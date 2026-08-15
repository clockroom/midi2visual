import type { TrackCollection, TrackId } from './tracks'
import type { TrackOrderMode } from './track-order'

export interface AppSettings {
	midiFileName: string
	preRollSeconds: number
	postRollSeconds: number
	lookAheadSeconds: number
	timeUnitsPerSecond: number
	trackSpacing: number
	trackOrderMode: TrackOrderMode
	smartTrackDurationBeats: number
	reverseTrackOrder: boolean
	noteSize: number
	noteOpacity: number
	noteBaseEmissiveIntensity: number
	distanceVisibility: number
	noteGlowIntensity: number
	noteAfterglowSeconds: number
	longNoteFadeEnabled: boolean
	longNoteFadeStartBeats: number
	longNoteFadeDurationBeats: number
	showLongNoteDissolve: boolean
	longNoteDissolveTimingPercent: number
	longNoteDissolvePreFlashSeconds: number
	longNoteDissolveRangePercent: number
	longNoteDissolveMaxParticlesPerNote: number
	longNoteDissolveParticleSize: number
	cameraFov: number
	showMeasureFrames: boolean
	showBeatFrames: boolean
	showMeasureCounter: boolean
	frameOpacity: number
	showCoreFlash: boolean
	showImpactRing: boolean
	showSparks: boolean
	effectVelocityEmphasisPercent: number
	effectVelocityCharacteristicPercent: number
	effectVelocityThresholdPercent: number
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
	levelMeterDepthOffset: number
	backgroundTopColor: string
	backgroundBottomColor: string
}

export interface VisualNote {
	trackId: TrackId
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
	ticks: number
	bpm: number
}

export interface MidiModel {
	notes: VisualNote[]
	tracks: TrackCollection
	minPitch: number
	maxPitch: number
	durationSeconds: number
	durationTicks: number
	ppq: number
	/** 四分音符1つ分のtick数。拍子の分母には依存しない。 */
	beatTicks: number
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
