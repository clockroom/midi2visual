import '../styles/stage.css'
import { AppChannel } from '../shared/channel'
import { loadMidiModel } from '../shared/midi'
import { normalizePublicFileName } from '../shared/public-files'
import { loadSettings } from '../shared/settings'
import type { MidiModel } from '../shared/types'
import { StageContext } from './stage-context'
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
const viewportSize = getRequiredElement<HTMLElement>('#viewport-size')

const context = new StageContext(loadSettings())
let model: MidiModel | null = null
let timeline: PlaybackTimeline | null = null
let beatCounterDigits = 1
const visualizer = new MidiVisualizer(stage, context)
const channel = new AppChannel()
const pressedCameraKeys = new Set<string>()
let previousFrameMilliseconds: number | null = null
const cameraControlCodes = new Set([
	'ArrowLeft',
	'ArrowRight',
	'ArrowUp',
	'ArrowDown',
	'KeyW',
	'KeyS',
])

async function reloadMidi(
	notifyControl = false,
	requestedFileName = context.settings.midiFileName,
): Promise<void> {
	const fileName = normalizePublicFileName(requestedFileName, 'input.mid', '.mid')
	loading.hidden = false
	loading.textContent = `Loading ${fileName}...`

	try {
		model = await loadMidiModel(fileName)
		timeline = new PlaybackTimeline(
			context.settings.preRollSeconds,
			context.settings.postRollSeconds,
			model.durationSeconds,
		)
		visualizer.load(model)
		loading.hidden = true
		const beatDigits = String(model.totalBeats).length
		beatCounterDigits = beatDigits
		playbackMetrics.style.setProperty(
			'--beat-counter-width',
			`${Math.max(5, beatDigits * 2 + 3)}ch`,
		)
		updatePlaybackMetrics(-context.settings.preRollSeconds)

		if (notifyControl) {
			channel.send({ type: 'midiReloaded', fileName })
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error)
		console.error('MIDI load failed.', error)
		loading.textContent = `Failed to load ${fileName}`
		alert(message)

		if (notifyControl) {
			channel.send({ type: 'midiReloadFailed', fileName, message })
		}
	}
}

const unsubscribeSettings = context.subscribe(({ current }) => {
	timeline?.reconfigure(
		current.preRollSeconds,
		current.postRollSeconds,
		model?.durationSeconds ?? 0,
	)
	updatePlaybackMetrics(timeline?.currentSeconds ?? -current.preRollSeconds)
})

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

function updateViewportSize(): void {
	viewportSize.textContent = `${window.innerWidth} x ${window.innerHeight}`
}

function formatBeatCounter(currentBeat: number, totalBeats: number): string {
	return `${String(currentBeat).padStart(beatCounterDigits, '0')} / ${totalBeats}`
}

function updatePlaybackMetrics(songSeconds: number): void {
	if (!model || !context.settings.showMeasureCounter) {
		playbackMetrics.hidden = true
		return
	}

	playbackMetrics.hidden = false
	const tempoIndex = findMarkerIndexAtTime(model.tempoMarkers, Math.max(0, songSeconds))
	const currentBpm = model.tempoMarkers[Math.max(0, tempoIndex)].bpm
	bpmCounter.textContent = formatBpm(currentBpm)

	if (songSeconds < 0) {
		beatCounter.textContent = formatBeatCounter(0, model.totalBeats)
		return
	}

	if (songSeconds >= model.durationSeconds) {
		beatCounter.textContent = formatBeatCounter(
			model.totalBeats,
			model.totalBeats,
		)
		return
	}

	const beatIndex = findMarkerIndexAtTime(model.beatTimeline, songSeconds)
	const currentBeat = Math.min(Math.max(beatIndex + 1, 1), model.totalBeats)
	beatCounter.textContent = formatBeatCounter(currentBeat, model.totalBeats)
}

function animate(nowMilliseconds: number): void {
	const deltaSeconds =
		previousFrameMilliseconds === null
			? 0
			: Math.min((nowMilliseconds - previousFrameMilliseconds) / 1000, 0.1)
	previousFrameMilliseconds = nowMilliseconds
	const horizontalDirection =
		Number(pressedCameraKeys.has('ArrowRight')) -
		Number(pressedCameraKeys.has('ArrowLeft'))
	const verticalDirection =
		Number(pressedCameraKeys.has('ArrowUp')) -
		Number(pressedCameraKeys.has('ArrowDown'))
	const zoomDirection =
		Number(pressedCameraKeys.has('KeyW')) -
		Number(pressedCameraKeys.has('KeyS'))
	visualizer.updateCameraControls(
		horizontalDirection,
		verticalDirection,
		zoomDirection,
		deltaSeconds,
	)
	const songSeconds =
		timeline?.update(nowMilliseconds) ?? -context.settings.preRollSeconds
	visualizer.render(songSeconds)
	updatePlaybackMetrics(songSeconds)
	requestAnimationFrame(animate)
}

window.addEventListener('keydown', (event) => {
	if (cameraControlCodes.has(event.code)) {
		event.preventDefault()
		pressedCameraKeys.add(event.code)
	}

	if (event.code === 'Digit0') {
		event.preventDefault()

		if (!event.repeat) {
			visualizer.resetCamera()
		}
	}

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

window.addEventListener('keyup', (event) => {
	if (cameraControlCodes.has(event.code)) {
		event.preventDefault()
		pressedCameraKeys.delete(event.code)
	}
})

window.addEventListener('blur', () => {
	pressedCameraKeys.clear()
	previousFrameMilliseconds = null
})

window.addEventListener('resize', updateViewportSize)

channel.subscribe((message) => {
	if (message.type === 'settingsChanged') {
		context.updateSettings(message.settings)
	}

	if (message.type === 'reloadMidi') {
		void reloadMidi(true, message.fileName)
	}
})

window.addEventListener('storage', (event) => {
	if (event.key?.startsWith('midi2visual.settings')) {
		context.updateSettings(loadSettings())
	}
})

window.addEventListener('beforeunload', () => {
	unsubscribeSettings()
	window.removeEventListener('resize', updateViewportSize)
	channel.close()
	visualizer.dispose()
})

updateViewportSize()
void reloadMidi(false, context.settings.midiFileName)
requestAnimationFrame(animate)
