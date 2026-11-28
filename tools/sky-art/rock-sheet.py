#!/usr/bin/env python3
"""STAGE 5 작은 응가 바위 시트 정리 (Higgsfield 원본 → 게임 시트)
 원본: 위 줄 4상태(정상·작은 균열·큰 균열·잔해) + 아래 줄 조각 4개, 투명 배경
 출력: public/assets/sky/v3-poop/s5/terrain-rock-s.png
   위 줄: 상태 4칸 (칸 W×H · 바닥 가운데 정렬 · 4칸 모두 '정상' 기준 같은 배율)
   아래 줄: 조각 4칸 (칸 P×P · 가운데 정렬 · 같은 배율)
 사용: python3 tools/sky-art/rock-sheet.py <원본.png> <출력.png> [바위 폭 px=56]
"""
import sys
import numpy as np
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
TW = int(sys.argv[3]) if len(sys.argv) > 3 else 56
im = Image.open(src).convert('RGBA')
a = np.array(im)[:, :, 3] > 40
H0, W0 = a.shape
rows = np.where(a.any(1))[0]
# 줄 나누기: 알파가 비어 있는 가로 띠로 위/아래 줄 구분
filled = a.any(1)
bands, y = [], 0
while y < H0:
    if filled[y]:
        y0 = y
        while y < H0 and filled[y]: y += 1
        bands.append((y0, y))
    y += 1
bands = [b for b in bands if b[1] - b[0] > 20]
assert len(bands) >= 2, bands
def objs(y0, y1, mingap=18):
    cols = a[y0:y1].any(0)
    res, x = [], 0
    while x < W0:
        if cols[x]:
            x0 = x; gap = 0
            while x < W0 and (cols[x] or gap < mingap):
                gap = 0 if cols[x] else gap + 1
                x += 1
            x1 = x - gap
            sub = a[y0:y1, x0:x1]
            ys = np.where(sub.any(1))[0]
            res.append((x0, y0 + ys[0], x1, y0 + ys[-1] + 1))
        x += 1
    return res
top = objs(*bands[0], mingap=40)
bot = objs(*bands[1], mingap=40)
print('top', top); print('bot', bot)
assert len(top) == 4 and len(bot) == 4
# 배율: '정상' 바위 폭 → TW
k = TW / (top[0][2] - top[0][0])
def crop(b):
    x0, y0, x1, y1 = b
    c = im.crop((x0, y0, x1, y1))
    return c.resize((max(1, round(c.width * k)), max(1, round(c.height * k))), Image.LANCZOS)
st = [crop(b) for b in top]
pc = [crop(b) for b in bot]
CW = max(s.width for s in st) + 4
CH = max(s.height for s in st) + 4
P = max(max(p.width, p.height) for p in pc) + 2
sheet = Image.new('RGBA', (CW * 4, CH + P), (0, 0, 0, 0))
for i, s in enumerate(st):
    sheet.alpha_composite(s, (i * CW + (CW - s.width) // 2, CH - 2 - s.height))  # 바닥 가운데
for i, p in enumerate(pc):
    sheet.alpha_composite(p, (i * P + (P - p.width) // 2, CH + (P - p.height) // 2))
# 반투명 가장자리 정리 (픽셀아트처럼 또렷하게: 알파 이진화)
arr = np.array(sheet); al = arr[:, :, 3]
arr[:, :, 3] = np.where(al > 110, 255, 0).astype(np.uint8)
Image.fromarray(arr).save(out)
print(f'sheet {sheet.size} cell {CW}x{CH} piece {P} scale {k:.3f}')
