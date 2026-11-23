#!/usr/bin/env python3
"""애니메이션 프레임 시트(3x2 등) → 같은 배율·같은 기준점의 프레임 PNG 들 (프레임을 바꿔도 캐릭터가 튀지 않게)
사용: python3 tools/sky-frames.py <시트> <출력폴더> <이름1,이름2,...> [--cols 3 --rows 2 --size 200 --colors 64]
 - 배경: 마젠타면 색 키, 아니면 매끈한 배경(그라디언트) 제거
 - 모든 칸에 같은 잘라내기 창(칸들의 합집합 영역)과 같은 배율 → 발 밑 기준선·크기가 프레임마다 같음
"""
import argparse, os
import numpy as np
from PIL import Image
from scipy import ndimage
import importlib.util
spec = importlib.util.spec_from_file_location('ss', os.path.join(os.path.dirname(__file__), 'sky-stage-sheet.py'))
ap = argparse.ArgumentParser()
ap.add_argument('src'); ap.add_argument('out'); ap.add_argument('names')
ap.add_argument('--cols', type=int, default=3); ap.add_argument('--rows', type=int, default=2)
ap.add_argument('--size', type=int, default=200); ap.add_argument('--colors', type=int, default=64)
ap.add_argument('--each', action='store_true', help='칸마다 따로 맞춤 (자세가 크게 다른 프레임)')
a = ap.parse_args()
names = a.names.split(',')
# sky-stage-sheet 의 key/smooth_bg 재사용 (모듈 실행부 없이)
src = open(os.path.join(os.path.dirname(__file__), 'sky-stage-sheet.py')).read().split('\nmode, src, dst')[0]
ns = {}; exec(src, ns)
im = Image.open(a.src).convert('RGB')
W, H = im.size
cw, ch = W / a.cols, H / a.rows
cells = []
for i in range(a.cols * a.rows):
    x, y = (i % a.cols) * cw, (i // a.cols) * ch
    c = im.crop((int(x), int(y), int(x + cw), int(y + ch)))
    k = ns['key'](c)
    arr = np.array(k)
    solid = arr[..., 3] > 0
    lab, n = ndimage.label(solid, structure=np.ones((3, 3)))
    if n:
        sizes = ndimage.sum(solid, lab, range(1, n + 1))
        big = sizes.max()
        edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
        for kk in range(1, n + 1):
            if sizes[kk - 1] < 25 or (kk in edge and sizes[kk - 1] < 0.3 * big):
                arr[lab == kk, 3] = 0
    cells.append(Image.fromarray(arr))
boxes = [c.getbbox() for c in cells]
ux0 = min(b[0] for b in boxes); uy0 = min(b[1] for b in boxes); ux1 = max(b[2] for b in boxes); uy1 = max(b[3] for b in boxes)
os.makedirs(a.out, exist_ok=True)
for i, (c, n) in enumerate(zip(cells, names)):
    if not n or n == '-':
        continue
    box = c.getbbox() if a.each else (ux0, uy0, ux1, uy1)
    cc = c.crop(box)
    s = a.size / max(ux1 - ux0, uy1 - uy0) if not a.each else a.size / max(cc.width, cc.height)
    cc = cc.resize((max(1, round(cc.width * s)), max(1, round(cc.height * s))), Image.LANCZOS)
    rgb = cc.convert('RGB').quantize(a.colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    al = (np.array(cc)[..., 3] > 110)
    outa = np.dstack([np.array(rgb), np.where(al, 255, 0)]).astype(np.uint8)
    ring = ndimage.binary_dilation(al) & ~al
    outa[ring] = [26, 18, 38, 255]
    canvas = Image.new('RGBA', (a.size, a.size), (0, 0, 0, 0))
    o = Image.fromarray(outa)
    canvas.alpha_composite(o, ((a.size - o.width) // 2, a.size - o.height - 4))
    canvas.save(os.path.join(a.out, n + '.png'))
    print(n, o.size)
