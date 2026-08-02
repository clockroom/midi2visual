import * as THREE from 'three'
import type { StageLayout } from './stage-layout'

interface GuideFrameStyle {
	color: number
	opacity: number
}

export abstract class GuideFrame {
	readonly object: THREE.LineLoop<
		THREE.BufferGeometry,
		THREE.LineBasicMaterial
	>

	constructor(
		layout: StageLayout,
		z: number,
		style: GuideFrameStyle,
	) {
		const left = layout.centerX - layout.worldWidth / 2
		const right = layout.centerX + layout.worldWidth / 2
		const bottom = layout.centerY - layout.worldHeight / 2
		const top = layout.centerY + layout.worldHeight / 2
		const geometry = new THREE.BufferGeometry().setFromPoints([
			new THREE.Vector3(left, bottom, z),
			new THREE.Vector3(right, bottom, z),
			new THREE.Vector3(right, top, z),
			new THREE.Vector3(left, top, z),
		])
		const material = new THREE.LineBasicMaterial({
			color: style.color,
			transparent: true,
			opacity: style.opacity,
			blending: THREE.AdditiveBlending,
			depthWrite: false,
		})
		this.object = new THREE.LineLoop(geometry, material)
	}

	dispose(): void {
		this.object.geometry.dispose()
		this.object.material.dispose()
	}
}

export class MeasureGuideFrame extends GuideFrame {
	constructor(layout: StageLayout, z: number, opacity: number) {
		super(layout, z, { color: 0x79bfff, opacity })
	}
}

export class BeatGuideFrame extends GuideFrame {
	constructor(layout: StageLayout, z: number, opacity: number) {
		super(layout, z, { color: 0x5680aa, opacity: opacity * 0.32 })
	}
}

export class PlayheadGuideFrame extends GuideFrame {
	constructor(layout: StageLayout) {
		super(layout, 0, { color: 0xc7f3ff, opacity: 0.72 })
	}
}
