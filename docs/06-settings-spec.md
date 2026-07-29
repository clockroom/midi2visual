# 設定仕様

## 保存と同期

- 設定型は`AppSettings`とする。
- 初期値は`defaultSettings`へ埋め込む。
- 保存先は`localStorage`とする。
- 保存キーは`midi2visual.settings.v2`とする。
- `v1`以前の保存値は読み込まない。
- 設定ページから映像ページへの通知は`BroadcastChannel`を使用する。
- 保存済みオブジェクトを初期値へShallow Mergeする。
- 保存値が不正なJSONまたはObject以外の場合は初期値へ戻す。

## 設定項目

| キー | 初期値 | UI範囲 | 意味 |
|---|---:|---:|---|
| `midiFileName` | `input.mid` | Text | `public`直下から読むSMF名。拡張子省略時は`.mid` |
| `preRollSeconds` | `2` | `0〜10`, step `0.1` | 曲頭より前に動かす秒数 |
| `postRollSeconds` | `3` | `0〜10`, step `0.1` | 最後のノート後に動かす秒数 |
| `lookAheadSeconds` | `8` | `2〜20`, step `0.5` | 描画対象と背景奥行きの基準時間 |
| `timeUnitsPerSecond` | `4` | `1〜10`, step `0.1` | 1秒あたりのZ方向world unit |
| `trackSpacing` | `1.5` | `0.6〜4`, step `0.05` | Track列のX間隔 |
| `noteSize` | `0.4` | `0.05〜1.5`, step `0.01` | 正方形ノート断面の一辺 |
| `noteOpacity` | `0.82` | `0.1〜1`, step `0.01` | 発音前ノートの基本Opacity |
| `noteBaseEmissiveIntensity` | `0.55` | `0〜3`, step `0.05` | 未発音・発音中・残光中の最低Emissive強度 |
| `distanceVisibility` | `0.8` | `0〜1`, step `0.05` | ノート、レベルメータ、カスタム画像のScene Fogの影響を弱める割合。`1`でFogなし |
| `noteGlowIntensity` | `1.7` | `0〜4`, step `0.05` | 発音中と残光のEmissive倍率 |
| `noteAfterglowSeconds` | `0.3` | `0.05〜2`, step `0.05` | Note Off後の残光時間 |
| `longNoteFadeEnabled` | `true` | ON/OFF | 長いノートをNote Off前に自動Fadeする |
| `longNoteFadeStartBeats` | `2` | `1〜32`, step `0.5` | Note OnからFade開始までの拍数 |
| `longNoteFadeDurationBeats` | `6` | `0.5〜64`, step `0.5` | Fade開始から完全消失までの拍数 |
| `showLongNoteDissolve` | `true` | ON/OFF | 実Fade区間内でバーを粒子へ置換する |
| `longNoteDissolveTimingPercent` | `50` | `10〜90`, step `5` | 実Fade区間内の粒子化タイミング |
| `showLongNoteDissolvePreFlash` | `true` | ON/OFF | 粒子化直前にノート本体とGlowを強く発光させる |
| `longNoteDissolvePreFlashSeconds` | `0.15` | `0.05〜0.5`, step `0.05` | 粒子化前に発光を強める時間 |
| `longNoteDissolveRangePercent` | `60` | `10〜100`, step `5` | ノート長に対する粒子化範囲の上限割合 |
| `longNoteDissolveMaxParticlesPerNote` | `32` | `8〜256`, step `8` | 1ノートの粒子化で生成する最大粒子数 |
| `longNoteDissolveParticleSize` | `10` | `2〜32`, step `1` | 距離減衰しないScreen Space基準の粒子サイズ (px) |
| `cameraFov` | `48` | `25〜80`, step `1` | Perspective Cameraの垂直FOV |
| `showMeasureFrames` | `true` | ON/OFF | 小節枠を生成・表示する |
| `showBeatFrames` | `false` | ON/OFF | 小節頭以外の拍枠を生成・表示する |
| `showMeasureCounter` | `true` | ON/OFF | BPMと拍数カウンターを表示する |
| `frameOpacity` | `0.28` | `0.02〜1`, step `0.01` | 小節枠のOpacity |
| `showCoreFlash` | `true` | ON/OFF | Note On時のコアフラッシュ |
| `showImpactRing` | `true` | ON/OFF | Note On時の拡散リング |
| `showSparks` | `true` | ON/OFF | Note On時のスパーク |
| `showCustomImpactImage` | `true` | ON/OFF | Note On時のカスタム画像 |
| `customImpactImageFileName` | `custom.png` | Text | `public`直下から読む画像名。拡張子省略時は`.png` |
| `customImpactDuration` | `0.8` | `0.1〜3`, step `0.05` | カスタム画像の表示時間 |
| `customImpactOpacity` | `0.75` | `0.05〜1`, step `0.05` | カスタム画像の最大Opacity |
| `customImpactScaleMode` | `expand` | `expand` / `shrink` | 拡大または縮小 |
| `customImpactStartScale` | `1` | `0.1〜5`, step `0.05` | 小さい側のScale |
| `customImpactEndScale` | `3` | `0.1〜5`, step `0.05` | 大きい側のScale |
| `showLevelMeters` | `true` | ON/OFF | Trackレベルメータを表示する |
| `levelMeterColorMode` | `normal` | Select | `normal`, `white`, `blue`, `track` |
| `levelMeterSensitivity` | `0` | `0〜100`, step `1` | 低域を狭め、中域・高域を広げる割合 |
| `levelMeterOpacity` | `0.8` | `0〜1`, step `0.05` | 全ZoneのOpacityへ乗じる |
| `levelMeterMaxHeightPercent` | `25` | `10〜50`, step `1` | 発音平面高に対する最大高の割合 |
| `levelMeterWidthPercent` | `70` | `50〜100`, step `1` | `trackSpacing`に対する幅の割合 |
| `levelMeterDepthOffset` | `0` | `0〜40`, step `0.5` | 発音平面から時間軸の奥方向への配置距離 |
| `backgroundTopColor` | `#101b32` | Color | 背景グラデーション上部色 |
| `backgroundBottomColor` | `#02040b` | Color | 背景下部色とFog色 |

