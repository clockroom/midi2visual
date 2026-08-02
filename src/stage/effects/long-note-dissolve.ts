import * as THREE from 'three'
import { clampOpacity } from './tuning/math'
import {
	calculateLongNoteParticleFrame,
	clampLongNoteParticleSize,
	createLongNoteParticleVelocity,
	getLongNoteActiveParticleLimit,
	getLongNoteAlphaTest,
	getLongNoteInitialOpacity,
	getLongNoteMinimumDurationSeconds,
	getLongNoteRenderOrder,
} from './tuning/long-note'
import {
	type StageContext,
	type StageSettingsChange,
} from '../stage-context'

interface DissolveBurst {
	points: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>
	origins: Float32Array
	velocities: Float32Array
	age: number
	duration: number
	baseOpacity: number
	startSize: number
	particleCount: number
}

export interface LongNoteDissolveTriggerRequest {
	positions: THREE.Vector3[]
	color: number
	durationSeconds: number
}

const SPARK_TEXTURE_PATH = '/assets/spark.png'

export class LongNoteDissolveEffects {
	private readonly textureLoader = new THREE.TextureLoader()
	private readonly bursts: DissolveBurst[] = []
	private sparkTexture: THREE.Texture | null = null
	private activeParticleCount = 0
	private loadGeneration = 0
	private readonly unsubscribeSettings: () => void

	constructor(
		private readonly group: THREE.Group,
		private readonly context: StageContext,
	) {
		this.unsubscribeSettings = context.subscribe((change) => {
			this.handleSettingsChanged(change)
		})
		void this.loadTexture()
	}

	canTrigger(durationSeconds: number): boolean {
		return (
			this.context.settings.showLongNoteDissolve &&
			this.sparkTexture !== null &&
			durationSeconds >= getLongNoteMinimumDurationSeconds()
		)
	}

	trigger(request: LongNoteDissolveTriggerRequest): boolean {
		if (
			!this.canTrigger(request.durationSeconds) ||
			request.positions.length === 0 ||
			!this.sparkTexture
		) {
			return false
		}

		while (
			this.bursts.length > 0 &&
			this.activeParticleCount + request.positions.length >
				getLongNoteActiveParticleLimit()
		) {
			this.removeAt(0)
		}

		const particleCount = Math.min(
			request.positions.length,
			getLongNoteActiveParticleLimit(),
		)
		const origins = new Float32Array(particleCount * 3)
		const velocities = new Float32Array(particleCount * 3)
		const positions = new Float32Array(particleCount * 3)

		for (let index = 0; index < particleCount; index += 1) {
			const source = request.positions[index]
			const offset = index * 3
			const velocity = createLongNoteParticleVelocity()
			origins[offset] = source.x
			origins[offset + 1] = source.y
			origins[offset + 2] = source.z
			positions[offset] = source.x
			positions[offset + 1] = source.y
			positions[offset + 2] = source.z
			velocities[offset] = velocity.x
			velocities[offset + 1] = velocity.y
			velocities[offset + 2] = velocity.z
		}

		const geometry = new THREE.BufferGeometry()
		geometry.setAttribute(
			'position',
			new THREE.BufferAttribute(positions, 3),
		)
		const startSize = clampLongNoteParticleSize(
			this.context.settings.longNoteDissolveParticleSize,
		)
		const material = new THREE.PointsMaterial({
			color: request.color,
			map: this.sparkTexture,
			size: startSize,
			sizeAttenuation: false,
			transparent: true,
			opacity: clampOpacity(getLongNoteInitialOpacity()),
			alphaTest: getLongNoteAlphaTest(),
			blending: THREE.AdditiveBlending,
			depthWrite: false,
			depthTest: true,
			fog: false,
		})
		const points = new THREE.Points(geometry, material)
		points.frustumCulled = false
		points.renderOrder = getLongNoteRenderOrder()
		this.group.add(points)
		this.bursts.push({
			points,
			origins,
			velocities,
			age: 0,
			duration: request.durationSeconds,
			baseOpacity: material.opacity,
			startSize,
			particleCount,
		})
		this.activeParticleCount += particleCount
		return true
	}

	update(deltaSeconds: number): void {
		const safeDeltaSeconds = Math.max(0, deltaSeconds)

		for (let index = this.bursts.length - 1; index >= 0; index -= 1) {
			const burst = this.bursts[index]
			burst.age += safeDeltaSeconds
			const frame = calculateLongNoteParticleFrame(
				burst.age,
				burst.duration,
				burst.baseOpacity,
				burst.startSize,
			)

			if (frame.complete) {
				this.removeAt(index)
				continue
			}

			const positionAttribute = burst.points.geometry.getAttribute(
				'position',
			) as THREE.BufferAttribute
			const positions = positionAttribute.array as Float32Array
			for (
				let particleIndex = 0;
				particleIndex < burst.particleCount;
				particleIndex += 1
			) {
				const offset = particleIndex * 3
				positions[offset] =
					burst.origins[offset] + burst.velocities[offset] * frame.travel
				positions[offset + 1] =
					burst.origins[offset + 1] +
					burst.velocities[offset + 1] * frame.travel
				positions[offset + 2] =
					burst.origins[offset + 2] +
					burst.velocities[offset + 2] * frame.travel
			}

			positionAttribute.needsUpdate = true
			burst.points.material.opacity = frame.opacity
			burst.points.material.size = frame.size
		}
	}

	clear(): void {
		for (let index = this.bursts.length - 1; index >= 0; index -= 1) {
			this.removeAt(index)
		}
	}

	dispose(): void {
		this.unsubscribeSettings()
		this.clear()
		this.loadGeneration += 1
		this.sparkTexture?.dispose()
		this.sparkTexture = null
	}

	private handleSettingsChanged({
		previous,
		current,
	}: StageSettingsChange): void {
		if (previous.showLongNoteDissolve && !current.showLongNoteDissolve) {
			this.clear()
		}
	}

	private async loadTexture(): Promise<void> {
		const generation = ++this.loadGeneration

		try {
			const texture = await this.textureLoader.loadAsync(
				SPARK_TEXTURE_PATH,
			)

			if (generation !== this.loadGeneration) {
				texture.dispose()
				return
			}

			texture.colorSpace = THREE.SRGBColorSpace
			texture.minFilter = THREE.LinearMipmapLinearFilter
			texture.magFilter = THREE.LinearFilter
			texture.generateMipmaps = true
			this.sparkTexture?.dispose()
			this.sparkTexture = texture
		} catch (error) {
			if (generation === this.loadGeneration) {
				console.warn(
					'Long note dissolve texture could not be loaded.',
					error,
				)
			}
		}
	}

	private removeAt(index: number): void {
		const [burst] = this.bursts.splice(index, 1)

		if (!burst) {
			return
		}

		this.group.remove(burst.points)
		burst.points.geometry.dispose()
		burst.points.material.dispose()
		this.activeParticleCount -= burst.particleCount
	}
}
