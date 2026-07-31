import * as THREE from 'three'
import type { AppSettings, MidiModel, VisualNote } from '../shared/types'
import {
	applyDistanceVisibility,
	type DistanceVisibilityUniform,
} from './distance-visibility'
import {
	calculateLongNoteParticleCount,
	calculateLongNoteParticlePlacement,
	calculateLongNotePreFlashProgress,
	calculateNoteAppearance,
	clampLongNoteDissolveRangeRatio,
	clampLongNoteDissolveTriggerRatio,
	type NoteAppearanceMode,
} from './effect-tuning'
import { NoteImpactEffects } from './effects'
import { TrackLevelMeters } from './level-meters'
import { LongNoteDissolveEffects } from './long-note-dissolve'
import { TRACK_PALETTE } from './palette'

interface NoteObject {
	note: VisualNote
	mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>
	glow: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>
	distanceVisibilityUniform: DistanceVisibilityUniform
	longDissolveTriggered: boolean
}

const PITCH_PADDING = 3
const PITCH_STEP = 0.34
const HORIZONTAL_LIMIT = THREE.MathUtils.degToRad(60)
const MIN_VERTICAL_ANGLE = THREE.MathUtils.degToRad(-45)
const MAX_VERTICAL_ANGLE = THREE.MathUtils.degToRad(60)
const ORBIT_SPEED = THREE.MathUtils.degToRad(35)
const ZOOM_SPEED_RATIO = 0.8
const MIN_DISTANCE_RATIO = 0.2
const MAX_DISTANCE_RATIO = 4

export class MidiVisualizer {
	private readonly scene = new THREE.Scene()
	private readonly camera = new THREE.PerspectiveCamera()
	private readonly renderer: THREE.WebGLRenderer
	private readonly notesGroup = new THREE.Group()
	private readonly framesGroup = new THREE.Group()
	private readonly playheadGroup = new THREE.Group()
	private readonly effectsGroup = new THREE.Group()
	private readonly noteObjects: NoteObject[] = []
	private readonly impactEffects: NoteImpactEffects
	private readonly longDissolveEffects: LongNoteDissolveEffects
	private readonly levelMeters: TrackLevelMeters
	private model: MidiModel | null = null
	private settings: AppSettings
	private previousEffectSongSeconds: number | null = null
	private previousNoteSongTicks: number | null = null
	private nextEffectNoteIndex = 0
	private worldWidth = 1
	private worldHeight = 1
	private centerX = 0
	private centerY = 0
	private readonly cameraTarget = new THREE.Vector3()
	private orbitAzimuth = 0
	private orbitElevation = 0
	private orbitDistance = 1
	private initialOrbitElevation = 0
	private initialOrbitDistance = 1
	private cameraOrbitInitialized = false

	constructor(container: HTMLElement, settings: AppSettings) {
		this.settings = settings
		this.impactEffects = new NoteImpactEffects(this.effectsGroup, settings)
		this.longDissolveEffects = new LongNoteDissolveEffects(
			this.effectsGroup,
			settings,
		)
		this.levelMeters = new TrackLevelMeters(settings)
		this.renderer = new THREE.WebGLRenderer({
			antialias: true,
			alpha: false,
			powerPreference: 'high-performance',
		})
		this.renderer.setPixelRatio(1)
		this.renderer.setSize(window.innerWidth, window.innerHeight)
		this.renderer.outputColorSpace = THREE.SRGBColorSpace
		this.renderer.toneMapping = THREE.ACESFilmicToneMapping
		this.renderer.toneMappingExposure = 1.1
		container.appendChild(this.renderer.domElement)

		this.scene.fog = new THREE.FogExp2(settings.backgroundBottomColor, 0.018)
		this.scene.add(
			this.notesGroup,
			this.framesGroup,
			this.playheadGroup,
			this.levelMeters.group,
			this.effectsGroup,
		)
		this.scene.add(new THREE.AmbientLight(0xacc8ff, 0.5))

		const keyLight = new THREE.PointLight(0xffffff, 28, 100)
		keyLight.position.set(0, 8, 12)
		this.scene.add(keyLight)

		window.addEventListener('resize', this.resize)
		this.applyBackground()
	}

