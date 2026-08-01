import * as THREE from 'three'
import {
	calculateSparkAppearance,
	calculateSparkCount,
} from '../effect-tuning/note-on'
import type { ActiveNoteImpactEffects } from './active-effects'
import { createEffectSpriteMaterial } from './materials'
import { loadEffectTexture } from './texture'
import type { NoteImpactSpawnRequest } from './types'

const TEXTURE_PATH = '/assets/spark.png'

export class SparkEffects {
	private readonly textureLoader = new THREE.TextureLoader()
	private texture: THREE.Texture | null = null

	constructor(private readonly activeEffects: ActiveNoteImpactEffects) {
		void this.loadTexture()
	}

	trigger(request: NoteImpactSpawnRequest): void {
		if (!this.texture) {
			return
		}

		const count = calculateSparkCount(request.velocity)

		for (let index = 0; index < count; index += 1) {
			const appearance = calculateSparkAppearance(request.velocity)
			const material = createEffectSpriteMaterial(
				this.texture,
				request.color,
				appearance.opacity,
			)
			const sprite = new THREE.Sprite(material)
			sprite.position.set(request.x, request.y, appearance.depth)
			this.activeEffects.add({
				kind: 'spark',
				object: sprite,
				material,
				duration: appearance.duration,
				startScale: appearance.startScale,
				endScale: appearance.endScale,
				baseOpacity: material.opacity,
				startX: request.x,
				startY: request.y,
				onFrame: (object, frame) => {
					object.position.x =
						request.x + appearance.velocityX * frame.travel
					object.position.y =
						request.y + appearance.velocityY * frame.travel
				},
			})
		}
	}

	dispose(): void {
		this.texture?.dispose()
		this.texture = null
	}

	private async loadTexture(): Promise<void> {
		try {
			this.texture = await loadEffectTexture(
				this.textureLoader,
				TEXTURE_PATH,
			)
		} catch (error) {
			console.warn('Spark texture could not be loaded.', error)
		}
	}
}
