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
const measureCounter = getRequiredElement<HTMLElement>('#measure-counter')

let settings = loadSettings()
let model: MidiModel | null = null
let timeline: PlaybackTimeline | null = null
const visualizer = new MidiVisualizer(stage, settings)
const channel = new AppChannel()

async function reloadMidi(): Promise<void> {
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
		updateMeasureCounter(-settings.preRollSeconds)
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		console.error('MIDI load failed.', error)
		loading.textContent = 'Failed to load input.mid'
		alert(message)
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
	updateMeasureCounter(timeline?.currentSeconds ?? -settings.preRollSeconds)
}

function updateMeasureCounter(songSeconds: number): void {
	if (!model || !settings.showMeasureCounter) {
		measureCounter.hidden = true
		return
	}

	measureCounter.hidden = false

	if (songSeconds < 0) {
		measureCounter.textContent = `0 / ${model.totalMeasures}`
		return
	}

	if (songSeconds >= model.durationSeconds) {
		measureCounter.textContent = `${model.totalMeasures} / ${model.totalMeasures}`
		return
	}

	let currentMeasure = 1

	for (let index = 0; index < model.measureMarkers.length; index += 1) {
		if (model.measureMarkers[index].seconds > songSeconds) {
			break
		}
		currentMeasure = Math.min(index + 1, model.totalMeasures)
	}

	measureCounter.textContent = `${currentMeasure} / ${model.totalMeasures}`
}

function animate(nowMilliseconds: number): void {
	const songSeconds = timeline?.update(nowMilliseconds) ?? -settings.preRollSeconds
	visualizer.render(songSeconds)
	updateMeasureCounter(songSeconds)
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
		void reloadMidi()
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
