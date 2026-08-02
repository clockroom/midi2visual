import * as THREE from 'three'
import type { AppSettings } from '../shared/types'

const FOG_DENSITY = 0.018

export class StageEnvironment {
	private readonly ambientLight = new THREE.AmbientLight(0xacc8ff, 0.5)
	private readonly keyLight = new THREE.PointLight(0xffffff, 28, 100)

	constructor(
		private readonly scene: THREE.Scene,
		settings: Readonly<AppSettings>,
	) {
		this.keyLight.position.set(0, 8, 12)
		this.scene.add(this.ambientLight, this.keyLight)
		this.scene.fog = new THREE.FogExp2(
			settings.backgroundBottomColor,
			FOG_DENSITY,
		)
		this.apply(settings)
	}

	apply(settings: Readonly<AppSettings>): void {
		const top = new THREE.Color(settings.backgroundTopColor)
		const bottom = new THREE.Color(settings.backgroundBottomColor)
		const texture = this.createGradientTexture(top, bottom)
		const previous = this.scene.background
		this.scene.background = texture ?? bottom

		if (previous instanceof THREE.Texture) {
			previous.dispose()
		}

		if (this.scene.fog instanceof THREE.FogExp2) {
			this.scene.fog.color.copy(bottom)
		}
	}

	dispose(): void {
		if (this.scene.background instanceof THREE.Texture) {
			this.scene.background.dispose()
		}

		this.scene.background = null
		this.scene.fog = null
		this.scene.remove(this.ambientLight, this.keyLight)
	}

	private createGradientTexture(
		top: THREE.Color,
		bottom: THREE.Color,
	): THREE.CanvasTexture | null {
		const canvas = document.createElement('canvas')
		canvas.width = 2
		canvas.height = 512
		const context = canvas.getContext('2d')

		if (!context) {
			return null
		}

		const gradient = context.createLinearGradient(0, 0, 0, canvas.height)
		gradient.addColorStop(0, `#${top.getHexString()}`)
		gradient.addColorStop(1, `#${bottom.getHexString()}`)
		context.fillStyle = gradient
		context.fillRect(0, 0, canvas.width, canvas.height)

		return new THREE.CanvasTexture(canvas)
	}
}
