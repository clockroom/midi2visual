import type { MidiModel, TempoMarker } from '../shared/types'

export class MidiTimeMap {
	private readonly ppq: number
	private readonly markers: readonly TempoMarker[]

	constructor(model: MidiModel) {
		this.ppq = model.ppq
		this.markers = model.tempoMarkers
	}

	secondsToTicks(seconds: number): number {
		const timelineSeconds = Math.max(0, seconds)
		const marker = this.findMarkerBySeconds(timelineSeconds)
		const elapsedSeconds = timelineSeconds - marker.seconds
		const ticksPerSecond = (this.ppq * marker.bpm) / 60

		return marker.ticks + elapsedSeconds * ticksPerSecond
	}

	ticksToSeconds(ticks: number): number {
		const marker = this.findMarkerByTicks(ticks)
		const elapsedTicks = ticks - marker.ticks
		const ticksPerSecond = (this.ppq * marker.bpm) / 60

		return marker.seconds + elapsedTicks / ticksPerSecond
	}

	private findMarkerBySeconds(seconds: number): TempoMarker {
		let low = 0
		let high = this.markers.length

		while (low < high) {
			const middle = Math.floor((low + high) / 2)

			if (this.markers[middle].seconds <= seconds) {
				low = middle + 1
			} else {
				high = middle
			}
		}

		return this.markers[Math.max(0, low - 1)]
	}

	private findMarkerByTicks(ticks: number): TempoMarker {
		let low = 0
		let high = this.markers.length

		while (low < high) {
			const middle = Math.floor((low + high) / 2)

			if (this.markers[middle].ticks <= ticks) {
				low = middle + 1
			} else {
				high = middle
			}
		}

		return this.markers[Math.max(0, low - 1)]
	}
}
