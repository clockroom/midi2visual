import '../styles/stage.css'
import { AppChannel } from '../shared/channel'
import { loadMidiModel } from '../shared/midi'
import { loadSettings } from '../shared/settings'
import type { AppSettings, MidiModel } from '../shared/types'
import { PlaybackTimeline } from './timeline'
import { MidiVisualizer } from './visualizer'

function getRequiredElement<T extends Element>(selector: string): T {
	const element = document.querySelector<T>(selector)

	if (!element) {
		throw new Error(`Required DOM element is missing: ${selector}`)
	}

	return element
}

const stage = getRequiredElement<HTMLElement>('#stage')
const loading = getRequiredElement<HTMLElement>('#loading')
const playbackMetrics = getRequiredElement<HTMLElement>('#playback-metrics')
const bpmCounter = getRequiredElement<HTMLElement>('#bpm-counter')
const beatCounter = getRequiredElement<HTMLElement>('#beat-counter')

let settings = loadSettings()
let model: MidiModel | null = null
let timeline: PlaybackTimeline | null = null
const visualizer = new MidiVisualizer(stage, settings)
const channel = new AppChannel()

async function reloadMidi(notifyControl = false): Promise<void> {
	loading.hidden = false
	loading.textContent = 'Loading input.mid...'

	try {
		model = await loadMidiModel()
		timeline = new PlaybackTimeline(
			settings.preRollSeconds,
			settings.postRollSeconds,
			model.durationSeconds,
		)
		visualizer.load(model)
		loading.hidden = true
		const beatDigits = String(model.totalBeats).length
		playbackMetrics.style.setProperty(
			'--beat-counter-width',
			`${Math.max(9, beatDigits * 2 + 5)}ch`,
		)
		updatePlaybackMetrics(-settings.preRollSeconds)

		if (notifyControl) {
			channel.send({ type: 'midiReloaded' })
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		console.error('MIDI load failed.', error)
		loading.textContent = 'Failed to load input.mid'
		alert(message)

		if (notifyControl) {
			channel.send({ type: 'midiReloadFailed', message })
		}
	}
}

function applySettings(nextSettings: AppSettings): void {
	settings = nextSettings
	visualizer.applySettings(settings)
	timeline?.reconfigure(
		settings.preRollSeconds,
		settings.postRollSeconds,
		model?.durationSeconds ?? 0,
	)
	updatePlaybackMetrics(timeline?.currentSeconds ?? -settings.preRollSeconds)
}

function findMarkerIndexAtTime(
	markers: ReadonlyArray<{ seconds: number }>,
	songSeconds: number,
): number {
	let low = 0
	let high = markers.length - 1
	let result = -1

	while (low <= high) {
		const middle = Math.floor((low + high) / 2)

		if (markers[middle].seconds <= songSeconds) {
			result = middle
			low = middle + 1
		} else {
			high = middle - 1
		}
	}

	return result
}

function formatBpm(bpm: number): string {
	return Number.isInteger(bpm) ? String(bpm) : bpm.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}

function updatePlaybackMetrics(songSeconds: number): void {
	if (!model || !settings.showMeasureCounter) {
		playbackMetrics.hidden = true
		return
	}

	playbackMetrics.hidden = false
	const tempoIndex = findMarkerIndexAtTime(model.tempoMarkers, Math.max(0, songSeconds))
	const currentBpm = model.tempoMarkers[Math.max(0, tempoIndex)].bpm
	bpmCounter.textContent = `BPM = ${formatBpm(currentBpm)}`

	if (songSeconds < 0) {
		beatCounter.textContent = `0 / ${model.totalBeats}`
		return
	}

	if (songSeconds >= model.durationSeconds) {
		beatCounter.textContent = `${model.totalBeats} / ${model.totalBeats}`
		return
	}

	const beatIndex = findMarkerIndexAtTime(model.beatTimeline, songSeconds)
	const currentBeat = Math.min(Math.max(beatIndex + 1, 1), model.totalBeats)
	beatCounter.textContent = `${currentBeat} / ${model.totalBeats}`
}

function animate(nowMilliseconds: number): void {
	const songSeconds = timeline?.update(nowMilliseconds) ?? -settings.preRollSeconds
	visualizer.render(songSeconds)
	updatePlaybackMetrics(songSeconds)
	requestAnimationFrame(animate)
}

window.addEventListener('keydown', (event) => {
	if (event.repeat) {
		return
	}

	if (event.code === 'Space') {
		event.preventDefault()
		timeline?.playFromStart(performance.now())
	}

	if (event.code === 'Escape') {
		timeline?.stop()
	}

	if (event.code === 'KeyR') {
		void reloadMidi()
	}
})

channel.subscribe((message) => {
	if (message.type === 'settingsChanged') {
		applySettings(message.settings)
	}

	if (message.type === 'reloadMidi') {
		void reloadMidi(true)
	}
})

window.addEventListener('storage', (event) => {
	if (event.key?.startsWith('midi2visual.settings')) {
		applySettings(loadSettings())
	}
})

window.addEventListener('beforeunload', () => {
	channel.close()
	visualizer.dispose()
})

void reloadMidi()
requestAnimationFrame(animate)
