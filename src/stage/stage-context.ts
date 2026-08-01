import type { AppSettings } from '../shared/types'

export interface StageSettingsChange {
	previous: Readonly<AppSettings>
	current: Readonly<AppSettings>
}

export type StageSettingsListener = (change: StageSettingsChange) => void

export class StageContext {
	private currentSettings: Readonly<AppSettings>
	private readonly listeners = new Set<StageSettingsListener>()

	constructor(settings: AppSettings) {
		this.currentSettings = { ...settings }
	}

	get settings(): Readonly<AppSettings> {
		return this.currentSettings
	}

	toEffectVelocity(velocity: number): number {
		const input = clampFinite(velocity, 0, 1, 0)
		const emphasis =
			clampFinite(
				this.settings.effectVelocityEmphasisPercent,
				0,
				200,
				100,
			) / 100
		const characteristic =
			clampFinite(
				this.settings.effectVelocityCharacteristicPercent,
				0,
				100,
				50,
			) / 100
		const minimum = emphasis <= 1 ? 1 - emphasis : 0
		const maximum = emphasis <= 1 ? 1 : emphasis
		const middle = lerp(minimum, maximum, characteristic)
		const transformed =
			input <= 0.5
				? lerp(minimum, middle, input * 2)
				: lerp(middle, maximum, (input - 0.5) * 2)

		return clampFinite(transformed, 0, 2, 0)
	}

	updateSettings(settings: AppSettings): void {
		const current = { ...settings }
		const change: StageSettingsChange = {
			previous: this.currentSettings,
			current,
		}
		this.currentSettings = current

		for (const listener of [...this.listeners]) {
			listener(change)
		}
	}

	subscribe(listener: StageSettingsListener): () => void {
		this.listeners.add(listener)

		return () => {
			this.listeners.delete(listener)
		}
	}
}

function clampFinite(
	value: number,
	minimum: number,
	maximum: number,
	fallback: number,
): number {
	return Number.isFinite(value)
		? Math.min(Math.max(value, minimum), maximum)
		: fallback
}

function lerp(start: number, end: number, progress: number): number {
	return start + (end - start) * progress
}
