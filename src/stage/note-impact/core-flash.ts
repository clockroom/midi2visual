import * as THREE from 'three'
import { calculateCoreFlashAppearance } from '../effect-tuning/note-on'
import type { ActiveNoteImpactEffects } from './active-effects'
import { createEffectSpriteMaterial } from './materials'
import { loadEffectTexture } from './texture'
import type { NoteImpactSpawnRequest } from './types'

const TEXTURE_PATH = '/assets/flare.png'

export class CoreFlashEffect {
	private readonly textureLoader = new THREE.TextureLoader()
	private texture: THREE.Texture | null = null

	constructor(private readonly activeEffects: ActiveNoteImpactEffects) {
		void this.loadTexture()
	}

	trigger(request: NoteImpactSpawnRequest): void {
		if (!this.texture) {
			return
		}

		const appearance = calculateCoreFlashAppearance(request.velocity)
		const material = createEffectSpriteMaterial(
			this.texture,
			request.color,
			appearance.opacity,
		)
		const sprite = new THREE.Sprite(material)
		sprite.position.set(request.x, request.y, appearance.depth)
		this.activeEffects.add({
			kind: 'flash',
			object: sprite,
			material,
			duration: appearance.duration,
			startScale: appearance.startScale,
			endScale: appearance.endScale,
			baseOpacity: material.opacity,
			startX: request.x,
			startY: request.y,
		})
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
			console.warn('Core flash texture could not be loaded.', error)
		}
	}
}
