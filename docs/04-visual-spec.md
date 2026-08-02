# 映像仕様

## 座標系

3D空間の各軸へ次の情報を割り当てます。

| 軸 | 意味 |
|---|---|
| X | ノートを持つTrack |
| Y | MIDI Pitch |
| Z | 時間 |

- TrackはSMF内の順序で左から右へ配置する。
- 高いPitchほど上へ配置する。
- 未来のイベントは発音平面より奥へ配置する。
- 現在時刻の進行に合わせてノートと枠のGroup全体を手前へ移動する。

## 表示範囲

### Track

- ノートを1つ以上持つTrackだけを表示する。
- Track間隔は`trackSpacing`で決定する。
- MIDI Channelは位置へ使用しない。
- Track名は映像へ表示しない。

### Pitch

- SMF内の最低Pitchから最高Pitchまでを自動検出する。
- 上下へ3半音分の余白を付ける。
- 1半音あたりの内部間隔は`0.34` world unitとする。
- 音域は設定画面から変更できない。

## ノート

- 形状は直方体とする。
- X・Y方向の一辺は`noteSize`とし、断面を常に正方形とする。
- Z方向の長さはノートDurationと`timeUnitsPerSecond`から算出する。
- 極端に短いノートにも最小Z長`0.08`を与える。
- Trackごとに固定パレットから色を割り当てる。
- Track数がパレット数を超えた場合は色を循環する。

### 発音前

- 基本のEmissive強度は`noteBaseEmissiveIntensity`とする。
- 初期値は`0.55`とし、照明へ依存しない最低発光量として使用する。
- `distanceVisibility`で、ノートとレベルメータのFog適用後の色をFog適用前の色へ補間する。
- Note Onエフェクト4種とロングトーン粒子はFogを常に無効化する。
- Note Onエフェクト4種はworld space基準のScaleとし、距離による見かけのサイズ変化を維持する。
- `distanceVisibility`の初期値は`0.8`とする。
- `noteOpacity`を使用する。

### 発音中

- Note OnからNote Offまで発光状態とする。
- Velocityが高いほどEmissive強度とGlow不透明度を強くする。
- Emissive強度は`noteBaseEmissiveIntensity`を下回らない。
- ノート本体の不透明度をわずかに上げる。
- ノート本体を拡大した半透明Glowを加算合成する。

### Note Off後

- `noteAfterglowSeconds`の間、発光と不透明度を線形に減衰する。
- 残光中のEmissive強度も`noteBaseEmissiveIntensity`を下回らない。
- 残光終了後は非表示範囲へ流れる。
- ロングトーンFade対象のノートには、この通常残光を適用しない。

### ロングトーンFade

- ノート長がFade開始拍を超える場合だけ適用する。
- Note OnからFade開始拍までは通常の発音中表示とする。
- Fade開始から`longNoteFadeDurationBeats`の間、ノート本体とGlowのOpacityを線形に減衰する。
- Fade開始から設定拍数が経過するよりNote Offが早い場合は、Note Offへ向けてFade区間を短縮する。
- 完全消失後はNote OffまでMeshを非表示のまま維持する。
- 直方体の長さや位置は変更せず、ノート全体のOpacityを減衰する。

### ロングトーン粒子化

- 設定した粒子化タイミングまでは、ノート本体とGlowを通常どおり線形Fadeする。
- 粒子化前の発光秒数が`0`より大きい場合、設定秒数をかけて発光強度、ノートOpacity、Glow Opacityを急速に上げる。
- 粒子化タイミングでノート本体とGlowを非表示にし、同じTrack色の粒子へ置き換える。
- 粒子化後はFade終了まで、粒子をXY方向へ大きく、Z方向へ控えめに拡散する。
- 粒子は加算合成とし、Scene Fogの影響を受けない。
- 粒子のOpacityとSizeをFade終了へ向けて減衰する。
- 粒子Sizeは距離減衰しないScreen Space基準とし、`longNoteDissolveParticleSize`で設定する。初期値は現在の見た目に相当する`10px`とする。
- 粒子化対象範囲は発音平面より手前も含める。
- 粒子はノート断面内でX・Y位置をわずかに散らす。
- 1Burstを単一の`THREE.Points`として描画する。

## Note Onエフェクト

既存のノート本体とGlowは維持し、Note Onが発音平面を通過した瞬間に独立した一過性エフェクトを生成します。

| 種類 | Texture | 表現 |
|---|---|---|
| コアフラッシュ | `public/assets/flare.png` | 発音点で短く強く拡大・消失 |
| 拡散リング | `public/assets/ring.png` | 即時と`0.12秒`後の2枚が発音平面に沿って広がりながら消失。2枚目の終了サイズは1枚目の`1.25倍` |
| スパーク | `public/assets/spark.png` | 3〜8個程度を大きく表示し、ランダム方向へ広く放射 |
| カスタム画像 | `public`直下の設定ファイル | 最大濃度からフェードしつつ拡大または縮小 |

- 全種類を個別にON/OFFできる。
- Trackに割り当てた色でTextureをTintする。
- コアフラッシュ、拡散リング、スパークは加算合成する。
- カスタム画像は通常のAlpha Blendとし、発音時にノート断面を覆う最小Scaleを保証する。
- 同一Track・Pitch位置のカスタム画像は重ねず、新しいNote Onの生成前に古い画像を破棄する。
- Velocityが高いほどOpacityとScaleを強くする。
- カスタム画像の初期値は`custom.png`の太い中抜き星形画像とする。
- 組み込みTextureは無彩色とAlphaを持ち、ユーザー用ファイルと分離して`assets`へ置く。
- 同時発音が多い場合に際限なく増えないよう、Active Effect数を最大`768`へ制限する。
- 遅延中の2枚目リングもActive Effect数へ含める。
- 曲時刻が巻き戻った場合はActive Effectを破棄し、先頭再生で再生成できる状態へ戻す。

