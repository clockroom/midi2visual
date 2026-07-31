import * as THREE from 'three'
import { normalizePublicFileName, toPublicFileUrl } from '../shared/public-files'
import type { AppSettings } from '../shared/types'
import {
	EFFECT_TUNING,
	calculateCoreFlashAppearance,
	calculateCustomEffectAppearance,
	calculateImpactRingAppearance,
	calculateNoteImpactFrame,
	calculateSparkAppearance,
	calculateSparkCount,
	type NoteImpactKind,
} from './effect-tuning'

interface ActiveEffect {
	kind: NoteImpactKind
	object: THREE.Sprite | THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
	material: THREE.SpriteMaterial | THREE.MeshBasicMaterial
	age: number
	duration: number
	startScale: number
	endScale: number
	baseOpacity: number
	startX: number
	startY: number
	velocityX: number
	velocityY: number
}

const BUILT_IN_TEXTURE_PATHS = {
	flash: '/assets/flare.png',
	ring: '/assets/ring.png',
	spark: '/assets/spark.png',
} as const

const CUSTOM_DEFAULT_FILE_NAME = 'custom.png'

export class NoteImpactEffects {
	private readonly textureLoader = new THREE.TextureLoader()
	private readonly planeGeometry = new THREE.PlaneGeometry(1, 1)
	private readonly activeEffects: ActiveEffect[] = []
	private flashTexture: THREE.Texture | null = null
	private ringTexture: THREE.Texture | null = null
	private sparkTexture: THREE.Texture | null = null
	private customTexture: THREE.Texture | null = null
	private customTextureFileName = ''
	private customLoadGeneration = 0
	private settings: AppSettings

	constructor(
		private readonly group: THREE.Group,
		settings: AppSettings,
	) {
		this.settings = settings
		void this.loadBuiltInTextures()
		void this.loadCustomTextureIfNeeded()
	}

	applySettings(settings: AppSettings): void {
		const previous = this.settings
		this.settings = settings

		if (previous.showCoreFlash && !settings.showCoreFlash) {
			this.clearKind('flash')
		}

		if (previous.showImpactRing && !settings.showImpactRing) {
			this.clearKind('ring')
		}

		if (previous.showSparks && !settings.showSparks) {
			this.clearKind('spark')
		}

		if (previous.showCustomImpactImage && !settings.showCustomImpactImage) {
			this.clearKind('custom')
		}

		if (
			previous.showCustomImpactImage !== settings.showCustomImpactImage ||
			previous.customImpactImageFileName !== settings.customImpactImageFileName
		) {
			void this.loadCustomTextureIfNeeded()
		}
	}

	trigger(x: number, y: number, color: number, velocity: number): void {
		if (this.settings.showCoreFlash && this.flashTexture) {
			this.createFlash(x, y, color, velocity)
		}

		if (this.settings.showImpactRing && this.ringTexture) {
			this.createRing(x, y, color, velocity)
		}

		if (this.settings.showSparks && this.sparkTexture) {
			this.createSparks(x, y, color, velocity)
		}

		if (this.settings.showCustomImpactImage && this.customTexture) {
			this.createCustomImage(x, y, color, velocity)
		}
	}

	update(deltaSeconds: number): void {
		const safeDeltaSeconds = THREE.MathUtils.clamp(
			deltaSeconds,
			0,
			EFFECT_TUNING.noteImpact.maxDeltaSeconds,
		)

		for (let index = this.activeEffects.length - 1; index >= 0; index -= 1) {
			const effect = this.activeEffects[index]
			effect.age += safeDeltaSeconds
			const frame = calculateNoteImpactFrame(
				effect.kind,
				effect.age,
				effect.duration,
				effect.startScale,
				effect.endScale,
				effect.baseOpacity,
			)

			if (frame.complete) {
				this.removeAt(index)
				continue
			}

			effect.object.scale.setScalar(frame.scale)
			effect.material.opacity = frame.opacity

			if (effect.kind === 'spark') {
				effect.object.position.x =
					effect.startX + effect.velocityX * frame.travel
				effect.object.position.y =
					effect.startY + effect.velocityY * frame.travel
			}
		}
	}

	clear(): void {
		for (let index = this.activeEffects.length - 1; index >= 0; index -= 1) {
			this.removeAt(index)
		}
	}

