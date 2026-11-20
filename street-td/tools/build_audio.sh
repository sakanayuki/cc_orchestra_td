#!/usr/bin/env bash
# source/ の元音源から、まちかどオーケストラ用の音源を作る。
# - 提示部 0〜89.790 秒だけを切り出す（89.790 秒で提示部の繰り返しに入るので、そこがループの繋ぎ目）
# - 1番・2番奏者を1本に混ぜ、モノラル・22.05kHz にする
# - OGG Vorbis と MP3 の両方を出力する
# 使い方: リポジトリのルートで  bash street-td/tools/build_audio.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
SRC=source
OUT=street-td/assets/audio
LOOP=89.790
GAIN=0.9   # 全パート共通（パート間の音量バランスは元のまま）
mkdir -p "$OUT"

make() { # make <name> <file> [<file>]
  local name=$1; shift
  local inputs=() n=0
  for f in "$@"; do inputs+=(-i "$SRC/$f"); n=$((n+1)); done
  local filter
  if [ $n -eq 1 ]; then filter="[0:a]"; else filter="[0:a][1:a]amix=inputs=2:normalize=0,"; filter="${filter%,}"; filter="$filter[m];[m]"; fi
  filter="${filter}atrim=0:${LOOP},pan=mono|c0=0.5*c0+0.5*c1,volume=${GAIN},aresample=22050[o]"
  ffmpeg -v error -y "${inputs[@]}" -filter_complex "$filter" -map "[o]" -c:a libvorbis -q:a 1 "$OUT/$name.ogg"
  ffmpeg -v error -y "${inputs[@]}" -filter_complex "$filter" -map "[o]" -c:a libmp3lame -b:a 48k "$OUT/$name.mp3"
  echo "$name"
}

make violin      14_Violin-1.ogg 15_Violin-2.ogg
make viola       16_Viola.ogg
make cello       17_Violoncello.ogg
make contrabass  18_Contrabass.ogg
make flute       01_Flute-1.ogg 02_Flute-2.ogg
make oboe        03_Oboe-1.ogg 04_Oboe-2.ogg
make clarinet    05_Clarinet-Bb-1.ogg 06_Clarinet-Bb-2.ogg
make horn        09_Horn-F-1.ogg 10_Horn-F-2.ogg
make trumpet     11_Trumpet-F-1.ogg 12_Trumpet-F-2.ogg
make timpani     13_Timpani.ogg
make fullmix     00_Full-Mix.ogg
