import type { AppSettings, MidiModel } from '../shared/types'

const PITCH_PADDING = 3
const PITCH_STEP = 0.34

export class StageLayout {
	readonly worldWidth: number
	readonly worldHeight: number
	readonly centerX: number
	readonly centerY: number
	readonly bottomY: number

	private readonly trackSpacing: number
	private readonly minimumPitch: number

	constructor(model: MidiModel, settings: Readonly<AppSettings>) {
		this.trackSpacing = settings.trackSpacing
		this.minimumPitch = model.minPitch
		this.worldWidth = Math.max(
			2.4,
			(model.trackCount - 1) * settings.trackSpacing +
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
			((model.trackCount - 1) * settings.trackSpacing) / 2
		this.centerY =
			((model.minPitch + model.maxPitch) / 2 -
				(model.minPitch - PITCH_PADDING)) *
			PITCH_STEP
		this.bottomY = this.centerY - this.worldHeight / 2
	}

	trackToX(trackIndex: number): number {
		return trackIndex * this.trackSpacing
	}

	pitchToY(pitch: number): number {
		return (
			(pitch - (this.minimumPitch - PITCH_PADDING)) * PITCH_STEP
		)
	}
}
