export const MIN_POSITIVE_VALUE = 0.000001

export function finiteOr(value: number, fallback: number): number {
	if (Number.isFinite(value)) {
		return value
	}

	return Number.isFinite(fallback) ? fallback : 0
}

export function clamp(
	value: number,
	min: number,
	max: number,
	fallback: number = min,
): number {
	const safeValue = finiteOr(value, fallback)
	const safeMin = finiteOr(min, 0)
	const safeMax = Math.max(safeMin, finiteOr(max, safeMin))
	return Math.min(Math.max(safeValue, safeMin), safeMax)
}

export function clampUnit(value: number, fallback = 0): number {
	return clamp(value, 0, 1, fallback)
}

export function clampOpacity(value: number): number {
	return clampUnit(value)
}

export function clampNonNegative(value: number, fallback = 0): number {
	return Math.max(0, finiteOr(value, fallback))
}

export function clampPositive(
	value: number,
	fallback = MIN_POSITIVE_VALUE,
): number {
	return Math.max(
		MIN_POSITIVE_VALUE,
		finiteOr(value, fallback),
	)
}

export function lerp(
	start: number,
	end: number,
	progress: number,
): number {
	const safeStart = finiteOr(start, 0)
	const safeEnd = finiteOr(end, safeStart)
	return safeStart + (safeEnd - safeStart) * clampUnit(progress)
}

export function easeOutPower(value: number, power: number): number {
	return 1 - Math.pow(
		1 - clampUnit(value),
		clampPositive(power, 1),
	)
}

export function safeRandom(random: () => number): number {
	return clampUnit(random(), 0.5)
}
