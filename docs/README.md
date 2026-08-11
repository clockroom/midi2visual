# midi2visualドキュメント

このディレクトリには、midi2visualの確定仕様、実装構造、設計判断、既知の制約をまとめています。

新しい開発チャットや新しい作業者へ引き継ぐ場合は、最初に[`01-handoff.md`](01-handoff.md)を渡し、その後は番号順に読んでください。

## 読む順番

1. [`01-handoff.md`](01-handoff.md)
	- 現在の状態、主要ファイル、操作、変更時の確認事項
2. [`02-product-spec.md`](02-product-spec.md)
	- アプリの目的、利用方法、対象範囲
3. [`03-functional-spec.md`](03-functional-spec.md)
	- 入力、再生、画面、設定、エラー処理の機能仕様
4. [`04-visual-spec.md`](04-visual-spec.md)
	- 3D空間、ノート、小節枠、カメラ、画面表示の仕様
5. [`05-midi-spec.md`](05-midi-spec.md)
	- SMF解析、時間変換、拍子、Tempo、無視するイベント
6. [`06-settings-spec.md`](06-settings-spec.md)
	- 全設定項目、初期値、UI範囲、保存仕様
7. [`07-architecture.md`](07-architecture.md)
	- 技術構成、モジュール責務、データフロー
8. [`08-decisions.md`](08-decisions.md)
	- 重要な設計判断と理由
9. [`09-known-limitations.md`](09-known-limitations.md)
	- 現在の制約、非対応機能、将来候補
10. [`10-uml/README.md`](10-uml/README.md)
	- 主要Objectの関係、実行順、Lifecycleを示すUML付録

## 仕様の正本

- 第三者向けの概要、起動手順、基本操作はルートの[`README.md`](../README.md)を正本とします。
- 機能と表示の期待動作は`docs`配下の仕様書を正本とします。
- 設定の型と初期値は[`src/shared/types.ts`](../src/shared/types.ts)および[`src/shared/settings.ts`](../src/shared/settings.ts)を最終的な正本とします。
- 実装とドキュメントが食い違う場合は、意図的な仕様変更か不具合かを確認してから両方を更新してください。
- UML付録は構造把握用の要約とし、仕様書とSource Codeを正本とします。

## 記述方針

- ローカル環境固有の絶対パスやユーザー名を記載しません。
- 実装済みの仕様と将来候補を区別します。
- 変更時は関連する複数の文書を同時に更新します。
- コード上の内部名と実際の責務が一致しない場合は、現在の動作を具体的に明記します。
