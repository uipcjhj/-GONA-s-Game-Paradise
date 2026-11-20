#!/usr/bin/env python3
"""오프닝 컷신 그림 정리: 단색 배경(마젠타/초록) 또는 투명 PNG → 약 200px 픽셀 스프라이트 + manifest 등록

  사용: python3 tools/sky-opening-art.py <원본 이미지> <칸 이름> [--key magenta|green] [--size 200] [--colors 48] [--src chatgpt]
    칸 이름: gona-cry · gona-strain2 · gona-sleep · gona-hero · v-soldier · v-golem · v-ghost · v-knight · v-king · bg-castle · bg-home
  결과: art-src/sky/opening2/<src>-<칸>.png (원본 보관) · public/assets/sky/v3-poop/opening2/<칸>.png · manifest.json 갱신
  bg-home 은 배경이라 배경 제거 없이 360×640 으로 맞춤.
"""
import argparse
import json
import os
import shutil

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACK = os.path.join(ROOT, 'public/assets/sky/v3-poop')

ap = argparse.ArgumentParser()
ap.add_argument('src')
ap.add_argument('slot')
ap.add_argument('--key', default='magenta', choices=['magenta', 'green'])
ap.add_argument('--size', type=int, default=200)
ap.add_argument('--colors', type=int, default=48)
ap.add_argument('--src-name', dest='srcname', default='chatgpt')
a = ap.parse_args()

os.makedirs(os.path.join(ROOT, 'art-src/sky/opening2'), exist_ok=True)
os.makedirs(os.path.join(PACK, 'opening2'), exist_ok=True)
shutil.copy(a.src, os.path.join(ROOT, f'art-src/sky/opening2/{a.srcname}-{a.slot}.png'))
dst = os.path.join(PACK, f'opening2/{a.slot}.png')

im = Image.open(a.src)
if a.slot == 'bg-home':
    im = im.convert('RGB')
    s = max(360 / im.width, 640 / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    l, t = (im.width - 360) // 2, (im.height - 640) // 2
    im.crop((l, t, l + 360, t + 640)).quantize(96, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB').save(dst)
else:
    im = im.convert('RGBA')
    s = a.size / max(im.width, im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    arr = np.array(im).astype(int)
    r, g, b, al = arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3]
    if a.key == 'magenta':
        bgm = (r > 150) & (b > 150) & (g < 120) & (np.abs(r - b) < 90)
        fringe = (r > 140) & (b > 110) & (g < 150) & (b > g + 30)
    else:
        bgm = (g > 150) & (r < 120) & (b < 120)
        fringe = (g > 130) & (g > r + 40) & (g > b + 40)
    bgm |= al < 128
    alpha = np.where(bgm, 0, 255).astype(np.uint8)
    alpha[ndimage.binary_dilation(bgm) & fringe] = 0
    lab, n = ndimage.label(alpha > 0)
    for i, sz in enumerate(ndimage.sum(alpha > 0, lab, range(1, n + 1))):
        if sz < 6:
            alpha[lab == i + 1] = 0
    rgb = Image.fromarray(arr[..., :3].astype(np.uint8), 'RGB').quantize(a.colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    out = np.dstack([np.array(rgb), alpha])
    solid = alpha > 0
    out[ndimage.binary_dilation(solid) & ~solid] = [34, 22, 30, 255]
    Image.fromarray(out.astype(np.uint8), 'RGBA').save(dst)

mp = os.path.join(PACK, 'manifest.json')
m = json.load(open(mp, encoding='utf-8'))
m['files'][f'opening2/{a.slot}.png'] = {'src': a.srcname, 'note': '오프닝 컷신 그림'}
open(mp, 'w', encoding='utf-8').write(json.dumps(m, ensure_ascii=False, indent=2) + '\n')
print('저장', dst, Image.open(dst).size, '· manifest 등록')
