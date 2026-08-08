import * as THREE from 'three'
import {
	applyDistanceVisibility,
	type DistanceVisibilityUniform,
} from '../core/distance-visibility'
import type { StageLayout } from '../core/stage-layout'
import type { TrackId } from '../../shared/tracks'
import {
	type StageContext,
	type StageSettingsChange,
} from '../stage-context'

export interface LevelMeterTriggerRequest {
	trackId: TrackId
	velocity: number
}

interface MeterState {
	level: number
	peakLevel: number
	holdRemaining: number
	releaseElapsed: number
}

interface MeterZone {
	startSegment: number
	endSegment: number
	opacityRatio: number
	normalColor: number
	mesh: THREE.InstancedMesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
}

const TOTAL_SEGMENTS = 20
const DEFAULT_LOW_SEGMENT_END = 14
const DEFAULT_MEDIUM_SEGMENT_END = 18
const SENSITIVE_LOW_SEGMENT_END = 6
const SENSITIVE_MEDIUM_SEGMENT_END = 14
const PEAK_HOLD_SECONDS = 0.08
const RELEASE_SECONDS = 0.52
const SEGMENT_HEIGHT_RATIO = 0.72
const Z_FIGHTING_OFFSET = 0.025
const INACTIVE_SCALE = 0.000001

const WHITE_METER_COLOR = 0xf4f8ff
const BLUE_METER_COLOR = 0x55bfff

export class TrackLevelMeters {
	readonly group = new THREE.Group()

	private readonly segmentGeometry = new THREE.PlaneGeometry(1, 1)
	private readonly states = new Map<TrackId, MeterState>()
	private readonly zones: MeterZone[] = []
	private readonly matrix = new THREE.Matrix4()
	private readonly position = new THREE.Vector3()
	private readonly scale = new THREE.Vector3()
	private readonly rotation = new THREE.Quaternion()
	private readonly distanceVisibilityUniform: DistanceVisibilityUniform
	private readonly unsubscribeSettings: () => void
	private layout: StageLayout | null = null
	private instancesDirty = false

	constructor(private readonly context: StageContext) {
		const settings = context.settings
		this.distanceVisibilityUniform = {
			value: settings.distanceVisibility,
		}
		this.group.visible = settings.showLevelMeters
		this.unsubscribeSettings = context.subscribe((change) => {
			this.handleSettingsChanged(change)
		})
	}

	configure(layout: StageLayout): void {
		const settings = this.context.settings
		const tracksChanged =
			!this.layout || !this.hasSameTrackIds(this.layout, layout)
		this.distanceVisibilityUniform.value = settings.distanceVisibility
		this.layout = layout
		this.group.visible = settings.showLevelMeters

		if (tracksChanged || this.zones.length === 0) {
			this.build(layout)
		}

		if (!settings.showLevelMeters) {
			this.clear()
			return
		}

		this.updateMaterialsAndColors()
		this.updateInstances()
	}

	trigger(request: LevelMeterTriggerRequest): void {
		if (!this.context.settings.showLevelMeters) {
			return
		}

		const state = this.states.get(request.trackId)

		if (!state) {
			return
		}

		const normalizedVelocity = THREE.MathUtils.clamp(
			request.velocity,
			0,
			1,
		)

		if (normalizedVelocity >= state.level) {
			state.level = normalizedVelocity
			state.peakLevel = normalizedVelocity
			state.holdRemaining = PEAK_HOLD_SECONDS
			state.releaseElapsed = 0
			this.instancesDirty = true
		}
	}

