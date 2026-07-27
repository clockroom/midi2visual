import { Midi } from '@tonejs/midi'
import type { MidiModel, TimelineMarker, VisualNote } from './types'

const DEFAULT_NUMERATOR = 4
const DEFAULT_DENOMINATOR = 4

export async function loadMidiModel(): Promise<MidiModel> {
	const response = await fetch(`/input.mid?v=${Date.now()}`, { cache: 'no-store' })

	if (!response.ok) {
		throw new Error(`input.midの読み込みに失敗しました。HTTP ${response.status}`)
	}

	const midi = new Midi(await response.arrayBuffer())
	const sourceTracks = midi.tracks.filter((track) => track.notes.length > 0)

	if (sourceTracks.length === 0) {
		throw new Error('input.midにNote On / Offから構成されたノートがありません。')
	}

	const notes: VisualNote[] = []

	sourceTracks.forEach((track, trackIndex) => {
		for (const note of track.notes) {
			notes.push({
				trackIndex,
				pitch: note.midi,
				velocity: note.velocity,
				startSeconds: note.time,
				endSeconds: note.time + note.duration,
				startTicks: note.ticks,
				endTicks: note.ticks + note.durationTicks,
			})
		}
	})

	notes.sort((left, right) => left.startSeconds - right.startSeconds)

	const minPitch = Math.min(...notes.map((note) => note.pitch))
	const maxPitch = Math.max(...notes.map((note) => note.pitch))
	const durationSeconds = Math.max(...notes.map((note) => note.endSeconds))
	const durationTicks = Math.max(...notes.map((note) => note.endTicks))
	const firstTimeSignature = midi.header.timeSignatures
		.slice()
		.sort((left, right) => left.ticks - right.ticks)[0]
	const numerator = firstTimeSignature?.timeSignature[0] ?? DEFAULT_NUMERATOR
	const denominator = firstTimeSignature?.timeSignature[1] ?? DEFAULT_DENOMINATOR
	const measureTicks = midi.header.ppq * numerator * (4 / denominator)
	const beatTicks = midi.header.ppq * (4 / denominator)
	const totalMeasures = Math.max(1, Math.ceil(durationTicks / measureTicks))
	const measureMarkers: TimelineMarker[] = []
	const beatMarkers: TimelineMarker[] = []

	for (let measure = 0; measure <= totalMeasures; measure += 1) {
		const ticks = Math.round(measure * measureTicks)
		measureMarkers.push({
			seconds: midi.header.ticksToSeconds(ticks),
			ticks,
			measure: measure + 1,
		})

		if (measure === totalMeasures) {
			continue
		}

		for (let beat = 1; beat < numerator; beat += 1) {
			const beatTick = Math.round(measure * measureTicks + beat * beatTicks)
			beatMarkers.push({
				seconds: midi.header.ticksToSeconds(beatTick),
				ticks: beatTick,
				measure: measure + 1,
			})
		}
	}

	return {
		notes,
		trackCount: sourceTracks.length,
		minPitch,
		maxPitch,
		durationSeconds,
		durationTicks,
		numerator,
		denominator,
		totalMeasures,
		measureMarkers,
		beatMarkers,
	}
}
