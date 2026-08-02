import * as THREE from 'three'
import type { AppSettings, VisualNote } from '../shared/types'
import {
	applyDistanceVisibility,
	type DistanceVisibilityUniform,
} from './distance-visibility'
import {
	calculateLongFadeNoteAppearance,
	calculateLongNoteParticleCount,
	calculateLongNoteParticlePlacement,
	calculateLongNotePreFlashProgress,
	clampLongNoteDissolveRangeRatio,
	clampLongNoteDissolveTriggerRatio,
} from './effect-tuning/long-note'
import {
	calculateNoteAppearance,
	type NoteAppearance,
	type NoteAppearanceMode,
} from './effect-tuning/note'
import type { LongNoteDissolveEffects } from './long-note-dissolve'
import type { MidiTimeMap } from './midi-time-map'
import { TRACK_PALETTE } from './palette'
import type { StageContext } from './stage-context'
import type { StageLayout } from './stage-layout'

export interface NoteUpdateFrame {
	songSeconds: number
	songTicks: number
	visibleFutureSeconds: number
	fadeStartBeats: number
	configuredFadeEndBeats: number
}

interface NoteTiming {
	timeUntilStart: number
	timeSinceEnd: number
	active: boolean
	afterglow: boolean
	durationBeats: number
	elapsedBeats: number
}

interface LongFadeState {
	applies: boolean
	started: boolean
	effectiveEndBeats: number
	dissolveTriggerBeats: number
	fadeEndSeconds: number
	dissolveReady: boolean
	preFlashProgress: number
	complete: boolean
}

export class RenderedNote {
	readonly object: THREE.Mesh<
		THREE.BoxGeometry,
		THREE.MeshStandardMaterial
	>

	private readonly glow: THREE.Mesh<
		THREE.BoxGeometry,
		THREE.MeshBasicMaterial
	>
	private readonly distanceVisibilityUniform: DistanceVisibilityUniform
	private readonly color: number
	private longDissolveTriggered = false

	constructor(
		private readonly note: VisualNote,
		private readonly beatTicks: number,
		private readonly context: StageContext,
		private readonly timeMap: MidiTimeMap,
		private readonly layout: StageLayout,
		private readonly dissolveEffects: LongNoteDissolveEffects,
	) {
		const settings = context.settings
		this.color =
			TRACK_PALETTE[note.trackIndex % TRACK_PALETTE.length]
		const geometry = this.createGeometry(settings)
		const material = this.createNoteMaterial(settings)
		this.distanceVisibilityUniform = {
			value: settings.distanceVisibility,
		}
		applyDistanceVisibility(material, this.distanceVisibilityUniform)
		this.object = new THREE.Mesh(geometry, material)
		this.object.position.set(
			layout.trackToX(note.trackIndex),
			layout.pitchToY(note.pitch),
			-((note.startSeconds + note.endSeconds) / 2) *
				settings.timeUnitsPerSecond,
		)
		this.glow = this.createGlow(geometry)
		this.object.add(this.glow)
	}

	update(frame: NoteUpdateFrame): void {
		const settings = this.context.settings
		this.distanceVisibilityUniform.value = settings.distanceVisibility
		const timing = this.calculateTiming(frame, settings)
		const longFade = this.calculateLongFade(frame, timing, settings)

		this.tryTriggerDissolve(frame, timing, longFade, settings)

		if (!this.updateVisibility(frame, timing, longFade, settings)) {
			return
		}

		this.applyAppearance(
			this.calculateAppearance(frame, timing, longFade, settings),
		)
	}

	resetLongDissolve(): void {
		this.longDissolveTriggered = false
	}

	dispose(): void {
		this.object.remove(this.glow)
		this.object.geometry.dispose()
		this.object.material.dispose()
		this.glow.material.dispose()
	}

	private createGeometry(settings: Readonly<AppSettings>): THREE.BoxGeometry {
		const duration = Math.max(
			0.08,
			(this.note.endSeconds - this.note.startSeconds) *
				settings.timeUnitsPerSecond,
		)

		return new THREE.BoxGeometry(
			settings.noteSize,
			settings.noteSize,
			duration,
		)
	}

	private createNoteMaterial(
		settings: Readonly<AppSettings>,
	): THREE.MeshStandardMaterial {
		return new THREE.MeshStandardMaterial({
			color: this.color,
			emissive: this.color,
			emissiveIntensity: settings.noteBaseEmissiveIntensity,
			transparent: true,
			opacity: settings.noteOpacity,
			roughness: 0.28,
			metalness: 0.08,
			depthWrite: false,
		})
	}

