import * as THREE from 'three'
import { TrackOrderer } from '../shared/track-order'
import type { MidiModel } from '../shared/types'
import { MidiTimeMap } from './core/midi-time-map'
import { StageLayout } from './core/stage-layout'
import { NoteLayer } from './notes/note-layer'
import { NoteOnReactionController } from './notes/note-on-reaction-controller'
import { OrbitCameraController } from './scene/orbit-camera-controller'
import {
	type StageContext,
	type StageSettingsChange,
} from './stage-context'
import { StageEnvironment } from './scene/stage-environment'
import { TimelineGuideLayer } from './scene/timeline-guide-layer'

export class MidiVisualizer {
	private readonly scene = new THREE.Scene()
	private readonly renderer: THREE.WebGLRenderer
	private readonly environment: StageEnvironment
	private readonly noteLayer: NoteLayer
	private readonly guideLayer: TimelineGuideLayer
	private readonly reactionController: NoteOnReactionController
	private readonly cameraController: OrbitCameraController
	private readonly trackOrderer = new TrackOrderer()
	private readonly unsubscribeSettings: () => void
	private model: MidiModel | null = null
	private timeMap: MidiTimeMap | null = null

	constructor(
		container: HTMLElement,
		private readonly context: StageContext,
	) {
		this.renderer = this.createRenderer(container)
		this.environment = new StageEnvironment(
			this.scene,
			context.settings,
		)
		this.noteLayer = new NoteLayer(context)
		this.guideLayer = new TimelineGuideLayer(context)
		this.reactionController = new NoteOnReactionController(context)
		this.cameraController = new OrbitCameraController(context)
		this.scene.add(
			this.noteLayer.group,
			this.guideLayer.group,
			this.reactionController.group,
		)
		window.addEventListener('resize', this.resize)
		this.unsubscribeSettings = context.subscribe((change) => {
			this.handleSettingsChanged(change)
		})
	}

	load(model: MidiModel): void {
		this.applyTrackOrder(model)
		const timeMap = new MidiTimeMap(model)
		const layout = new StageLayout(model, this.context.settings)
		this.model = model
		this.timeMap = timeMap
		this.noteLayer.load(model, timeMap, layout)
		this.guideLayer.load(model, layout)
		this.reactionController.load(model, layout)
		this.cameraController.configure(layout, true)
	}

	updateCameraControls(
		horizontalDirection: number,
		verticalDirection: number,
		zoomDirection: number,
		deltaSeconds: number,
	): void {
		this.cameraController.updateControls(
			horizontalDirection,
			verticalDirection,
			zoomDirection,
			deltaSeconds,
		)
	}

	resetCamera(): void {
		this.cameraController.reset()
	}

	render(songSeconds: number): void {
		if (!this.model) {
			return
		}

		this.noteLayer.update(songSeconds)
		this.guideLayer.update(songSeconds)
		this.reactionController.update(songSeconds)
		this.renderer.render(
			this.scene,
			this.cameraController.camera,
		)
	}

	dispose(): void {
		this.unsubscribeSettings()
		window.removeEventListener('resize', this.resize)
		this.noteLayer.dispose()
		this.guideLayer.dispose()
		this.reactionController.dispose()
		this.environment.dispose()
		this.scene.remove(
			this.noteLayer.group,
			this.guideLayer.group,
			this.reactionController.group,
		)
		this.renderer.dispose()
		this.renderer.domElement.remove()
	}

	private readonly resize = (): void => {
		const width = window.innerWidth
		const height = window.innerHeight
		this.renderer.setSize(width, height)
		this.cameraController.resize(width, height)
	}

	private createRenderer(container: HTMLElement): THREE.WebGLRenderer {
		const renderer = new THREE.WebGLRenderer({
			antialias: true,
			alpha: false,
			powerPreference: 'high-performance',
		})
		renderer.setPixelRatio(1)
		renderer.setSize(window.innerWidth, window.innerHeight)
		renderer.outputColorSpace = THREE.SRGBColorSpace
		renderer.toneMapping = THREE.ACESFilmicToneMapping
		renderer.toneMappingExposure = 1.1
		container.appendChild(renderer.domElement)
		return renderer
	}

	private handleSettingsChanged(change: StageSettingsChange): void {
		this.environment.apply(change.current)

		if (!this.model || !this.timeMap) {
			return
		}

		const trackOrderChanged = this.trackOrderChanged(change)

		if (trackOrderChanged) {
			this.applyTrackOrder(this.model)
		}

		const layout = new StageLayout(this.model, change.current)
		this.noteLayer.applySettingsChange(
			change,
			this.model,
			this.timeMap,
			layout,
		)
		this.guideLayer.applySettingsChange(change, this.model, layout)

		if (trackOrderChanged) {
			this.reactionController.load(this.model, layout)
		} else {
			this.reactionController.reconfigure(this.model, layout)
		}

		this.cameraController.configure(layout, false)
	}

	private applyTrackOrder(model: MidiModel): void {
		const settings = this.context.settings

		this.trackOrderer.apply(model.tracks, {
			mode: settings.trackOrderMode,
			reversed: settings.reverseTrackOrder,
			beatTicks: model.beatTicks,
		})
	}

	private trackOrderChanged({
		previous,
		current,
	}: StageSettingsChange): boolean {
		return (
			previous.trackOrderMode !== current.trackOrderMode ||
			previous.reverseTrackOrder !== current.reverseTrackOrder
		)
	}
}
