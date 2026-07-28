import '../styles/control.css'
import { AppChannel } from '../shared/channel'
import {
	defaultSettings,
	loadSettings,
	saveSettings,
} from '../shared/settings'
import { normalizePublicFileName } from '../shared/public-files'
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

type StringSetting = {
	kind: 'string'
	key: keyof AppSettings
	label: string
	defaultFileName: string
	defaultExtension: string
}

type SelectSetting = {
	kind: 'select'
	key: keyof AppSettings
	label: string
	options: Array<{ value: string; label: string }>
}

type SettingDefinition =
	| NumericSetting
	| BooleanSetting
	| ColorSetting
	| StringSetting
	| SelectSetting

const groups: Record<string, SettingDefinition[]> = {
	'file-settings': [
		{
			kind: 'string',
			key: 'midiFileName',
			label: 'MIDIファイル名',
			defaultFileName: 'input.mid',
			defaultExtension: '.mid',
		},
	],
	'time-settings': [
		{ kind: 'number', key: 'preRollSeconds', label: 'プリロール (秒)', min: 0, max: 10, step: 0.1 },
		{ kind: 'number', key: 'postRollSeconds', label: 'ポストロール (秒)', min: 0, max: 10, step: 0.1 },
		{ kind: 'number', key: 'lookAheadSeconds', label: '先読み (秒)', min: 2, max: 20, step: 0.5 },
		{ kind: 'number', key: 'timeUnitsPerSecond', label: '時間方向の速度', min: 1, max: 10, step: 0.1 },
	],
	'note-settings': [
		{ kind: 'number', key: 'noteSize', label: 'ノート断面サイズ', min: 0.05, max: 1.5, step: 0.01 },
		{ kind: 'number', key: 'noteOpacity', label: 'ノート不透明度', min: 0.1, max: 1, step: 0.01 },
		{ kind: 'number', key: 'noteBaseEmissiveIntensity', label: 'ノート基本発光', min: 0, max: 3, step: 0.05 },
		{ kind: 'number', key: 'noteDistanceVisibility', label: '遠方ノート視認性', min: 0, max: 1, step: 0.05 },
		{ kind: 'number', key: 'noteGlowIntensity', label: '発音時の発光', min: 0, max: 4, step: 0.05 },
		{ kind: 'number', key: 'noteAfterglowSeconds', label: '残光 (秒)', min: 0.05, max: 2, step: 0.05 },
		{ kind: 'boolean', key: 'longNoteFadeEnabled', label: 'ロングトーン自動Fade' },
		{ kind: 'number', key: 'longNoteFadeStartBeats', label: 'Fade開始 (拍)', min: 1, max: 32, step: 0.5 },
		{ kind: 'number', key: 'longNoteFadeDurationBeats', label: 'Fade時間 (拍)', min: 0.5, max: 64, step: 0.5 },
		{ kind: 'boolean', key: 'showLongNoteDissolve', label: 'ロングトーン粒子化' },
		{ kind: 'number', key: 'longNoteDissolveRangePercent', label: '粒子化範囲 (%)', min: 10, max: 100, step: 5 },
		{ kind: 'number', key: 'longNoteDissolveMaxParticlesPerNote', label: '1ノート最大粒子数', min: 8, max: 256, step: 8 },
		{ kind: 'number', key: 'longNoteDissolveParticleSize', label: '粒子サイズ (px)', min: 2, max: 32, step: 1 },
	],
	'effect-settings': [
		{ kind: 'boolean', key: 'showCoreFlash', label: 'コアフラッシュ' },
		{ kind: 'boolean', key: 'showImpactRing', label: '拡散リング' },
		{ kind: 'boolean', key: 'showSparks', label: 'スパーク' },
		{ kind: 'boolean', key: 'showCustomImpactImage', label: 'カスタム画像' },
		{
			kind: 'string',
			key: 'customImpactImageFileName',
			label: 'カスタム画像ファイル名',
			defaultFileName: 'custom.png',
			defaultExtension: '.png',
		},
		{
			kind: 'select',
			key: 'customImpactScaleMode',
			label: 'カスタム画像の変形',
			options: [
				{ value: 'expand', label: '拡大' },
				{ value: 'shrink', label: '縮小' },
			],
		},
		{ kind: 'number', key: 'customImpactDuration', label: '表示時間 (秒)', min: 0.1, max: 3, step: 0.05 },
		{ kind: 'number', key: 'customImpactOpacity', label: '最大不透明度', min: 0.05, max: 1, step: 0.05 },
		{ kind: 'number', key: 'customImpactStartScale', label: '開始サイズ', min: 0.1, max: 5, step: 0.05 },
		{ kind: 'number', key: 'customImpactEndScale', label: '終了サイズ', min: 0.1, max: 5, step: 0.05 },
	],
	'level-meter-settings': [
		{ kind: 'boolean', key: 'showLevelMeters', label: 'レベルメータを表示' },
		{
			kind: 'select',
			key: 'levelMeterColorMode',
			label: '色',
			options: [
				{ value: 'normal', label: 'ノーマル (緑・黄・赤)' },
				{ value: 'white', label: '白系' },
				{ value: 'blue', label: '青系' },
				{ value: 'track', label: 'トラックカラー' },
			],
		},
		{ kind: 'number', key: 'levelMeterSensitivity', label: '感度 (%)', min: 0, max: 100, step: 1 },
		{ kind: 'number', key: 'levelMeterOpacity', label: '全体の不透明度', min: 0, max: 1, step: 0.05 },
		{ kind: 'number', key: 'levelMeterMaxHeightPercent', label: '最大高さ (%)', min: 10, max: 50, step: 1 },
		{ kind: 'number', key: 'levelMeterWidthPercent', label: 'トラック幅比 (%)', min: 50, max: 100, step: 1 },
		{ kind: 'number', key: 'levelMeterDepthOffset', label: '奥行き位置', min: 0, max: 40, step: 0.5 },
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
		{ kind: 'color', key: 'backgroundTopColor', label: '背景上部色' },
		{ kind: 'color', key: 'backgroundBottomColor', label: '背景下部色' },
	],
}

