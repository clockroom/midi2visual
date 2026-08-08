# 開発引き継ぎ

## 最初に把握すること

midi2visualは、DTM成果の公開動画を作るための、音声を再生しないリアルタイムSMFビジュアライザーです。

入力SMFとカスタム画像は`public`直下に置き、設定画面からファイル名を指定します。初期値は`input.mid`と`custom.png`です。映像は`index.html`、設定は`control.html`へ分離されています。

現在のMVPは次の機能を実装済みです。

- SMF Format 0 / 1の読み込み
- Note On / Off、Velocity、Tempo、PPQ、先頭Time Signatureの利用
- Track、Pitch、Timeを3軸へ割り当てたThree.js描画
- MIDI順、音長順、音程順、スマート順と反転によるTrack自動並べ替え
- ノートの発光と残光
- 発音時のコアフラッシュ、二重の拡散リング、スパーク
- Track色で合成する拡大・縮小対応カスタム画像
- Trackごとの20セグメント式Velocityレベルメータ
- 小節枠と任意の拍枠
- プリロール、ポストロール、先頭再生、停止
- 現在BPMと曲全体の拍数カウンター
- 発音平面中央を注視する球面オービットカメラ
- 別ページの設定UI、`localStorage`保存、`BroadcastChannel`同期
- MIDI再読み込みの成功・失敗通知

## 起動ページ

- 映像: <http://localhost:5173/>
- 設定: <http://localhost:5173/control.html>

Dockerを含む詳しい起動手順は[`../README.md`](../README.md)を参照してください。

## 操作

| キー | 動作 |
|---|---|
| `Space` | プリロール先頭から再生 |
| `Esc` | 停止してプリロール先頭へ戻る |
| `R` | 設定中のMIDIファイルを再読み込み |
| `←` / `→` | カメラを水平オービット |
| `↑` / `↓` | カメラを垂直オービット |
| `W` | ズームイン |
| `S` | ズームアウト |
| `0` | カメラを初期位置へ戻す |

シーク、一時停止、途中位置からの再開はありません。

## 主要ファイル

| ファイル | 責務 |
|---|---|
| `src/shared/midi.ts` | SMF読み込みと描画用データへの正規化 |
| `src/shared/track-order.ts` | 設定に応じたTrack自動並べ替え |
| `src/shared/tracks.ts` | Track Entity、識別子検索、表示順、Track派生値の管理 |
| `src/shared/types.ts` | 設定、MIDIモデル、ページ間メッセージの型 |
| `src/shared/settings.ts` | 初期設定、読み込み、保存 |
| `src/shared/public-files.ts` | `public`直下のファイル名正規化とURL生成 |
| `src/shared/channel.ts` | `BroadcastChannel`の薄いラッパー |
| `src/stage/timeline.ts` | 実時間基準の再生時刻管理 |
| `src/stage/stage-context.ts` | Stage内の最新設定と変更通知を共有するContext |
| `src/stage/visualizer.ts` | Stage描画オブジェクトを接続するComposition Root |
| `src/stage/core/stage-layout.ts` | Track、Pitch、World座標の変換と寸法 |
| `src/stage/core/midi-time-map.ts` | 秒とMIDI Tickの相互変換 |
| `src/stage/scene/stage-environment.ts` | 背景、Fog、Lightの状態とLifecycle |
| `src/stage/scene/guide-frame.ts` | 小節枠、拍枠、発音平面の具象クラス |
| `src/stage/scene/timeline-guide-layer.ts` | Timeline GuideのCollectionと時間移動 |
| `src/stage/notes/rendered-note.ts` | 1ノート分の表示状態、更新、Resource |
| `src/stage/notes/note-layer.ts` | Rendered Note Collectionとロングトーン粒子化 |
| `src/stage/notes/note-on-reaction-controller.ts` | Note On走査、発音エフェクト、レベルメータ |
| `src/stage/scene/orbit-camera-controller.ts` | 球面オービットカメラの状態と操作 |
| `src/stage/core/distance-visibility.ts` | ノートとレベルメータで共有するFog軽減Shader処理 |
| `src/stage/effects/tuning/note.ts` | 通常ノート、発音中、Note Off残光の表示調整 |
| `src/stage/effects/tuning/long-note.ts` | ロングトーンFade、粒子、粒子化前発光の調整 |
| `src/stage/effects/tuning/note-on.ts` | Note Onエフェクト4種の調整 |
| `src/stage/effects/tuning/math.ts` | 値域制限、非有限値対策、補間とEasing |
| `src/stage/effects/note-impact-effects.ts` | 4種の発音エフェクトを接続するFacade |
| `src/stage/effects/note-impact/` | 4種の発音エフェクト生成、Active Effectクラス、Queue |
| `src/stage/effects/long-note-dissolve.ts` | ロングトーン粒子Burstの生成、拡散、上限管理 |
| `src/stage/effects/level-meters.ts` | Trackレベルメータの状態、減衰、InstancedMesh描画 |
| `src/stage/core/palette.ts` | ノート、エフェクト、メータで共有するTrack色 |
| `src/stage/main.ts` | 映像ページの初期化、入力、再生、表示更新 |
| `src/control/main.ts` | 設定UIの生成、保存、通知 |
| `src/styles/stage.css` | 映像ページとBPM・拍数表示 |
| `src/styles/control.css` | 設定画面 |

