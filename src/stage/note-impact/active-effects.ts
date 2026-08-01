import * as THREE from 'three'
import {
	calculateNoteImpactFrame,
	getNoteImpactActiveEffectLimit,
	getNoteImpactMaxDeltaSeconds,
	type EffectFrame,
	type NoteImpactKind,
} from '../effect-tuning/note-on'
import { clampNonNegative } from '../effect-tuning/math'

type EffectMaterial = THREE.SpriteMaterial | THREE.MeshBasicMaterial
type EffectFrameHandler = (
	object: THREE.Object3D,
	frame: EffectFrame,
) => void

export interface ActiveEffectRequest {
	kind: NoteImpactKind
	object: THREE.Object3D
	material: EffectMaterial
	delaySeconds?: number
	duration: number
	startScale: number
	endScale: number
	baseOpacity: number
	startX: number
	startY: number
	onFrame?: EffectFrameHandler
}

interface ActiveEffect extends ActiveEffectRequest {
	age: number
	delaySeconds: number
}

export class ActiveNoteImpactEffects {
	private readonly effects: ActiveEffect[] = []

	constructor(private readonly group: THREE.Group) {}

	add(request: ActiveEffectRequest): void {
		const delaySeconds = clampNonNegative(request.delaySeconds ?? 0)
		const effect: ActiveEffect = {
			...request,
			delaySeconds,
			age: 0,
		}
		effect.object.scale.setScalar(effect.startScale)
		effect.object.visible = delaySeconds <= 0
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
			const effect = this.effects[index]
			effect.age += safeDeltaSeconds
			const activeAge = effect.age - effect.delaySeconds

			if (activeAge < 0) {
				effect.object.visible = false
				continue
			}

			effect.object.visible = true
			const frame = calculateNoteImpactFrame(
				effect.kind,
				activeAge,
				effect.duration,
				effect.startScale,
				effect.endScale,
				effect.baseOpacity,
			)

			if (frame.complete) {
				this.removeAt(index)
				continue
			}

			effect.object.scale.setScalar(frame.scale)
			effect.material.opacity = frame.opacity
			effect.onFrame?.(effect.object, frame)
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
				Math.abs(effect.startX - x) < positionTolerance &&
				Math.abs(effect.startY - y) < positionTolerance
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
		effect.material.dispose()
	}
}
