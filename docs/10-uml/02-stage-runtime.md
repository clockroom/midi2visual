# Stage構成とフレーム更新

`MidiVisualizer`をComposition RootとしたStage描画Objectの所有関係です。

```mermaid
classDiagram
	direction TB

	class MidiVisualizer {
		<<CompositionRoot>>
	}
	class StageContext {
		<<SettingsContext>>
	}
	class StageEnvironment {
		<<SceneEnvironment>>
	}
	class NoteLayer {
		<<SceneLayer>>
	}
	class RenderedNote {
		<<RenderObject>>
	}
	class LongNoteDissolveEffects {
		<<EffectCollection>>
	}
	class TimelineGuideLayer {
		<<SceneLayer>>
	}
	class GuideFrame {
		<<AbstractRenderObject>>
	}
	class MeasureGuideFrame
	class BeatGuideFrame
	class PlayheadGuideFrame
	class NoteOnReactionController {
		<<ReactionCoordinator>>
	}
	class OrbitCameraController {
		<<CameraController>>
	}
	class StageLayout {
		<<CoordinateMapping>>
	}
	class MidiTimeMap {
		<<TimeMapping>>
	}

	MidiVisualizer *-- StageEnvironment
	MidiVisualizer *-- NoteLayer
	MidiVisualizer *-- TimelineGuideLayer
	MidiVisualizer *-- NoteOnReactionController
	MidiVisualizer *-- OrbitCameraController
	MidiVisualizer --> StageContext : 設定を共有
	MidiVisualizer ..> StageLayout : Load・設定変更時に生成
	MidiVisualizer ..> MidiTimeMap : MIDI読込時に生成

	NoteLayer *-- RenderedNote : Noteごとの表示状態
	NoteLayer *-- LongNoteDissolveEffects : 粒子Burstを管理
	TimelineGuideLayer *-- GuideFrame : Timeline枠を管理
	GuideFrame <|-- MeasureGuideFrame
	GuideFrame <|-- BeatGuideFrame
	GuideFrame <|-- PlayheadGuideFrame
```

`StageContext`は各描画Objectへ注入されますが、図の交差を抑えるため個別の依存線は省略しています。

## 1フレームの主要処理

```mermaid
sequenceDiagram
	participant App as stage/main.ts
	participant Timeline as PlaybackTimeline
	participant Visualizer as MidiVisualizer
	participant Notes as NoteLayer
	participant Guides as TimelineGuideLayer
	participant Reactions as NoteOnReactionController
	participant Renderer as WebGLRenderer

	App->>Visualizer: Camera入力を更新
	App->>Timeline: performance.now()で更新
	Timeline-->>App: songSeconds
	App->>Visualizer: render(songSeconds)
	Visualizer->>Notes: Note表示と粒子を更新
	Visualizer->>Guides: Timeline枠位置を更新
	Visualizer->>Reactions: Note On反応を更新
	Visualizer->>Renderer: Sceneを描画
	App->>App: BPM・拍数表示を更新
```

## 正本

- Module責務と毎フレーム処理: [`../07-architecture.md`](../07-architecture.md)
- 3D空間と表示仕様: [`../04-visual-spec.md`](../04-visual-spec.md)
- 実装: [`stage/visualizer.ts`](../../src/stage/visualizer.ts)、[`stage/main.ts`](../../src/stage/main.ts)、[`stage/notes`](../../src/stage/notes)、[`stage/scene`](../../src/stage/scene)
