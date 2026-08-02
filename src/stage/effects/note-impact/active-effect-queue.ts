import * as THREE from 'three'
import {
	getNoteImpactActiveEffectLimit,
	getNoteImpactMaxDeltaSeconds,
	type NoteImpactKind,
} from '../tuning/note-on'
import type { ActiveNoteImpactEffect } from './active-effect'

export class ActiveNoteImpactEffectQueue {
	private readonly effects: ActiveNoteImpactEffect[] = []

	constructor(private readonly group: THREE.Group) {}

	add(effect: ActiveNoteImpactEffect): void {
		this.group.add(effect.object)
		this.effects.push(effect)

		while (this.effects.length > getNoteImpactActiveEffectLimit()) {
			this.removeAt(0)
		}
	}

	update(deltaSeconds: number): void {
		const safeDeltaSeconds = THREE.MathUtils.clamp(
			deltaSeconds,
			0,
			getNoteImpactMaxDeltaSeconds(),
		)

		for (let index = this.effects.length - 1; index >= 0; index -= 1) {
			if (this.effects[index].update(safeDeltaSeconds) === 'complete') {
				this.removeAt(index)
			}
		}
	}

	clear(): void {
		for (let index = this.effects.length - 1; index >= 0; index -= 1) {
			this.removeAt(index)
		}
	}

	clearKind(kind: NoteImpactKind): void {
		for (let index = this.effects.length - 1; index >= 0; index -= 1) {
			if (this.effects[index].kind === kind) {
				this.removeAt(index)
			}
		}
	}

	clearAt(
		kind: NoteImpactKind,
		x: number,
		y: number,
		positionTolerance: number,
	): void {
		for (let index = this.effects.length - 1; index >= 0; index -= 1) {
			const effect = this.effects[index]

			if (
				effect.kind === kind &&
				effect.matchesPosition(x, y, positionTolerance)
			) {
				this.removeAt(index)
			}
		}
	}

	private removeAt(index: number): void {
		const [effect] = this.effects.splice(index, 1)

		if (!effect) {
			return
		}

		this.group.remove(effect.object)
		effect.dispose()
	}
}
