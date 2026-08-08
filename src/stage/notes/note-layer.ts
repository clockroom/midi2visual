import * as THREE from 'three'
import type { MidiModel } from '../../shared/types'
import type { MidiTimeMap } from '../core/midi-time-map'
import type { StageLayout } from '../core/stage-layout'
import { LongNoteDissolveEffects } from '../effects/long-note-dissolve'
import { RenderedNote, type NoteUpdateFrame } from './rendered-note'
import {
	type StageContext,
	type StageSettingsChange,
} from '../stage-context'

export class NoteLayer {
	readonly group = new THREE.Group()

	private readonly movingNotesGroup = new THREE.Group()
	private readonly dissolveGroup = new THREE.Group()
	private readonly dissolveEffects: LongNoteDissolveEffects
	private readonly notes: RenderedNote[] = []
	private model: MidiModel | null = null
	private timeMap: MidiTimeMap | null = null
	private previousSongTicks: number | null = null
	private previousSongSeconds: number | null = null

	constructor(private readonly context: StageContext) {
		this.dissolveEffects = new LongNoteDissolveEffects(
			this.dissolveGroup,
			context,
		)
		this.group.add(this.movingNotesGroup, this.dissolveGroup)
	}

	load(
		model: MidiModel,
		timeMap: MidiTimeMap,
		layout: StageLayout,
	): void {
		this.clearNotes()
		this.dissolveEffects.clear()
		this.model = model
		this.timeMap = timeMap
		this.previousSongTicks = null
		this.previousSongSeconds = null

		for (const note of model.notes) {
			const renderedNote = new RenderedNote(
				note,
				model.beatTicks,
				this.context,
				timeMap,
				layout,
				this.dissolveEffects,
			)
			this.notes.push(renderedNote)
			this.movingNotesGroup.add(renderedNote.object)
		}
	}

	applySettingsChange(
		change: StageSettingsChange,
		model: MidiModel,
		timeMap: MidiTimeMap,
		layout: StageLayout,
	): void {
		if (this.longDissolveSettingsChanged(change)) {
			this.resetLongDissolve()
		}

		if (this.noteGeometrySettingsChanged(change)) {
			this.load(model, timeMap, layout)
		}
	}

	update(songSeconds: number): void {
		if (!this.model || !this.timeMap) {
			return
		}

		this.movingNotesGroup.position.z =
			songSeconds * this.context.settings.timeUnitsPerSecond
		const songTicks = this.timeMap.secondsToTicks(songSeconds)

		if (
			this.previousSongTicks !== null &&
			songTicks < this.previousSongTicks
		) {
			this.resetLongDissolve()
		}

		const frame = this.createUpdateFrame(songSeconds, songTicks)

		for (const note of this.notes) {
			note.update(frame)
		}

		this.updateDissolveEffects(songSeconds)
		this.previousSongTicks = songTicks
		this.previousSongSeconds = songSeconds
	}

	clear(): void {
		this.clearNotes()
		this.dissolveEffects.clear()
		this.model = null
		this.timeMap = null
		this.previousSongTicks = null
		this.previousSongSeconds = null
	}

	dispose(): void {
		this.clear()
		this.dissolveEffects.dispose()
		this.group.remove(this.movingNotesGroup, this.dissolveGroup)
	}

	private createUpdateFrame(
		songSeconds: number,
		songTicks: number,
	): NoteUpdateFrame {
		const settings = this.context.settings
		const fadeStartBeats = Math.max(
			0,
			settings.longNoteFadeStartBeats,
		)
		const fadeDurationBeats = Math.max(
			0.000001,
			settings.longNoteFadeDurationBeats,
		)

		return {
			songSeconds,
			songTicks,
			visibleFutureSeconds: settings.lookAheadSeconds + 2,
			fadeStartBeats,
			configuredFadeEndBeats:
				fadeStartBeats + fadeDurationBeats,
		}
	}

	private updateDissolveEffects(songSeconds: number): void {
		if (
			this.previousSongSeconds === null ||
			songSeconds < this.previousSongSeconds
		) {
			return
		}

		this.dissolveEffects.update(
			songSeconds - this.previousSongSeconds,
		)
	}

	private resetLongDissolve(): void {
		this.dissolveEffects.clear()

		for (const note of this.notes) {
			note.resetLongDissolve()
		}
	}

	private clearNotes(): void {
		for (const note of this.notes) {
			this.movingNotesGroup.remove(note.object)
			note.dispose()
		}

		this.notes.length = 0
	}

	private longDissolveSettingsChanged({
		previous,
		current,
	}: StageSettingsChange): boolean {
		return (
			previous.longNoteFadeEnabled !== current.longNoteFadeEnabled ||
			previous.longNoteFadeStartBeats !== current.longNoteFadeStartBeats ||
			previous.longNoteFadeDurationBeats !==
				current.longNoteFadeDurationBeats ||
			previous.showLongNoteDissolve !== current.showLongNoteDissolve ||
			previous.longNoteDissolveTimingPercent !==
				current.longNoteDissolveTimingPercent ||
			previous.longNoteDissolveRangePercent !==
				current.longNoteDissolveRangePercent ||
			previous.longNoteDissolveMaxParticlesPerNote !==
				current.longNoteDissolveMaxParticlesPerNote ||
			previous.longNoteDissolveParticleSize !==
				current.longNoteDissolveParticleSize
		)
	}

	private noteGeometrySettingsChanged({
		previous,
		current,
	}: StageSettingsChange): boolean {
		return (
			previous.noteSize !== current.noteSize ||
			previous.noteOpacity !== current.noteOpacity ||
			previous.timeUnitsPerSecond !== current.timeUnitsPerSecond ||
			previous.trackSpacing !== current.trackSpacing ||
			previous.trackOrderMode !== current.trackOrderMode ||
			previous.reverseTrackOrder !== current.reverseTrackOrder
		)
	}
}