	load(model: MidiModel): void {
		this.model = model
		this.impactEffects.clear()
		this.longDissolveEffects.clear()
		this.levelMeters.clear()
		this.previousEffectSongSeconds = null
		this.previousNoteSongTicks = null
		this.nextEffectNoteIndex = 0
		this.clearGroup(this.notesGroup)
		this.clearGroup(this.framesGroup)
		this.clearGroup(this.playheadGroup)
		this.noteObjects.length = 0
		this.recalculateWorld()
		this.configureLevelMeters()
		this.buildNotes()
		this.buildFrames()
		this.buildPlayhead()
		this.updateCamera(true)
	}

	applySettings(settings: AppSettings): void {
		const previous = this.settings
		this.settings = settings
		this.impactEffects.applySettings(settings)
		this.longDissolveEffects.applySettings(settings)

		if (
			previous.longNoteFadeEnabled !== settings.longNoteFadeEnabled ||
			previous.longNoteFadeStartBeats !== settings.longNoteFadeStartBeats ||
			previous.longNoteFadeDurationBeats !==
				settings.longNoteFadeDurationBeats ||
			previous.showLongNoteDissolve !== settings.showLongNoteDissolve ||
			previous.longNoteDissolveTimingPercent !==
				settings.longNoteDissolveTimingPercent ||
			previous.longNoteDissolveRangePercent !==
				settings.longNoteDissolveRangePercent ||
			previous.longNoteDissolveMaxParticlesPerNote !==
				settings.longNoteDissolveMaxParticlesPerNote ||
			previous.longNoteDissolveParticleSize !==
				settings.longNoteDissolveParticleSize
		) {
			this.longDissolveEffects.clear()

			for (const object of this.noteObjects) {
				object.longDissolveTriggered = false
			}
		}

		if (!this.model) {
			this.applyBackground()
			return
		}

		const rebuildNotes =
			previous.noteSize !== settings.noteSize ||
			previous.noteOpacity !== settings.noteOpacity ||
			previous.timeUnitsPerSecond !== settings.timeUnitsPerSecond ||
			previous.trackSpacing !== settings.trackSpacing
		const rebuildFrames =
			previous.showMeasureFrames !== settings.showMeasureFrames ||
			previous.showBeatFrames !== settings.showBeatFrames ||
			previous.frameOpacity !== settings.frameOpacity ||
			previous.timeUnitsPerSecond !== settings.timeUnitsPerSecond ||
			previous.trackSpacing !== settings.trackSpacing

		this.recalculateWorld()
		this.configureLevelMeters()

		if (rebuildNotes) {
			this.longDissolveEffects.clear()
			this.clearGroup(this.notesGroup)
			this.noteObjects.length = 0
			this.buildNotes()
		}

		if (rebuildFrames) {
			this.clearGroup(this.framesGroup)
			this.clearGroup(this.playheadGroup)
			this.buildFrames()
			this.buildPlayhead()
		}

		this.applyBackground()
		this.updateCamera(false)
	}

	updateCameraControls(
		horizontalDirection: number,
		verticalDirection: number,
		zoomDirection: number,
		deltaSeconds: number,
	): void {
		if (!this.model || !this.cameraOrbitInitialized) {
			return
		}

		if (
			horizontalDirection === 0 &&
			verticalDirection === 0 &&
			zoomDirection === 0
		) {
			return
		}

		const safeDeltaSeconds = THREE.MathUtils.clamp(deltaSeconds, 0, 0.1)

		// Update the horizontal and vertical angles independently, then rebuild the
		// camera position from spherical coordinates to prevent accumulated roll.
		this.orbitAzimuth = THREE.MathUtils.clamp(
			this.orbitAzimuth + horizontalDirection * ORBIT_SPEED * safeDeltaSeconds,
			-HORIZONTAL_LIMIT,
			HORIZONTAL_LIMIT,
		)
		this.orbitElevation = THREE.MathUtils.clamp(
			this.orbitElevation + verticalDirection * ORBIT_SPEED * safeDeltaSeconds,
			MIN_VERTICAL_ANGLE,
			MAX_VERTICAL_ANGLE,
		)
		this.orbitDistance = THREE.MathUtils.clamp(
			this.orbitDistance -
				zoomDirection * this.initialOrbitDistance * ZOOM_SPEED_RATIO * safeDeltaSeconds,
			this.initialOrbitDistance * MIN_DISTANCE_RATIO,
			this.initialOrbitDistance * MAX_DISTANCE_RATIO,
		)
		this.applyCameraTransform()
	}

