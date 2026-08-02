import * as THREE from 'three'
import type { MidiModel } from '../shared/types'
import {
	BeatGuideFrame,
	type GuideFrame,
	MeasureGuideFrame,
	PlayheadGuideFrame,
} from './guide-frame'
import {
	type StageContext,
	type StageSettingsChange,
} from './stage-context'
import type { StageLayout } from './stage-layout'

export class TimelineGuideLayer {
	readonly group = new THREE.Group()

	private readonly movingFramesGroup = new THREE.Group()
	private readonly playheadGroup = new THREE.Group()
	private readonly frames: GuideFrame[] = []

	constructor(private readonly context: StageContext) {
		this.group.add(this.movingFramesGroup, this.playheadGroup)
	}

	load(model: MidiModel, layout: StageLayout): void {
		this.clear()
		this.buildTimelineFrames(model, layout)
		this.addFrame(new PlayheadGuideFrame(layout), this.playheadGroup)
	}

	applySettingsChange(
		{ previous, current }: StageSettingsChange,
		model: MidiModel,
		layout: StageLayout,
	): void {
		if (
			previous.showMeasureFrames !== current.showMeasureFrames ||
			previous.showBeatFrames !== current.showBeatFrames ||
			previous.frameOpacity !== current.frameOpacity ||
			previous.timeUnitsPerSecond !== current.timeUnitsPerSecond ||
			previous.trackSpacing !== current.trackSpacing
		) {
			this.load(model, layout)
		}
	}

	update(songSeconds: number): void {
		this.movingFramesGroup.position.z =
			songSeconds * this.context.settings.timeUnitsPerSecond
	}

	clear(): void {
		for (const frame of this.frames) {
			this.movingFramesGroup.remove(frame.object)
			this.playheadGroup.remove(frame.object)
			frame.dispose()
		}

		this.frames.length = 0
	}

	dispose(): void {
		this.clear()
		this.group.remove(this.movingFramesGroup, this.playheadGroup)
	}

	private buildTimelineFrames(
		model: MidiModel,
		layout: StageLayout,
	): void {
		const settings = this.context.settings

		if (settings.showMeasureFrames) {
			for (const marker of model.measureMarkers) {
				this.addFrame(
					new MeasureGuideFrame(
						layout,
						-marker.seconds * settings.timeUnitsPerSecond,
						settings.frameOpacity,
					),
					this.movingFramesGroup,
				)
			}
		}

		if (settings.showBeatFrames) {
			for (const marker of model.beatMarkers) {
				this.addFrame(
					new BeatGuideFrame(
						layout,
						-marker.seconds * settings.timeUnitsPerSecond,
						settings.frameOpacity,
					),
					this.movingFramesGroup,
				)
			}
		}
	}

	private addFrame(frame: GuideFrame, group: THREE.Group): void {
		this.frames.push(frame)
		group.add(frame.object)
	}
}
