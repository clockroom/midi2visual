import {
	calculateSparkTravel,
	type EffectFrame,
} from '../effect-tuning/note-on'
import {
	ActiveNoteImpactEffect,
	type ActiveNoteImpactEffectInit,
} from './active-effect'

export interface ActiveSparkEffectInit extends ActiveNoteImpactEffectInit {
	velocityX: number
	velocityY: number
}

export class ActiveSparkEffect extends ActiveNoteImpactEffect {
	readonly kind = 'spark' as const

	private readonly velocityX: number
	private readonly velocityY: number

	constructor({
		velocityX,
		velocityY,
		...init
	}: ActiveSparkEffectInit) {
		super(init)
		this.velocityX = velocityX
		this.velocityY = velocityY
	}

	protected override applyFrame(
		frame: EffectFrame,
		activeAge: number,
	): void {
		super.applyFrame(frame, activeAge)
		const travel = calculateSparkTravel(activeAge, this.duration)

		this.object.position.x = this.startX + this.velocityX * travel
		this.object.position.y = this.startY + this.velocityY * travel
	}
}
