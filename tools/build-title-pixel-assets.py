#!/usr/bin/env python3
"""
타이틀 배경 · 로고 · 한글 부제 → 고나의 도트 격자에 맞춘 최종 에셋 (재현 가능 변환).

원본(art-src/title/*8-original.png)은 Higgsfield(gpt_image_2_6)로 '굵은 8비트 도트'로 직접 생성한 그림.
AI 가 만든 도트는 격자가 완벽하지 않으므로, 다음 순서로 고나의 격자(1도트 = 화면 4px)에 정확히 맞춘다.
  1) 원본을 제한 팔레트(중앙값 분할)로 색 확정 — 색이 섞이지 않게
  2) [배경] 도트 격자 칸마다 가장 많은 색을 선택 — 계단형 외곽선이 또렷하게 (110칸 = 화면 4px)
     [로고·부제] 작은 글자는 리샘플하면 깨지므로 원본 도트 구조를 그대로 두고 색 확정 + 경계 단단하게
  3) 외톨이 도트 정리 (+ 배경: 위쪽 잘린 구름 정리/하늘 연장)

  pip install pillow numpy && python3 tools/build-title-pixel-assets.py
"""
import os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'art-src/title')
OUT = os.path.join(ROOT, 'public/assets/title')

BG_W, BG_H = 110, 245     # 배경(도트) ×4 = 440×980 CSS px 까지 덮음


def quantize(rgb, n):
    img = Image.fromarray(rgb, 'RGB').quantize(colors=n, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    pal = np.array(img.getpalette()[:n * 3], dtype=np.uint8).reshape(-1, 3)
    return np.array(img, dtype=np.int16), pal


def cell_mode(idx, gw, gh, n_colors):
    h, w = idx.shape
    xs = np.linspace(0, w, gw + 1).astype(int)
    ys = np.linspace(0, h, gh + 1).astype(int)
    out = np.zeros((gh, gw), np.int16)
    for j in range(gh):
        for i in range(gw):
            blk = idx[ys[j]:ys[j + 1], xs[i]:xs[i + 1]].ravel()
            out[j, i] = np.bincount(blk, minlength=n_colors).argmax()
    return out


def despeckle(idx, protect=None):
    h, w = idx.shape
    out = idx.copy()
    for y in range(h):
        for x in range(w):
            c = idx[y, x]
            if protect is not None and c == protect:
                continue
            nb = [idx[yy, xx] for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)) if 0 <= yy < h and 0 <= xx < w]
            if c not in nb:
                out[y, x] = np.bincount(nb).argmax()
    return out


def build_bg():
    im = np.array(Image.open(os.path.join(SRC, 'bg8-original.png')).convert('RGB'))
    idx, pal = quantize(im, 44)       # 절벽 주황·꽃 분홍 같은 작은 색 영역까지 살리려면 28색으로는 부족
    comp_h = round(im.shape[0] * BG_W / im.shape[1])
    cells = despeckle(cell_mode(idx, BG_W, comp_h, len(pal)))
    comp = pal[cells]
    # 하늘 연장(키 큰 폰): 맨 윗줄에서 가장 흔한 색
    top = comp[0].reshape(-1, 3)
    vals, cnt = np.unique(top, axis=0, return_counts=True)
    sky = vals[cnt.argmax()]
    canvas = np.tile(sky, (BG_H, BG_W, 1))
    off = BG_H - comp_h
    canvas[off:] = comp
    # 장면 맨 위에서 잘려 이어지는 밝은 구름은 하늘색으로 정리 (이어붙인 경계가 보이지 않게)
    bright = lambda c: int(c[0]) + int(c[1]) + int(c[2]) > 600
    seen = np.zeros((BG_H, BG_W), bool)
    stack = [(off, x) for x in range(BG_W) if bright(canvas[off, x])]
    while stack:
        y, x = stack.pop()
        if y < off or y >= BG_H or x < 0 or x >= BG_W or seen[y, x] or not bright(canvas[y, x]):
            continue
        seen[y, x] = True
        canvas[y, x] = sky
        stack += [(y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)]
    Image.fromarray(canvas, 'RGB').save(os.path.join(OUT, 'title-bg-px.png'))
    print('title-bg-px.png', BG_W, 'x', BG_H, '색', len({tuple(c) for c in canvas.reshape(-1, 3)}), '| 도트 배율 4px')


def build_text(src_name, out_name, n_colors=14):
    """로고·부제: AI 가 그린 도트 구조(획·계단 윤곽)를 그대로 보존.
    임의의 격자로 다시 표본을 뽑으면 작은 글자가 어긋나 깨지므로 리샘플하지 않고,
    ① 글자 영역만 자르고 ② 제한 팔레트로 색을 확정하고(디더 없음) ③ 투명도를 0/255 로 단단하게 만든다."""
    im = Image.open(os.path.join(SRC, src_name)).convert('RGBA')
    a = np.array(im)
    mask = a[..., 3] >= 128
    ys, xs = np.where(mask)
    a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    mask = a[..., 3] >= 128
    idx, pal = quantize(a[..., :3].copy(), n_colors)
    out = np.dstack([pal[idx], np.where(mask, 255, 0).astype(np.uint8)])
    Image.fromarray(out, 'RGBA').save(os.path.join(OUT, out_name), optimize=True)
    print(out_name, a.shape[1], 'x', a.shape[0], '색', n_colors, '| 화면 폭 기준 비율', round(a.shape[0] / a.shape[1], 4))


if __name__ == '__main__':
    build_bg()
    build_text('logo8-original.png', 'logo-px.png')
    build_text('subtitle8-original.png', 'subtitle-px.png', 10)