	dispose(): void {
		this.clear()
		this.planeGeometry.dispose()
		this.flashTexture?.dispose()
		this.ringTexture?.dispose()
		this.sparkTexture?.dispose()
		this.customTexture?.dispose()
	}

	private async loadBuiltInTextures(): Promise<void> {
		const results = await Promise.allSettled([
			this.loadTexture(BUILT_IN_TEXTURE_PATHS.flash),
			this.loadTexture(BUILT_IN_TEXTURE_PATHS.ring),
			this.loadTexture(BUILT_IN_TEXTURE_PATHS.spark),
		])

		if (results[0].status === 'fulfilled') {
			this.flashTexture = results[0].value
		} else {
			console.warn('Core flash texture could not be loaded.', results[0].reason)
		}

		if (results[1].status === 'fulfilled') {
			this.ringTexture = results[1].value
		} else {
			console.warn('Impact ring texture could not be loaded.', results[1].reason)
		}

		if (results[2].status === 'fulfilled') {
			this.sparkTexture = results[2].value
		} else {
			console.warn('Spark texture could not be loaded.', results[2].reason)
		}
	}

	private async loadCustomTextureIfNeeded(): Promise<void> {
		const generation = ++this.customLoadGeneration

		if (!this.settings.showCustomImpactImage) {
			this.customTexture?.dispose()
			this.customTexture = null
			this.customTextureFileName = ''
			return
		}

		const fileName = normalizePublicFileName(
			this.settings.customImpactImageFileName,
			CUSTOM_DEFAULT_FILE_NAME,
			'.png',
		)

		if (this.customTexture && this.customTextureFileName === fileName) {
			return
		}

		try {
			const texture = await this.loadTexture(
				`${toPublicFileUrl(fileName)}?v=${Date.now()}`,
			)

			if (generation !== this.customLoadGeneration) {
				texture.dispose()
				return
			}

			this.customTexture?.dispose()
			this.customTexture = texture
			this.customTextureFileName = fileName
		} catch (error) {
			if (generation !== this.customLoadGeneration) {
				return
			}

			this.customTexture?.dispose()
			this.customTexture = null
			this.customTextureFileName = ''
			console.warn(`Custom effect image could not be loaded: ${fileName}`, error)
		}
	}

	private async loadTexture(url: string): Promise<THREE.Texture> {
		const texture = await this.textureLoader.loadAsync(url)
		texture.colorSpace = THREE.SRGBColorSpace
		texture.minFilter = THREE.LinearMipmapLinearFilter
		texture.magFilter = THREE.LinearFilter
		texture.generateMipmaps = true
		return texture
	}

	private createFlash(
		x: number,
		y: number,
		color: number,
		velocity: number,
	): void {
		if (!this.flashTexture) {
			return
		}

		const appearance = calculateCoreFlashAppearance(velocity)
		const material = this.createSpriteMaterial(
			this.flashTexture,
			color,
			appearance.opacity,
		)
		const sprite = new THREE.Sprite(material)
		sprite.position.set(x, y, appearance.depth)
		this.group.add(sprite)
		this.addEffect({
			kind: 'flash',
			object: sprite,
			material,
			age: 0,
			duration: appearance.duration,
			startScale: appearance.startScale,
			endScale: appearance.endScale,
			baseOpacity: material.opacity,
			startX: x,
			startY: y,
			velocityX: 0,
			velocityY: 0,
		})
	}

	private createRing(
		x: number,
		y: number,
		color: number,
		velocity: number,
	): void {
		if (!this.ringTexture) {
			return
		}

		const appearance = calculateImpactRingAppearance(velocity)
		const material = this.createPlaneMaterial(
			this.ringTexture,
			color,
			appearance.opacity,
		)
		const mesh = new THREE.Mesh(this.planeGeometry, material)
		mesh.position.set(x, y, appearance.depth)
		this.group.add(mesh)
		this.addEffect({
			kind: 'ring',
			object: mesh,
			material,
			age: 0,
			duration: appearance.duration,
			startScale: appearance.startScale,
			endScale: appearance.endScale,
			baseOpacity: material.opacity,
			startX: x,
			startY: y,
			velocityX: 0,
			velocityY: 0,
		})
	}

