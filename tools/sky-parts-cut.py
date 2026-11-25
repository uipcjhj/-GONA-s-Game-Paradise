#!/usr/bin/env python3
"""보스 부위 파괴용 2x2 시트(왼쪽 위 A · 오른쪽 위 A 파손 · 왼쪽 아래 B · 오른쪽 아래 B 파손) → 게임용 4칸 가로 시트.

  사용: python3 tools/sky-parts-cut.py <시트.png> <스테이지 폴더(stage1|s2..s6)> [--step 10] [--cell 88]
  결과: public/assets/sky/v3-poop/<폴더>/parts.png (칸 크기 cell×cell, 2배 격자 → 게임 k=0.5) + manifest 등록
  배경: 마젠타 또는 어두운 그라디언트(가장자리에서 비슷한 색만 퍼져 지움 · 굵은 외곽선에서 멈춤)
"""
import argparse, json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, os.path.dirname(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACK = os.path.join(ROOT, 'public/assets/sky/v3-poop')

ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('dir')
ap.add_argument('--step', type=int, default=10)
ap.add_argument('--cell', type=int, default=88)
a = ap.parse_args()

def smooth_bg(rgb, step):
    from collections import deque
    h, w = rgb.shape[:2]
    bg = np.zeros((h, w), bool); q = deque()
    for x in range(w):
        for y in (0, h - 1): bg[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1): bg[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft(); c = rgb[y, x]
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not bg[ny, nx] and np.abs(rgb[ny, nx] - c).max() <= step:
                bg[ny, nx] = True; q.append((ny, nx))
    return bg

im = Image.open(a.src).convert('RGB')
W, H = im.size
cells = []
for i in range(4):
    x0, y0 = (i % 2) * W // 2, (i // 2) * H // 2
    c = np.array(im.crop((x0, y0, x0 + W // 2, y0 + H // 2)).resize((W // 4, H // 4), Image.LANCZOS)).astype(int)
    mag = (c[..., 0] > 150) & (c[..., 2] > 150) & (c[..., 1] < 120)
    bg = mag if mag.mean() > 0.15 else smooth_bg(c, a.step)
    solid = ~bg
    solid = ndimage.binary_opening(solid, iterations=1)
    lab, n = ndimage.label(ndimage.binary_dilation(solid, iterations=3))
    if n:
        sizes = ndimage.sum(solid, lab, range(1, n + 1))
        keep = lab == (int(np.argmax(sizes)) + 1)
        solid &= keep
    solid = ndimage.binary_fill_holes(solid)
    rgba = np.dstack([c, np.where(solid, 255, 0)]).astype(np.uint8)
    out = Image.fromarray(rgba, 'RGBA')
    out = out.crop(out.getbbox())
    cells.append(out)
# A 쌍 · B 쌍은 같은 배율로 (파손 전후 크기가 같게)
C = a.cell
sheet = Image.new('RGBA', (C * 4, C), (0, 0, 0, 0))
for pair in ((0, 1), (2, 3)):
    m = max(max(cells[j].size) for j in pair)
    k = (C - 4) / m
    for j in pair:
        c = cells[j]
        c = c.resize((max(1, round(c.width * k)), max(1, round(c.height * k))), Image.LANCZOS)
        sheet.paste(c, (j * C + (C - c.width) // 2, (C - c.height) // 2), c)
dst = os.path.join(PACK, a.dir, 'parts.png')
sheet.save(dst)
mp = os.path.join(PACK, 'manifest.json')
m = json.load(open(mp, encoding='utf-8'))
m['files'][f'{a.dir}/parts.png'] = {'frames': 4, 'k': 0.5, 'src': 'higgsfield', 'note': '보스 부위 파괴: A · A 파손 · B · B 파손'}
open(mp, 'w', encoding='utf-8').write(json.dumps(m, ensure_ascii=False, indent=2) + '\n')
print('저장', dst, sheet.size, [c.size for c in cells])
