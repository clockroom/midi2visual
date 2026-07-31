import {
	clamp,
	clampNonNegative,
	clampOpacity,
	clampPositive,
	clampUnit,
	finiteOr,
	lerp,
	safeRandom,
} from './math'
import {
	calculateNoteAppearance,
	type NoteAppearance,
} from './note'

export const LONG_NOTE_TUNING = {
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
} as const

const ABSOLUTE_MAX_ACTIVE_PARTICLES = 4096
const ABSOLUTE_MAX_PARTICLES_PER_NOTE = 4096

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

export interface LongFadeNoteAppearanceInput {
	velocity: number
	remaining: number
	preFlashProgress: number
	baseEmissiveIntensity: number
	glowIntensity: number
	noteOpacity: number
}

export function getLongNoteActiveParticleLimit(): number {
	return Math.round(
		clamp(
			LONG_NOTE_TUNING.maxActiveParticles,
			1,
			ABSOLUTE_MAX_ACTIVE_PARTICLES,
			512,
		),
	)
}

export function getLongNoteMinimumDurationSeconds(): number {
	return clampPositive(
		LONG_NOTE_TUNING.minimumDurationSeconds,
		0.15,
	)
}

export function getLongNoteInitialOpacity(): number {
	return clampOpacity(LONG_NOTE_TUNING.initialOpacity)
}

export function getLongNoteAlphaTest(): number {
	return clampUnit(LONG_NOTE_TUNING.alphaTest)
}

export function getLongNoteRenderOrder(): number {
	return Math.round(finiteOr(LONG_NOTE_TUNING.renderOrder, 5))
}

export function clampLongNoteParticleSize(size: number): number {
	const min = clampNonNegative(LONG_NOTE_TUNING.particleSizeMin, 2)
	const max = Math.max(
		min,
		clampNonNegative(LONG_NOTE_TUNING.particleSizeMax, 32),
	)
	return clamp(size, min, max, min)
}

export function clampLongNoteDissolveTriggerRatio(ratio: number): number {
	const min = clampUnit(LONG_NOTE_TUNING.triggerRatioMin, 0.1)
	const max = Math.max(
		min,
		clampUnit(LONG_NOTE_TUNING.triggerRatioMax, 0.9),
	)
	return clamp(ratio, min, max, min)
}

export function clampLongNoteDissolveRangeRatio(ratio: number): number {
	const min = clampUnit(LONG_NOTE_TUNING.rangeRatioMin, 0.1)
	const max = Math.max(
		min,
		clampUnit(LONG_NOTE_TUNING.rangeRatioMax, 1),
	)
	return clamp(ratio, min, max, min)
}

export function calculateLongNoteParticleCount(
	rangeBeats: number,
	configuredMaximum: number,
): number {
	const tuningMaximum = clamp(
		LONG_NOTE_TUNING.maxParticlesPerNoteHardLimit,
		1,
		ABSOLUTE_MAX_PARTICLES_PER_NOTE,
		512,
	)
	const maximum = clamp(
		Math.round(configuredMaximum),
		1,
		tuningMaximum,
		1,
	)
	const densityCount = Math.max(
		1,
		Math.ceil(
			clampNonNegative(rangeBeats) *
				clampNonNegative(LONG_NOTE_TUNING.particlesPerBeat, 6),
		),
	)

	return Math.round(Math.min(maximum, densityCount))
}

export function calculateLongNoteParticlePlacement(
	index: number,
	particleCount: number,
	noteSize: number,
	random: () => number = Math.random,
): LongNoteParticlePlacement {
	const safeCount = Math.max(1, Math.round(clampPositive(particleCount, 1)))
	const safeIndex = clamp(index, 0, safeCount - 1)
	const jitter =
		clampNonNegative(noteSize) *
		clampNonNegative(LONG_NOTE_TUNING.crossSectionJitterRatio, 0.38)

	return {
		intervalProgress: clampUnit(
			(safeIndex + safeRandom(random)) / safeCount,
		),
		xOffset: (safeRandom(random) - 0.5) * jitter,
		yOffset: (safeRandom(random) - 0.5) * jitter,
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
		clampNonNegative(LONG_NOTE_TUNING.preFlashMaxSeconds, 0.5),
	)
	const safeSongSeconds = finiteOr(songSeconds, triggerSeconds)
	const safeTriggerSeconds = finiteOr(triggerSeconds, safeSongSeconds)

	if (
		duration <= 0 ||
		!ready ||
		safeSongSeconds >= safeTriggerSeconds ||
		safeSongSeconds < safeTriggerSeconds - duration
	) {
		return 0
	}

	return clampUnit(
		1 - (safeTriggerSeconds - safeSongSeconds) / duration,
	)
}

