# Note OnエフェクトとLevel Meter

Note On検出後の一過性エフェクトとTrack Level Meterの主要なObject関係です。

```mermaid
classDiagram
	direction TB

	class NoteOnReactionController {
		<<ReactionCoordinator>>
	}
	class NoteImpactEffects {
		<<Facade>>
	}
	class CoreFlashEffect {
		<<Emitter>>
	}
	class ImpactRingEffect {
		<<Emitter>>
	}
	class SparkEffects {
		<<Emitter>>
	}
	class CustomImageEffect {
		<<Emitter>>
	}
	class ActiveNoteImpactEffectQueue {
		<<Collection>>
	}
	class ActiveNoteImpactEffect {
		<<AbstractActiveEffect>>
	}
	class ActiveCoreFlashEffect
	class ActiveImpactRingEffect
	class ActiveSparkEffect
	class ActiveCustomImageEffect
	class TrackLevelMeters {
		<<RendererCollection>>
	}
	class LevelMeterEnvelope {
		<<EnvelopeState>>
	}

	NoteOnReactionController *-- NoteImpactEffects
	NoteOnReactionController *-- TrackLevelMeters

	NoteImpactEffects *-- CoreFlashEffect
	NoteImpactEffects *-- ImpactRingEffect
	NoteImpactEffects *-- SparkEffects
	NoteImpactEffects *-- CustomImageEffect
	NoteImpactEffects *-- ActiveNoteImpactEffectQueue

	CoreFlashEffect ..> ActiveCoreFlashEffect : 生成してQueueへ追加
	ImpactRingEffect ..> ActiveImpactRingEffect : 生成してQueueへ追加
	SparkEffects ..> ActiveSparkEffect : 生成してQueueへ追加
	CustomImageEffect ..> ActiveCustomImageEffect : 生成してQueueへ追加

	ActiveNoteImpactEffectQueue o-- ActiveNoteImpactEffect : Lifecycleを管理
	ActiveNoteImpactEffect <|-- ActiveCoreFlashEffect
	ActiveNoteImpactEffect <|-- ActiveImpactRingEffect
	ActiveNoteImpactEffect <|-- ActiveSparkEffect
	ActiveNoteImpactEffect <|-- ActiveCustomImageEffect

	TrackLevelMeters *-- LevelMeterEnvelope : Trackごとに所有
```

## Note On処理

```mermaid
sequenceDiagram
	participant Controller as NoteOnReactionController
	participant Facade as NoteImpactEffects
	participant Context as StageContext
	participant Emitter as 対象Emitter
	participant Queue as ActiveNoteImpactEffectQueue
	participant Meters as TrackLevelMeters
	participant Envelope as LevelMeterEnvelope

	Controller->>Controller: 同じTickのNoteを取得
	loop Noteごとの発音位置
		Controller->>Facade: Track位置・Pitch・Velocity
		Facade->>Context: 演出用Velocityへ変換
		Facade->>Emitter: 有効なEffectをTrigger
		Emitter->>Queue: Active Effectを追加
	end
	Controller->>Controller: Trackごとに最大Velocityと最終Note Offを集約
	loop 発音したTrack
		Controller->>Meters: 集約済みRequest
		Meters->>Envelope: PeakとRelease終点を更新
	end
	Queue->>Queue: Active Effectを更新・完了分を破棄
	Meters->>Envelope: 絶対曲時刻まで進める
```

コアフラッシュは変換前のMIDI Velocityを使用し、拡散リング、スパーク、カスタム画像は`StageContext`で変換した演出用Velocityを使用します。

## 正本

- 発音エフェクトとLevel Meter仕様: [`../03-functional-spec.md`](../03-functional-spec.md#発音エフェクト)、[`../04-visual-spec.md`](../04-visual-spec.md#note-onエフェクト)
- 設計判断: [`../08-decisions.md`](../08-decisions.md#note-onエフェクトを生成処理active-objectqueueへ分離する)
- 実装: [`note-on-reaction-controller.ts`](../../src/stage/notes/note-on-reaction-controller.ts)、[`note-impact-effects.ts`](../../src/stage/effects/note-impact-effects.ts)、[`note-impact`](../../src/stage/effects/note-impact)、[`level-meters.ts`](../../src/stage/effects/level-meters.ts)