## 内部名に関する注意

`showMeasureCounter`は、初期実装で小節カウンターを表示していた時の名前を維持しています。現在はBPMと拍数カウンター全体の表示フラグです。

保存済み設定との互換性を保つため、単純な名称変更は行いません。名称を変更する場合は保存データの移行処理を追加してください。

カスタム画像のNote On時のScaleには、ノート断面を覆うための最小値`noteSize × 1.5`を適用します。拡大モードで`customImpactStartScale`がこの値より小さい場合も、発音時だけは最小値を使用します。

## 設定変更時の再構築

### ノートを再構築する設定

- `noteSize`
- `noteOpacity`
- `timeUnitsPerSecond`
- `trackSpacing`

### 枠を再構築する設定

- `showMeasureFrames`
- `showBeatFrames`
- `frameOpacity`
- `timeUnitsPerSecond`
- `trackSpacing`

### 即時更新

- 背景色はTextureとFog色を再生成する。
- ノート基本発光は各ノートMaterialのEmissive強度へ毎フレーム反映する。
- 遠方視認性はノート、レベルメータ、カスタム画像のMaterialで共有するShader Uniformへ反映する。
- 設定画面では「空間とカメラ」へ配置する。
- 保存済みの`noteDistanceVisibility`は`distanceVisibility`へ移行してから旧キーを破棄する。
- FOVとレイアウト変更後はカメラの基準距離を再計算する。
- 現在のカメラ角度と初期距離に対するズーム比は可能な限り維持する。
- 発音エフェクトのON/OFFは次のNote Onから反映し、OFFにした種類のActive Effectも破棄する。
- カスタム画像名または表示フラグを変更した場合はTextureを再取得する。
- `midiFileName`の変更だけでは再解析せず、ファイル設定エリアの「MIDIを再読み込み」または映像画面の`R`で反映する。
- レベルメータ設定は既存InstanceのMaterial、色、配置、Scaleへ即時反映する。
- 感度変更時はZoneごとのInstance数が変わるため、3つのInstancedMeshを再構築する。
- レベルメータをOFFにした場合は全Trackの状態をゼロへ戻す。

## 保存しない状態

- 再生位置
- 再生中かどうか
- カメラ水平角
- カメラ垂直角
- カメラ距離
- キー押下状態

## 初期設定へ戻す

設定ページのボタンで`defaultSettings`をCloneし、`localStorage`へ保存して映像ページへ通知します。
