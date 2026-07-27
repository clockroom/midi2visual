import { SETTINGS_CHANNEL_NAME } from './settings'
import type { AppMessage } from './types'

export class AppChannel {
	private readonly channel = new BroadcastChannel(SETTINGS_CHANNEL_NAME)

	send(message: AppMessage): void {
		this.channel.postMessage(message)
	}

	subscribe(handler: (message: AppMessage) => void): () => void {
		const listener = (event: MessageEvent<unknown>): void => {
			if (!event.data || typeof event.data !== 'object' || !('type' in event.data)) {
				return
			}

			handler(event.data as AppMessage)
		}

		this.channel.addEventListener('message', listener)
		return () => this.channel.removeEventListener('message', listener)
	}

	close(): void {
		this.channel.close()
	}
}
