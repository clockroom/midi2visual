# UML付録

このディレクトリは、midi2visualの主要なObject関係とLifecycleをMermaidで概観するための付録です。

## 位置付け

- 機能と表示の仕様は[`03-functional-spec.md`](../03-functional-spec.md)から[`06-settings-spec.md`](../06-settings-spec.md)までを正本とします。
- Module責務と依存方向は[`07-architecture.md`](../07-architecture.md)を正本とします。
- 型、プロパティ、メソッド、計算処理の最終的な正本は[`src`](../../src)配下のSource Codeです。
- UMLは責務、所有、継承、生成、主要な状態遷移を把握するための要約であり、Source Codeの完全な転記ではありません。

図と正本が一致しない場合は、意図的な仕様変更かUMLの更新漏れかを確認してください。

## 読む順番

1. [`01-domain-model.md`](01-domain-model.md)
	- MIDI Domain ModelとTrack並べ替えの責務
2. [`02-stage-runtime.md`](02-stage-runtime.md)
	- Stage描画Objectの所有関係とフレーム更新
3. [`03-note-impact-effects.md`](03-note-impact-effects.md)
	- Note Onエフェクト、Active Effect、Level Meterの関係
4. [`04-note-lifecycle.md`](04-note-lifecycle.md)
	- ノート表示とLevel Meter Envelopeの状態遷移

## 記法

| 記法 | 意味 |
|---|---|
| `A *-- B` | AがBのLifecycleを所有するComposition |
| `A o-- B` | AがBをCollectionまたはDataとして保持するAggregation |
| `A --> B` | AがBを呼び出す、または処理を委譲する依存 |
| `A ..> B` | Requestや一時Objectとして利用する依存 |
| `A <|-- B` | BがAを継承するGeneralization |

図では、理解に必要な場合を除いてプロパティとメソッドを記載しません。関係線のLabelは実装の詳細な呼び出し名ではなく、責務上の意味を表します。

## 更新方針

次の場合に、関係する図を更新します。

- 主要Objectの所有者が変わった
- Classの継承・委譲関係が変わった
- フレーム更新やNote On処理の順序が変わった
- ノート表示またはLevel MeterのLifecycleが変わった

設定値、計算式、個別メソッドの追加だけでは、図の関係やLifecycleが変わらない限り更新不要です。
