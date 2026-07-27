# 既知の制約

## ブラウザ

- 主な動作確認対象はFirefoxです。
- Safari、Edge、ChromeはMVPの動作保証対象ではありません。
- `BroadcastChannel`、WebGL、ファイル取得の挙動差が発生する可能性があります。

## MIDI

- 途中の拍子変更は非対応です。
- SMPTE Time Divisionは保証しません。
- Sustain Pedalを含むCCを描画へ反映しません。
- Pitch Bend、Aftertouch、Program Change、SysExを描画へ反映しません。
- MIDI ChannelをTrack内で分離しません。
- Trackの並べ替え、表示・非表示を変更できません。
- Track Nameを画面へ表示しません。
- 曲長は最後のNote Offを基準とし、それより後のメタイベントを含めません。

## 再生

- 一時停止はありません。
- シークはありません。
- 途中位置からの再開はありません。
- ループ再生はありません。
- 音声は再生しません。
- 外部音源とリアルタイム同期する機能はありません。

## 映像

- 動画ファイルを出力しません。
- PNG連番を出力しません。
- RendererのPixel Ratioは`1`固定です。
- フレーム落ち時も曲時刻は進むため、表示フレームが飛ぶ可能性があります。
- 大量のノートは個別Meshとして生成されるため、非常に大規模なSMFでは負荷が増えます。
- ノートのGlowは簡易的な加算Meshであり、Post Processing Bloomではありません。
- 背景粒子はランダム生成のため、ページ読み込みごとに配置が変わります。
- 発音エフェクトは最大`768`個で、極端に密集した同時発音では古いものから破棄されます。
- カスタム画像の縦横比は保持せず、正方形の発音面Spriteとして表示します。
- カスタム画像の読み込み失敗はDevTools Consoleへ警告し、映像画面のalertは表示しません。
- Trackレベルメータは音声レベルではなく、MIDI Velocityを直接正規化した表示です。
- レベルメータは20段固定で、Zone境界は感度から線形算出します。減衰時間は設定画面から変更できません。

## カメラ

- マウス、Trackpad、Gamepad操作はありません。
- カメラ位置は保存されません。
- カメラ角度とZoom範囲はコード上の定数です。
- 発音平面中央以外へ注視点を移動できません。
- MIDI再読み込みでカメラ位置は初期化されます。

## 設定

- 設定PresetのImport / Exportはありません。
- 曲ごとの設定ファイルはありません。
- 設定のSchema Validationは最小限です。
- `localStorage`の古い値が型として不正でも、ObjectであればShallow Mergeされます。
- `showMeasureCounter`という内部名は旧仕様由来ですが、現在はBPMと拍数カウンターの表示を制御します。

## 入力

- ファイル選択UIはありません。
- Drag & Dropはありません。
- MIDIとカスタム画像は`public`直下へ手動配置し、設定画面ではファイル名だけを指定します。
- MIDIファイル名を変更した後は再読み込み操作が必要です。
- 設定ページだけを開いている場合、再読み込み要求へ応答する映像ページが存在しません。

## 将来候補

次の項目は候補であり、実装予定として確定していません。

- `InstancedMesh`による大量ノート最適化
- PNG連番またはOffline Frame Rendering
- 曲ごとのPreset
- Track表示切り替えと並べ替え
- CC、Expression、Pitch Bend連動演出
- 拍子変更対応
- Markerによるセクション演出
- Post Processing Bloom
- 背景テーマとカメラPreset
- FPS、描画サイズ、現在時刻のDebug表示

機能追加時は[`02-product-spec.md`](02-product-spec.md)、[`03-functional-spec.md`](03-functional-spec.md)、[`08-decisions.md`](08-decisions.md)を更新してください。
