import * as THREE from 'three'
import type { AppSettings, MidiModel, VisualNote } from '../shared/types'

interface NoteObject {
	note: VisualNote
	mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>
	glow: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>
}

const PITCH_PADDING = 3
const PITCH_STEP = 0.34
const HORIZONTAL_LIMIT = THREE.MathUtils.degToRad(60)
const MIN_VERTICAL_ANGLE = THREE.MathUtils.degToRad(-45)
const MAX_VERTICAL_ANGLE = THREE.MathUtils.degToRad(60)
const ORBIT_SPEED = THREE.MathUtils.degToRad(35)
const ZOOM_SPEED_RATIO = 0.8
const MIN_DISTANCE_RATIO = 0.2
const MAX_DISTANCE_RATIO = 4
const TRACK_PALETTE = [
	0x55d8ff,
	0x8c7bff,
	0xff6eb4,
	0xffae57,
	0x75e6a4,
	0xf4e66b,
	0x5c9dff,
	0xdf78ff,
]

export class MidiVisualizer {
	private readonly scene = new THREE.Scene()
	private readonly camera = new THREE.PerspectiveCamera()
	private readonly renderer: THREE.WebGLRenderer
	private readonly notesGroup = new THREE.Group()
	private readonly framesGroup = new THREE.Group()
	private readonly playheadGroup = new THREE.Group()
	private readonly particlesGroup = new THREE.Group()
	private readonly noteObjects: NoteObject[] = []
	private particlePoints: THREE.Points | null = null
	private model: MidiModel | null = null
	private settings: AppSettings
	private worldWidth = 1
	private worldHeight = 1
	private centerX = 0
	private centerY = 0
	private readonly cameraTarget = new THREE.Vector3()
	private orbitAzimuth = 0
	private orbitElevation = 0
	private orbitDistance = 1
	private initialOrbitElevation = 0
	private initialOrbitDistance = 1
	private cameraOrbitInitialized = false

	constructor(container: HTMLElement, settings: AppSettings) {
		this.settings = settings
		this.renderer = new THREE.WebGLRenderer({
			antialias: true,
			alpha: false,
			powerPreference: 'high-performance',
		})
		this.renderer.setPixelRatio(1)
		this.renderer.setSize(window.innerWidth, window.innerHeight)
		this.renderer.outputColorSpace = THREE.SRGBColorSpace
		this.renderer.toneMapping = THREE.ACESFilmicToneMapping
		this.renderer.toneMappingExposure = 1.1
		container.appendChild(this.renderer.domElement)

		this.scene.fog = new THREE.FogExp2(settings.backgroundBottomColor, 0.018)
		this.scene.add(this.notesGroup, this.framesGroup, this.playheadGroup, this.particlesGroup)
		this.scene.add(new THREE.AmbientLight(0xacc8ff, 0.5))

		const keyLight = new THREE.PointLight(0xffffff, 28, 100)
		keyLight.position.set(0, 8, 12)
		this.scene.add(keyLight)

		window.addEventListener('resize', this.resize)
		this.applyBackground()
	}

	load(model: MidiModel): void {
		this.model = model
		this.clearGroup(this.notesGroup)
		this.clearGroup(this.framesGroup)
		this.clearGroup(this.playheadGroup)
		this.noteObjects.length = 0
		this.recalculateWorld()
		this.buildNotes()
		this.buildFrames()
		this.buildPlayhead()
		this.buildParticles()
		this.updateCamera(true)
	}

	applySettings(settings: AppSettings): void {
		const previous = this.settings
		this.settings = settings

		if (!this.model) {
			this.applyBackground()
			return
		}

		const rebuildNotes =
			previous.noteWidth !== settings.noteWidth ||
			previous.noteHeight !== settings.noteHeight ||
			previous.noteOpacity !== settings.noteOpacity ||
			previous.timeUnitsPerSecond !== settings.timeUnitsPerSecond ||
			previous.trackSpacing !== settings.trackSpacing
		const rebuildFrames =
			previous.showMeasureFrames !== settings.showMeasureFrames ||
			previous.showBeatFrames !== settings.showBeatFrames ||
			previous.frameOpacity !== settings.frameOpacity ||
			previous.timeUnitsPerSecond !== settings.timeUnitsPerSecond ||
			previous.trackSpacing !== settings.trackSpacing

		this.recalculateWorld()

		if (rebuildNotes) {
			this.clearGroup(this.notesGroup)
			this.noteObjects.length = 0
			this.buildNotes()
		}

		if (rebuildFrames) {
			this.clearGroup(this.framesGroup)
			this.clearGroup(this.playheadGroup)
			this.buildFrames()
			this.buildPlayhead()
		}

		if (
			previous.backgroundParticleCount !== settings.backgroundParticleCount ||
			previous.lookAheadSeconds !== settings.lookAheadSeconds ||
			previous.timeUnitsPerSecond !== settings.timeUnitsPerSecond ||
			previous.trackSpacing !== settings.trackSpacing
		) {
			this.buildParticles()
		}

		this.applyBackground()
		this.updateCamera(false)
	}

