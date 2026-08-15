import { Midi } from '@tonejs/midi'
import { toPublicFileUrl } from './public-files'
import { TrackCollection, VisualTrack } from './tracks'
import type {
	MidiModel,
	TempoMarker,
	TimelineMarker,
	VisualNote,
} from './types'

const DEFAULT_NUMERATOR = 4
const DEFAULT_DENOMINATOR = 4
const DEFAULT_BPM = 120

interface TimeSignatureChange {
	ticks: number
	numerator: number
	denominator: number
}

export async function loadMidiModel(fileName: string): Promise<MidiModel> {
	const response = await fetch(`${toPublicFileUrl(fileName)}?v=${Date.now()}`, {
		cache: 'no-store',
	})

	if (!response.ok) {
		throw new Error(`${fileName}の読み込みに失敗しました。HTTP ${response.status}`)
	}

	const midi = new Midi(await response.arrayBuffer())
	const tracks: VisualTrack[] = []
	const notes: VisualNote[] = []

	midi.tracks.forEach((track, sourceIndex) => {
		if (track.notes.length === 0) {
			return
		}

		const trackNotes = track.notes.map((note) => ({
			trackId: sourceIndex,
			pitch: note.midi,
			velocity: note.velocity,
			startSeconds: note.time,
			endSeconds: note.time + note.duration,
			startTicks: note.ticks,
			endTicks: note.ticks + note.durationTicks,
		}))
		tracks.push(
			new VisualTrack({
				id: sourceIndex,
				sourceIndex,
				name: track.name.trim() || `Track ${sourceIndex + 1}`,
				notes: trackNotes,
			}),
		)
		notes.push(...trackNotes)
	})

	if (tracks.length === 0) {
		throw new Error(`${fileName}にNote On / Offから構成されたノートがありません。`)
	}

	notes.sort((left, right) => left.startSeconds - right.startSeconds)

	const minPitch = Math.min(...notes.map((note) => note.pitch))
	const maxPitch = Math.max(...notes.map((note) => note.pitch))
	const durationSeconds = Math.max(...notes.map((note) => note.endSeconds))
	const durationTicks = Math.max(...notes.map((note) => note.endTicks))
	const timeSignatures = normalizeTimeSignatures(
		midi.header.timeSignatures,
		durationTicks,
	)
	const { numerator, denominator } = timeSignatures[0]
	const beatTicks = midi.header.ppq
	const musicalBeatTicks = midi.header.ppq * (4 / denominator)
	const measureTicks = musicalBeatTicks * numerator
	const totalMeasures = Math.max(1, Math.ceil(durationTicks / measureTicks))
	const totalBeats = totalMeasures * numerator
	const measureMarkers = createMeasureMarkers(
		timeSignatures,
		midi.header.ppq,
		durationTicks,
		(ticks) => midi.header.ticksToSeconds(ticks),
	)
	const beatMarkers: TimelineMarker[] = []
	const beatTimeline: TimelineMarker[] = []

	for (let measure = 0; measure <= totalMeasures; measure += 1) {
		if (measure === totalMeasures) {
			continue
		}

		for (let beat = 1; beat < numerator; beat += 1) {
			const beatTick = Math.round(
				measure * measureTicks + beat * musicalBeatTicks,
			)
			beatMarkers.push({
				seconds: midi.header.ticksToSeconds(beatTick),
				ticks: beatTick,
				measure: measure + 1,
			})
		}
	}

	for (let beat = 0; beat < totalBeats; beat += 1) {
		const ticks = Math.round(beat * musicalBeatTicks)
		beatTimeline.push({
			seconds: midi.header.ticksToSeconds(ticks),
			ticks,
			measure: Math.floor(beat / numerator) + 1,
		})
	}

	const tempoMarkers: TempoMarker[] = [
		{ seconds: 0, ticks: 0, bpm: DEFAULT_BPM },
	]
	const tempoEvents = midi.header.tempos
		.slice()
		.sort((left, right) => left.ticks - right.ticks)

	for (const tempo of tempoEvents) {
		const marker = {
			seconds: midi.header.ticksToSeconds(tempo.ticks),
			ticks: tempo.ticks,
			bpm: tempo.bpm,
		}
		const previous = tempoMarkers[tempoMarkers.length - 1]

		if (previous.seconds === marker.seconds) {
			tempoMarkers[tempoMarkers.length - 1] = marker
		} else {
			tempoMarkers.push(marker)
		}
	}

	return {
		notes,
		tracks: new TrackCollection(tracks),
		minPitch,
		maxPitch,
		durationSeconds,
		durationTicks,
		ppq: midi.header.ppq,
		beatTicks,
		numerator,
		denominator,
		totalMeasures,
		totalBeats,
		measureMarkers,
		beatMarkers,
		beatTimeline,
		tempoMarkers,
	}
}

function normalizeTimeSignatures(
	events: ReadonlyArray<{
		ticks: number
		timeSignature: number[]
	}>,
	durationTicks: number,
): TimeSignatureChange[] {
	const changes: TimeSignatureChange[] = [
		{
			ticks: 0,
			numerator: DEFAULT_NUMERATOR,
			denominator: DEFAULT_DENOMINATOR,
		},
	]
	const sortedEvents = [...events].sort(
		(left, right) => left.ticks - right.ticks,
	)

	for (const event of sortedEvents) {
		if (event.ticks < 0 || event.ticks > durationTicks) {
			continue
		}

		const numerator = event.timeSignature[0]
		const denominator = event.timeSignature[1]

		if (
			!Number.isFinite(numerator) ||
			!Number.isFinite(denominator) ||
			numerator <= 0 ||
			denominator <= 0
		) {
			continue
		}

		const change = {
			ticks: event.ticks,
			numerator,
			denominator,
		}
		const previous = changes[changes.length - 1]

		if (previous.ticks === change.ticks) {
			changes[changes.length - 1] = change
		} else {
			changes.push(change)
		}
	}

	return changes
}

function createMeasureMarkers(
	timeSignatures: readonly TimeSignatureChange[],
	ppq: number,
	durationTicks: number,
	ticksToSeconds: (ticks: number) => number,
): TimelineMarker[] {
	const boundaryTicks: number[] = []

	for (let index = 0; index < timeSignatures.length; index += 1) {
		const signature = timeSignatures[index]
		const nextSignature = timeSignatures[index + 1]
		const measureTicks =
			ppq * signature.numerator * (4 / signature.denominator)
		pushUniqueBoundary(boundaryTicks, signature.ticks)

		if (signature.ticks >= durationTicks) {
			continue
		}

		for (let measure = 1; ; measure += 1) {
			const ticks = Math.round(
				signature.ticks + measure * measureTicks,
			)

			if (nextSignature && ticks >= nextSignature.ticks) {
				break
			}

			pushUniqueBoundary(boundaryTicks, ticks)

			if (ticks >= durationTicks) {
				break
			}
		}
	}

	return boundaryTicks.map((ticks, index) => ({
		seconds: ticksToSeconds(ticks),
		ticks,
		measure: index + 1,
	}))
}

function pushUniqueBoundary(boundaries: number[], ticks: number): void {
	if (boundaries[boundaries.length - 1] !== ticks) {
		boundaries.push(ticks)
	}
}
