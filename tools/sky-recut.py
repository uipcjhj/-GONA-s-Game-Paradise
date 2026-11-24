#!/usr/bin/env python3
"""잘린 스프라이트를 원본 시트에서 다시 오려 내기 (칸 경계에 걸려 잘린 것 복구)
  원본 시트 전체에서 배경을 지운 뒤, 지정한 칸 중심을 포함하는 '덩어리'를 칸보다 넓은 창에서 찾아 그대로 오림
  옆 칸 캐릭터와 붙은 경우: 창(칸의 1+pad 배) 밖은 잘라 내고, 창 안에서 중심 덩어리만 남김
사용: python3 tools/sky-recut.py <시트> <cols>x<rows> <칸번호(0부터)> <출력.png> [--size 최대변] [--pad 0.35] [--colors 64]
"""
import argparse, os
import numpy as np
from PIL import Image
from scipy import ndimage
ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('grid'); ap.add_argument('cell', type=int); ap.add_argument('out')
ap.add_argument('--size', type=int, default=0); ap.add_argument('--pad', type=float, default=0.35); ap.add_argument('--colors', type=int, default=64)
ap.add_argument('--pixel', action='store_true', help='팔레트 정리 + 1px 외곽선 (픽셀 스프라이트)')
a = ap.parse_args()
cols, rows = map(int, a.grid.split('x'))
ns = {}; exec(open(os.path.join(os.path.dirname(__file__), 'sky-stage-sheet.py')).read().split('\nmode, src, dst')[0], ns)
im = Image.open(a.src).convert('RGB'); W, H = im.size
k = np.array(ns['key'](im))
cw, ch = W / cols, H / rows
cx, cy = (a.cell % cols + 0.5) * cw, (a.cell // cols + 0.5) * ch
x0, x1 = int(max(0, cx - cw * (0.5 + a.pad))), int(min(W, cx + cw * (0.5 + a.pad)))
y0, y1 = int(max(0, cy - ch * (0.5 + a.pad))), int(min(H, cy + ch * (0.5 + a.pad)))
win = k[y0:y1, x0:x1].copy()
solid = win[..., 3] > 0
lab, n = ndimage.label(ndimage.binary_dilation(solid, iterations=3))
# 칸 안쪽(가운데 60%)에 가장 많이 들어 있는 덩어리 = 이 칸의 캐릭터
inner = np.zeros_like(solid)
iy0, iy1 = int(cy - ch * 0.3 - y0), int(cy + ch * 0.3 - y0); ix0, ix1 = int(cx - cw * 0.3 - x0), int(cx + cw * 0.3 - x0)
inner[max(0, iy0):iy1, max(0, ix0):ix1] = True
cnt = ndimage.sum(solid & inner, lab, range(1, n + 1))
keep = int(np.argmax(cnt)) + 1
# 본체와 가까운 작은 조각(장식·이펙트)도 함께: 본체 덩어리 경계에서 12px 안의 조각
body = lab == keep
near = ndimage.binary_dilation(body, iterations=12)
for j in range(1, n + 1):
    if j != keep and (near & (lab == j)).any() and ndimage.sum(solid, lab, j) < 0.25 * ndimage.sum(solid, lab, keep):
        body |= lab == j
win[~body, 3] = 0
out = Image.fromarray(win); out = out.crop(out.getbbox())
edge = [int(np.array(out)[..., 3][0].sum() > 0), int(np.array(out)[..., 3][-1].sum() > 0)]
if a.size:
    s = a.size / max(out.size); out = out.resize((max(1, round(out.width * s)), max(1, round(out.height * s))), Image.LANCZOS)
if a.pixel:
    rgb = out.convert('RGB').quantize(a.colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    al = np.array(out)[..., 3] > 110
    o = np.dstack([np.array(rgb), np.where(al, 255, 0)]).astype(np.uint8)
    o[ndimage.binary_dilation(al) & ~al] = [26, 18, 38, 255]
    out = Image.fromarray(o)
    out = out.crop(out.getbbox())
out.save(a.out)
print(a.out, out.size, '창 경계에 닿음(위,아래)=', edge)
