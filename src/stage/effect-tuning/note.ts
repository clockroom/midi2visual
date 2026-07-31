import {
	clampNonNegative,
	clampOpacity,
	clampUnit,
} from './math'

export const NOTE_TUNING = {
	velocityEmissiveBase: 0.45,
	activeOpacityBoost: 0.16,
	glowOpacityBase: 0.1,
	glowOpacityVelocityInfluence: 0.25,
	afterglowEmissiveRatio: 0.7,
	afterglowGlowOpacity: 0.2,
} as const

export type NoteAppearanceMode = 'idle' | 'active' | 'afterglow'

export interface NoteAppearanceInput {
	mode: NoteAppearanceMode
	velocity: number
	remaining: number
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

export function calculateNoteAppearance(
	input: NoteAppearanceInput,
): NoteAppearance {
	const velocity = clampUnit(input.velocity)
	const remaining = clampUnit(input.remaining)
	const baseEmissive = clampNonNegative(input.baseEmissiveIntensity)
	const glowIntensity = clampNonNegative(input.glowIntensity)
	const noteOpacity = clampOpacity(input.noteOpacity)
	const activeEmissive = clampNonNegative(
		Math.max(
			baseEmissive,
			glowIntensity *
				(clampNonNegative(
					NOTE_TUNING.velocityEmissiveBase,
					0.45,
				) + velocity),
		),
		baseEmissive,
	)
	const activeOpacity = clampOpacity(
		noteOpacity +
			clampNonNegative(NOTE_TUNING.activeOpacityBoost, 0.16),
	)
	const activeGlowOpacity = clampOpacity(
		NOTE_TUNING.glowOpacityBase +
			velocity * NOTE_TUNING.glowOpacityVelocityInfluence,
	)

	if (input.mode === 'active') {
		return {
			emissiveIntensity: activeEmissive,
			noteOpacity: activeOpacity,
			glowOpacity: activeGlowOpacity,
			glowVisible: true,
		}
	}

	if (input.mode === 'afterglow') {
		return {
			emissiveIntensity: clampNonNegative(
				Math.max(
					baseEmissive,
					glowIntensity *
						remaining *
						clampNonNegative(
							NOTE_TUNING.afterglowEmissiveRatio,
							0.7,
						),
				),
				baseEmissive,
			),
			noteOpacity: clampOpacity(noteOpacity * remaining),
			glowOpacity: clampOpacity(
				NOTE_TUNING.afterglowGlowOpacity * remaining,
			),
			glowVisible: true,
		}
	}

	return {
		emissiveIntensity: baseEmissive,
		noteOpacity,
		glowOpacity: 0,
		glowVisible: false,
	}
}
