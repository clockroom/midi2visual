import * as THREE from 'three'
import {
	calculateSparkAppearance,
	calculateSparkCount,
} from '../tuning/note-on'
import type { ActiveNoteImpactEffectQueue } from './active-effect-queue'
import { ActiveSparkEffect } from './active-spark'
import { createEffectSpriteMaterial } from './materials'
import { loadEffectTexture } from './texture'
import type { NoteImpactSpawnRequest } from './types'

const TEXTURE_PATH = '/assets/spark.png'

export class SparkEffects {
	private readonly textureLoader = new THREE.TextureLoader()
	private texture: THREE.Texture | null = null

	constructor(private readonly effectQueue: ActiveNoteImpactEffectQueue) {
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
			this.effectQueue.add(
				new ActiveSparkEffect({
					object: sprite,
					material,
					duration: appearance.duration,
					startScale: appearance.startScale,
					endScale: appearance.endScale,
					baseOpacity: material.opacity,
					startX: request.x,
					startY: request.y,
					velocityX: appearance.velocityX,
					velocityY: appearance.velocityY,
				}),
			)
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