	resetCamera(): void {
		if (!this.model || !this.cameraOrbitInitialized) {
			return
		}

		this.orbitAzimuth = 0
		this.orbitElevation = this.initialOrbitElevation
		this.orbitDistance = this.initialOrbitDistance
		this.applyCameraTransform()
	}

	render(songSeconds: number): void {
		if (!this.model) {
			return
		}

		const timeOffset = songSeconds * this.settings.timeUnitsPerSecond
		this.notesGroup.position.z = timeOffset
		this.framesGroup.position.z = timeOffset
		this.updateNotes(songSeconds)
		this.updateNoteOnReactions(songSeconds)
		this.renderer.render(this.scene, this.camera)
	}

	dispose(): void {
		window.removeEventListener('resize', this.resize)
		this.impactEffects.dispose()
		this.longDissolveEffects.dispose()
		this.levelMeters.dispose()
		this.clearGroup(this.scene)
		this.renderer.dispose()
		this.renderer.domElement.remove()
	}

	private readonly resize = (): void => {
		const width = window.innerWidth
		const height = window.innerHeight
		this.renderer.setSize(width, height)
		this.camera.aspect = width / Math.max(height, 1)
		this.updateCamera(false)
	}

	private recalculateWorld(): void {
		if (!this.model) {
			return
		}

		this.worldWidth = Math.max(
			2.4,
			(this.model.trackCount - 1) * this.settings.trackSpacing + this.settings.noteSize + 1.4,
		)
		this.worldHeight =
			(this.model.maxPitch - this.model.minPitch + PITCH_PADDING * 2 + 1) * PITCH_STEP
		this.centerX = ((this.model.trackCount - 1) * this.settings.trackSpacing) / 2
		this.centerY =
			((this.model.minPitch + this.model.maxPitch) / 2 - (this.model.minPitch - PITCH_PADDING)) *
			PITCH_STEP
	}

	private buildNotes(): void {
		if (!this.model) {
			return
		}

		for (const note of this.model.notes) {
			const color = TRACK_PALETTE[note.trackIndex % TRACK_PALETTE.length]
			const duration = Math.max(
				0.08,
				(note.endSeconds - note.startSeconds) * this.settings.timeUnitsPerSecond,
			)
			const geometry = new THREE.BoxGeometry(
				this.settings.noteSize,
				this.settings.noteSize,
				duration,
			)
			const material = new THREE.MeshStandardMaterial({
				color,
				emissive: color,
				emissiveIntensity: this.settings.noteBaseEmissiveIntensity,
				transparent: true,
				opacity: this.settings.noteOpacity,
				roughness: 0.28,
				metalness: 0.08,
				depthWrite: false,
			})
			const distanceVisibilityUniform = {
				value: this.settings.distanceVisibility,
			}
			applyDistanceVisibility(material, distanceVisibilityUniform)
			const mesh = new THREE.Mesh(geometry, material)
			mesh.position.set(
				note.trackIndex * this.settings.trackSpacing,
				this.pitchToY(note.pitch),
				-((note.startSeconds + note.endSeconds) / 2) * this.settings.timeUnitsPerSecond,
			)

			const glowMaterial = new THREE.MeshBasicMaterial({
				color,
				transparent: true,
				opacity: 0,
				blending: THREE.AdditiveBlending,
				depthWrite: false,
			})
			const glow = new THREE.Mesh(geometry, glowMaterial)
			glow.scale.set(1.3, 2.2, 1.04)
			glow.visible = false
			mesh.add(glow)
			this.notesGroup.add(mesh)
			this.noteObjects.push({
				note,
				mesh,
				glow,
				distanceVisibilityUniform,
				longDissolveTriggered: false,
			})
		}
	}

