import * as THREE from 'three'
import type { AppSettings } from '../shared/types'
import { TRACK_PALETTE } from './palette'

interface MeterState {
	level: number
	peakLevel: number
	holdRemaining: number
	releaseElapsed: number
}

interface MeterLayout {
	trackCount: number
	trackSpacing: number
	bottomY: number
	worldHeight: number
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
const METER_Z = 0.025
const INACTIVE_SCALE = 0.000001

const WHITE_METER_COLOR = 0xf4f8ff
const BLUE_METER_COLOR = 0x55bfff

export class TrackLevelMeters {
	readonly group = new THREE.Group()

	private readonly segmentGeometry = new THREE.PlaneGeometry(1, 1)
	private readonly states: MeterState[] = []
	private readonly zones: MeterZone[] = []
	private readonly matrix = new THREE.Matrix4()
	private readonly position = new THREE.Vector3()
	private readonly scale = new THREE.Vector3()
	private readonly rotation = new THREE.Quaternion()
	private settings: AppSettings
	private layout: MeterLayout | null = null
	private instancesDirty = false

	constructor(settings: AppSettings) {
		this.settings = settings
		this.group.visible = settings.showLevelMeters
	}

	configure(settings: AppSettings, layout: MeterLayout): void {
		const trackCountChanged = this.layout?.trackCount !== layout.trackCount
		const sensitivityChanged =
			this.settings.levelMeterSensitivity !== settings.levelMeterSensitivity
		this.settings = settings
		this.layout = layout
		this.group.visible = settings.showLevelMeters

		if (trackCountChanged || sensitivityChanged || this.zones.length === 0) {
			this.build(layout.trackCount)
		}

		if (!settings.showLevelMeters) {
			this.clear()
			return
		}

		this.updateMaterialsAndColors()
		this.updateInstances()
	}

	trigger(trackIndex: number, velocity: number): void {
		if (!this.settings.showLevelMeters) {
			return
		}

		const state = this.states[trackIndex]

		if (!state) {
			return
		}

		const normalizedVelocity = THREE.MathUtils.clamp(velocity, 0, 1)

		if (normalizedVelocity >= state.level) {
			state.level = normalizedVelocity
			state.peakLevel = normalizedVelocity
			state.holdRemaining = PEAK_HOLD_SECONDS
			state.releaseElapsed = 0
			this.instancesDirty = true
		}
	}

	update(deltaSeconds: number): void {
		if (!this.settings.showLevelMeters || deltaSeconds <= 0) {
			return
		}

		const safeDeltaSeconds = Math.max(0, deltaSeconds)
		let changed = this.instancesDirty

		for (const state of this.states) {
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
		for (const state of this.states) {
			state.level = 0
			state.peakLevel = 0
			state.holdRemaining = 0
			state.releaseElapsed = 0
		}

		this.updateInstances()
		this.instancesDirty = false
	}

	dispose(): void {
		this.clearMeshes()
		this.segmentGeometry.dispose()
	}

	private build(trackCount: number): void {
		this.clearMeshes()
		this.states.length = 0
		const { lowEnd, mediumEnd } = this.getZoneBoundaries()

		for (let trackIndex = 0; trackIndex < trackCount; trackIndex += 1) {
			this.states.push({
				level: 0,
				peakLevel: 0,
				holdRemaining: 0,
				releaseElapsed: 0,
			})
		}

		this.zones.push(
			this.createZone(0, lowEnd, 0.4, 0x45d65b, trackCount),
			this.createZone(
				lowEnd,
				mediumEnd,
				0.7,
				0xffd84a,
				trackCount,
			),
			this.createZone(
				mediumEnd,
				TOTAL_SEGMENTS,
				1,
				0xff4a4a,
				trackCount,
			),
		)
	}

	private getZoneBoundaries(): { lowEnd: number; mediumEnd: number } {
		const sensitivity =
			THREE.MathUtils.clamp(this.settings.levelMeterSensitivity, 0, 100) /
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
		const material = new THREE.MeshBasicMaterial({
			color: 0xffffff,
			transparent: true,
			opacity: this.settings.levelMeterOpacity * opacityRatio,
			blending: THREE.NormalBlending,
			depthWrite: false,
			depthTest: true,
		})
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

		for (const zone of this.zones) {
			zone.mesh.material.opacity =
				this.settings.levelMeterOpacity * zone.opacityRatio
			const segmentCount = zone.endSegment - zone.startSegment

			for (let trackIndex = 0; trackIndex < this.layout.trackCount; trackIndex += 1) {
				const color = this.getColor(zone, trackIndex)

				for (let localSegment = 0; localSegment < segmentCount; localSegment += 1) {
					const instanceIndex = trackIndex * segmentCount + localSegment
					zone.mesh.setColorAt(instanceIndex, color)
				}
			}

			if (zone.mesh.instanceColor) {
				zone.mesh.instanceColor.needsUpdate = true
			}
		}
	}

	private getColor(zone: MeterZone, trackIndex: number): THREE.Color {
		switch (this.settings.levelMeterColorMode) {
			case 'white':
				return new THREE.Color(WHITE_METER_COLOR)
			case 'blue':
				return new THREE.Color(BLUE_METER_COLOR)
			case 'track':
				return new THREE.Color(
					TRACK_PALETTE[trackIndex % TRACK_PALETTE.length],
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

		const maxHeight =
			this.layout.worldHeight *
			(this.settings.levelMeterMaxHeightPercent / 100)
		const cellHeight = maxHeight / TOTAL_SEGMENTS
		const segmentHeight = cellHeight * SEGMENT_HEIGHT_RATIO
		const meterWidth =
			this.layout.trackSpacing * (this.settings.levelMeterWidthPercent / 100)

		for (const zone of this.zones) {
			const segmentCount = zone.endSegment - zone.startSegment

			for (let trackIndex = 0; trackIndex < this.layout.trackCount; trackIndex += 1) {
				const state = this.states[trackIndex]
				const activeSegmentCount = Math.ceil(
					THREE.MathUtils.clamp(state.level, 0, 1) * TOTAL_SEGMENTS,
				)

				for (let localSegment = 0; localSegment < segmentCount; localSegment += 1) {
					const segmentIndex = zone.startSegment + localSegment
					const instanceIndex = trackIndex * segmentCount + localSegment
					const active = segmentIndex < activeSegmentCount
					this.position.set(
						trackIndex * this.layout.trackSpacing,
						this.layout.bottomY + (segmentIndex + 0.5) * cellHeight,
						METER_Z,
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
}