## 発音平面

- Z=`0`へ配置する。
- 表示Track範囲とPitch範囲を囲む四角い枠とする。
- 単一の通常枠だけを表示する。
- ノートと時間枠がこの平面へ到達した時刻を現在とする。

## Trackレベルメータ

- 各TrackのX位置へ配置し、発音平面の下辺を始点としてY方向へ伸ばす。
- Zは`0.025 - levelMeterDepthOffset`とし、`0`では発音平面とのZ-Fightingを避けるためわずかに手前へ配置する。
- `levelMeterDepthOffset`は`0〜40 world units`とし、正の値ほど時間軸の奥へ配置する。
- 最大値`40`は、BPM 120、`timeUnitsPerSecond=10`で8拍分に相当する距離とする。
- `PlaneGeometry`をXY平面のまま使用し、Billboard化しない。
- 1Trackあたり20個の横長矩形を積み上げる。
- 1区画の高さに対して矩形を`72%`とし、残り`28%`を上下の隙間として見せる。
- 最大高は`worldHeight × levelMeterMaxHeightPercent / 100`とする。
- 幅は`trackSpacing × levelMeterWidthPercent / 100`とする。
- Velocityに応じて`ceil(velocity × 20)`個を下から表示する。
- 感度`0%`ではindex `0〜13`を低域、`14〜17`を中域、`18〜19`を高域とする。
- 感度`100%`ではindex `0〜5`を低域、`6〜13`を中域、`14〜19`を高域とする。
- 中間の感度ではZone境界を線形補間して整数indexへ丸める。
- 通常のAlpha Blendを使用し、ライティングの影響を受けない`MeshBasicMaterial`で描画する。
- 非表示セグメントはInstanceのScaleをほぼゼロにする。

## 小節枠

- 先頭Time SignatureとPPQから小節境界を計算する。
- 各小節境界へ発音平面と同じ大きさの四角い枠を配置する。
- Tempo変更時もtickを秒へ変換して正しい実時間位置へ配置する。
- `showMeasureFrames`がOFFの場合は生成しない。
- 色は青系、Opacityは`frameOpacity`を使用する。

## 拍枠

- 小節頭以外の拍境界へ配置する。
- `showBeatFrames`の初期値はOFFとする。
- OFFの場合はオブジェクトを生成しない。
- 小節枠より暗く、Opacityは`frameOpacity × 0.32`とする。

## カメラ

### 注視点

- 発音平面の中央を固定注視点とする。
- XはTrack表示範囲中央、YはPitch表示範囲中央、Zは`0`とする。

### 初期位置

- ウィンドウのアスペクト比、`cameraFov`、表示範囲から全体が収まる距離を算出する。
- 初期位置は正面からわずかに上へ置く。
- リサイズ時は初期距離を再計算し、現在のズーム比を維持する。

### オービット

- カメラ状態を水平角、垂直角、注視点までの距離で保持する。
- 水平角と垂直角を更新した後、球面座標からカメラ位置を再構成する。
- 回転行列やQuaternionをフレームごとに積算しない。
- `camera.up`をワールドY軸へ固定する。
- 最後に発音平面中央へ`lookAt`する。
- この方法によりカメラのロールを防ぐ。

球面座標は次の式を使用する。

```text
horizontalDistance = distance × cos(elevation)
x = targetX + horizontalDistance × sin(azimuth)
y = targetY + distance × sin(elevation)
z = targetZ + horizontalDistance × cos(azimuth)
```

### 制限

| 項目 | 制限 |
|---|---:|
| 水平角 | 正面から左右`60°` |
| 垂直角 | 下`45°`〜上`60°` |
| 回転速度 | `35°/秒` |
| 最小距離 | 初期距離の`0.2倍` |
| 最大距離 | 初期距離の`4倍` |
| ズーム速度 | 初期距離の`0.8倍/秒` |

カメラ位置は`localStorage`へ保存しない。

## 背景

- 上下2色の縦グラデーションをCanvasTextureとして生成する。
- 下部色をFog色にも使用する。

## ライト

- 青白いAmbientLightを使用する。
- 前方上部にPointLightを配置する。
- RendererはACES Filmic Tone Mappingを使用する。

## 画面オーバーレイ

### BPM

- 右下の拍数表示の左隣へ表示する。
- `public/assets/metronome.svg`とBPM数値を半透明のMetric Cardへ表示する。
- 数値領域を固定し、Tempo変更でCard幅を変えない。

### 拍数

- `public/assets/beat.svg`と`現在拍 / 総拍数`をBPMと同じMetric Card形式で表示する。
- 現在拍は総拍数の桁数に合わせてゼロ埋めする。
- 総拍数の桁数から初回読み込み時に領域幅を決定する。
- Tabular Numberと左揃えを使用し、Icon直後から数値を表示する。
- 桁数変化によって右端やBPM欄の位置を移動させない。

BPMと拍数のCardは、暗い半透明背景、細い水色の枠、控えめなGlowを使用し、点滅や常時Animationは行わない。

### 操作案内

- 画面左下へ薄く表示する。
- 通常は透明にし、マウスがページ上にある場合だけ表示する。
- 末尾へClient領域を`幅 x 高さ`で表示し、Window Resizeへ追従する。
