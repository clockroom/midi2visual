import {
	MIN_POSITIVE_VALUE,
	clamp,
	clampNonNegative,
	clampOpacity,
	clampPositive,
	clampUnit,
	easeOutPower,
	finiteOr,
	lerp,
	safeRandom,
} from './math'

export const NOTE_ON_TUNING = {
	common: {
		maxActiveEffects: 768,
		maxDeltaSeconds: 0.1,
		scaleEasePower: 3,
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
} as const

const ABSOLUTE_MAX_ACTIVE_EFFECTS = 4096

export type NoteImpactKind = 'flash' | 'ring' | 'spark' | 'custom'

export interface EffectAppearance {
	duration: number
	startScale: number
	endScale: number
	opacity: number
	depth: number
}

export interface SparkAppearance extends EffectAppearance {
	velocityX: number
	velocityY: number
}

export interface EffectFrame {
	complete: boolean
	scale: number
	opacity: number
	travel: number
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

export function getNoteImpactActiveEffectLimit(): number {
	return Math.round(
		clamp(
			NOTE_ON_TUNING.common.maxActiveEffects,
			1,
			ABSOLUTE_MAX_ACTIVE_EFFECTS,
			768,
		),
	)
}

export function getNoteImpactMaxDeltaSeconds(): number {
	return clampPositive(NOTE_ON_TUNING.common.maxDeltaSeconds, 0.1)
}

export function getCustomEffectPositionTolerance(): number {
	return clampNonNegative(NOTE_ON_TUNING.custom.positionTolerance, 0.0001)
}

export function calculateCoreFlashAppearance(
	velocity: number,
): EffectAppearance {
	const tuning = NOTE_ON_TUNING.coreFlash
	const normalizedVelocity = clampUnit(velocity)

	return {
		duration: clampPositive(tuning.duration, 0.18),
		startScale: clampNonNegative(
			tuning.startScaleBase +
				normalizedVelocity * tuning.startScaleVelocityInfluence,
		),
		endScale: clampNonNegative(
			tuning.endScaleBase +
				normalizedVelocity * tuning.endScaleVelocityInfluence,
		),
		opacity: clampOpacity(
			tuning.opacityBase +
				normalizedVelocity * tuning.opacityVelocityInfluence,
		),
		depth: finiteOr(tuning.depth, 0.12),
	}
}

export function calculateImpactRingAppearance(
	velocity: number,
): EffectAppearance {
	const tuning = NOTE_ON_TUNING.impactRing
	const normalizedVelocity = clampUnit(velocity)

	return {
		duration: clampPositive(tuning.duration, 0.55),
		startScale: clampNonNegative(
			tuning.startScaleBase +
				normalizedVelocity * tuning.startScaleVelocityInfluence,
		),
		endScale: clampNonNegative(
			tuning.endScaleBase +
				normalizedVelocity * tuning.endScaleVelocityInfluence,
		),
		opacity: clampOpacity(
			tuning.opacityBase +
				normalizedVelocity * tuning.opacityVelocityInfluence,
		),
		depth: finiteOr(tuning.depth, 0.07),
	}
}

export function calculateSparkCount(velocity: number): number {
	const tuning = NOTE_ON_TUNING.sparks
	const requestedCount = Math.round(
		tuning.countBase +
			clampUnit(velocity) * tuning.countVelocityInfluence,
	)
	return Math.round(
		clamp(requestedCount, 0, getNoteImpactActiveEffectLimit()),
	)
}

export function calculateSparkAppearance(
	velocity: number,
	random: () => number = Math.random,
): SparkAppearance {
	const tuning = NOTE_ON_TUNING.sparks
	const normalizedVelocity = clampUnit(velocity)
	const angle = safeRandom(random) * Math.PI * 2
	const speed = clampNonNegative(
		tuning.speedBase +
			safeRandom(random) * tuning.speedRandomRange +
			normalizedVelocity * tuning.speedVelocityInfluence,
	)

	return {
		duration: clampPositive(
			tuning.durationBase +
				safeRandom(random) * tuning.durationRandomRange,
			0.6,
		),
		startScale: clampNonNegative(
			tuning.startScaleBase +
				normalizedVelocity * tuning.startScaleVelocityInfluence,
		),
		endScale: clampNonNegative(tuning.endScale),
		opacity: clampOpacity(
			tuning.opacityBase +
				normalizedVelocity * tuning.opacityVelocityInfluence,
		),
		depth: finiteOr(tuning.depth, 0.14),
		velocityX: finiteOr(Math.cos(angle) * speed, 0),
		velocityY: finiteOr(Math.sin(angle) * speed, 0),
	}
}

export function calculateCustomEffectAppearance(
	input: CustomEffectInput,
): EffectAppearance {
	const tuning = NOTE_ON_TUNING.custom
	const normalizedVelocity = clampUnit(input.velocity)
	const velocityScale = clampNonNegative(
		tuning.velocityScaleBase +
			normalizedVelocity * tuning.velocityScaleInfluence,
	)
	const configuredStart =
		clampNonNegative(input.configuredStartScale) * velocityScale
	const configuredEnd =
		clampNonNegative(input.configuredEndScale) * velocityScale
	const requestedStartScale =
		input.scaleMode === 'expand' ? configuredStart : configuredEnd
	const minimumCoverScale =
		clampNonNegative(input.noteSize) *
		clampNonNegative(tuning.minimumNoteCoverRatio)

	return {
		duration: clampPositive(input.configuredDuration, 0.8),
		startScale: Math.max(requestedStartScale, minimumCoverScale),
		endScale:
			input.scaleMode === 'expand' ? configuredEnd : configuredStart,
		opacity: clampOpacity(
			input.configuredOpacity *
				(tuning.opacityVelocityBase +
					normalizedVelocity * tuning.opacityVelocityInfluence),
		),
		depth: finiteOr(tuning.depth, 0.1),
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
	const safeDuration = clampPositive(duration)
	const safeAge = clampNonNegative(age, safeDuration)
	const progress = clampUnit(safeAge / safeDuration)
	const easedProgress = easeOutPower(
		progress,
		NOTE_ON_TUNING.common.scaleEasePower,
	)
	const fadeStart = clamp(
		NOTE_ON_TUNING.custom.fadeStartProgress,
		0,
		1 - MIN_POSITIVE_VALUE,
		0.15,
	)
	const opacityProgress =
		kind === 'custom'
			? clampUnit((progress - fadeStart) / (1 - fadeStart))
			: progress
	const travel =
		kind === 'spark'
			? finiteOr(
					safeAge *
						(1 -
							progress *
								clampUnit(
									NOTE_ON_TUNING.sparks.travelSlowdown,
								)),
					0,
				)
			: 0

	return {
		complete: progress >= 1,
		scale: clampNonNegative(
			lerp(startScale, endScale, easedProgress),
		),
		opacity: clampOpacity(
			clampOpacity(baseOpacity) * (1 - opacityProgress),
		),
		travel,
	}
}
