export class PlaybackTimeline {
	private playing = false
	private anchorMilliseconds = 0
	private anchorSongSeconds = 0
	private songSeconds = 0

	constructor(
		private preRollSeconds: number,
		private postRollSeconds: number,
		private durationSeconds: number,
	) {
		this.songSeconds = -preRollSeconds
	}

	get currentSeconds(): number {
		return this.songSeconds
	}

	get isPlaying(): boolean {
		return this.playing
	}

	reconfigure(preRollSeconds: number, postRollSeconds: number, durationSeconds: number): void {
		const wasAtStart = this.songSeconds <= -this.preRollSeconds
		this.preRollSeconds = preRollSeconds
		this.postRollSeconds = postRollSeconds
		this.durationSeconds = durationSeconds

		if (wasAtStart && !this.playing) {
			this.songSeconds = -preRollSeconds
		}
	}

	playFromStart(nowMilliseconds: number): void {
		this.playing = true
		this.anchorMilliseconds = nowMilliseconds
		this.anchorSongSeconds = -this.preRollSeconds
		this.songSeconds = this.anchorSongSeconds
	}

	stop(): void {
		this.playing = false
		this.songSeconds = -this.preRollSeconds
	}

	update(nowMilliseconds: number): number {
		if (!this.playing) {
			return this.songSeconds
		}

		const elapsedSeconds = (nowMilliseconds - this.anchorMilliseconds) / 1000
		this.songSeconds = this.anchorSongSeconds + elapsedSeconds
		const endSeconds = this.durationSeconds + this.postRollSeconds

		if (this.songSeconds >= endSeconds) {
			this.songSeconds = endSeconds
			this.playing = false
		}

		return this.songSeconds
	}
}