	update(deltaSeconds: number): void {
		if (!this.context.settings.showLevelMeters || deltaSeconds <= 0) {
			return
		}

		const safeDeltaSeconds = Math.max(0, deltaSeconds)
		let changed = this.instancesDirty

		for (const state of this.states.values()) {
			if (state.level <= 0) {
				continue
			}

			let releaseDelta = safeDeltaSeconds

			if (state.holdRemaining > 0) {
				const heldSeconds = Math.min(state.holdRemaining, releaseDelta)
				state.holdRemaining -= heldSeconds
				releaseDelta -= heldSeconds
			}

			if (releaseDelta > 0) {
				state.releaseElapsed += releaseDelta
				const progress = THREE.MathUtils.clamp(
					state.releaseElapsed / RELEASE_SECONDS,
					0,
					1,
				)
				state.level = state.peakLevel * (1 - progress)
				changed = true
			}
		}

		if (changed) {
			this.updateInstances()
			this.instancesDirty = false
		}
	}

	clear(): void {
		for (const state of this.states.values()) {
			state.level = 0
			state.peakLevel = 0
			state.holdRemaining = 0
			state.releaseElapsed = 0
		}

		this.updateInstances()
		this.instancesDirty = false
	}

	dispose(): void {
		this.unsubscribeSettings()
		this.clearMeshes()
		this.segmentGeometry.dispose()
	}

	private handleSettingsChanged({
		previous,
		current,
	}: StageSettingsChange): void {
		const sensitivityChanged =
			previous.levelMeterSensitivity !== current.levelMeterSensitivity
		this.distanceVisibilityUniform.value = current.distanceVisibility
		this.group.visible = current.showLevelMeters

		if (this.layout && (sensitivityChanged || this.zones.length === 0)) {
			this.build(this.layout)
		}

		if (!current.showLevelMeters) {
			this.clear()
			return
		}

		this.updateMaterialsAndColors()
		this.updateInstances()
	}

	private build(layout: StageLayout): void {
		this.clearMeshes()
		this.states.clear()
		const { lowEnd, mediumEnd } = this.getZoneBoundaries()

		for (const track of layout.tracks) {
			this.states.set(track.id, {
				level: 0,
				peakLevel: 0,
				holdRemaining: 0,
				releaseElapsed: 0,
			})
		}

		this.zones.push(
			this.createZone(0, lowEnd, 0.4, 0x45d65b, layout.trackCount),
			this.createZone(
				lowEnd,
				mediumEnd,
				0.7,
				0xffd84a,
				layout.trackCount,
			),
			this.createZone(
				mediumEnd,
				TOTAL_SEGMENTS,
				1,
				0xff4a4a,
				layout.trackCount,
			),
		)
	}

	private getZoneBoundaries(): { lowEnd: number; mediumEnd: number } {
		const sensitivity =
			THREE.MathUtils.clamp(
				this.context.settings.levelMeterSensitivity,
				0,
				100,
			) /
			100

		return {
			lowEnd: Math.round(
				THREE.MathUtils.lerp(
					DEFAULT_LOW_SEGMENT_END,
					SENSITIVE_LOW_SEGMENT_END,
					sensitivity,
				),
			),
			mediumEnd: Math.round(
				THREE.MathUtils.lerp(
					DEFAULT_MEDIUM_SEGMENT_END,
					SENSITIVE_MEDIUM_SEGMENT_END,
					sensitivity,
				),
			),
		}
	}

	private createZone(
		startSegment: number,
		endSegment: number,
		opacityRatio: number,
		normalColor: number,
		trackCount: number,
	): MeterZone {
		const segmentCount = endSegment - startSegment
		const settings = this.context.settings
		const material = new THREE.MeshBasicMaterial({
			color: 0xffffff,
			transparent: true,
			opacity: settings.levelMeterOpacity * opacityRatio,
			blending: THREE.NormalBlending,
			depthWrite: false,
			depthTest: true,
		})
		applyDistanceVisibility(
			material,
			this.distanceVisibilityUniform,
		)
		const mesh = new THREE.InstancedMesh(
			this.segmentGeometry,
			material,
			trackCount * segmentCount,
		)
		mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
		mesh.frustumCulled = false
		mesh.renderOrder = 3
		this.group.add(mesh)

		return {
			startSegment,
			endSegment,
			opacityRatio,
			normalColor,
			mesh,
		}
	}

