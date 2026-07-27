export interface AppSettings {
	midiFileName: string
	preRollSeconds: number
	postRollSeconds: number
	lookAheadSeconds: number
	timeUnitsPerSecond: number
	trackSpacing: number
	noteSize: number
	noteOpacity: number
	noteGlowIntensity: number
	noteAfterglowSeconds: number
	cameraFov: number
	showMeasureFrames: boolean
	showBeatFrames: boolean
	showMeasureCounter: boolean
	frameOpacity: number
	showCoreFlash: boolean
	showImpactRing: boolean
	showSparks: boolean
	showCustomImpactImage: boolean
	customImpactImageFileName: string
	customImpactDuration: number
	customImpactOpacity: number
	customImpactScaleMode: 'expand' | 'shrink'
	customImpactStartScale: number
	customImpactEndScale: number
	showLevelMeters: boolean
	levelMeterColorMode: 'normal' | 'white' | 'blue' | 'track'
	levelMeterSensitivity: number
	levelMeterOpacity: number
	levelMeterMaxHeightPercent: number
	levelMeterWidthPercent: number
	backgroundParticleCount: number
	backgroundTopColor: string
	backgroundBottomColor: string
}

export interface VisualNote {
	trackIndex: number
	pitch: number
	velocity: number
	startSeconds: number
	endSeconds: number
	startTicks: number
	endTicks: number
}

export interface TimelineMarker {
	seconds: number
	ticks: number
	measure: number
}

export interface TempoMarker {
	seconds: number
	bpm: number
}

export interface MidiModel {
	notes: VisualNote[]
	trackCount: number
	minPitch: number
	maxPitch: number
	durationSeconds: number
	durationTicks: number
	numerator: number
	denominator: number
	totalMeasures: number
	totalBeats: number
	measureMarkers: TimelineMarker[]
	beatMarkers: TimelineMarker[]
	beatTimeline: TimelineMarker[]
	tempoMarkers: TempoMarker[]
}

export type AppMessage =
	| { type: 'settingsChanged'; settings: AppSettings }
	| { type: 'reloadMidi'; fileName: string }
	| { type: 'midiReloaded'; fileName: string }
	| { type: 'midiReloadFailed'; fileName: string; message: string }