	private createGlow(
		geometry: THREE.BoxGeometry,
	): THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial> {
		const material = new THREE.MeshBasicMaterial({
			color: this.color,
			transparent: true,
			opacity: 0,
			blending: THREE.AdditiveBlending,
			depthWrite: false,
		})
		const glow = new THREE.Mesh(geometry, material)
		glow.scale.set(1.3, 2.2, 1.04)
		glow.visible = false
		return glow
	}

	private calculateTiming(
		frame: NoteUpdateFrame,
		settings: Readonly<AppSettings>,
	): NoteTiming {
		const timeSinceEnd = frame.songSeconds - this.note.endSeconds

		return {
			timeUntilStart: this.note.startSeconds - frame.songSeconds,
			timeSinceEnd,
			active:
				frame.songSeconds >= this.note.startSeconds &&
				frame.songSeconds <= this.note.endSeconds,
			afterglow:
				timeSinceEnd > 0 &&
				timeSinceEnd <= settings.noteAfterglowSeconds,
			durationBeats:
				(this.note.endTicks - this.note.startTicks) /
				this.beatTicks,
			elapsedBeats:
				(frame.songTicks - this.note.startTicks) / this.beatTicks,
		}
	}

	private calculateLongFade(
		frame: NoteUpdateFrame,
		timing: NoteTiming,
		settings: Readonly<AppSettings>,
	): LongFadeState {
		const applies =
			settings.longNoteFadeEnabled &&
			timing.durationBeats > frame.fadeStartBeats
		const effectiveEndBeats = Math.min(
			frame.configuredFadeEndBeats,
			timing.durationBeats,
		)
		const started =
			applies && timing.elapsedBeats >= frame.fadeStartBeats
		const dissolveTriggerBeats = this.calculateDissolveTriggerBeats(
			frame.fadeStartBeats,
			effectiveEndBeats,
			settings,
		)
		const fadeEndSeconds = this.timeMap.ticksToSeconds(
			this.note.startTicks + effectiveEndBeats * this.beatTicks,
		)
		const dissolveTriggerSeconds = this.timeMap.ticksToSeconds(
			this.note.startTicks + dissolveTriggerBeats * this.beatTicks,
		)
		const plannedDuration = Math.max(
			0,
			fadeEndSeconds - dissolveTriggerSeconds,
		)
		const dissolveReady =
			started && this.dissolveEffects.canTrigger(plannedDuration)

		return {
			applies,
			started,
			effectiveEndBeats,
			dissolveTriggerBeats,
			fadeEndSeconds,
			dissolveReady,
			preFlashProgress: calculateLongNotePreFlashProgress(
				frame.songSeconds,
				dissolveTriggerSeconds,
				settings.longNoteDissolvePreFlashSeconds,
				dissolveReady,
			),
			complete:
				started && timing.elapsedBeats >= effectiveEndBeats,
		}
	}

	private calculateDissolveTriggerBeats(
		fadeStartBeats: number,
		fadeEndBeats: number,
		settings: Readonly<AppSettings>,
	): number {
		const triggerRatio = clampLongNoteDissolveTriggerRatio(
			settings.longNoteDissolveTimingPercent / 100,
		)

		return (
			fadeStartBeats +
			(fadeEndBeats - fadeStartBeats) * triggerRatio
		)
	}

	private tryTriggerDissolve(
		frame: NoteUpdateFrame,
		timing: NoteTiming,
		longFade: LongFadeState,
		settings: Readonly<AppSettings>,
	): void {
		if (
			!longFade.dissolveReady ||
			timing.elapsedBeats < longFade.dissolveTriggerBeats ||
			timing.elapsedBeats >= longFade.effectiveEndBeats ||
			this.longDissolveTriggered
		) {
			return
		}

		this.longDissolveTriggered = this.dissolveEffects.trigger({
			positions: this.createDissolvePositions(frame, settings),
			color: this.color,
			durationSeconds: Math.max(
				0,
				longFade.fadeEndSeconds - frame.songSeconds,
			),
		})
	}

	private updateVisibility(
		frame: NoteUpdateFrame,
		timing: NoteTiming,
		longFade: LongFadeState,
		settings: Readonly<AppSettings>,
	): boolean {
		const endedAfterLongFade =
			longFade.applies && timing.timeSinceEnd > 0
		this.object.visible =
			timing.timeUntilStart <= frame.visibleFutureSeconds &&
			timing.timeSinceEnd <= settings.noteAfterglowSeconds &&
			!longFade.complete &&
			!endedAfterLongFade &&
			!this.longDissolveTriggered

		if (!this.object.visible) {
			this.glow.visible = false
		}

		return this.object.visible
	}

