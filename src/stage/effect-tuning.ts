export type NoteImpactKind = 'flash' | 'ring' | 'spark' | 'custom'

export interface EffectAppearance {
	duration: number
	startScale: number
	endScale: number
	opacity: number
	depth: number
}

export interface EffectFrame {
	complete: boolean
	scale: number
	opacity: number
	travel: number
}

export interface SparkAppearance extends EffectAppearance {
	velocityX: number
	velocityY: number
}

export interface CustomEffectInput {
	velocity: number
	configuredDuration: number
	configuredOpacity: number
	configuredStartScale: number
	configuredEndScale: number
	scaleMode: 'expand' | 'shrink'
	noteSize: number
}

export interface LongNoteParticleVelocity {
	x: number
	y: number
	z: number
}

export interface LongNoteParticlePlacement {
	intervalProgress: number
	xOffset: number
	yOffset: number
}

export interface LongNoteParticleFrame {
	complete: boolean
	travel: number
	opacity: number
	size: number
}

export interface LongNotePreFlashFrame {
	emissiveBoostRatio: number
	noteOpacityBlend: number
	glowOpacityBlend: number
}

export type NoteAppearanceMode = 'idle' | 'active' | 'longFade' | 'afterglow'

export interface NoteAppearanceInput {
	mode: NoteAppearanceMode
	velocity: number
	remaining: number
	preFlashProgress: number
	baseEmissiveIntensity: number
	glowIntensity: number
	noteOpacity: number
}

export interface NoteAppearance {
	emissiveIntensity: number
	noteOpacity: number
	glowOpacity: number
	glowVisible: boolean
}

export const EFFECT_TUNING = {
	noteImpact: {
		maxActiveEffects: 768,
		maxDeltaSeconds: 0.1,
		scaleEasePower: 3,
	},
	noteAppearance: {
		velocityEmissiveBase: 0.45,
		activeOpacityBoost: 0.16,
		glowOpacityBase: 0.1,
		glowOpacityVelocityInfluence: 0.25,
		afterglowEmissiveRatio: 0.7,
		afterglowGlowOpacity: 0.2,
	},
	coreFlash: {
		duration: 0.18,
		depth: 0.12,
		opacityBase: 0.45,
		opacityVelocityInfluence: 0.5,
		startScaleBase: 0.28,
		startScaleVelocityInfluence: 0.18,
		endScaleBase: 1,
		endScaleVelocityInfluence: 0.7,
	},
	impactRing: {
		duration: 0.55,
		depth: 0.07,
		opacityBase: 0.35,
		opacityVelocityInfluence: 0.5,
		startScaleBase: 0.35,
		startScaleVelocityInfluence: 0.2,
		endScaleBase: 1.5,
		endScaleVelocityInfluence: 1.3,
	},
	sparks: {
		depth: 0.14,
		countBase: 3,
		countVelocityInfluence: 5,
		speedBase: 1.4,
		speedRandomRange: 1.2,
		speedVelocityInfluence: 1.8,
		durationBase: 0.6,
		durationRandomRange: 0.35,
		opacityBase: 0.5,
		opacityVelocityInfluence: 0.5,
		startScaleBase: 0.48,
		startScaleVelocityInfluence: 0.34,
		endScale: 0.12,
		travelSlowdown: 0.35,
	},
	custom: {
		depth: 0.1,
		velocityScaleBase: 0.75,
		velocityScaleInfluence: 0.5,
		opacityVelocityBase: 0.55,
		opacityVelocityInfluence: 0.45,
		minimumNoteCoverRatio: 1.5,
		fadeStartProgress: 0.15,
		positionTolerance: 0.0001,
	},
	longNoteDissolve: {
		maxActiveParticles: 512,
		maxParticlesPerNoteHardLimit: 512,
		particlesPerBeat: 6,
		minimumDurationSeconds: 0.15,
		triggerRatioMin: 0.1,
		triggerRatioMax: 0.9,
		rangeRatioMin: 0.1,
		rangeRatioMax: 1,
		crossSectionJitterRatio: 0.38,
		preFlashMaxSeconds: 0.5,
		preFlashPower: 2,
		preFlashEmissiveBoost: 3,
		preFlashNoteOpacityBlend: 0.7,
		preFlashGlowOpacityBlend: 1,
		particleSizeMin: 2,
		particleSizeMax: 32,
		initialOpacity: 0.9,
		alphaTest: 0.02,
		renderOrder: 5,
		radialSpeedBase: 0.7,
		radialSpeedRandomRange: 1.3,
		upwardSpeedBase: 0.15,
		upwardSpeedRandomRange: 0.3,
		depthSpeedRange: 1.4,
		travelSlowdown: 0.35,
		opacityFadePower: 1.35,
		endSizeRatio: 0.3,
	},
} as const

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max)
}

