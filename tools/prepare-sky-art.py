#!/usr/bin/env python3
"""Higgsfield 생성 시안(raw)을 검수용으로 정리 — 재그림 없음.
 - 알파: <8 → 0, ≥240 → 255 (생성기가 알파를 250~253 으로 내보내는 '거의 불투명'을 정리), 투명 픽셀 RGB 0
 - 컷인: 16:9 원본에서 2:1 크롭(y=88)
 사용: python3 tools/prepare-sky-art.py art-src/sky/illust/gona
"""
import sys, os
import numpy as np
from PIL import Image

def clean(src, dst):
    a = np.array(Image.open(src).convert('RGBA')); al = a[..., 3]
    al2 = np.where(al < 8, 0, np.where(al >= 240, 255, al)).astype(np.uint8); a[..., 3] = al2; a[al2 == 0, :3] = 0
    Image.fromarray(a, 'RGBA').save(dst)

d = sys.argv[1]
for n in ('A_illust', 'B_portrait', 'D_sprite'):
    if os.path.exists(f'{d}/{n}_raw.png'): clean(f'{d}/{n}_raw.png', f'{d}/{n}_clean.png')
if os.path.exists(f'{d}/C_cutin_raw.png'):
    Image.open(f'{d}/C_cutin_raw.png').convert('RGB').crop((0, 88, 2688, 88 + 1344)).save(f'{d}/C_cutin_2x1_crop.png')
