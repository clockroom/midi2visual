import { ActiveNoteImpactEffect } from './active-effect'

export class ActiveCoreFlashEffect extends ActiveNoteImpactEffect {
	readonly kind = 'flash' as const
}
