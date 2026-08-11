# ノートとLevel MeterのLifecycle

この文書の状態名は、複数の時刻判定から得られる表示上の概念です。Source Codeに同名の状態Enumが存在することを意味しません。

## ノート表示

```mermaid
stateDiagram-v2
	[*] --> Future
	Future --> Active: Note On
	Active --> Afterglow: Note Off / 通常ノート
	Afterglow --> Hidden: 残光終了

	Active --> LongFade: Fade開始拍へ到達
	LongFade --> PreFlash: 粒子化可能かつ事前発光区間
	PreFlash --> Dissolved: 粒子化時刻へ到達
	LongFade --> Dissolved: 事前発光時間が0
	LongFade --> Hidden: 粒子化せずFade完了
	PreFlash --> Hidden: 粒子化せずFade完了
	Dissolved --> Hidden: 粒子Burst終了

	Hidden --> Future: 再生位置を巻き戻してReset
	Dissolved --> Future: 再生位置を巻き戻してReset
```

- `Future`、`Active`、`Afterglow`は通常ノートの表示経路です。
- `LongFade`は設定した開始拍から実際のFade終了までの経路です。
- 粒子化に成功するとノートMeshを非表示にし、表示責務を`LongNoteDissolveEffects`の粒子Burstへ移します。
- ロングトーンFadeが適用されたノートは、完全消失後にNote Off残光へ遷移しません。

## Level Meter Envelope

```mermaid
stateDiagram-v2
	[*] --> Idle
	Idle --> PeakHold: Note On
	PeakHold --> Release: Hold終了
	Release --> Idle: Release終点
	PeakHold --> PeakHold: 再発音 / Peak再計算
	Release --> PeakHold: 再発音 / Peakと終点を再評価

	note right of Release
		短音: Note Onから600msで終了
		長音: Note Offで終了
		後のNote Offだけが終点を延長
	end note
```

EnvelopeはTrackごとに存在します。同じTickに同一Trackで複数のNote Onがある場合は、最大Velocityと最も遅いNote Offへ集約してからTriggerします。

## 正本

- ノート、ロングトーン、Level Meter仕様: [`../03-functional-spec.md`](../03-functional-spec.md)、[`../04-visual-spec.md`](../04-visual-spec.md)
- 実装: [`rendered-note.ts`](../../src/stage/notes/rendered-note.ts)、[`long-note-dissolve.ts`](../../src/stage/effects/long-note-dissolve.ts)、[`level-meter-envelope.ts`](../../src/stage/effects/level-meter-envelope.ts)