	updateCameraControls(
		horizontalDirection: number,
		verticalDirection: number,
		zoomDirection: number,
		deltaSeconds: number,
	): void {
		if (!this.model || !this.cameraOrbitInitialized) {
			return
		}

		if (
			horizontalDirection === 0 &&
			verticalDirection === 0 &&
			zoomDirection === 0
		) {
			return
		}

		const safeDeltaSeconds = THREE.MathUtils.clamp(deltaSeconds, 0, 0.1)

		// Update the horizontal and vertical angles independently, then rebuild the
		// camera position from spherical coordinates to prevent accumulated roll.
		this.orbitAzimuth = THREE.MathUtils.clamp(
			this.orbitAzimuth + horizontalDirection * ORBIT_SPEED * safeDeltaSeconds,
			-HORIZONTAL_LIMIT,
			HORIZONTAL_LIMIT,
		)
		this.orbitElevation = THREE.MathUtils.clamp(
			this.orbitElevation + verticalDirection * ORBIT_SPEED * safeDeltaSeconds,
			MIN_VERTICAL_ANGLE,
			MAX_VERTICAL_ANGLE,
		)
		this.orbitDistance = THREE.MathUtils.clamp(
			this.orbitDistance -
				zoomDirection * this.initialOrbitDistance * ZOOM_SPEED_RATIO * safeDeltaSeconds,
			this.initialOrbitDistance * MIN_DISTANCE_RATIO,
			this.initialOrbitDistance * MAX_DISTANCE_RATIO,
		)
		this.applyCameraTransform()
	}

	resetCamera(): void {
		if (!this.model || !this.cameraOrbitInitialized) {
			return
		}

		this.orbitAzimuth = 0
		this.orbitElevation = this.initialOrbitElevation
		this.orbitDistance = this.initialOrbitDistance
		this.applyCameraTransform()
	}

	render(songSeconds: number): void {
		if (!this.model) {
			return
		}

		const timeOffset = songSeconds * this.settings.timeUnitsPerSecond
		this.notesGroup.position.z = timeOffset
		this.framesGroup.position.z = timeOffset
		this.updateNotes(songSeconds)
		this.updateParticles(songSeconds)
		this.renderer.render(this.scene, this.camera)
	}

	dispose(): void {
		window.removeEventListener('resize', this.resize)
		this.clearGroup(this.scene)
		this.renderer.dispose()
		this.renderer.domElement.remove()
	}

	private readonly resize = (): void => {
		const width = window.innerWidth
		const height = window.innerHeight
		this.renderer.setSize(width, height)
		this.camera.aspect = width / Math.max(height, 1)
		this.updateCamera(false)
	}

	private recalculateWorld(): void {
		if (!this.model) {
			return
		}

		this.worldWidth = Math.max(
			2.4,
			(this.model.trackCount - 1) * this.settings.trackSpacing + this.settings.noteWidth + 1.4,
		)
		this.worldHeight =
			(this.model.maxPitch - this.model.minPitch + PITCH_PADDING * 2 + 1) * PITCH_STEP
		this.centerX = ((this.model.trackCount - 1) * this.settings.trackSpacing) / 2
		this.centerY =
			((this.model.minPitch + this.model.maxPitch) / 2 - (this.model.minPitch - PITCH_PADDING)) *
			PITCH_STEP
	}

	private buildNotes(): void {
		if (!this.model) {
			return
		}

		for (const note of this.model.notes) {
			const color = TRACK_PALETTE[note.trackIndex % TRACK_PALETTE.length]
			const duration = Math.max(
				0.08,
				(note.endSeconds - note.startSeconds) * this.settings.timeUnitsPerSecond,
			)
			const geometry = new THREE.BoxGeometry(
				this.settings.noteWidth,
				this.settings.noteHeight,
				duration,
			)
			const material = new THREE.MeshStandardMaterial({
				color,
				emissive: color,
				emissiveIntensity: 0.15,
				transparent: true,
				opacity: this.settings.noteOpacity,
				roughness: 0.28,
				metalness: 0.08,
				depthWrite: false,
			})
			const mesh = new THREE.Mesh(geometry, material)
			mesh.position.set(
				note.trackIndex * this.settings.trackSpacing,
				this.pitchToY(note.pitch),
				-((note.startSeconds + note.endSeconds) / 2) * this.settings.timeUnitsPerSecond,
			)

			const glowMaterial = new THREE.MeshBasicMaterial({
				color,
				transparent: true,
				opacity: 0,
				blending: THREE.AdditiveBlending,
				depthWrite: false,
			})
			const glow = new THREE.Mesh(geometry, glowMaterial)
			glow.scale.set(1.3, 2.2, 1.04)
			glow.visible = false
			mesh.add(glow)
			this.notesGroup.add(mesh)
			this.noteObjects.push({ note, mesh, glow })
		}
	}