	private createSparks(
		x: number,
		y: number,
		color: number,
		velocity: number,
	): void {
		if (!this.sparkTexture) {
			return
		}

		const count = calculateSparkCount(velocity)

		for (let index = 0; index < count; index += 1) {
			const appearance = calculateSparkAppearance(velocity)
			const material = this.createSpriteMaterial(
				this.sparkTexture,
				color,
				appearance.opacity,
			)
			const sprite = new THREE.Sprite(material)
			sprite.position.set(x, y, appearance.depth)
			this.group.add(sprite)
			this.addEffect({
				kind: 'spark',
				object: sprite,
				material,
				age: 0,
				duration: appearance.duration,
				startScale: appearance.startScale,
				endScale: appearance.endScale,
				baseOpacity: material.opacity,
				startX: x,
				startY: y,
				velocityX: appearance.velocityX,
				velocityY: appearance.velocityY,
			})
		}
	}

	private createCustomImage(
		x: number,
		y: number,
		color: number,
		velocity: number,
	): void {
		if (!this.customTexture) {
			return
		}

		this.clearCustomAt(x, y)

		const appearance = calculateCustomEffectAppearance({
			velocity,
			configuredDuration: this.settings.customImpactDuration,
			configuredOpacity: this.settings.customImpactOpacity,
			configuredStartScale: this.settings.customImpactStartScale,
			configuredEndScale: this.settings.customImpactEndScale,
			scaleMode: this.settings.customImpactScaleMode,
			noteSize: this.settings.noteSize,
		})
		const material = this.createPlaneMaterial(
			this.customTexture,
			color,
			appearance.opacity,
			THREE.NormalBlending,
		)
		const mesh = new THREE.Mesh(this.planeGeometry, material)
		mesh.position.set(x, y, appearance.depth)
		this.group.add(mesh)
		this.addEffect({
			kind: 'custom',
			object: mesh,
			material,
			age: 0,
			duration: appearance.duration,
			startScale: appearance.startScale,
			endScale: appearance.endScale,
			baseOpacity: appearance.opacity,
			startX: x,
			startY: y,
			velocityX: 0,
			velocityY: 0,
		})
	}

	private createSpriteMaterial(
		texture: THREE.Texture,
		color: number,
		opacity: number,
	): THREE.SpriteMaterial {
		const material = new THREE.SpriteMaterial({
			map: texture,
			color,
			transparent: true,
			opacity,
			blending: THREE.AdditiveBlending,
			depthWrite: false,
			depthTest: true,
			fog: false,
		})
		return material
	}

	private createPlaneMaterial(
		texture: THREE.Texture,
		color: number,
		opacity: number,
		blending: THREE.Blending = THREE.AdditiveBlending,
	): THREE.MeshBasicMaterial {
		const material = new THREE.MeshBasicMaterial({
			map: texture,
			color,
			transparent: true,
			opacity,
			blending,
			depthWrite: false,
			depthTest: true,
			side: THREE.DoubleSide,
			fog: false,
		})
		return material
	}

	private addEffect(effect: ActiveEffect): void {
		effect.object.scale.setScalar(effect.startScale)
		this.activeEffects.push(effect)

		while (
			this.activeEffects.length >
				EFFECT_TUNING.noteImpact.maxActiveEffects
		) {
			this.removeAt(0)
		}
	}

	private clearKind(kind: NoteImpactKind): void {
		for (let index = this.activeEffects.length - 1; index >= 0; index -= 1) {
			if (this.activeEffects[index].kind === kind) {
				this.removeAt(index)
			}
		}
	}

	private clearCustomAt(x: number, y: number): void {
		const positionTolerance = EFFECT_TUNING.custom.positionTolerance

		for (let index = this.activeEffects.length - 1; index >= 0; index -= 1) {
			const effect = this.activeEffects[index]

			if (
				effect.kind === 'custom' &&
				Math.abs(effect.startX - x) < positionTolerance &&
				Math.abs(effect.startY - y) < positionTolerance
			) {
				this.removeAt(index)
			}
		}
	}

	private removeAt(index: number): void {
		const [effect] = this.activeEffects.splice(index, 1)

		if (!effect) {
			return
		}

		this.group.remove(effect.object)
		effect.material.dispose()
	}
}
