#!/bin/bash
# 스테이지 그림 한 번에 적용: tools/sky-stage-apply.sh <stage(s2..s6)> <enemies.png|-> <boss.png|-> <midboss.png|-> <bg.png|->
# enemies 3x2 칸 순서 = drone · fighter · wyvern / orb · gunship · (예비)
set -e
set -o pipefail
cd "$(dirname "$0")/.."
ST=$1; EN=$2; BO=$3; MI=$4; BG=$5
TMP=$(mktemp -d)
mkdir -p art-src/sky-poop/generated
if [ "$EN" != "-" ]; then
  cp "$EN" art-src/sky-poop/generated/$ST-enemies.png
  python3 tools/sky-stage-sheet.py ${ENMODE:-enemies} "$EN" $TMP/en
  i=1; for slot in drone fighter wyvern orb gunship; do python3 tools/sky-art-import.py enemy $TMP/en/cell$i.png --stage $ST --slot $slot | tail -1; i=$((i+1)); done
  cp $TMP/en/cell6.png public/assets/sky/v3-poop/$ST/extra.png 2>/dev/null || true
fi
if [ "$BO" != "-" ]; then
  cp "$BO" art-src/sky-poop/generated/$ST-boss.png
  python3 tools/sky-stage-sheet.py frames "$BO" $TMP/boss.png
  python3 tools/sky-art-import.py boss $TMP/boss.png --stage $ST --frames 3 --auto-split | tail -1 || python3 tools/sky-art-import.py boss $TMP/boss.png --stage $ST --frames 3 | tail -1
fi
if [ "$MI" != "-" ]; then
  cp "$MI" art-src/sky-poop/generated/$ST-midboss.png
  python3 tools/sky-stage-sheet.py frames "$MI" $TMP/mid.png
  python3 tools/sky-art-import.py midboss $TMP/mid.png --stage $ST --frames 2 --auto-split | tail -1 || python3 tools/sky-art-import.py midboss $TMP/mid.png --stage $ST --frames 2 | tail -1
fi
if [ "$BG" != "-" ]; then
  cp "$BG" art-src/sky-poop/generated/$ST-bg.png
  python3 tools/sky-art-import.py bg "$BG" --stage $ST --fix-seam --tint 0.35 | tail -1
fi
python3 - "$ST" <<'P'
import json, sys
st = sys.argv[1]
p = 'public/assets/sky/v3-poop/manifest.json'
m = json.load(open(p, encoding='utf-8'))
b = m['files'].get(f'{st}/boss.png')
if b is not None:
    b.update({'partDx': 35, 'partDy': -10, 'weakDy': 10})
bg = m['files'].get(f'{st}/bg-backdrop.png')
if bg is not None:
    bg['noProps'] = True
json.dump(m, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
open(p, 'a').write('\n')
P
rm -rf $TMP
