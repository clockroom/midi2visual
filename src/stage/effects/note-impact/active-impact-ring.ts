import { ActiveNoteImpactEffect } from './active-effect'

export class ActiveImpactRingEffect extends ActiveNoteImpactEffect {
	readonly kind = 'ring' as const
}
