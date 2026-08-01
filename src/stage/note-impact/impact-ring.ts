import * as THREE from 'three'
import { calculateImpactRingAppearances } from '../effect-tuning/note-on'
import type { ActiveNoteImpactEffects } from './active-effects'
import { createEffectPlaneMaterial } from './materials'
import { loadEffectTexture } from './texture'
import type { NoteImpactSpawnRequest } from './types'

const TEXTURE_PATH = '/assets/ring.png'

export class ImpactRingEffect {
	private readonly textureLoader = new THREE.TextureLoader()
	private readonly geometry = new THREE.PlaneGeometry(1, 1)
	private texture: THREE.Texture | null = null

	constructor(private readonly activeEffects: ActiveNoteImpactEffects) {
		void this.loadTexture()
	}

	trigger(request: NoteImpactSpawnRequest): void {
		if (!this.texture) {
			return
		}

		const appearances = calculateImpactRingAppearances(request.velocity)

		for (const appearance of appearances) {
			const material = createEffectPlaneMaterial(
				this.texture,
				request.color,
				appearance.opacity,
			)
			const mesh = new THREE.Mesh(this.geometry, material)
			mesh.position.set(request.x, request.y, appearance.depth)
			this.activeEffects.add({
				kind: 'ring',
				object: mesh,
				material,
				delaySeconds: appearance.delaySeconds,
				duration: appearance.duration,
				startScale: appearance.startScale,
				endScale: appearance.endScale,
				baseOpacity: material.opacity,
				startX: request.x,
				startY: request.y,
				velocityX: 0,
				velocityY: 0,
			})
		}
	}

	dispose(): void {
		this.geometry.dispose()
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
			console.warn('Impact ring texture could not be loaded.', error)
		}
	}
}