	private buildFrames(): void {
		if (!this.model) {
			return
		}

		if (this.settings.showMeasureFrames) {
			for (const marker of this.model.measureMarkers) {
				this.framesGroup.add(
					this.createFrame(
						-marker.seconds * this.settings.timeUnitsPerSecond,
						0x79bfff,
						this.settings.frameOpacity,
					),
				)
			}
		}

		if (this.settings.showBeatFrames) {
			for (const marker of this.model.beatMarkers) {
				this.framesGroup.add(
					this.createFrame(
						-marker.seconds * this.settings.timeUnitsPerSecond,
						0x5680aa,
						this.settings.frameOpacity * 0.32,
					),
				)
			}
		}
	}

	private buildPlayhead(): void {
		const frame = this.createFrame(0, 0xc7f3ff, 0.72)
		this.playheadGroup.add(frame)
	}

	private createFrame(z: number, color: number, opacity: number): THREE.LineLoop {
		const left = this.centerX - this.worldWidth / 2
		const right = this.centerX + this.worldWidth / 2
		const bottom = this.centerY - this.worldHeight / 2
		const top = this.centerY + this.worldHeight / 2
		const points = [
			new THREE.Vector3(left, bottom, z),
			new THREE.Vector3(right, bottom, z),
			new THREE.Vector3(right, top, z),
			new THREE.Vector3(left, top, z),
		]
		const geometry = new THREE.BufferGeometry().setFromPoints(points)
		const material = new THREE.LineBasicMaterial({
			color,
			transparent: true,
			opacity,
			blending: THREE.AdditiveBlending,
			depthWrite: false,
		})

		return new THREE.LineLoop(geometry, material)
	}

