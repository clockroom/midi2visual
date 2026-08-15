# MIDI仕様

## 入力

- ファイルは`public`直下へ置き、設定中のファイル名で取得する。
- 初期値は`input.mid`とする。
- ファイル名に拡張子がなければ`.mid`を補完する。
- Directory Traversalを避けるため、Pathが入力されても末尾のファイル名だけを使用する。
- SMF Format 0 / 1を対象とする。
- PPQベースのTime Divisionを前提とする。
- 解析には`@tonejs/midi`を使用する。

## 使用する情報

### 演奏情報

- Note On
- Note Off
- Velocity
- Track

Note On Velocity=`0`のNote Off相当処理はMIDIパーサーへ委ねる。

### 時間・構造情報

- PPQ
- Tempo
- 先頭Time Signature

TempoとTime Signatureは描画する演奏イベントではないが、秒変換、小節枠、拍数カウンターに必要です。

## 無視する情報

- MIDI Channelによる列分割
- CC
- Sustain Pedal
- Pitch Bend
- Aftertouch
- Program Change
- SysEx
- Track Nameの映像表示
- Marker、歌詞、コード情報

パーサーがこれらを読み取っても、MVPの描画モデルでは参照しません。

## Track

- ノートを1つ以上含むTrackだけを表示対象とする。
- 空Trackとメタイベント専用Trackは除外する。
- Track IDには入力SMF内のTrack Indexを使用し、空Trackを除外しても再採番しない。
- 初期表示順はノートを含むTrackのSMF内順序とする。
- 表示順はMIDIトラック、音長、音程、スマートの4種類から設定でき、反転もできる。
- 任意のTrackを個別に移動する機能は持たない。
- 同一Track内の複数Channelは同じ列へ表示する。
- Track Nameは映像へ表示しないが、将来のTrack管理用データとして保持する。名前がない場合は内部名として`Track n`を補う。

各Trackは`VisualTrack`へ正規化し、`TrackCollection`が識別子検索と表示順を管理する。

```ts
class VisualTrack {
	readonly id: TrackId
	readonly sourceIndex: number
	readonly name: string
	readonly notes: readonly VisualNote[]
	readonly maxNoteDurationTicks: number
	readonly averagePitch: number
}
```

- `maxNoteDurationTicks`はTrack内で最も長い1ノートのNote OnからNote OffまでのTick数とする。
- `averagePitch`はTrack内全ノートのPitchを単純平均した値とし、整数へ丸めない。
- 表示順を変更してもTrack IDとTrack内のノートは変えない。
- Track色はTrack固有値ではなく現在の表示位置へ割り当てる。並べ替え後は同じTrackが新しい表示位置の色を使用する。

## Trackの自動並べ替え

最大発音時間は`maxNoteDurationTicks`、平均音程は`averagePitch`を使用する。最終比較には常に`sourceIndex`昇順を使用し、同じ入力から同じ順序を得る。

| 設定 | 第1条件 | 第2条件 |
|---|---|---|
| MIDIトラック | `sourceIndex`昇順 | なし |
| 音長 | 最大発音時間の長い順 | 平均Pitchの高い順 |
| 音程 | 平均Pitchの高い順 | 最大発音時間の長い順 |

スマートは`maxNoteDurationTicks > beatTicks × smartTrackDurationBeats`を閾値超Groupとする。ちょうど閾値と同じ長さのノートは閾値以下Groupに含める。

- 閾値超Groupを閾値以下Groupより先へ置く。
- 閾値超Groupは音長順を使用する。
- 閾値以下Groupは音程順を使用する。
- 反転設定は上記で確定した配列全体へ最後に適用する。

## ノートの正規化

各ノートを次の情報へ変換する。

```ts
interface VisualNote {
	trackId: TrackId
	pitch: number
	velocity: number
	startSeconds: number
	endSeconds: number
	startTicks: number
	endTicks: number
}
```

正規化後の配列は`startSeconds`順へ並べる。描画側はMIDIイベントの対応付けを行わない。

`MidiModel`には入力SMFの`ppq`と、先頭Time Signatureから算出した`beatTicks`も保持する。Tempo Markerは`seconds`、`ticks`、`bpm`を保持し、ロングトーンFadeで現在時刻をTickへ逆変換するために使用する。

## 曲長

- `durationSeconds`は全ノートの最大`endSeconds`とする。
- `durationTicks`は全ノートの最大`endTicks`とする。
- 最後のノートより後にあるメタイベントは曲長へ含めない。
- SMF先頭の無音時間は削除しない。

## Pitch範囲

- 全ノートの最小Pitchと最大Pitchを取得する。
- 描画時に上下へ3半音の余白を付ける。
- 手動範囲設定は持たない。

## Time Signature

- Time Signatureイベントをtick順へ並べ、最初の1件だけを使用する。
- イベントがない場合は`4/4`とする。
- 途中の拍子変更は非対応とする。

小節と拍のtick数は次の式で計算する。

```text
measureTicks = PPQ × numerator × (4 / denominator)
beatTicks = PPQ × (4 / denominator)
```

## 小節境界

- `durationTicks / measureTicks`を切り上げて総小節数とする。
- tick=`0`から総小節数の末尾境界までMarkerを生成する。
- 各tickは`header.ticksToSeconds()`で秒へ変換する。
- Tempo変更があっても小節枠の実時間位置を正しくする。

## 拍境界

用途に応じて2種類を生成する。

### 描画用拍境界

- 各小節内の小節頭以外を生成する。
- 拍枠をONにした場合だけ描画する。
- 小節頭は小節枠が担うため重複させない。

### カウンター用拍Timeline

- tick=`0`から総拍数分を生成する。
- 総拍数は`totalMeasures × numerator`とする。
- 現在時刻以下で最後のMarkerを二分探索し、現在拍を求める。

## Tempo

- Tempoイベントをtick順へ並べる。
- 各Tempoイベントを`seconds`と`bpm`へ変換する。
- tick=`0`の既定値としてBPM=`120`を用意する。
- tick=`0`にTempoイベントがあれば既定値を置き換える。
- 同一秒に複数のTempoイベントがある場合は後の値を使用する。
- 現在時刻以下で最後のTempo Markerを二分探索し、表示BPMを求める。

## エラー

- HTTP取得に失敗した場合はステータスを含めて失敗する。
- ノートを1つも含まないSMFは失敗する。
- 解析例外は呼び出し元へ伝播し、画面とalertで通知する。
