import type { AppSettings } from './types'

export const SETTINGS_STORAGE_KEY = 'midi2visual.settings.v2'
export const SETTINGS_CHANNEL_NAME = 'midi2visual'

export const defaultSettings: AppSettings = {
	midiFileName: 'input.mid',
	preRollSeconds: 2,
	postRollSeconds: 3,
	lookAheadSeconds: 8,
	timeUnitsPerSecond: 4,
	trackSpacing: 1.5,
	noteSize: 0.4,
	noteOpacity: 0.82,
	noteBaseEmissiveIntensity: 0.55,
	distanceVisibility: 0.8,
	noteGlowIntensity: 1.7,
	noteAfterglowSeconds: 0.3,
	longNoteFadeEnabled: true,
	longNoteFadeStartBeats: 2,
	longNoteFadeDurationBeats: 6,
	showLongNoteDissolve: true,
	longNoteDissolveTimingPercent: 50,
	longNoteDissolvePreFlashSeconds: 0.15,
	longNoteDissolveRangePercent: 60,
	longNoteDissolveMaxParticlesPerNote: 32,
	longNoteDissolveParticleSize: 10,
	cameraFov: 48,
	showMeasureFrames: true,
	showBeatFrames: false,
	showMeasureCounter: true,
	frameOpacity: 0.28,
	showCoreFlash: true,
	showImpactRing: true,
	showSparks: true,
	effectVelocityEmphasisPercent: 100,
	effectVelocityCharacteristicPercent: 50,
	effectVelocityThresholdPercent: 50,
	showCustomImpactImage: true,
	customImpactImageFileName: 'custom.png',
	customImpactDuration: 0.8,
	customImpactOpacity: 0.75,
	customImpactScaleMode: 'expand',
	customImpactStartScale: 1,
	customImpactEndScale: 3,
	showLevelMeters: true,
	levelMeterColorMode: 'normal',
	levelMeterSensitivity: 0,
	levelMeterOpacity: 0.8,
	levelMeterMaxHeightPercent: 25,
	levelMeterWidthPercent: 70,
	levelMeterDepthOffset: 0,
	backgroundTopColor: '#101b32',
	backgroundBottomColor: '#02040b',
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function loadSettings(): AppSettings {
	const saved = localStorage.getItem(SETTINGS_STORAGE_KEY)

	if (!saved) {
		return structuredClone(defaultSettings)
	}

	try {
		const parsed: unknown = JSON.parse(saved)

		if (!isRecord(parsed)) {
			throw new Error('Saved settings are not an object.')
		}

		const currentKeys = Object.keys(defaultSettings) as (keyof AppSettings)[]
		const savedSettings = Object.fromEntries(
			currentKeys
				.filter((key) => key in parsed)
				.map((key) => [key, parsed[key]]),
		) as Partial<AppSettings>

		return {
			...structuredClone(defaultSettings),
			...savedSettings,
		} as AppSettings
	} catch (error) {
		console.warn('Saved settings could not be read. Defaults are used.', error)
		return structuredClone(defaultSettings)
	}
}

export function saveSettings(settings: AppSettings): void {
	localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
}
