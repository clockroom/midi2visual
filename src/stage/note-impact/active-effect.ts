import * as THREE from 'three'
import {
	calculateCommonNoteImpactFrame,
	type EffectFrame,
	type NoteImpactKind,
} from '../effect-tuning/note-on'
import { clampNonNegative } from '../effect-tuning/math'

export type ActiveEffectUpdateResult = 'active' | 'complete'
export type NoteImpactEffectMaterial =
	| THREE.SpriteMaterial
	| THREE.MeshBasicMaterial

export interface ActiveNoteImpactEffectInit {
	object: THREE.Object3D
	material: NoteImpactEffectMaterial
	delaySeconds?: number
	duration: number
	startScale: number
	endScale: number
	baseOpacity: number
	startX: number
	startY: number
}

export abstract class ActiveNoteImpactEffect {
	abstract readonly kind: NoteImpactKind

	readonly object: THREE.Object3D
	readonly startX: number
	readonly startY: number

	protected readonly material: NoteImpactEffectMaterial
	protected readonly duration: number
	protected readonly startScale: number
	protected readonly endScale: number
	protected readonly baseOpacity: number

	private readonly delaySeconds: number
	private age = 0

	constructor({
		object,
		material,
		delaySeconds = 0,
		duration,
		startScale,
		endScale,
		baseOpacity,
		startX,
		startY,
	}: ActiveNoteImpactEffectInit) {
		this.object = object
		this.material = material
		this.delaySeconds = clampNonNegative(delaySeconds)
		this.duration = duration
		this.startScale = startScale
		this.endScale = endScale
		this.baseOpacity = baseOpacity
		this.startX = startX
		this.startY = startY

		this.object.scale.setScalar(this.startScale)
		this.object.visible = this.delaySeconds <= 0
	}

	update(deltaSeconds: number): ActiveEffectUpdateResult {
		this.age += deltaSeconds
		const activeAge = this.age - this.delaySeconds

		if (activeAge < 0) {
			this.object.visible = false
			return 'active'
		}

		this.object.visible = true
		const frame = this.calculateFrame(activeAge)

		if (frame.complete) {
			return 'complete'
		}

		this.applyFrame(frame, activeAge)
		return 'active'
	}

	matchesPosition(
		x: number,
		y: number,
		positionTolerance: number,
	): boolean {
		return (
			Math.abs(this.startX - x) < positionTolerance &&
			Math.abs(this.startY - y) < positionTolerance
		)
	}

	dispose(): void {
		this.material.dispose()
	}

	protected calculateFrame(activeAge: number): EffectFrame {
		return calculateCommonNoteImpactFrame(
			activeAge,
			this.duration,
			this.startScale,
			this.endScale,
			this.baseOpacity,
		)
	}

	protected applyFrame(frame: EffectFrame, _activeAge: number): void {
		this.object.scale.setScalar(frame.scale)
		this.material.opacity = frame.opacity
	}
}
