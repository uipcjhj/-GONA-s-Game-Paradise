#!/usr/bin/env python3
"""
타이틀 배경 · 로고 · 한글 부제를 '고나의 도트 격자'(1도트 = 화면 4px)로 다시 만드는 재현 가능 변환.
이미지 생성 AI(크레딧) 미사용. 원본은 art-src/title/ 에 그대로 보관.

v2 방식 (색이 흐려지는 '평균 리샘플'을 쓰지 않음):
  1) 원본 해상도에서 먼저 제한 팔레트(큐레이션)로 색을 확정  → 색이 섞이지 않은 깨끗한 색 영역
  2) 도트 격자 칸마다 '가장 많이 차지하는 팔레트 색'을 선택  → 외곽선·형태가 또렷한 계단형 도트
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
LOGO_W = 86               # 영문 로고 폭(도트) ×4 = 344px
SUB_W = 72                # 한글 부제 폭(도트) ×4 = 288px — 62도트(248px)는 고나와 같은 밀도에서 글자가 뭉쳐 읽히지 않아 72로 결정


def hexes(*h):
    return [tuple(int(x[i:i + 2], 16) for i in (1, 3, 5)) for x in h]


def lab(rgb):
    c = rgb.astype(np.float64) / 255
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    m = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ m.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def to_index(rgb, palette):
    """각 픽셀을 가장 가까운 팔레트 번호로 (원본 해상도에서 먼저 색 확정)"""
    pal_lab = lab(np.array(palette, dtype=np.uint8))
    h, w, _ = rgb.shape
    out = np.empty((h, w), np.int16)
    step = 128
    for y in range(0, h, step):
        L = lab(rgb[y:y + step])
        d = ((L[:, :, None, :] - pal_lab[None, None, :, :]) ** 2).sum(-1)
        out[y:y + step] = d.argmin(-1)
    return out


def cell_mode(idx, gw, gh, n_colors, weights=None):
    """원본(idx)을 gw×gh 칸으로 나누어 칸마다 가장 많은 번호를 선택"""
    h, w = idx.shape
    xs = np.linspace(0, w, gw + 1).astype(int)
    ys = np.linspace(0, h, gh + 1).astype(int)
    out = np.zeros((gh, gw), np.int16)
    for j in range(gh):
        for i in range(gw):
            blk = idx[ys[j]:ys[j + 1], xs[i]:xs[i + 1]].ravel()
            cnt = np.bincount(blk, minlength=n_colors).astype(np.float64)
            if weights is not None:
                cnt = cnt * weights          # 가중치: 외곽선이 글자 속 빈 공간을 삼키지 않게
            out[j, i] = cnt.argmax()
    return out


def despeckle(idx, passes=1, protect=None):
    """4방향 이웃 중 같은 번호가 없는 외톨이 도트를 가장 흔한 이웃으로 교체"""
    h, w = idx.shape
    out = idx.copy()
    for _ in range(passes):
        src = out.copy()
        for y in range(h):
            for x in range(w):
                c = src[y, x]
                if protect is not None and c == protect:
                    continue
                nb = [src[yy, xx] for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)) if 0 <= yy < h and 0 <= xx < w]
                if c not in nb:
                    out[y, x] = np.bincount(nb).argmax()
    return out


# ── 배경 팔레트: 고나(연두 옷·살구색·갈색 윤곽)와 어울리는 밝지만 살짝 바랜 색
BG_PAL = hexes(
    '#2f9fe6', '#58b8f0', '#8fd4f7', '#1c6fc4', '#35b6d8', '#6fd6e4', '#c8f0f4',          # 하늘 · 바다
    '#ffffff', '#dcd6f2', '#b3a8dc', '#f6c9dd', '#fbe9a8',                                # 구름 · 무지개
    '#f6dca4', '#e7c07c', '#c9965a', '#9c6a40', '#6d4430',                                # 모래 · 절벽
    '#bfe05a', '#8cc43e', '#5a9e34', '#2f6e2c', '#1f4a24',                                # 풀 · 야자
    '#ffd23f', '#f08a3c', '#9a8f99', '#5b4a52', '#3a2219',                                # 꽃 · 돌 · 윤곽
)
# ── 글자(로고·부제) 팔레트: 보라 윤곽 2 + 노랑 3 + 주황 2 (+ 투명)
TXT_PAL = hexes('#3b1b5e', '#5a2d82', '#ffc21a', '#ffd84a', '#ff9a1c', '#e8741a', '#fff1b8')


def build_bg():
    im = np.array(Image.open(os.path.join(SRC, 'title-bg-original-752x1344.png')).convert('RGB'))
    idx_hi = to_index(im, BG_PAL)
    comp_h = round(im.shape[0] * BG_W / im.shape[1])
    idx = cell_mode(idx_hi, BG_W, comp_h, len(BG_PAL))
    idx = despeckle(idx, 1)
    rgb = np.array(BG_PAL, dtype=np.uint8)[idx]
    sky = np.array(BG_PAL[0], dtype=np.uint8)
    canvas = np.tile(sky, (BG_H, BG_W, 1))
    off = BG_H - comp_h
    canvas[off:] = rgb
    # 장면 맨 위에서 잘린 구름은 하늘색으로 정리 (키 큰 폰에서 이어붙인 경계가 보이지 않게)
    bright = lambda c: int(c[0]) + int(c[1]) + int(c[2]) > 560
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
    print('title-bg-px.png', BG_W, 'x', BG_H, '색', len({tuple(c) for c in canvas.reshape(-1, 3)}))


def build_text(src_name, out_name, width, outline_w=1.0, out_dir=None):
    im = Image.open(os.path.join(SRC, src_name)).convert('RGBA')
    a = np.array(im)
    alpha = a[..., 3] >= 110                      # 윤곽선이 가늘어지지 않게 낮춘 기준
    idx_hi = to_index(a[..., :3], TXT_PAL)
    n = len(TXT_PAL)
    idx_hi = np.where(alpha, idx_hi, n)           # n = 투명
    gh = round(im.height * width / im.width)
    w = np.ones(n + 1)
    w[0] = w[1] = outline_w                      # 보라 윤곽 번호(0,1)의 영향력
    idx = cell_mode(idx_hi, width, gh, n + 1, w)
    idx = despeckle(idx, 1, protect=n)
    pal = np.array(TXT_PAL + [(0, 0, 0)], dtype=np.uint8)
    rgb = pal[idx]
    out = np.dstack([rgb, np.where(idx == n, 0, 255).astype(np.uint8)])
    Image.fromarray(out, 'RGBA').save(os.path.join(out_dir or OUT, out_name))
    print(out_name, width, 'x', gh)


if __name__ == '__main__':
    build_bg()
    build_text('logo-rev2-original-transparent.png', 'logo-px.png', LOGO_W)
    build_text('subtitle-style2-original-transparent.png', 'subtitle-px.png', SUB_W, outline_w=0.75)   # 획이 촘촘한 한글은 윤곽 영향력을 낮춰 속 공간 보존