	private buildFrames(): void {
		if (!this.model) {
			return
		}

		if (this.settings.showMeasureFrames) {
			for (const marker of this.model.measureMarkers) {
				this.framesGroup.add(
					this.createFrame(
						-marker.seconds * this.settings.timeUnitsPerSecond,
						0x79bfff,
						this.settings.frameOpacity,
					),
				)
			}
		}

		if (this.settings.showBeatFrames) {
			for (const marker of this.model.beatMarkers) {
				this.framesGroup.add(
					this.createFrame(
						-marker.seconds * this.settings.timeUnitsPerSecond,
						0x5680aa,
						this.settings.frameOpacity * 0.32,
					),
				)
			}
		}
	}

	private buildPlayhead(): void {
		const frame = this.createFrame(0, 0xc7f3ff, 0.72)
		const glow = this.createFrame(0.03, 0x5cdfff, 0.22)
		glow.scale.set(1.01, 1.02, 1)
		this.playheadGroup.add(frame, glow)
	}

	private createFrame(z: number, color: number, opacity: number): THREE.LineLoop {
		const left = this.centerX - this.worldWidth / 2
		const right = this.centerX + this.worldWidth / 2
		const bottom = this.centerY - this.worldHeight / 2
		const top = this.centerY + this.worldHeight / 2
		const points = [
			new THREE.Vector3(left, bottom, z),
			new THREE.Vector3(right, bottom, z),
			new THREE.Vector3(right, top, z),
			new THREE.Vector3(left, top, z),
		]
		const geometry = new THREE.BufferGeometry().setFromPoints(points)
		const material = new THREE.LineBasicMaterial({
			color,
			transparent: true,
			opacity,
			blending: THREE.AdditiveBlending,
			depthWrite: false,
		})

		return new THREE.LineLoop(geometry, material)
	}

	private buildParticles(): void {
		this.clearGroup(this.particlesGroup)
		this.particlePoints = null

		if (this.settings.backgroundParticleCount <= 0) {
			return
		}

		const count = Math.round(this.settings.backgroundParticleCount)
		const positions = new Float32Array(count * 3)
		const depth = Math.max(30, this.settings.lookAheadSeconds * this.settings.timeUnitsPerSecond * 1.5)

		for (let index = 0; index < count; index += 1) {
			positions[index * 3] = this.centerX + (Math.random() - 0.5) * this.worldWidth * 2.4
			positions[index * 3 + 1] = this.centerY + (Math.random() - 0.5) * this.worldHeight * 2.2
			positions[index * 3 + 2] = -Math.random() * depth
		}

		const geometry = new THREE.BufferGeometry()
		geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
		const material = new THREE.PointsMaterial({
			color: 0x90bfff,
			size: 0.045,
			transparent: true,
			opacity: 0.28,
			blending: THREE.AdditiveBlending,
			depthWrite: false,
		})
		this.particlePoints = new THREE.Points(geometry, material)
		this.particlesGroup.add(this.particlePoints)
	}

	private updateNotes(songSeconds: number): void {
		const visiblePast = this.settings.noteAfterglowSeconds + 0.2
		const visibleFuture = this.settings.lookAheadSeconds + 2

		for (const object of this.noteObjects) {
			const { note, mesh, glow } = object
			const timeUntilStart = note.startSeconds - songSeconds
			const timeSinceEnd = songSeconds - note.endSeconds
			const active = songSeconds >= note.startSeconds && songSeconds <= note.endSeconds
			const afterglow =
				timeSinceEnd > 0 && timeSinceEnd <= this.settings.noteAfterglowSeconds
			mesh.visible = timeUntilStart <= visibleFuture && timeSinceEnd <= visiblePast

			if (!mesh.visible) {
				glow.visible = false
				continue
			}

			if (active) {
				const velocity = THREE.MathUtils.clamp(note.velocity, 0, 1)
				mesh.material.emissiveIntensity = this.settings.noteGlowIntensity * (0.45 + velocity)
				mesh.material.opacity = Math.min(1, this.settings.noteOpacity + 0.16)
				glow.material.opacity = 0.1 + velocity * 0.25
				glow.visible = true
			} else if (afterglow) {
				const fade = 1 - timeSinceEnd / this.settings.noteAfterglowSeconds
				mesh.material.emissiveIntensity = this.settings.noteGlowIntensity * fade * 0.7
				mesh.material.opacity = this.settings.noteOpacity * fade
				glow.material.opacity = 0.2 * fade
				glow.visible = true
			} else {
				mesh.material.emissiveIntensity = 0.15
				mesh.material.opacity = this.settings.noteOpacity
				glow.material.opacity = 0
				glow.visible = false
			}
		}
	}