export function calculateLongNotePreFlashFrame(
	progress: number,
): LongNotePreFlashFrame {
	const strength = Math.pow(
		clampUnit(progress),
		clampPositive(LONG_NOTE_TUNING.preFlashPower, 2),
	)

	return {
		emissiveBoostRatio: clampNonNegative(
			LONG_NOTE_TUNING.preFlashEmissiveBoost * strength,
		),
		noteOpacityBlend: clampUnit(
			LONG_NOTE_TUNING.preFlashNoteOpacityBlend * strength,
		),
		glowOpacityBlend: clampUnit(
			LONG_NOTE_TUNING.preFlashGlowOpacityBlend * strength,
		),
	}
}

export function calculateLongFadeNoteAppearance(
	input: LongFadeNoteAppearanceInput,
): NoteAppearance {
	const remaining = clampUnit(input.remaining)
	const glowIntensity = clampNonNegative(input.glowIntensity)
	const appearance = calculateNoteAppearance({
		mode: 'active',
		velocity: input.velocity,
		remaining: 1,
		baseEmissiveIntensity: input.baseEmissiveIntensity,
		glowIntensity,
		noteOpacity: input.noteOpacity,
	})
	appearance.noteOpacity = clampOpacity(
		appearance.noteOpacity * remaining,
	)
	appearance.glowOpacity = clampOpacity(
		appearance.glowOpacity * remaining,
	)
	appearance.glowVisible = remaining > 0

	if (input.preFlashProgress > 0) {
		const preFlash = calculateLongNotePreFlashFrame(
			input.preFlashProgress,
		)
		appearance.emissiveIntensity = clampNonNegative(
			appearance.emissiveIntensity +
				glowIntensity * preFlash.emissiveBoostRatio,
		)
		appearance.noteOpacity = clampOpacity(
			lerp(
				appearance.noteOpacity,
				1,
				preFlash.noteOpacityBlend,
			),
		)
		appearance.glowOpacity = clampOpacity(
			lerp(
				appearance.glowOpacity,
				1,
				preFlash.glowOpacityBlend,
			),
		)
		appearance.glowVisible = true
	}

	return appearance
}

export function createLongNoteParticleVelocity(
	random: () => number = Math.random,
): LongNoteParticleVelocity {
	const angle = safeRandom(random) * Math.PI * 2
	const radialSpeed = clampNonNegative(
		LONG_NOTE_TUNING.radialSpeedBase +
			safeRandom(random) * LONG_NOTE_TUNING.radialSpeedRandomRange,
	)

	return {
		x: finiteOr(Math.cos(angle) * radialSpeed, 0),
		y: finiteOr(
			Math.sin(angle) * radialSpeed +
				LONG_NOTE_TUNING.upwardSpeedBase +
				safeRandom(random) *
					LONG_NOTE_TUNING.upwardSpeedRandomRange,
			0,
		),
		z: finiteOr(
			(safeRandom(random) - 0.5) *
				clampNonNegative(LONG_NOTE_TUNING.depthSpeedRange, 1.4),
			0,
		),
	}
}

export function calculateLongNoteParticleFrame(
	age: number,
	duration: number,
	baseOpacity: number,
	startSize: number,
): LongNoteParticleFrame {
	const safeDuration = clampPositive(duration)
	const safeAge = clampNonNegative(age, safeDuration)
	const progress = clampUnit(safeAge / safeDuration)
	const slowdown = clampUnit(LONG_NOTE_TUNING.travelSlowdown, 0.35)
	const safeStartSize = clampNonNegative(startSize)

	return {
		complete: progress >= 1,
		travel: finiteOr(safeAge * (1 - progress * slowdown), 0),
		opacity: clampOpacity(
			clampOpacity(baseOpacity) *
				Math.pow(
					1 - progress,
					clampPositive(LONG_NOTE_TUNING.opacityFadePower, 1.35),
				),
		),
		size: clampNonNegative(
			lerp(
				safeStartSize,
				safeStartSize *
					clampNonNegative(LONG_NOTE_TUNING.endSizeRatio, 0.3),
				progress,
			),
		),
	}
}
