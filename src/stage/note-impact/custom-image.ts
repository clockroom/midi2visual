import * as THREE from 'three'
import {
	normalizePublicFileName,
	toPublicFileUrl,
} from '../../shared/public-files'
import {
	calculateCustomEffectAppearance,
	getCustomEffectPositionTolerance,
} from '../effect-tuning/note-on'
import {
	type StageContext,
	type StageSettingsChange,
} from '../stage-context'
import { ActiveCustomImageEffect } from './active-custom-image'
import type { ActiveNoteImpactEffectQueue } from './active-effect-queue'
import { createEffectPlaneMaterial } from './materials'
import { loadEffectTexture } from './texture'
import type { NoteImpactSpawnRequest } from './types'

const DEFAULT_FILE_NAME = 'custom.png'

export class CustomImageEffect {
	private readonly textureLoader = new THREE.TextureLoader()
	private readonly geometry = new THREE.PlaneGeometry(1, 1)
	private texture: THREE.Texture | null = null
	private textureFileName = ''
	private loadGeneration = 0
	private readonly unsubscribeSettings: () => void

	constructor(
		private readonly effectQueue: ActiveNoteImpactEffectQueue,
		private readonly context: StageContext,
	) {
		this.unsubscribeSettings = context.subscribe((change) => {
			this.handleSettingsChanged(change)
		})
		void this.loadTextureIfNeeded()
	}

	trigger(request: NoteImpactSpawnRequest): void {
		if (!this.texture) {
			return
		}

		this.effectQueue.clearAt(
			'custom',
			request.x,
			request.y,
			getCustomEffectPositionTolerance(),
		)

		const settings = this.context.settings
		const appearance = calculateCustomEffectAppearance({
			velocity: request.velocity,
			configuredDuration: settings.customImpactDuration,
			configuredOpacity: settings.customImpactOpacity,
			configuredStartScale: settings.customImpactStartScale,
			configuredEndScale: settings.customImpactEndScale,
			scaleMode: settings.customImpactScaleMode,
			noteSize: settings.noteSize,
		})
		const material = createEffectPlaneMaterial(
			this.texture,
			request.color,
			appearance.opacity,
			THREE.NormalBlending,
		)
		const mesh = new THREE.Mesh(this.geometry, material)
		mesh.position.set(request.x, request.y, appearance.depth)
		this.effectQueue.add(
			new ActiveCustomImageEffect({
				object: mesh,
				material,
				duration: appearance.duration,
				startScale: appearance.startScale,
				endScale: appearance.endScale,
				baseOpacity: material.opacity,
				startX: request.x,
				startY: request.y,
			}),
		)
	}

	dispose(): void {
		this.unsubscribeSettings()
		this.loadGeneration += 1
		this.geometry.dispose()
		this.texture?.dispose()
		this.texture = null
		this.textureFileName = ''
	}

	private handleSettingsChanged({
		previous,
		current,
	}: StageSettingsChange): void {
		if (
			previous.showCustomImpactImage !== current.showCustomImpactImage ||
			previous.customImpactImageFileName !== current.customImpactImageFileName
		) {
			void this.loadTextureIfNeeded()
		}
	}

	private async loadTextureIfNeeded(): Promise<void> {
		const generation = ++this.loadGeneration
		const settings = this.context.settings

		if (!settings.showCustomImpactImage) {
			this.texture?.dispose()
			this.texture = null
			this.textureFileName = ''
			return
		}

		const fileName = normalizePublicFileName(
			settings.customImpactImageFileName,
			DEFAULT_FILE_NAME,
			'.png',
		)

		if (this.texture && this.textureFileName === fileName) {
			return
		}

		try {
			const texture = await loadEffectTexture(
				this.textureLoader,
				`${toPublicFileUrl(fileName)}?v=${Date.now()}`,
			)

			if (generation !== this.loadGeneration) {
				texture.dispose()
				return
			}

			this.texture?.dispose()
			this.texture = texture
			this.textureFileName = fileName
		} catch (error) {
			if (generation !== this.loadGeneration) {
				return
			}

			this.texture?.dispose()
			this.texture = null
			this.textureFileName = ''
			console.warn(
				`Custom effect image could not be loaded: ${fileName}`,
				error,
			)
		}
	}
}