## 変更時の注意点

### MIDI処理

- 描画コードからMIDIライブラリのオブジェクトを直接参照しません。
- `src/shared/midi.ts`で`MidiModel`へ正規化してから描画へ渡します。
- `VisualTrack.id`は元SMF内のTrack Indexであり、空Trackを除外しても再採番しません。
- `TrackCollection`が現在の表示順を管理し、ノートとLevel MeterはTrack IDへ紐付けます。
- Track色はTrack固有ではなく表示位置へ割り当てるため、並べ替えても画面上の色順は変わりません。
- `VisualTrack`は最長ノートのTick数と全ノートの平均Pitchを保持します。
- Track順は`TrackOrderer`が設定から決定し、自由な個別移動は行いません。
- Tempo変更は対応済みです。
- 途中の拍子変更は非対応です。先頭拍子を曲全体へ適用します。

### 再生時刻

- `requestAnimationFrame`の回数ではなく`performance.now()`を基準にします。
- フレーム落ち時に音楽時間を遅らせない設計です。
- シークを追加する場合は、途中から発音中になるノートとエフェクト状態を別途設計する必要があります。

### 設定

- 初期値を追加・変更するときは`AppSettings`、`defaultSettings`、設定UI、[`06-settings-spec.md`](06-settings-spec.md)を同時に更新します。
- 保存済み値は初期値へマージされるため、新規キーは初期値で補完されます。
- `showMeasureCounter`は現在BPMと拍数カウンターの表示フラグです。名称は旧仕様由来です。
- MIDIとカスタム画像のファイル名も設定として永続化します。
- 組み込み画像は`public/assets`、ユーザーが差し替えるファイルは`public`直下に置きます。
- Stage側では`StageContext`を設定の正本とし、各描画クラスが同じInstanceを参照します。
- 設定変更時の副作用は`StageContext`の変更通知を各担当クラスが購読します。

### カメラ

- カメラ位置は水平角、垂直角、距離から毎フレーム再構成します。
- 回転を積算せず、`camera.up`をY軸へ固定してロールを防ぎます。
- 注視点は発音平面中央です。
- カメラ位置は永続化しません。

## 変更後の確認項目

- `docker compose run --rm npm run build`
- Firefoxで`index.html`が表示される
- 設定ページ上段へ常用4カテゴリーが表示される
- 「詳細設定」で5カテゴリーをまとめて開閉でき、再読み込み時は閉じている
- PC表示と狭幅表示で常用カテゴリーが仕様どおり並び替わる
- 詳細設定でノートが2行を占め、その右へエフェクトとガイドが並ぶ
- 粒子化前に発光を`0秒`にすると事前発光しない
- 設定した`public`直下のMIDIが読み込まれる
- 3種の発音エフェクトを個別にON/OFFできる
- 拡散リングが即時と約`0.12秒`後に表示され、2枚目だけ大きな終了サイズまで広がる
- 停止中は待機中の2枚目リングの遅延時間が進まない
- ベロシティ強調、強調特性、強調閾値を変更すると、次のNote Onからリング、スパーク、カスタム画像の強度が変わる
- 初期値`100% / 50% / 50%`では従来と同じVelocityになる
- 遠方視認性を上げると、近距離表示を白飛びさせずに遠方のノートとレベルメータが見やすくなる
- Note Onエフェクト4種は遠方視認性にかかわらずFogの影響を受けない
- ノート基本発光を変更すると、未発音・発音中・残光中の最低発光量が変わる
- 2拍を超えるノートが2拍目からFadeし、Fade開始から6拍後またはNote Offの早い方で完全に消える
- ロングトーンFade後にNote Off残光でノートが再表示されない
- 設定した実Fade時間内の位置でバーが消え、Track色の粒子へ一度だけ置き換わる
- 粒子化タイミング直前にノート本体とGlowが短く強く発光する
- 粒子Texture未読込時や残りFade時間不足時は事前発光しない
- 粒子化範囲を変更すると、短い範囲では粒子数、長い範囲では粒子密度が変わる
- 1ノート最大粒子数を増減すると、長い粒子化範囲の密度が変わる
- 粒子サイズを変更すると、カメラとの距離によらず画面上の大きさが変わる
- カスタム画像が発音時にTrack色で合成され、フェードしながら拡大または縮小する
- TrackレベルメータがNote Onへ反応し、ロングトーンでも一定時間で減衰する
- Trackの4種類の並び順と反転が即時反映され、再生位置とカメラ状態が維持される
- レベルメータの表示、色、感度、不透明度、高さ、幅、奥行き位置設定が即時反映される
- 再生、停止、プリロール、ポストロールが機能する
- Tempo変更位置でBPM表示が切り替わる
- 拍数表示の桁が変わっても右下の位置がずれない
- 設定変更が映像ページへ即時反映される
- 設定ページからのMIDI再読み込み後にalertが表示される
- カメラ操作を重ねても画面がロールしない
- `0`とMIDI再読み込みでカメラが初期化される

## 次に読む文書

要件を変更する場合は[`02-product-spec.md`](02-product-spec.md)から、実装を変更する場合は[`03-functional-spec.md`](03-functional-spec.md)以降も確認してください。
