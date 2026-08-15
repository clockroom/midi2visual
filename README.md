# midi2visual

SMFのノートを、公開動画向けの3D映像として表示するWebアプリです。

音声再生、動画出力、MIDI編集は行いません。映像はブラウザへリアルタイム描画し、必要に応じて画面録画と音源を動画編集ソフトで合成します。

## 必要環境

- Docker Desktop
- Firefox

依存関係はDockerコンテナ内へインストールするため、ホスト側のNode.jsとnpmは不要です。

## クイックスタート

1. Cloneしたディレクトリへ移動します。

	```sh
	cd path/to/midi2visual
	```

2. 初回のみ、依存関係をインストールします。

	```sh
	docker compose run --rm npm install
	```

3. Vite開発サーバーを起動します。

	```sh
	docker compose up -d
	```

4. Firefoxで次のページを開きます。

	- 映像画面: <http://localhost:5173/>
	- 設定画面: <http://localhost:5173/control.html>

2回目以降は、依存関係に変更がなければ`docker compose up -d`だけで起動できます。

## 基本的な使い方

### MIDI

1. SMFを`public`直下へ配置します。
2. 設定画面の「MIDIファイル名」へファイル名を入力します。
3. 「MIDIを再読み込み」を押します。
4. 映像画面で`Space`を押して再生します。

初期ファイル名は`input.mid`です。拡張子を省略した場合は`.mid`を補完します。

### カスタム画像

Note On時のカスタムエフェクトを変更する場合は、PNG画像を`public`直下へ配置し、設定画面の「カスタム画像ファイル名」へ入力します。

初期ファイル名は`custom.png`です。拡張子を省略した場合は`.png`を補完します。組み込みエフェクトのAssetは`public/assets`にあり、通常は変更不要です。

### キーボード操作

| キー | 操作 |
| --- | --- |
| `Space` | プリロール先頭から再生 |
| `Esc` | 停止してプリロール先頭へ戻る |
| `R` | MIDIを再読み込み |
| `←` / `→` | カメラを左右へ移動 |
| `↑` / `↓` | カメラを上下へ移動 |
| `W` / `S` | ズームイン / ズームアウト |
| `0` | カメラを初期位置へ戻す |

シーク、一時停止、途中位置からの再開には対応していません。

## ビルド

```sh
docker compose run --rm npm run build
```

生成物は`dist`へ出力されます。ビルド結果をプレビューする場合は次を実行します。

```sh
docker compose run --rm --service-ports npm run preview
```

## 重要な制約

- 主な動作確認対象はFirefoxです。
- 音声再生と動画出力は行いません。
- 設定と演出計算の1拍は、拍子にかかわらず四分音符1つ分です。拍枠と拍数カウンターだけは、先頭拍子の分母音符を1拍とします。
- 途中で拍子の分子が変わるSMFは、小節枠だけ変更後の拍子へ追従します。
- 曲途中の拍子の分母変更は対応対象外です。

その他の制約は[`docs/09-known-limitations.md`](docs/09-known-limitations.md)を参照してください。

## ドキュメント

機能仕様、映像仕様、設定項目、MIDI処理、設計判断、実装構造は[`docs/README.md`](docs/README.md)から参照できます。

開発や機能変更を行う場合は、最初に[`docs/01-handoff.md`](docs/01-handoff.md)を確認してください。

## License

[MIT License](LICENSE.md)