	private updateNotes(songSeconds: number): void {
		if (!this.model) {
			return
		}

		const visibleFuture = this.settings.lookAheadSeconds + 2
		const songTicks = this.secondsToTicks(songSeconds)

		if (
			this.previousNoteSongTicks !== null &&
			songTicks < this.previousNoteSongTicks
		) {
			this.longDissolveEffects.clear()

			for (const object of this.noteObjects) {
				object.longDissolveTriggered = false
			}
		}

		this.previousNoteSongTicks = songTicks
		const fadeStartBeats = Math.max(0, this.settings.longNoteFadeStartBeats)
		const configuredFadeDurationBeats = Math.max(
			0.000001,
			this.settings.longNoteFadeDurationBeats,
		)
		const configuredFadeEndBeats =
			fadeStartBeats + configuredFadeDurationBeats

		for (const object of this.noteObjects) {
			const { note, mesh, glow, distanceVisibilityUniform } = object
			distanceVisibilityUniform.value = this.settings.distanceVisibility
			const timeUntilStart = note.startSeconds - songSeconds
			const timeSinceEnd = songSeconds - note.endSeconds
			const active = songSeconds >= note.startSeconds && songSeconds <= note.endSeconds
			const afterglow =
				timeSinceEnd > 0 && timeSinceEnd <= this.settings.noteAfterglowSeconds
			const durationBeats =
				(note.endTicks - note.startTicks) / this.model.beatTicks
			const elapsedBeats = (songTicks - note.startTicks) / this.model.beatTicks
			const longFadeApplies =
				this.settings.longNoteFadeEnabled &&
				durationBeats > fadeStartBeats
			const effectiveFadeEndBeats = Math.min(
				configuredFadeEndBeats,
				durationBeats,
			)
			const longFadeStarted =
				longFadeApplies && elapsedBeats >= fadeStartBeats
			const dissolveTriggerRatio = clampLongNoteDissolveTriggerRatio(
				this.settings.longNoteDissolveTimingPercent / 100,
			)
			const dissolveTriggerBeats =
				fadeStartBeats +
				(effectiveFadeEndBeats - fadeStartBeats) *
					dissolveTriggerRatio
			const fadeEndTicks =
				note.startTicks +
				effectiveFadeEndBeats * this.model.beatTicks
			const dissolveTriggerTicks =
				note.startTicks +
				dissolveTriggerBeats * this.model.beatTicks
			const fadeEndSeconds = this.ticksToSeconds(fadeEndTicks)
			const dissolveTriggerSeconds = this.ticksToSeconds(
				dissolveTriggerTicks,
			)
			const plannedDissolveDurationSeconds = Math.max(
				0,
				fadeEndSeconds - dissolveTriggerSeconds,
			)
			const dissolveReady =
				longFadeStarted &&
				this.longDissolveEffects.canTrigger(
					plannedDissolveDurationSeconds,
				)
			const preFlashProgress = calculateLongNotePreFlashProgress(
				songSeconds,
				dissolveTriggerSeconds,
				this.settings.longNoteDissolvePreFlashSeconds,
				dissolveReady,
			)

			if (
				dissolveReady &&
				elapsedBeats >= dissolveTriggerBeats &&
				elapsedBeats < effectiveFadeEndBeats &&
				!object.longDissolveTriggered
			) {
				object.longDissolveTriggered =
					this.longDissolveEffects.trigger({
						positions: this.createLongDissolvePositions(
							note,
							songSeconds,
						),
						color:
							TRACK_PALETTE[
								note.trackIndex % TRACK_PALETTE.length
							],
						durationSeconds: Math.max(
							0,
							fadeEndSeconds - songSeconds,
						),
					})
			}

			const longFadeComplete =
				longFadeStarted && elapsedBeats >= effectiveFadeEndBeats
			const endedAfterLongFade = longFadeApplies && timeSinceEnd > 0
			mesh.visible =
				timeUntilStart <= visibleFuture &&
				timeSinceEnd <= this.settings.noteAfterglowSeconds &&
				!longFadeComplete &&
				!endedAfterLongFade &&
				!object.longDissolveTriggered

			if (!mesh.visible) {
				glow.visible = false
				continue
			}

			let appearanceMode: NoteAppearanceMode = 'idle'
			let appearanceRemaining = 1

			if (active && longFadeStarted) {
				const fadeDurationBeats = Math.max(
					0.000001,
					effectiveFadeEndBeats - fadeStartBeats,
				)
				const fadeProgress = THREE.MathUtils.clamp(
					(elapsedBeats - fadeStartBeats) / fadeDurationBeats,
					0,
					1,
				)
				appearanceMode = 'longFade'
				appearanceRemaining = 1 - fadeProgress
			} else if (active) {
				appearanceMode = 'active'
			} else if (afterglow) {
				appearanceMode = 'afterglow'
				appearanceRemaining =
					1 - timeSinceEnd / this.settings.noteAfterglowSeconds
			}

			const appearance = calculateNoteAppearance({
				mode: appearanceMode,
				velocity: note.velocity,
				remaining: appearanceRemaining,
				preFlashProgress,
				baseEmissiveIntensity:
					this.settings.noteBaseEmissiveIntensity,
				glowIntensity: this.settings.noteGlowIntensity,
				noteOpacity: this.settings.noteOpacity,
			})
			mesh.material.emissiveIntensity = appearance.emissiveIntensity
			mesh.material.opacity = appearance.noteOpacity
			glow.material.opacity = appearance.glowOpacity
			glow.visible = appearance.glowVisible
		}
	}

	private secondsToTicks(seconds: number): number {
		if (!this.model) {
			return 0
		}

		const timelineSeconds = Math.max(0, seconds)
		let low = 0
		let high = this.model.tempoMarkers.length

		while (low < high) {
			const middle = Math.floor((low + high) / 2)

			if (this.model.tempoMarkers[middle].seconds <= timelineSeconds) {
				low = middle + 1
			} else {
				high = middle
			}
		}

		const marker = this.model.tempoMarkers[Math.max(0, low - 1)]
		const elapsedSeconds = timelineSeconds - marker.seconds
		const ticksPerSecond = (this.model.ppq * marker.bpm) / 60

		return marker.ticks + elapsedSeconds * ticksPerSecond
	}

	private ticksToSeconds(ticks: number): number {
		if (!this.model) {
			return 0
		}

		let low = 0
		let high = this.model.tempoMarkers.length

		while (low < high) {
			const middle = Math.floor((low + high) / 2)

			if (this.model.tempoMarkers[middle].ticks <= ticks) {
				low = middle + 1
			} else {
				high = middle
			}
		}

		const marker = this.model.tempoMarkers[Math.max(0, low - 1)]
		const elapsedTicks = ticks - marker.ticks
		const ticksPerSecond = (this.model.ppq * marker.bpm) / 60

		return marker.seconds + elapsedTicks / ticksPerSecond
	}