function clamp01(value: number): number {
	return clamp(value, 0, 1)
}

function lerp(start: number, end: number, progress: number): number {
	return start + (end - start) * progress
}

function easeOutPower(value: number, power: number): number {
	return 1 - Math.pow(1 - value, power)
}

export function calculateCoreFlashAppearance(velocity: number): EffectAppearance {
	const tuning = EFFECT_TUNING.coreFlash
	const normalizedVelocity = clamp01(velocity)

	return {
		duration: tuning.duration,
		startScale:
			tuning.startScaleBase +
			normalizedVelocity * tuning.startScaleVelocityInfluence,
		endScale:
			tuning.endScaleBase +
			normalizedVelocity * tuning.endScaleVelocityInfluence,
		opacity:
			tuning.opacityBase +
			normalizedVelocity * tuning.opacityVelocityInfluence,
		depth: tuning.depth,
	}
}

export function calculateImpactRingAppearance(velocity: number): EffectAppearance {
	const tuning = EFFECT_TUNING.impactRing
	const normalizedVelocity = clamp01(velocity)

	return {
		duration: tuning.duration,
		startScale:
			tuning.startScaleBase +
			normalizedVelocity * tuning.startScaleVelocityInfluence,
		endScale:
			tuning.endScaleBase +
			normalizedVelocity * tuning.endScaleVelocityInfluence,
		opacity:
			tuning.opacityBase +
			normalizedVelocity * tuning.opacityVelocityInfluence,
		depth: tuning.depth,
	}
}

export function calculateSparkCount(velocity: number): number {
	const tuning = EFFECT_TUNING.sparks
	return Math.round(
		tuning.countBase + clamp01(velocity) * tuning.countVelocityInfluence,
	)
}

export function calculateSparkAppearance(
	velocity: number,
	random: () => number = Math.random,
): SparkAppearance {
	const tuning = EFFECT_TUNING.sparks
	const normalizedVelocity = clamp01(velocity)
	const angle = random() * Math.PI * 2
	const speed =
		tuning.speedBase +
		random() * tuning.speedRandomRange +
		normalizedVelocity * tuning.speedVelocityInfluence

	return {
		duration:
			tuning.durationBase + random() * tuning.durationRandomRange,
		startScale:
			tuning.startScaleBase +
			normalizedVelocity * tuning.startScaleVelocityInfluence,
		endScale: tuning.endScale,
		opacity:
			tuning.opacityBase +
			normalizedVelocity * tuning.opacityVelocityInfluence,
		depth: tuning.depth,
		velocityX: Math.cos(angle) * speed,
		velocityY: Math.sin(angle) * speed,
	}
}

