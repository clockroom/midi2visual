import * as THREE from 'three'
import { normalizePublicFileName, toPublicFileUrl } from '../shared/public-files'
import type { AppSettings } from '../shared/types'
import {
	applyDistanceVisibility,
	type DistanceVisibilityUniform,
} from './distance-visibility'

type EffectKind = 'flash' | 'ring' | 'spark' | 'custom'

interface ActiveEffect {
	kind: EffectKind
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

const MAX_ACTIVE_EFFECTS = 768
const FLASH_DURATION = 0.18
const RING_DURATION = 0.55
const CUSTOM_DEFAULT_FILE_NAME = 'custom.png'

function easeOutCubic(value: number): number {
	return 1 - Math.pow(1 - value, 3)
}

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
	private readonly distanceVisibilityUniform: DistanceVisibilityUniform
	private settings: AppSettings

	constructor(
		private readonly group: THREE.Group,
		settings: AppSettings,
	) {
		this.settings = settings
		this.distanceVisibilityUniform = {
			value: settings.distanceVisibility,
		}
		void this.loadBuiltInTextures()
		void this.loadCustomTextureIfNeeded()
	}

	applySettings(settings: AppSettings): void {
		const previous = this.settings
		this.settings = settings
		this.distanceVisibilityUniform.value = settings.distanceVisibility

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
		const normalizedVelocity = THREE.MathUtils.clamp(velocity, 0, 1)

		if (this.settings.showCoreFlash && this.flashTexture) {
			this.createFlash(x, y, color, normalizedVelocity)
		}

		if (this.settings.showImpactRing && this.ringTexture) {
			this.createRing(x, y, color, normalizedVelocity)
		}

		if (this.settings.showSparks && this.sparkTexture) {
			this.createSparks(x, y, color, normalizedVelocity)
		}

		if (this.settings.showCustomImpactImage && this.customTexture) {
			this.createCustomImage(x, y, color, normalizedVelocity)
		}
	}

	update(deltaSeconds: number): void {
		const safeDeltaSeconds = THREE.MathUtils.clamp(deltaSeconds, 0, 0.1)

		for (let index = this.activeEffects.length - 1; index >= 0; index -= 1) {
			const effect = this.activeEffects[index]
			effect.age += safeDeltaSeconds
			const progress = THREE.MathUtils.clamp(effect.age / effect.duration, 0, 1)

			if (progress >= 1) {
				this.removeAt(index)
				continue
			}

			const easedProgress = easeOutCubic(progress)
			const scale = THREE.MathUtils.lerp(
				effect.startScale,
				effect.endScale,
				easedProgress,
			)
			effect.object.scale.setScalar(scale)

			if (effect.kind === 'custom') {
				const fadeProgress =
					progress <= 0.15 ? 0 : (progress - 0.15) / 0.85
				effect.material.opacity =
					effect.baseOpacity * (1 - THREE.MathUtils.clamp(fadeProgress, 0, 1))
			} else {
				effect.material.opacity = effect.baseOpacity * (1 - progress)
			}

			if (effect.kind === 'spark') {
				const travel = effect.age * (1 - progress * 0.35)
				effect.object.position.x = effect.startX + effect.velocityX * travel
				effect.object.position.y = effect.startY + effect.velocityY * travel
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

		const material = this.createSpriteMaterial(this.flashTexture, color, 0.45 + velocity * 0.5)
		const sprite = new THREE.Sprite(material)
		sprite.position.set(x, y, 0.12)
		this.group.add(sprite)
		this.addEffect({
			kind: 'flash',
			object: sprite,
			material,
			age: 0,
			duration: FLASH_DURATION,
			startScale: 0.28 + velocity * 0.18,
			endScale: 1 + velocity * 0.7,
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

		const material = this.createPlaneMaterial(this.ringTexture, color, 0.35 + velocity * 0.5)
		const mesh = new THREE.Mesh(this.planeGeometry, material)
		mesh.position.set(x, y, 0.07)
		this.group.add(mesh)
		this.addEffect({
			kind: 'ring',
			object: mesh,
			material,
			age: 0,
			duration: RING_DURATION,
			startScale: 0.35 + velocity * 0.2,
			endScale: 1.5 + velocity * 1.3,
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

		const count = Math.round(3 + velocity * 5)

		for (let index = 0; index < count; index += 1) {
			const angle = Math.random() * Math.PI * 2
			const speed = 1.4 + Math.random() * 1.2 + velocity * 1.8
			const material = this.createSpriteMaterial(
				this.sparkTexture,
				color,
				0.5 + velocity * 0.5,
			)
			const sprite = new THREE.Sprite(material)
			sprite.position.set(x, y, 0.14)
			this.group.add(sprite)
			this.addEffect({
				kind: 'spark',
				object: sprite,
				material,
				age: 0,
				duration: 0.6 + Math.random() * 0.35,
				startScale: 0.48 + velocity * 0.34,
				endScale: 0.12,
				baseOpacity: material.opacity,
				startX: x,
				startY: y,
				velocityX: Math.cos(angle) * speed,
				velocityY: Math.sin(angle) * speed,
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

		const velocityScale = 0.75 + velocity * 0.5
		const configuredStart = this.settings.customImpactStartScale * velocityScale
		const configuredEnd = this.settings.customImpactEndScale * velocityScale
		const requestedStartScale =
			this.settings.customImpactScaleMode === 'expand'
				? configuredStart
				: configuredEnd
		const minimumCoverScale = this.settings.noteSize * 1.5
		const startScale = Math.max(requestedStartScale, minimumCoverScale)
		const endScale =
			this.settings.customImpactScaleMode === 'expand'
				? configuredEnd
				: configuredStart
		const baseOpacity =
			this.settings.customImpactOpacity * (0.55 + velocity * 0.45)
		const material = this.createPlaneMaterial(
			this.customTexture,
			color,
			baseOpacity,
			THREE.NormalBlending,
		)
		applyDistanceVisibility(
			material,
			this.distanceVisibilityUniform,
		)
		const mesh = new THREE.Mesh(this.planeGeometry, material)
		mesh.position.set(x, y, 0.1)
		this.group.add(mesh)
		this.addEffect({
			kind: 'custom',
			object: mesh,
			material,
			age: 0,
			duration: this.settings.customImpactDuration,
			startScale,
			endScale,
			baseOpacity,
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
		return new THREE.SpriteMaterial({
			map: texture,
			color,
			transparent: true,
			opacity,
			blending: THREE.AdditiveBlending,
			depthWrite: false,
			depthTest: true,
		})
	}

	private createPlaneMaterial(
		texture: THREE.Texture,
		color: number,
		opacity: number,
		blending: THREE.Blending = THREE.AdditiveBlending,
	): THREE.MeshBasicMaterial {
		return new THREE.MeshBasicMaterial({
			map: texture,
			color,
			transparent: true,
			opacity,
			blending,
			depthWrite: false,
			depthTest: true,
			side: THREE.DoubleSide,
		})
	}

	private addEffect(effect: ActiveEffect): void {
		effect.object.scale.setScalar(effect.startScale)
		this.activeEffects.push(effect)

		while (this.activeEffects.length > MAX_ACTIVE_EFFECTS) {
			this.removeAt(0)
		}
	}

	private clearKind(kind: EffectKind): void {
		for (let index = this.activeEffects.length - 1; index >= 0; index -= 1) {
			if (this.activeEffects[index].kind === kind) {
				this.removeAt(index)
			}
		}
	}

	private clearCustomAt(x: number, y: number): void {
		const positionTolerance = 0.0001

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
