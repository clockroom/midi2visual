import '../styles/control.css'
import { AppChannel } from '../shared/channel'
import {
	defaultSettings,
	loadSettings,
	saveSettings,
} from '../shared/settings'
import type { AppSettings } from '../shared/types'

type NumericSetting = {
	kind: 'number'
	key: keyof AppSettings
	label: string
	min: number
	max: number
	step: number
}

type BooleanSetting = {
	kind: 'boolean'
	key: keyof AppSettings
	label: string
}

type ColorSetting = {
	kind: 'color'
	key: keyof AppSettings
	label: string
}

const groups: Record<string, Array<NumericSetting | BooleanSetting | ColorSetting>> = {
	'time-settings': [
		{ kind: 'number', key: 'preRollSeconds', label: 'プリロール (秒)', min: 0, max: 10, step: 0.1 },
		{ kind: 'number', key: 'postRollSeconds', label: 'ポストロール (秒)', min: 0, max: 10, step: 0.1 },
		{ kind: 'number', key: 'lookAheadSeconds', label: '先読み (秒)', min: 2, max: 20, step: 0.5 },
		{ kind: 'number', key: 'timeUnitsPerSecond', label: '時間方向の速度', min: 1, max: 10, step: 0.1 },
	],
	'note-settings': [
		{ kind: 'number', key: 'noteWidth', label: 'ノート幅', min: 0.1, max: 1.5, step: 0.01 },
		{ kind: 'number', key: 'noteHeight', label: 'ノート高', min: 0.05, max: 0.8, step: 0.01 },
		{ kind: 'number', key: 'noteOpacity', label: 'ノート不透明度', min: 0.1, max: 1, step: 0.01 },
		{ kind: 'number', key: 'noteGlowIntensity', label: '発音時の発光', min: 0, max: 4, step: 0.05 },
		{ kind: 'number', key: 'noteAfterglowSeconds', label: '残光 (秒)', min: 0.05, max: 2, step: 0.05 },
	],
	'space-settings': [
		{ kind: 'number', key: 'trackSpacing', label: 'トラック間隔', min: 0.6, max: 4, step: 0.05 },
		{ kind: 'number', key: 'cameraFov', label: 'カメラ視野角', min: 25, max: 80, step: 1 },
	],
	'guide-settings': [
		{ kind: 'boolean', key: 'showMeasureFrames', label: '小節枠を表示' },
		{ kind: 'boolean', key: 'showBeatFrames', label: '拍枠を表示' },
		{ kind: 'boolean', key: 'showMeasureCounter', label: 'BPMと拍数カウンターを表示' },
		{ kind: 'number', key: 'frameOpacity', label: '枠の不透明度', min: 0.02, max: 1, step: 0.01 },
	],
	'background-settings': [
		{ kind: 'number', key: 'backgroundParticleCount', label: '背景粒子数', min: 0, max: 500, step: 10 },
		{ kind: 'color', key: 'backgroundTopColor', label: '背景上部色' },
		{ kind: 'color', key: 'backgroundBottomColor', label: '背景下部色' },
	],
}

const channel = new AppChannel()
let settings = loadSettings()
const saveStatus = document.querySelector<HTMLElement>('#save-status')

function isBooleanSetting(
	definition: NumericSetting | BooleanSetting | ColorSetting,
): definition is BooleanSetting {
	return definition.kind === 'boolean'
}

function isColorSetting(
	definition: NumericSetting | BooleanSetting | ColorSetting,
): definition is ColorSetting {
	return definition.kind === 'color'
}

function publish(): void {
	saveSettings(settings)
	channel.send({ type: 'settingsChanged', settings: structuredClone(settings) })

	if (saveStatus) {
		saveStatus.textContent = '保存済み'
	}
}

function renderControls(): void {
	for (const [containerId, definitions] of Object.entries(groups)) {
		const container = document.querySelector<HTMLElement>(`#${containerId}`)

		if (!container) {
			continue
		}

		container.replaceChildren()

		for (const definition of definitions) {
			const row = document.createElement('label')
			row.className = 'field-row'
			const labelText = document.createElement('span')
			labelText.textContent = definition.label
			row.appendChild(labelText)

			if (isBooleanSetting(definition)) {
				const input = document.createElement('input')
				input.type = 'checkbox'
				input.checked = settings[definition.key] as boolean
				input.addEventListener('change', () => {
					settings = { ...settings, [definition.key]: input.checked }
					publish()
				})
				row.classList.add('checkbox-row')
				row.appendChild(input)
			} else if (isColorSetting(definition)) {
				const input = document.createElement('input')
				input.type = 'color'
				input.value = settings[definition.key] as string
				input.addEventListener('input', () => {
					settings = { ...settings, [definition.key]: input.value }
					publish()
				})
				row.appendChild(input)
			} else {
				const control = document.createElement('div')
				control.className = 'range-control'
				const input = document.createElement('input')
				input.type = 'range'
				input.min = String(definition.min)
				input.max = String(definition.max)
				input.step = String(definition.step)
				input.value = String(settings[definition.key])
				const output = document.createElement('output')
				output.value = input.value
				input.addEventListener('input', () => {
					const value = Number(input.value)
					output.value = Number.isInteger(value) ? String(value) : value.toFixed(2)
					settings = { ...settings, [definition.key]: value }
					publish()
				})
				control.append(input, output)
				row.appendChild(control)
			}

			container.appendChild(row)
		}
	}
}

document.querySelector('#reset-settings')?.addEventListener('click', () => {
	settings = structuredClone(defaultSettings)
	publish()
	renderControls()
})

document.querySelector('#reload-midi')?.addEventListener('click', () => {
	channel.send({ type: 'reloadMidi' })
})

channel.subscribe((message) => {
	if (message.type === 'midiReloaded') {
		alert('input.midを再読み込みしました。')
	}

	if (message.type === 'midiReloadFailed') {
		alert(`input.midの再読み込みに失敗しました。\n${message.message}`)
	}
})

window.addEventListener('beforeunload', () => channel.close())

renderControls()
