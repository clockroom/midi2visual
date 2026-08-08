import type { VisualNote } from './types'
import {
	TrackOrderer,
	type TrackOrderRequest,
} from './track-order'

export type TrackId = number

export interface VisualTrackInit {
	id: TrackId
	sourceIndex: number
	name: string
	notes: readonly VisualNote[]
}

export class VisualTrack {
	readonly id: TrackId
	readonly sourceIndex: number
	readonly name: string
	readonly notes: readonly VisualNote[]
	readonly maxNoteDurationTicks: number
	readonly averagePitch: number

	constructor({
		id,
		sourceIndex,
		name,
		notes,
	}: VisualTrackInit) {
		if (notes.length === 0) {
			throw new Error('VisualTrack requires at least one note.')
		}

		this.id = id
		this.sourceIndex = sourceIndex
		this.name = name
		this.notes = Object.freeze([...notes])

		let maxNoteDurationTicks = 0
		let pitchTotal = 0

		for (const note of notes) {
			maxNoteDurationTicks = Math.max(
				maxNoteDurationTicks,
				note.endTicks - note.startTicks,
			)
			pitchTotal += note.pitch
		}

		this.maxNoteDurationTicks = maxNoteDurationTicks
		this.averagePitch = pitchTotal / notes.length
	}
}

export class TrackCollection {
	private readonly tracksById = new Map<TrackId, VisualTrack>()
	private readonly orderer = new TrackOrderer()
	private orderedTracks: readonly VisualTrack[]
	private readonly displayIndexById = new Map<TrackId, number>()

	constructor(tracks: readonly VisualTrack[]) {
		this.orderedTracks = Object.freeze([...tracks])

		for (const track of tracks) {
			if (this.tracksById.has(track.id)) {
				throw new Error(`Duplicate Track ID: ${track.id}`)
			}

			this.tracksById.set(track.id, track)
		}

		this.rebuildDisplayIndexes()
	}

	get count(): number {
		return this.orderedTracks.length
	}

	get tracks(): readonly VisualTrack[] {
		return this.orderedTracks
	}

	getById(trackId: TrackId): VisualTrack {
		const track = this.tracksById.get(trackId)

		if (!track) {
			throw new Error(`Unknown Track ID: ${trackId}`)
		}

		return track
	}

	getAt(displayIndex: number): VisualTrack {
		const track = this.orderedTracks[displayIndex]

		if (!track) {
			throw new Error(`Unknown Track display index: ${displayIndex}`)
		}

		return track
	}

	getDisplayIndex(trackId: TrackId): number {
		const displayIndex = this.displayIndexById.get(trackId)

		if (displayIndex === undefined) {
			throw new Error(`Unknown Track ID: ${trackId}`)
		}

		return displayIndex
	}

	applyOrder(request: TrackOrderRequest): void {
		this.reorder(this.orderer.resolve(this.orderedTracks, request))
	}

	private reorder(orderedTrackIds: readonly TrackId[]): void {
		if (orderedTrackIds.length !== this.count) {
			throw new Error('Track order must contain every Track ID exactly once.')
		}

		const uniqueTrackIds = new Set(orderedTrackIds)

		if (uniqueTrackIds.size !== this.count) {
			throw new Error('Track order contains duplicate Track IDs.')
		}

		this.orderedTracks = Object.freeze(
			orderedTrackIds.map((trackId) => this.getById(trackId)),
		)
		this.rebuildDisplayIndexes()
	}

	private rebuildDisplayIndexes(): void {
		this.displayIndexById.clear()

		this.orderedTracks.forEach((track, displayIndex) => {
			this.displayIndexById.set(track.id, displayIndex)
		})
	}
}
