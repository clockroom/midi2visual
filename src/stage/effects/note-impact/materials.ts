import * as THREE from 'three'
import { clampOpacity } from '../tuning/math'

export function createEffectSpriteMaterial(
	texture: THREE.Texture,
	color: number,
	opacity: number,
): THREE.SpriteMaterial {
	return new THREE.SpriteMaterial({
		map: texture,
		color,
		transparent: true,
		opacity: clampOpacity(opacity),
		blending: THREE.AdditiveBlending,
		depthWrite: false,
		depthTest: true,
		fog: false,
	})
}

export function createEffectPlaneMaterial(
	texture: THREE.Texture,
	color: number,
	opacity: number,
	blending: THREE.Blending = THREE.AdditiveBlending,
): THREE.MeshBasicMaterial {
	return new THREE.MeshBasicMaterial({
		map: texture,
		color,
		transparent: true,
		opacity: clampOpacity(opacity),
		blending,
		depthWrite: false,
		depthTest: true,
		side: THREE.DoubleSide,
		fog: false,
	})
}
