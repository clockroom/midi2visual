import {
	calculateCustomNoteImpactFrame,
	type EffectFrame,
} from '../effect-tuning/note-on'
import { ActiveNoteImpactEffect } from './active-effect'

export class ActiveCustomImageEffect extends ActiveNoteImpactEffect {
	readonly kind = 'custom' as const

	protected override calculateFrame(activeAge: number): EffectFrame {
		return calculateCustomNoteImpactFrame(
			activeAge,
			this.duration,
			this.startScale,
			this.endScale,
			this.baseOpacity,
		)
	}
}