	private calculateAppearance(
		frame: NoteUpdateFrame,
		timing: NoteTiming,
		longFade: LongFadeState,
		settings: Readonly<AppSettings>,
	): NoteAppearance {
		if (timing.active && longFade.started) {
			return this.calculateLongFadeAppearance(
				frame,
				timing,
				longFade,
				settings,
			)
		}

		return this.calculateStandardAppearance(timing, settings)
	}

	private calculateLongFadeAppearance(
		frame: NoteUpdateFrame,
		timing: NoteTiming,
		longFade: LongFadeState,
		settings: Readonly<AppSettings>,
	): NoteAppearance {
		const fadeDurationBeats = Math.max(
			0.000001,
			longFade.effectiveEndBeats - frame.fadeStartBeats,
		)
		const fadeProgress = THREE.MathUtils.clamp(
			(timing.elapsedBeats - frame.fadeStartBeats) /
				fadeDurationBeats,
			0,
			1,
		)

		return calculateLongFadeNoteAppearance({
			velocity: this.note.velocity,
			remaining: 1 - fadeProgress,
			preFlashProgress: longFade.preFlashProgress,
			baseEmissiveIntensity: settings.noteBaseEmissiveIntensity,
			glowIntensity: settings.noteGlowIntensity,
			noteOpacity: settings.noteOpacity,
		})
	}

	private calculateStandardAppearance(
		timing: NoteTiming,
		settings: Readonly<AppSettings>,
	): NoteAppearance {
		let mode: NoteAppearanceMode = 'idle'
		let remaining = 1

		if (timing.active) {
			mode = 'active'
		} else if (timing.afterglow) {
			mode = 'afterglow'
			remaining =
				1 - timing.timeSinceEnd / settings.noteAfterglowSeconds
		}

		return calculateNoteAppearance({
			mode,
			velocity: this.note.velocity,
			remaining,
			baseEmissiveIntensity: settings.noteBaseEmissiveIntensity,
			glowIntensity: settings.noteGlowIntensity,
			noteOpacity: settings.noteOpacity,
		})
	}

	private applyAppearance(appearance: NoteAppearance): void {
		this.object.material.emissiveIntensity = appearance.emissiveIntensity
		this.object.material.opacity = appearance.noteOpacity
		this.glow.material.opacity = appearance.glowOpacity
		this.glow.visible = appearance.glowVisible
	}

	private createDissolvePositions(
		frame: NoteUpdateFrame,
		settings: Readonly<AppSettings>,
	): THREE.Vector3[] {
		const { startTicks, endTicks } = this.getDissolveTickRange(
			frame,
			settings,
		)
		const rangeBeats = (endTicks - startTicks) / this.beatTicks
		const particleCount = calculateLongNoteParticleCount(
			rangeBeats,
			settings.longNoteDissolveMaxParticlesPerNote,
		)
		const positions: THREE.Vector3[] = []

		for (let index = 0; index < particleCount; index += 1) {
			positions.push(
				this.createDissolvePosition(
					index,
					particleCount,
					startTicks,
					endTicks,
					frame.songSeconds,
					settings,
				),
			)
		}

		return positions
	}

	private getDissolveTickRange(
		frame: NoteUpdateFrame,
		settings: Readonly<AppSettings>,
	): { startTicks: number; endTicks: number } {
		const rangeRatio = clampLongNoteDissolveRangeRatio(
			settings.longNoteDissolveRangePercent / 100,
		)
		const visibleFarTicks = this.timeMap.secondsToTicks(
			frame.songSeconds + settings.lookAheadSeconds,
		)
		const endTicks = Math.min(this.note.endTicks, visibleFarTicks)
		const requestedRangeTicks =
			(this.note.endTicks - this.note.startTicks) * rangeRatio

		return {
			startTicks: Math.max(
				this.note.startTicks,
				endTicks - requestedRangeTicks,
			),
			endTicks,
		}
	}

	private createDissolvePosition(
		index: number,
		particleCount: number,
		startTicks: number,
		endTicks: number,
		songSeconds: number,
		settings: Readonly<AppSettings>,
	): THREE.Vector3 {
		const placement = calculateLongNoteParticlePlacement(
			index,
			particleCount,
			settings.noteSize,
		)
		const particleTicks = THREE.MathUtils.lerp(
			startTicks,
			endTicks,
			placement.intervalProgress,
		)
		const particleSeconds = this.timeMap.ticksToSeconds(particleTicks)

		return new THREE.Vector3(
			this.layout.trackToX(this.note.trackIndex) + placement.xOffset,
			this.layout.pitchToY(this.note.pitch) + placement.yOffset,
			(songSeconds - particleSeconds) * settings.timeUnitsPerSecond,
		)
	}
}