	private createLongDissolvePositions(
		note: VisualNote,
		songSeconds: number,
	): THREE.Vector3[] {
		if (!this.model) {
			return []
		}

		const rangeRatio = clampLongNoteDissolveRangeRatio(
			this.settings.longNoteDissolveRangePercent / 100,
		)
		const visibleFarTicks = this.secondsToTicks(
			songSeconds + this.settings.lookAheadSeconds,
		)
		const rangeEndTicks = Math.min(note.endTicks, visibleFarTicks)
		const requestedRangeTicks =
			(note.endTicks - note.startTicks) * rangeRatio
		const rangeStartTicks = Math.max(
			note.startTicks,
			rangeEndTicks - requestedRangeTicks,
		)
		const rangeBeats =
			(rangeEndTicks - rangeStartTicks) / this.model.beatTicks
		const particleCount = calculateLongNoteParticleCount(
			rangeBeats,
			this.settings.longNoteDissolveMaxParticlesPerNote,
		)
		const positions: THREE.Vector3[] = []

		for (let index = 0; index < particleCount; index += 1) {
			const placement = calculateLongNoteParticlePlacement(
				index,
				particleCount,
				this.settings.noteSize,
			)
			const particleTicks = THREE.MathUtils.lerp(
				rangeStartTicks,
				rangeEndTicks,
				placement.intervalProgress,
			)
			const particleSeconds = this.ticksToSeconds(particleTicks)
			positions.push(
				new THREE.Vector3(
					note.trackIndex * this.settings.trackSpacing +
						placement.xOffset,
					this.pitchToY(note.pitch) +
						placement.yOffset,
					(songSeconds - particleSeconds) *
						this.settings.timeUnitsPerSecond,
				),
			)
		}

		return positions
	}

	private updateNoteOnReactions(songSeconds: number): void {
		if (!this.model) {
			return
		}

		if (
			this.previousEffectSongSeconds === null ||
			songSeconds < this.previousEffectSongSeconds
		) {
			this.impactEffects.clear()
			this.levelMeters.clear()
			this.nextEffectNoteIndex = this.findFirstNoteAfter(songSeconds)
			this.previousEffectSongSeconds = songSeconds
			return
		}

		while (this.nextEffectNoteIndex < this.model.notes.length) {
			const note = this.model.notes[this.nextEffectNoteIndex]

			if (note.startSeconds > songSeconds) {
				break
			}

			if (note.startSeconds > this.previousEffectSongSeconds) {
				const color = TRACK_PALETTE[note.trackIndex % TRACK_PALETTE.length]
				this.impactEffects.trigger(
					note.trackIndex * this.settings.trackSpacing,
					this.pitchToY(note.pitch),
					color,
					note.velocity,
				)
				this.levelMeters.trigger(note.trackIndex, note.velocity)
			}

			this.nextEffectNoteIndex += 1
		}

		const deltaSeconds = songSeconds - this.previousEffectSongSeconds
		this.impactEffects.update(deltaSeconds)
		this.longDissolveEffects.update(deltaSeconds)
		this.levelMeters.update(deltaSeconds)
		this.previousEffectSongSeconds = songSeconds
	}

	private configureLevelMeters(): void {
		if (!this.model) {
			return
		}

		this.levelMeters.configure(this.settings, {
			trackCount: this.model.trackCount,
			trackSpacing: this.settings.trackSpacing,
			bottomY: this.centerY - this.worldHeight / 2,
			worldHeight: this.worldHeight,
		})
	}

	private findFirstNoteAfter(songSeconds: number): number {
		if (!this.model) {
			return 0
		}

		let low = 0
		let high = this.model.notes.length

		while (low < high) {
			const middle = Math.floor((low + high) / 2)

			if (this.model.notes[middle].startSeconds <= songSeconds) {
				low = middle + 1
			} else {
				high = middle
			}
		}

		return low
	}

