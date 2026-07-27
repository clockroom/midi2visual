# midi2visual

SMFのノートを、公開動画向けの3D映像として表示するMVPです。音声再生、動画出力、MIDI編集は行いません。

## ドキュメント

詳細仕様と開発引き継ぎ資料は[`docs/README.md`](docs/README.md)を参照してください。

## 必要環境

- Docker Desktop
- Firefox

依存関係はDockerコンテナ内へインストールします。ホスト側へNode.jsやnpmをインストールする必要はありません。

## 初回起動

本プロジェクトでは、Dockerおよびnpmコマンドは作業者が手動で実行します。

1. ターミナルでクローンした`midi2visual`ディレクトリへ移動します。

	```sh
	cd path/to/midi2visual
	```

2. npm依存関係をインストールします。

	```sh
	docker compose run --rm npm install
	```

3. Vite開発サーバーを起動します。

	```sh
	docker compose up -d
	```

4. Firefoxで次のページを別タブまたは別ウィンドウとして開きます。

	- 映像: <http://localhost:5173/>
	- 設定: <http://localhost:5173/control.html>

## 2回目以降

依存関係を変更していなければ、次のコマンドだけで起動できます。

```sh
docker compose up -d
```

## MIDIとカスタム画像の差し替え

使用するファイルは`public`直下へ配置し、設定画面でファイル名を指定します。

1. 利用するSMFを`public`直下へ配置します。初期値は`public/input.mid`です。
2. 設定画面の「MIDIファイル名」へ名前を入力します。拡張子を省くと`.mid`を補完します。
3. 「MIDIを再読み込み」を押します。読み込み結果はalertで通知されます。

再読み込み時にはキャッシュ回避用のクエリを付けています。

カスタム発音エフェクトを使う場合は画像を`public`直下へ配置し、「カスタム画像ファイル名」を指定して「カスタム画像」をONにします。初期画像は`public/custom.png`で、拡張子を省くと`.png`を補完します。

組み込みエフェクトの画像は`public/assets`にあり、通常は差し替える必要がありません。

## 操作

- `Space`: プリロール先頭から再生します。再生中に押した場合も先頭から再生し直します。
- `Esc`: 停止し、プリロール先頭へ戻します。
- `R`: 設定中のMIDIファイルを再読み込みします。
- `←` / `→`: 発音平面中央を注視したまま、カメラを水平方向へ移動します。
- `↑` / `↓`: 発音平面中央を注視したまま、カメラを垂直方向へ移動します。
- `W`: 現在の角度を維持してズームインします。
- `S`: 現在の角度を維持してズームアウトします。
- `0`: カメラを初期位置へ戻します。

シーク、一時停止、途中位置からの再開はありません。

カメラの上下左右移動は、発音平面中央を中心とする球面上で行われます。水平角は左右`60°`、垂直角は下方向`45°`から上方向`60°`の範囲に制限されます。カメラ位置は保存されず、ページまたはMIDIの再読み込み時に初期化されます。

## 設定

`control.html`で変更した設定は、同一オリジンで開いている映像画面へ`BroadcastChannel`で即時反映されます。設定値は`localStorage`へ保存され、ページ再読み込み後も保持されます。

初期設定へ戻す場合は、設定画面下部の「初期設定へ戻す」を押します。

発音面エフェクトは、コアフラッシュ、拡散リング、少量のスパークを個別にON/OFFできます。カスタム画像はTrack色で通常のAlpha Blendを行い、Note Onを最大濃度としてフェードしながら拡大または縮小します。既存のノート発光とNote Off後の残光には影響しません。

## MIDIの扱い

- SMF Format 0 / 1
- Note On / Off、Velocity、Tempo、PPQを使用
- 小節枠のために先頭のTime Signatureを使用
- Time Signatureがない場合は4/4として扱う
- 途中の拍子変更は非対応
- CC、Sustain Pedal、Pitch Bend、Aftertouch、Program Change、SysExを描画へ使用しない
- ノートを1つ以上含むトラックだけを、SMF内の順序で横軸へ配置
- MIDI Channelは無視
- 音域はSMF内の最低音から最高音までを自動検出し、上下へ3半音分の余白を付加

## ビルド

ビルドも作業者が手動で実行します。

```sh
docker compose run --rm npm run build
```

生成物は`dist`へ出力されます。プレビューする場合は次を実行します。

```sh
docker compose run --rm --service-ports npm run preview
```

## 既知の制約

- 主な動作確認対象はFirefoxです。
- Firefox以外では、Safari、Edge、Chromeの順に互換性を想定していますが、MVPでは動作保証しません。
- 拍子変更を含むSMFでは、小節枠と拍数カウンターが正しくならない場合があります。
- 曲末は最後のノート終了時刻を基準とします。ノート終了後にあるメタイベントだけの余白は曲長へ含めません。
- `renderScale`は1.0固定です。
- 音声同期は実時間基準ですが、画面録画やブラウザ自体のフレーム落ちは補正しません。
- OSのファイル選択、プリセットJSON、トラック並べ替え、トラック名表示、動画出力はありません。

## 構成

```text
index.html
control.html
public/
	assets/
		flare.png
		ring.png
		spark.png
	custom.png
	input.mid
src/
	control/
		main.ts
	shared/
		channel.ts
		midi.ts
		public-files.ts
		settings.ts
		types.ts
	stage/
		effects.ts
		main.ts
		timeline.ts
		visualizer.ts
	styles/
		control.css
		stage.css
```

MIDI解析、設定、再生時計、描画を分離しているため、演出追加時にもMIDIの読み込み処理へ影響を広げずに変更できます。
