# 開発引き継ぎ

## 最初に把握すること

midi2visualは、DTM成果の公開動画を作るための、音声を再生しないリアルタイムSMFビジュアライザーです。

入力SMFとカスタム画像は`public`直下に置き、設定画面からファイル名を指定します。初期値は`input.mid`と`custom.png`です。映像は`index.html`、設定は`control.html`へ分離されています。

現在のMVPは次の機能を実装済みです。

- SMF Format 0 / 1の読み込み
- Note On / Off、Velocity、Tempo、PPQ、先頭Time Signatureの利用
- Track、Pitch、Timeを3軸へ割り当てたThree.js描画
- ノートの発光と残光
- 発音時のコアフラッシュ、拡散リング、スパーク
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
| `src/shared/types.ts` | 設定、MIDIモデル、ページ間メッセージの型 |
| `src/shared/settings.ts` | 初期設定、読み込み、保存 |
| `src/shared/public-files.ts` | `public`直下のファイル名正規化とURL生成 |
| `src/shared/channel.ts` | `BroadcastChannel`の薄いラッパー |
| `src/stage/timeline.ts` | 実時間基準の再生時刻管理 |
| `src/stage/visualizer.ts` | Three.jsシーン、ノート、枠、粒子、カメラ |
| `src/stage/effects.ts` | 発音時エフェクトの生成、時間更新、Texture管理 |
| `src/stage/level-meters.ts` | Trackレベルメータの状態、減衰、InstancedMesh描画 |
| `src/stage/palette.ts` | ノート、エフェクト、メータで共有するTrack色 |
| `src/stage/main.ts` | 映像ページの初期化、入力、再生、表示更新 |
| `src/control/main.ts` | 設定UIの生成、保存、通知 |
| `src/styles/stage.css` | 映像ページとBPM・拍数表示 |
| `src/styles/control.css` | 設定画面 |

## 変更時の注意点

### MIDI処理

- 描画コードからMIDIライブラリのオブジェクトを直接参照しません。
- `src/shared/midi.ts`で`MidiModel`へ正規化してから描画へ渡します。
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

### カメラ

- カメラ位置は水平角、垂直角、距離から毎フレーム再構成します。
- 回転を積算せず、`camera.up`をY軸へ固定してロールを防ぎます。
- 注視点は発音平面中央です。
- カメラ位置は永続化しません。

## 変更後の確認項目

- `docker compose run --rm npm run build`
- Firefoxで`index.html`が表示される
- 設定した`public`直下のMIDIが読み込まれる
- 3種の発音エフェクトを個別にON/OFFできる
- 遠方ノート視認性を上げると、近距離ノートを白飛びさせずに遠方ノートが見やすくなる
- ノート基本発光を変更すると、未発音・発音中・残光中の最低発光量が変わる
- カスタム画像が発音時にTrack色で合成され、フェードしながら拡大または縮小する
- TrackレベルメータがNote Onへ反応し、ロングトーンでも一定時間で減衰する
- レベルメータの表示、色、感度、不透明度、高さ、幅設定が即時反映される
- 再生、停止、プリロール、ポストロールが機能する
- Tempo変更位置でBPM表示が切り替わる
- 拍数表示の桁が変わっても右下の位置がずれない
- 設定変更が映像ページへ即時反映される
- 設定ページからのMIDI再読み込み後にalertが表示される
- カメラ操作を重ねても画面がロールしない
- `0`とMIDI再読み込みでカメラが初期化される

## 次に読む文書

要件を変更する場合は[`02-product-spec.md`](02-product-spec.md)から、実装を変更する場合は[`03-functional-spec.md`](03-functional-spec.md)以降も確認してください。
