import * as THREE from 'three'
import type { StageLayout } from '../core/stage-layout'
import type { StageContext } from '../stage-context'

const HORIZONTAL_LIMIT = THREE.MathUtils.degToRad(60)
const MIN_VERTICAL_ANGLE = THREE.MathUtils.degToRad(-45)
const MAX_VERTICAL_ANGLE = THREE.MathUtils.degToRad(60)
const ORBIT_SPEED = THREE.MathUtils.degToRad(35)
const ZOOM_SPEED_RATIO = 0.8
const MIN_DISTANCE_RATIO = 0.2
const MAX_DISTANCE_RATIO = 4

export class OrbitCameraController {
	readonly camera = new THREE.PerspectiveCamera()

	private readonly target = new THREE.Vector3()
	private layout: StageLayout | null = null
	private orbitAzimuth = 0
	private orbitElevation = 0
	private orbitDistance = 1
	private initialOrbitElevation = 0
	private initialOrbitDistance = 1
	private initialized = false

	constructor(private readonly context: StageContext) {}

	configure(layout: StageLayout, resetOrbit: boolean): void {
		this.layout = layout
		const previousInitialDistance = this.initialOrbitDistance
		const previousDistanceRatio =
			previousInitialDistance > 0
				? this.orbitDistance / previousInitialDistance
				: 1

		this.configureProjection()
		this.configureInitialOrbit(layout)
		this.camera.far = this.calculateFarPlane()

		if (resetOrbit || !this.initialized) {
			this.orbitAzimuth = 0
			this.orbitElevation = this.initialOrbitElevation
			this.orbitDistance = this.initialOrbitDistance
			this.initialized = true
		} else {
			this.preserveOrbit(previousDistanceRatio)
		}

		this.camera.updateProjectionMatrix()
		this.applyTransform()
	}

	updateControls(
		horizontalDirection: number,
		verticalDirection: number,
		zoomDirection: number,
		deltaSeconds: number,
	): void {
		if (!this.initialized || this.controlsAreIdle(
			horizontalDirection,
			verticalDirection,
			zoomDirection,
		)) {
			return
		}

		const safeDeltaSeconds = THREE.MathUtils.clamp(
			deltaSeconds,
			0,
			0.1,
		)
		this.orbitAzimuth = THREE.MathUtils.clamp(
			this.orbitAzimuth +
				horizontalDirection * ORBIT_SPEED * safeDeltaSeconds,
			-HORIZONTAL_LIMIT,
			HORIZONTAL_LIMIT,
		)
		this.orbitElevation = THREE.MathUtils.clamp(
			this.orbitElevation +
				verticalDirection * ORBIT_SPEED * safeDeltaSeconds,
			MIN_VERTICAL_ANGLE,
			MAX_VERTICAL_ANGLE,
		)
		this.orbitDistance = THREE.MathUtils.clamp(
			this.orbitDistance -
				zoomDirection *
					this.initialOrbitDistance *
					ZOOM_SPEED_RATIO *
					safeDeltaSeconds,
			this.initialOrbitDistance * MIN_DISTANCE_RATIO,
			this.initialOrbitDistance * MAX_DISTANCE_RATIO,
		)
		this.applyTransform()
	}

	reset(): void {
		if (!this.initialized) {
			return
		}

		this.orbitAzimuth = 0
		this.orbitElevation = this.initialOrbitElevation
		this.orbitDistance = this.initialOrbitDistance
		this.applyTransform()
	}

	resize(width: number, height: number): void {
		this.camera.aspect = width / Math.max(height, 1)

		if (this.layout) {
			this.configure(this.layout, false)
		}
	}

	private configureProjection(): void {
		const settings = this.context.settings
		this.camera.fov = settings.cameraFov
		this.camera.aspect =
			window.innerWidth / Math.max(window.innerHeight, 1)
		this.camera.near = 0.1
	}

	private configureInitialOrbit(layout: StageLayout): void {
		const verticalFov = THREE.MathUtils.degToRad(this.camera.fov)
		const horizontalFov =
			2 *
			Math.atan(
				Math.tan(verticalFov / 2) * this.camera.aspect,
			)
		const fitHeightDistance =
			(layout.worldHeight / 2) / Math.tan(verticalFov / 2)
		const fitWidthDistance =
			(layout.worldWidth / 2) / Math.tan(horizontalFov / 2)
		const forwardDistance =
			Math.max(fitHeightDistance, fitWidthDistance) * 1.3 + 5
		const verticalOffset = layout.worldHeight * 0.1
		this.target.set(layout.centerX, layout.centerY, 0)
		this.initialOrbitDistance = Math.hypot(
			forwardDistance,
			verticalOffset,
		)
		this.initialOrbitElevation = Math.atan2(
			verticalOffset,
			forwardDistance,
		)
	}

	private calculateFarPlane(): number {
		const settings = this.context.settings

		return Math.max(
			500,
			this.initialOrbitDistance * MAX_DISTANCE_RATIO +
				settings.lookAheadSeconds *
					settings.timeUnitsPerSecond *
					2,
		)
	}

	private preserveOrbit(previousDistanceRatio: number): void {
		this.orbitDistance = THREE.MathUtils.clamp(
			this.initialOrbitDistance * previousDistanceRatio,
			this.initialOrbitDistance * MIN_DISTANCE_RATIO,
			this.initialOrbitDistance * MAX_DISTANCE_RATIO,
		)
		this.orbitElevation = THREE.MathUtils.clamp(
			this.orbitElevation,
			MIN_VERTICAL_ANGLE,
			MAX_VERTICAL_ANGLE,
		)
	}

	private applyTransform(): void {
		const horizontalDistance =
			this.orbitDistance * Math.cos(this.orbitElevation)

		this.camera.position.set(
			this.target.x +
				horizontalDistance * Math.sin(this.orbitAzimuth),
			this.target.y +
				this.orbitDistance * Math.sin(this.orbitElevation),
			this.target.z +
				horizontalDistance * Math.cos(this.orbitAzimuth),
		)
		this.camera.up.set(0, 1, 0)
		this.camera.lookAt(this.target)
	}

	private controlsAreIdle(
		horizontalDirection: number,
		verticalDirection: number,
		zoomDirection: number,
	): boolean {
		return (
			horizontalDirection === 0 &&
			verticalDirection === 0 &&
			zoomDirection === 0
		)
	}
}
