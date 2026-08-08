import * as THREE from 'three'
import type { MidiModel, VisualNote } from '../../shared/types'
import type { StageLayout } from '../core/stage-layout'
import { TrackLevelMeters } from '../effects/level-meters'
import { NoteImpactEffects } from '../effects/note-impact-effects'
import type { StageContext } from '../stage-context'

export class NoteOnReactionController {
	readonly group = new THREE.Group()

	private readonly effectsGroup = new THREE.Group()
	private readonly impactEffects: NoteImpactEffects
	private readonly levelMeters: TrackLevelMeters
	private model: MidiModel | null = null
	private layout: StageLayout | null = null
	private previousSongSeconds: number | null = null
	private nextNoteIndex = 0

	constructor(private readonly context: StageContext) {
		this.impactEffects = new NoteImpactEffects(
			this.effectsGroup,
			context,
		)
		this.levelMeters = new TrackLevelMeters(context)
		this.group.add(this.levelMeters.group, this.effectsGroup)
	}

	load(model: MidiModel, layout: StageLayout): void {
		this.clear()
		this.model = model
		this.layout = layout
		this.configureLevelMeters()
	}

	reconfigure(model: MidiModel, layout: StageLayout): void {
		this.model = model
		this.layout = layout
		this.configureLevelMeters()
	}

	update(songSeconds: number): void {
		if (!this.model || !this.layout) {
			return
		}

		if (
			this.previousSongSeconds === null ||
			songSeconds < this.previousSongSeconds
		) {
			this.resetPlaybackCursor(songSeconds)
			return
		}

		this.triggerNotesThrough(songSeconds)
		const deltaSeconds = songSeconds - this.previousSongSeconds
		this.impactEffects.update(deltaSeconds)
		this.levelMeters.update(deltaSeconds)
		this.previousSongSeconds = songSeconds
	}

	clear(): void {
		this.impactEffects.clear()
		this.levelMeters.clear()
		this.previousSongSeconds = null
		this.nextNoteIndex = 0
	}

	dispose(): void {
		this.impactEffects.dispose()
		this.levelMeters.dispose()
		this.group.remove(this.levelMeters.group, this.effectsGroup)
		this.model = null
		this.layout = null
	}

	private resetPlaybackCursor(songSeconds: number): void {
		this.impactEffects.clear()
		this.levelMeters.clear()
		this.nextNoteIndex = this.findFirstNoteAfter(songSeconds)
		this.previousSongSeconds = songSeconds
	}

	private triggerNotesThrough(songSeconds: number): void {
		if (!this.model) {
			return
		}

		while (this.nextNoteIndex < this.model.notes.length) {
			const note = this.model.notes[this.nextNoteIndex]

			if (note.startSeconds > songSeconds) {
				break
			}

			if (note.startSeconds > (this.previousSongSeconds ?? songSeconds)) {
				this.triggerNote(note)
			}

			this.nextNoteIndex += 1
		}
	}

	private triggerNote(note: VisualNote): void {
		if (!this.layout) {
			return
		}

		const color = this.layout.trackToColor(note.trackId)
		this.impactEffects.trigger({
			x: this.layout.trackToX(note.trackId),
			y: this.layout.pitchToY(note.pitch),
			color,
			velocity: note.velocity,
		})
		this.levelMeters.trigger({
			trackId: note.trackId,
			velocity: note.velocity,
		})
	}

	private configureLevelMeters(): void {
		if (!this.model || !this.layout) {
			return
		}

		this.levelMeters.configure(this.layout)
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
}