const channel = new AppChannel()
let settings = loadSettings()
const saveStatus = document.querySelector<HTMLElement>('#save-status')

function isBooleanSetting(
	definition: SettingDefinition,
): definition is BooleanSetting {
	return definition.kind === 'boolean'
}

function isColorSetting(
	definition: SettingDefinition,
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
			} else if (definition.kind === 'string') {
				const input = document.createElement('input')
				input.type = 'text'
				input.value = String(settings[definition.key])
				input.spellcheck = false
				input.addEventListener('change', () => {
					const value = normalizePublicFileName(
						input.value,
						definition.defaultFileName,
						definition.defaultExtension,
					)
					input.value = value
					settings = { ...settings, [definition.key]: value }
					publish()
				})
				row.appendChild(input)
			} else if (definition.kind === 'select') {
				const select = document.createElement('select')

				for (const optionDefinition of definition.options) {
					const option = document.createElement('option')
					option.value = optionDefinition.value
					option.textContent = optionDefinition.label
					select.appendChild(option)
				}

				select.value = String(settings[definition.key])
				select.addEventListener('change', () => {
					settings = { ...settings, [definition.key]: select.value }
					publish()
				})
				row.appendChild(select)
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
	const fileName = normalizePublicFileName(
		settings.midiFileName,
		'input.mid',
		'.mid',
	)
	settings = { ...settings, midiFileName: fileName }
	publish()
	renderControls()
	channel.send({ type: 'reloadMidi', fileName })
})

channel.subscribe((message) => {
	if (message.type === 'midiReloaded') {
		alert(`${message.fileName}を再読み込みしました。`)
	}

	if (message.type === 'midiReloadFailed') {
		alert(`${message.fileName}の再読み込みに失敗しました。\n${message.message}`)
	}
})

window.addEventListener('beforeunload', () => channel.close())

renderControls()