	private updateParticles(songSeconds: number): void {
		if (!this.particlePoints) {
			return
		}

		const depth = Math.max(30, this.settings.lookAheadSeconds * this.settings.timeUnitsPerSecond * 1.5)
		this.particlePoints.position.z =
			(songSeconds * this.settings.timeUnitsPerSecond * 0.16) % depth
		this.particlePoints.rotation.z = songSeconds * 0.002
	}

	private updateCamera(resetOrbit: boolean): void {
		if (!this.model) {
			return
		}

		const previousInitialDistance = this.initialOrbitDistance
		const previousDistanceRatio =
			previousInitialDistance > 0 ? this.orbitDistance / previousInitialDistance : 1
		this.camera.fov = this.settings.cameraFov
		this.camera.aspect = window.innerWidth / Math.max(window.innerHeight, 1)
		this.camera.near = 0.1
		const verticalFov = THREE.MathUtils.degToRad(this.camera.fov)
		const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * this.camera.aspect)
		const fitHeightDistance = (this.worldHeight / 2) / Math.tan(verticalFov / 2)
		const fitWidthDistance = (this.worldWidth / 2) / Math.tan(horizontalFov / 2)
		const forwardDistance = Math.max(fitHeightDistance, fitWidthDistance) * 1.3 + 5
		const verticalOffset = this.worldHeight * 0.1
		this.cameraTarget.set(this.centerX, this.centerY, 0)
		this.initialOrbitDistance = Math.hypot(forwardDistance, verticalOffset)
		this.initialOrbitElevation = Math.atan2(verticalOffset, forwardDistance)
		this.camera.far = Math.max(
			500,
			this.initialOrbitDistance * MAX_DISTANCE_RATIO +
				this.settings.lookAheadSeconds * this.settings.timeUnitsPerSecond * 2,
		)

		if (resetOrbit || !this.cameraOrbitInitialized) {
			this.orbitAzimuth = 0
			this.orbitElevation = this.initialOrbitElevation
			this.orbitDistance = this.initialOrbitDistance
			this.cameraOrbitInitialized = true
		} else {
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

		this.camera.updateProjectionMatrix()
		this.applyCameraTransform()
	}

	private applyCameraTransform(): void {
		const horizontalDistance = this.orbitDistance * Math.cos(this.orbitElevation)

		this.camera.position.set(
			this.cameraTarget.x + horizontalDistance * Math.sin(this.orbitAzimuth),
			this.cameraTarget.y + this.orbitDistance * Math.sin(this.orbitElevation),
			this.cameraTarget.z + horizontalDistance * Math.cos(this.orbitAzimuth),
		)
		this.camera.up.set(0, 1, 0)
		this.camera.lookAt(this.cameraTarget)
	}

	private applyBackground(): void {
		const top = new THREE.Color(this.settings.backgroundTopColor)
		const bottom = new THREE.Color(this.settings.backgroundBottomColor)
		const canvas = document.createElement('canvas')
		canvas.width = 2
		canvas.height = 512
		const context = canvas.getContext('2d')

		if (!context) {
			this.scene.background = bottom
			return
		}

		const gradient = context.createLinearGradient(0, 0, 0, canvas.height)
		gradient.addColorStop(0, `#${top.getHexString()}`)
		gradient.addColorStop(1, `#${bottom.getHexString()}`)
		context.fillStyle = gradient
		context.fillRect(0, 0, canvas.width, canvas.height)

		const previous = this.scene.background
		this.scene.background = new THREE.CanvasTexture(canvas)

		if (previous instanceof THREE.Texture) {
			previous.dispose()
		}

		if (this.scene.fog instanceof THREE.FogExp2) {
			this.scene.fog.color.copy(bottom)
		}
	}

	private pitchToY(pitch: number): number {
		if (!this.model) {
			return 0
		}

		return (pitch - (this.model.minPitch - PITCH_PADDING)) * PITCH_STEP
	}

	private clearGroup(group: THREE.Object3D): void {
		for (const child of [...group.children]) {
			child.traverse((object) => {
				if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) {
					object.geometry.dispose()
					const materials = Array.isArray(object.material) ? object.material : [object.material]
					for (const material of materials) {
						material.dispose()
					}
				}
			})
			group.remove(child)
		}
	}
}
