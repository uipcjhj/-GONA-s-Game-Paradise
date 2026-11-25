#!/usr/bin/env python3
"""오프닝 자막 글꼴 만들기 — 고운바탕(Gowun Batang, SIL OFL 1.1) 에서 오프닝에 쓰는 글자만 뽑아 작은 woff2 로.

  입력: @fontsource/gowun-batang 패키지 폴더 (npm pack @fontsource/gowun-batang 로 받아 풀기)
  출력: src/sky/fonts/gowun-batang-{400,700}.woff2 + OFL.txt (라이선스 동봉)
  글자: src/sky/OpeningCinematic.tsx 의 자막(CUES)·타이틀 글자 + 기본 문장부호·숫자·영문

  사용: python3 tools/sky-opening-font.py <fontsource 패키지 폴더>
  (자막 문구를 바꾸면 다시 실행)
"""
import glob
import os
import re
import shutil
import sys

from fontTools import subset
from fontTools.merge import Merger
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PKG = sys.argv[1]
OUT = os.path.join(ROOT, 'src/sky/fonts')

src = open(os.path.join(ROOT, 'src/sky/OpeningCinematic.tsx'), encoding='utf-8').read()
texts = re.findall(r"text: '([^']*)'", src)
extra = ['고나의 응가 대탈출 대작전', '고나의 스카이 어드벤처', '응가 대탈출 대작전', '“막힌 운명을 뚫어라!”', '터치하여 시작', "GONA's Sky Adventure — The Great Poo Escape",
         '0123456789', 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', ' .,…!?“”‘’\'"-—:;()·']
chars = set(''.join(texts + extra).replace('[[', '').replace(']]', ''))
cps = sorted(ord(c) for c in chars)
print(f'글자 {len(cps)}개')

os.makedirs(OUT, exist_ok=True)
for w in (400, 700):
    parts = []
    for f in sorted(glob.glob(os.path.join(PKG, 'files', f'gowun-batang-*-{w}-normal.woff2'))):
        cmap = TTFont(f)['cmap'].getBestCmap()
        need = [c for c in cps if c in cmap]
        if not need:
            continue
        opt = subset.Options()
        opt.flavor = None
        opt.layout_features = ['*']
        opt.notdef_outline = True
        ft = TTFont(f)
        s = subset.Subsetter(opt)
        s.populate(unicodes=need)
        s.subset(ft)
        p = os.path.join('/tmp', f'gb-{w}-{len(parts)}.ttf')
        ft.flavor = None
        ft.save(p)
        parts.append(p)
    merged = Merger().merge(parts)
    merged.flavor = 'woff2'
    dst = os.path.join(OUT, f'gowun-batang-{w}.woff2')
    merged.save(dst)
    have = set(merged['cmap'].getBestCmap())
    miss = [chr(c) for c in cps if c not in have]
    print(f'{w}: 조각 {len(parts)}개 → {os.path.getsize(dst) // 1024} KB · 없는 글자 {"".join(miss) or "없음"}')
    for p in parts:
        os.remove(p)
shutil.copy(os.path.join(PKG, 'LICENSE'), os.path.join(OUT, 'OFL.txt'))