export function calculateCustomEffectAppearance(input: CustomEffectInput): EffectAppearance {
	const tuning = EFFECT_TUNING.custom
	const normalizedVelocity = clamp01(input.velocity)
	const velocityScale =
		tuning.velocityScaleBase +
		normalizedVelocity * tuning.velocityScaleInfluence
	const configuredStart = input.configuredStartScale * velocityScale
	const configuredEnd = input.configuredEndScale * velocityScale
	const requestedStartScale =
		input.scaleMode === 'expand' ? configuredStart : configuredEnd
	const minimumCoverScale = input.noteSize * tuning.minimumNoteCoverRatio

	return {
		duration: input.configuredDuration,
		startScale: Math.max(requestedStartScale, minimumCoverScale),
		endScale:
			input.scaleMode === 'expand' ? configuredEnd : configuredStart,
		opacity:
			input.configuredOpacity *
			(tuning.opacityVelocityBase +
				normalizedVelocity * tuning.opacityVelocityInfluence),
		depth: tuning.depth,
	}
}

export function calculateNoteImpactFrame(
	kind: NoteImpactKind,
	age: number,
	duration: number,
	startScale: number,
	endScale: number,
	baseOpacity: number,
): EffectFrame {
	const progress = clamp01(age / duration)
	const easedProgress = easeOutPower(
		progress,
		EFFECT_TUNING.noteImpact.scaleEasePower,
	)
	const opacityProgress =
		kind === 'custom'
			? clamp01(
					(progress - EFFECT_TUNING.custom.fadeStartProgress) /
						(1 - EFFECT_TUNING.custom.fadeStartProgress),
				)
			: progress
	const travel =
		kind === 'spark'
			? age * (1 - progress * EFFECT_TUNING.sparks.travelSlowdown)
			: 0

	return {
		complete: progress >= 1,
		scale: lerp(startScale, endScale, easedProgress),
		opacity: baseOpacity * (1 - opacityProgress),
		travel,
	}
}

export function calculateNoteAppearance(input: NoteAppearanceInput): NoteAppearance {
	const tuning = EFFECT_TUNING.noteAppearance
	const velocity = clamp01(input.velocity)
	const remaining = clamp01(input.remaining)
	const activeEmissive = Math.max(
		input.baseEmissiveIntensity,
		input.glowIntensity * (tuning.velocityEmissiveBase + velocity),
	)
	const activeOpacity = Math.min(
		1,
		input.noteOpacity + tuning.activeOpacityBoost,
	)
	const activeGlowOpacity =
		tuning.glowOpacityBase +
		velocity * tuning.glowOpacityVelocityInfluence

	if (input.mode === 'active' || input.mode === 'longFade') {
		const fadeRemaining = input.mode === 'longFade' ? remaining : 1
		const appearance: NoteAppearance = {
			emissiveIntensity: activeEmissive,
			noteOpacity: activeOpacity * fadeRemaining,
			glowOpacity: activeGlowOpacity * fadeRemaining,
			glowVisible:
				input.mode === 'active' || fadeRemaining > 0,
		}

		if (input.mode === 'longFade' && input.preFlashProgress > 0) {
			const preFlash = calculateLongNotePreFlashFrame(
				input.preFlashProgress,
			)
			appearance.emissiveIntensity +=
				input.glowIntensity * preFlash.emissiveBoostRatio
			appearance.noteOpacity = lerp(
				appearance.noteOpacity,
				1,
				preFlash.noteOpacityBlend,
			)
			appearance.glowOpacity = lerp(
				appearance.glowOpacity,
				1,
				preFlash.glowOpacityBlend,
			)
			appearance.glowVisible = true
		}

		return appearance
	}

	if (input.mode === 'afterglow') {
		return {
			emissiveIntensity: Math.max(
				input.baseEmissiveIntensity,
				input.glowIntensity *
					remaining *
					tuning.afterglowEmissiveRatio,
			),
			noteOpacity: input.noteOpacity * remaining,
			glowOpacity: tuning.afterglowGlowOpacity * remaining,
			glowVisible: true,
		}
	}

	return {
		emissiveIntensity: input.baseEmissiveIntensity,
		noteOpacity: input.noteOpacity,
		glowOpacity: 0,
		glowVisible: false,
	}
}