	private updateCamera(resetOrbit: boolean): void {
		if (!this.model) {
			return
		}

		const previousInitialDistance = this.initialOrbitDistance
		const previousDistanceRatio =
			previousInitialDistance > 0 ? this.orbitDistance / previousInitialDistance : 1
		this.camera.fov = this.settings.cameraFov
		this.camera.aspect = window.innerWidth / Math.max(window.innerHeight, 1)
		this.camera.near = 0.1
		const verticalFov = THREE.MathUtils.degToRad(this.camera.fov)
		const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * this.camera.aspect)
		const fitHeightDistance = (this.worldHeight / 2) / Math.tan(verticalFov / 2)
		const fitWidthDistance = (this.worldWidth / 2) / Math.tan(horizontalFov / 2)
		const forwardDistance = Math.max(fitHeightDistance, fitWidthDistance) * 1.3 + 5
		const verticalOffset = this.worldHeight * 0.1
		this.cameraTarget.set(this.centerX, this.centerY, 0)
		this.initialOrbitDistance = Math.hypot(forwardDistance, verticalOffset)
		this.initialOrbitElevation = Math.atan2(verticalOffset, forwardDistance)
		this.camera.far = Math.max(
			500,
			this.initialOrbitDistance * MAX_DISTANCE_RATIO +
				this.settings.lookAheadSeconds * this.settings.timeUnitsPerSecond * 2,
		)

		if (resetOrbit || !this.cameraOrbitInitialized) {
			this.orbitAzimuth = 0
			this.orbitElevation = this.initialOrbitElevation
			this.orbitDistance = this.initialOrbitDistance
			this.cameraOrbitInitialized = true
		} else {
			this.orbitDistance = THREE.MathUtils.clamp(
				this.initialOrbitDistance * previousDistanceRatio,
				this.initialOrbitDistance * MIN_DISTANCE_RATIO,
				this.initialOrbitDistance * MAX_DISTANCE_RATIO,
			)
			this.orbitElevation = THREE.MathUtils.clamp(
				this.orbitElevation,
				MIN_VERTICAL_ANGLE,
				MAX_VERTICAL_ANGLE,
			)
		}

		this.camera.updateProjectionMatrix()
		this.applyCameraTransform()
	}

	private applyCameraTransform(): void {
		const horizontalDistance = this.orbitDistance * Math.cos(this.orbitElevation)

		this.camera.position.set(
			this.cameraTarget.x + horizontalDistance * Math.sin(this.orbitAzimuth),
			this.cameraTarget.y + this.orbitDistance * Math.sin(this.orbitElevation),
			this.cameraTarget.z + horizontalDistance * Math.cos(this.orbitAzimuth),
		)
		this.camera.up.set(0, 1, 0)
		this.camera.lookAt(this.cameraTarget)
	}

	private applyBackground(): void {
		const top = new THREE.Color(this.settings.backgroundTopColor)
		const bottom = new THREE.Color(this.settings.backgroundBottomColor)
		const canvas = document.createElement('canvas')
		canvas.width = 2
		canvas.height = 512
		const context = canvas.getContext('2d')

		if (!context) {
			this.scene.background = bottom
			return
		}

		const gradient = context.createLinearGradient(0, 0, 0, canvas.height)
		gradient.addColorStop(0, `#${top.getHexString()}`)
		gradient.addColorStop(1, `#${bottom.getHexString()}`)
		context.fillStyle = gradient
		context.fillRect(0, 0, canvas.width, canvas.height)

		const previous = this.scene.background
		this.scene.background = new THREE.CanvasTexture(canvas)

		if (previous instanceof THREE.Texture) {
			previous.dispose()
		}

		if (this.scene.fog instanceof THREE.FogExp2) {
			this.scene.fog.color.copy(bottom)
		}
	}

	private pitchToY(pitch: number): number {
		if (!this.model) {
			return 0
		}

		return (pitch - (this.model.minPitch - PITCH_PADDING)) * PITCH_STEP
	}

	private clearGroup(group: THREE.Object3D): void {
		for (const child of [...group.children]) {
			child.traverse((object) => {
				if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) {
					object.geometry.dispose()
					const materials = Array.isArray(object.material) ? object.material : [object.material]
					for (const material of materials) {
						material.dispose()
					}
				}
			})
			group.remove(child)
		}
	}
}
