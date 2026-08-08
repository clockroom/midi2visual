import type { AppSettings, MidiModel } from '../../shared/types'
import type { TrackId, VisualTrack } from '../../shared/tracks'
import { TRACK_PALETTE } from './palette'

const PITCH_PADDING = 3
const PITCH_STEP = 0.34

export class StageLayout {
	readonly trackCount: number
	readonly trackSpacing: number
	readonly worldWidth: number
	readonly worldHeight: number
	readonly centerX: number
	readonly centerY: number
	readonly bottomY: number

	private readonly model: MidiModel
	private readonly minimumPitch: number

	constructor(model: MidiModel, settings: Readonly<AppSettings>) {
		this.model = model
		this.trackCount = model.tracks.count
		this.trackSpacing = settings.trackSpacing
		this.minimumPitch = model.minPitch
		this.worldWidth = Math.max(
			2.4,
			(this.trackCount - 1) * settings.trackSpacing +
				settings.noteSize +
				1.4,
		)
		this.worldHeight =
			(model.maxPitch -
				model.minPitch +
				PITCH_PADDING * 2 +
				1) *
			PITCH_STEP
		this.centerX =
			((this.trackCount - 1) * settings.trackSpacing) / 2
		this.centerY =
			((model.minPitch + model.maxPitch) / 2 -
				(model.minPitch - PITCH_PADDING)) *
			PITCH_STEP
		this.bottomY = this.centerY - this.worldHeight / 2
	}

	get tracks(): readonly VisualTrack[] {
		return this.model.tracks.tracks
	}

	trackAt(displayIndex: number): VisualTrack {
		return this.model.tracks.getAt(displayIndex)
	}

	trackToDisplayIndex(trackId: TrackId): number {
		return this.model.tracks.getDisplayIndex(trackId)
	}

	trackToX(trackId: TrackId): number {
		return this.trackToDisplayIndex(trackId) * this.trackSpacing
	}

	trackToColor(trackId: TrackId): number {
		const displayIndex = this.trackToDisplayIndex(trackId)

		return TRACK_PALETTE[displayIndex % TRACK_PALETTE.length]
	}

	pitchToY(pitch: number): number {
		return (
			(pitch - (this.minimumPitch - PITCH_PADDING)) * PITCH_STEP
		)
	}
}