	private updateMaterialsAndColors(): void {
		if (!this.layout) {
			return
		}

		const settings = this.context.settings

		for (const zone of this.zones) {
			zone.mesh.material.opacity =
				settings.levelMeterOpacity * zone.opacityRatio
			const segmentCount = zone.endSegment - zone.startSegment

			for (
				let displayIndex = 0;
				displayIndex < this.layout.trackCount;
				displayIndex += 1
			) {
				const track = this.layout.trackAt(displayIndex)
				const color = this.getColor(zone, track.id)

				for (
					let localSegment = 0;
					localSegment < segmentCount;
					localSegment += 1
				) {
					const instanceIndex = displayIndex * segmentCount + localSegment
					zone.mesh.setColorAt(instanceIndex, color)
				}
			}

			if (zone.mesh.instanceColor) {
				zone.mesh.instanceColor.needsUpdate = true
			}
		}
	}

	private getColor(zone: MeterZone, trackId: TrackId): THREE.Color {
		switch (this.context.settings.levelMeterColorMode) {
			case 'white':
				return new THREE.Color(WHITE_METER_COLOR)
			case 'blue':
				return new THREE.Color(BLUE_METER_COLOR)
			case 'track':
				return new THREE.Color(
					this.layout?.trackToColor(trackId) ?? WHITE_METER_COLOR,
				)
			case 'normal':
			default:
				return new THREE.Color(zone.normalColor)
		}
	}

	private updateInstances(): void {
		if (!this.layout || this.zones.length === 0) {
			return
		}

		const settings = this.context.settings
		const maxHeight =
			this.layout.worldHeight *
			(settings.levelMeterMaxHeightPercent / 100)
		const cellHeight = maxHeight / TOTAL_SEGMENTS
		const segmentHeight = cellHeight * SEGMENT_HEIGHT_RATIO
		const meterWidth =
			this.layout.trackSpacing * (settings.levelMeterWidthPercent / 100)

		for (const zone of this.zones) {
			const segmentCount = zone.endSegment - zone.startSegment

			for (
				let displayIndex = 0;
				displayIndex < this.layout.trackCount;
				displayIndex += 1
			) {
				const track = this.layout.trackAt(displayIndex)
				const state = this.states.get(track.id)

				if (!state) {
					continue
				}

				const activeSegmentCount = Math.ceil(
					THREE.MathUtils.clamp(state.level, 0, 1) * TOTAL_SEGMENTS,
				)

				for (
					let localSegment = 0;
					localSegment < segmentCount;
					localSegment += 1
				) {
					const segmentIndex = zone.startSegment + localSegment
					const instanceIndex = displayIndex * segmentCount + localSegment
					const active = segmentIndex < activeSegmentCount
					this.position.set(
						this.layout.trackToX(track.id),
						this.layout.bottomY + (segmentIndex + 0.5) * cellHeight,
						Z_FIGHTING_OFFSET - settings.levelMeterDepthOffset,
					)
					this.scale.set(
						active ? meterWidth : INACTIVE_SCALE,
						active ? segmentHeight : INACTIVE_SCALE,
						1,
					)
					this.matrix.compose(this.position, this.rotation, this.scale)
					zone.mesh.setMatrixAt(instanceIndex, this.matrix)
				}
			}

			zone.mesh.instanceMatrix.needsUpdate = true
		}
	}

	private clearMeshes(): void {
		for (const zone of this.zones) {
			this.group.remove(zone.mesh)
			zone.mesh.material.dispose()
		}

		this.zones.length = 0
	}

	private hasSameTrackIds(
		left: StageLayout,
		right: StageLayout,
	): boolean {
		if (left.trackCount !== right.trackCount) {
			return false
		}

		const rightTrackIds = new Set(right.tracks.map((track) => track.id))

		return left.tracks.every((track) => rightTrackIds.has(track.id))
	}
}
