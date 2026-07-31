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
