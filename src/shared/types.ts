export interface AppSettings {
	preRollSeconds: number
	postRollSeconds: number
	lookAheadSeconds: number
	timeUnitsPerSecond: number
	trackSpacing: number
	noteWidth: number
	noteHeight: number
	noteOpacity: number
	noteGlowIntensity: number
	noteAfterglowSeconds: number
	cameraFov: number
	showMeasureFrames: boolean
	showBeatFrames: boolean
	showMeasureCounter: boolean
	frameOpacity: number
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
	measureMarkers: TimelineMarker[]
	beatMarkers: TimelineMarker[]
}

export type AppMessage =
	| { type: 'settingsChanged'; settings: AppSettings }
	| { type: 'reloadMidi' }
