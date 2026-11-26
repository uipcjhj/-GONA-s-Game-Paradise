#!/usr/bin/env bash
# 정식 플레이판(/GoNa/sky-adventure/) 빌드: 테스트 허브·?dev 치트·BETA 표시 없음 · 기록 저장 키 gona.skyadv
#   결과: dist-adventure/ (테스트 전용 갤러리 미리보기 thumbs/ 는 뺌 · 탭 제목을 게임 이름으로)
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build:adventure
rm -rf dist-adventure/assets/sky/v3-poop/thumbs
sed -i 's#<title>[^<]*</title>#<title>GONA'"'"'s SKY ADVENTURE · 응가 대탈출 대작전</title>#' dist-adventure/index.html
grep -o '<title>[^<]*</title>' dist-adventure/index.html
python3 tools/sky-pwa.py dist-adventure