export function clampLongNoteParticleSize(size: number): number {
	const tuning = EFFECT_TUNING.longNoteDissolve
	return clamp(size, tuning.particleSizeMin, tuning.particleSizeMax)
}

export function clampLongNoteDissolveTriggerRatio(ratio: number): number {
	const tuning = EFFECT_TUNING.longNoteDissolve
	return clamp(ratio, tuning.triggerRatioMin, tuning.triggerRatioMax)
}

export function clampLongNoteDissolveRangeRatio(ratio: number): number {
	const tuning = EFFECT_TUNING.longNoteDissolve
	return clamp(ratio, tuning.rangeRatioMin, tuning.rangeRatioMax)
}

export function calculateLongNoteParticleCount(
	rangeBeats: number,
	configuredMaximum: number,
): number {
	const tuning = EFFECT_TUNING.longNoteDissolve
	const maximum = clamp(
		Math.round(configuredMaximum),
		1,
		tuning.maxParticlesPerNoteHardLimit,
	)
	const densityCount = Math.max(
		1,
		Math.ceil(rangeBeats * tuning.particlesPerBeat),
	)

	return Math.min(maximum, densityCount)
}

export function calculateLongNoteParticlePlacement(
	index: number,
	particleCount: number,
	noteSize: number,
	random: () => number = Math.random,
): LongNoteParticlePlacement {
	const jitter =
		noteSize * EFFECT_TUNING.longNoteDissolve.crossSectionJitterRatio

	return {
		intervalProgress: (index + random()) / particleCount,
		xOffset: (random() - 0.5) * jitter,
		yOffset: (random() - 0.5) * jitter,
	}
}

export function calculateLongNotePreFlashProgress(
	songSeconds: number,
	triggerSeconds: number,
	configuredSeconds: number,
	ready: boolean,
): number {
	const duration = clamp(
		configuredSeconds,
		0,
		EFFECT_TUNING.longNoteDissolve.preFlashMaxSeconds,
	)

	if (
		duration <= 0 ||
		!ready ||
		songSeconds >= triggerSeconds ||
		songSeconds < triggerSeconds - duration
	) {
		return 0
	}

	return clamp01(1 - (triggerSeconds - songSeconds) / duration)
}

export function calculateLongNotePreFlashFrame(progress: number): LongNotePreFlashFrame {
	const tuning = EFFECT_TUNING.longNoteDissolve
	const strength = Math.pow(clamp01(progress), tuning.preFlashPower)

	return {
		emissiveBoostRatio: tuning.preFlashEmissiveBoost * strength,
		noteOpacityBlend: tuning.preFlashNoteOpacityBlend * strength,
		glowOpacityBlend: tuning.preFlashGlowOpacityBlend * strength,
	}
}

export function createLongNoteParticleVelocity(
	random: () => number = Math.random,
): LongNoteParticleVelocity {
	const tuning = EFFECT_TUNING.longNoteDissolve
	const angle = random() * Math.PI * 2
	const radialSpeed =
		tuning.radialSpeedBase + random() * tuning.radialSpeedRandomRange

	return {
		x: Math.cos(angle) * radialSpeed,
		y:
			Math.sin(angle) * radialSpeed +
			tuning.upwardSpeedBase +
			random() * tuning.upwardSpeedRandomRange,
		z: (random() - 0.5) * tuning.depthSpeedRange,
	}
}

export function calculateLongNoteParticleFrame(
	age: number, duration: number, baseOpacity: number, startSize: number,
): LongNoteParticleFrame {
	const tuning = EFFECT_TUNING.longNoteDissolve
	const progress = clamp01(age / duration)

	return {
		complete: progress >= 1,
		travel: age * (1 - progress * tuning.travelSlowdown),
		opacity: baseOpacity * Math.pow(1 - progress, tuning.opacityFadePower),
		size: lerp(startSize, startSize * tuning.endSizeRatio, progress),
	}
}
