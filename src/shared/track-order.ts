import type { TrackId, VisualTrack } from './tracks'

export type TrackOrderMode = 'midi' | 'duration' | 'pitch' | 'smart'

export interface TrackOrderRequest {
	mode: TrackOrderMode
	reversed: boolean
	beatTicks: number
}

type TrackComparator = (left: VisualTrack, right: VisualTrack) => number

export class TrackOrderer {
	resolve(
		tracks: readonly VisualTrack[],
		request: TrackOrderRequest,
	): TrackId[] {
		const comparator = this.getComparator(request)
		const orderedTrackIds = [...tracks]
			.sort(comparator)
			.map((track) => track.id)

		if (request.reversed) {
			orderedTrackIds.reverse()
		}

		return orderedTrackIds
	}

	private getComparator({
		mode,
		beatTicks,
	}: TrackOrderRequest): TrackComparator {
		switch (mode) {
			case 'duration':
				return this.compareByDuration
			case 'pitch':
				return this.compareByPitch
			case 'smart':
				return this.createSmartComparator(beatTicks)
			case 'midi':
			default:
				return this.compareBySourceIndex
		}
	}

	private readonly compareBySourceIndex: TrackComparator = (
		left,
		right,
	) => left.sourceIndex - right.sourceIndex

	private readonly compareByDuration: TrackComparator = (
		left,
		right,
	) =>
		this.compareDescending(
			left.maxNoteDurationTicks,
			right.maxNoteDurationTicks,
		) ||
		this.compareDescending(left.averagePitch, right.averagePitch) ||
		this.compareBySourceIndex(left, right)

	private readonly compareByPitch: TrackComparator = (
		left,
		right,
	) =>
		this.compareDescending(left.averagePitch, right.averagePitch) ||
		this.compareDescending(
			left.maxNoteDurationTicks,
			right.maxNoteDurationTicks,
		) ||
		this.compareBySourceIndex(left, right)

	private createSmartComparator(beatTicks: number): TrackComparator {
		const longNoteThresholdTicks = beatTicks * 8

		return (left, right) => {
			const leftHasLongNote =
				left.maxNoteDurationTicks > longNoteThresholdTicks
			const rightHasLongNote =
				right.maxNoteDurationTicks > longNoteThresholdTicks

			if (leftHasLongNote !== rightHasLongNote) {
				return leftHasLongNote ? -1 : 1
			}

			return leftHasLongNote
				? this.compareByDuration(left, right)
				: this.compareByPitch(left, right)
		}
	}

	private compareDescending(left: number, right: number): number {
		return right - left
	}
}
