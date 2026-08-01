import * as THREE from 'three'
import { ActiveNoteImpactEffects } from './note-impact/active-effects'
import { CoreFlashEffect } from './note-impact/core-flash'
import { CustomImageEffect } from './note-impact/custom-image'
import { ImpactRingEffect } from './note-impact/impact-ring'
import { SparkEffects } from './note-impact/sparks'
import type { NoteImpactSpawnRequest } from './note-impact/types'
import {
	type StageContext,
	type StageSettingsChange,
} from './stage-context'

export type NoteImpactTriggerRequest = NoteImpactSpawnRequest

export class NoteImpactEffects {
	private readonly activeEffects: ActiveNoteImpactEffects
	private readonly coreFlash: CoreFlashEffect
	private readonly impactRing: ImpactRingEffect
	private readonly sparks: SparkEffects
	private readonly customImage: CustomImageEffect
	private readonly unsubscribeSettings: () => void

	constructor(
		group: THREE.Group,
		private readonly context: StageContext,
	) {
		this.activeEffects = new ActiveNoteImpactEffects(group)
		this.coreFlash = new CoreFlashEffect(this.activeEffects)
		this.impactRing = new ImpactRingEffect(this.activeEffects)
		this.sparks = new SparkEffects(this.activeEffects)
		this.customImage = new CustomImageEffect(
			this.activeEffects,
			context,
		)
		this.unsubscribeSettings = context.subscribe((change) => {
			this.handleSettingsChanged(change)
		})
	}

	trigger(request: NoteImpactTriggerRequest): void {
		const settings = this.context.settings
		const effectRequest = {
			...request,
			velocity: this.context.toEffectVelocity(request.velocity),
		}

		if (settings.showCoreFlash) {
			this.coreFlash.trigger(request)
		}

		if (settings.showImpactRing) {
			this.impactRing.trigger(effectRequest)
		}

		if (settings.showSparks) {
			this.sparks.trigger(effectRequest)
		}

		if (settings.showCustomImpactImage) {
			this.customImage.trigger(effectRequest)
		}
	}

	update(deltaSeconds: number): void {
		this.activeEffects.update(deltaSeconds)
	}

	clear(): void {
		this.activeEffects.clear()
	}

	dispose(): void {
		this.unsubscribeSettings()
		this.activeEffects.clear()
		this.coreFlash.dispose()
		this.impactRing.dispose()
		this.sparks.dispose()
		this.customImage.dispose()
	}

	private handleSettingsChanged({
		previous,
		current,
	}: StageSettingsChange): void {
		if (previous.showCoreFlash && !current.showCoreFlash) {
			this.activeEffects.clearKind('flash')
		}

		if (previous.showImpactRing && !current.showImpactRing) {
			this.activeEffects.clearKind('ring')
		}

		if (previous.showSparks && !current.showSparks) {
			this.activeEffects.clearKind('spark')
		}

		if (previous.showCustomImpactImage && !current.showCustomImpactImage) {
			this.activeEffects.clearKind('custom')
		}
	}
}
