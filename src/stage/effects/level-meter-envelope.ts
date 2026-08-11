export interface LevelMeterEnvelopeTriggerRequest {
	velocity: number
	noteOnSeconds: number
	noteOffSeconds: number
}

const PEAK_HOLD_SECONDS = 0.08
const FIXED_RELEASE_SECONDS = 0.52
const SHORT_NOTE_ENVELOPE_SECONDS =
	PEAK_HOLD_SECONDS + FIXED_RELEASE_SECONDS
const RETRIGGER_BOOST = 1.1

export class LevelMeterEnvelope {
	private level = 0
	private peakLevel = 0
	private peakHoldEndSeconds = 0
	private releaseEndSeconds = 0

	get currentLevel(): number {
		return this.level
	}

	trigger(request: LevelMeterEnvelopeTriggerRequest): void {
		const noteOnSeconds = finiteOr(request.noteOnSeconds, 0)
		const noteOffSeconds = Math.max(
			noteOnSeconds,
			finiteOr(request.noteOffSeconds, noteOnSeconds),
		)
		this.advanceTo(noteOnSeconds)

		const velocity = clamp01(request.velocity)
		const boostedLevel = Math.min(this.level * RETRIGGER_BOOST, 1)
		const nextPeak = Math.max(velocity, boostedLevel)
		const noteDuration = noteOffSeconds - noteOnSeconds
		const candidateReleaseEnd =
			noteDuration < SHORT_NOTE_ENVELOPE_SECONDS
				? noteOnSeconds + SHORT_NOTE_ENVELOPE_SECONDS
				: noteOffSeconds
		const currentReleaseEnd =
			this.level > 0 ? this.releaseEndSeconds : noteOnSeconds

		this.level = nextPeak
		this.peakLevel = nextPeak
		this.peakHoldEndSeconds = noteOnSeconds + PEAK_HOLD_SECONDS
		this.releaseEndSeconds = Math.max(
			currentReleaseEnd,
			candidateReleaseEnd,
			this.peakHoldEndSeconds,
		)
	}

	advanceTo(songSeconds: number): boolean {
		if (!Number.isFinite(songSeconds) || this.level <= 0) {
			return false
		}

		const previousLevel = this.level

		if (songSeconds <= this.peakHoldEndSeconds) {
			this.level = this.peakLevel
		} else if (songSeconds >= this.releaseEndSeconds) {
			this.level = 0
		} else {
			const releaseDuration =
				this.releaseEndSeconds - this.peakHoldEndSeconds
			const releaseProgress =
				(songSeconds - this.peakHoldEndSeconds) / releaseDuration
			this.level = this.peakLevel * (1 - releaseProgress)
		}

		return this.level !== previousLevel
	}

	clear(): void {
		this.level = 0
		this.peakLevel = 0
		this.peakHoldEndSeconds = 0
		this.releaseEndSeconds = 0
	}
}

function clamp01(value: number): number {
	return Math.min(Math.max(finiteOr(value, 0), 0), 1)
}

function finiteOr(value: number, fallback: number): number {
	return Number.isFinite(value) ? value : fallback
}
