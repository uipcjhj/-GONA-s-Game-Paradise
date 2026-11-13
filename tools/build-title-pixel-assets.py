#!/usr/bin/env python3
"""
타이틀 배경·로고를 '고나의 도트 밀도'로 다시 정리하는 재현 가능 변환 (이미지 생성 AI 미사용, 크레딧 없음).

기준: 고나 스프라이트(public/assets/gona.png) 27×34 도트를 화면에서 4배 → 1도트 = 4 CSS px.
 배경/로고도 같은 격자(1도트 = 4px)로 다시 만든다. CSS 의 image-rendering 만으로 해결하지 않고 원본 자체를 저해상도로 재작업.

 파이프라인: 전처리(질감 병합) → 도트 격자 리샘플(BOX) → 큐레이션한 제한 팔레트로 스냅(디더 없음)
            → 잡티(외톨이 도트) 제거 → 위쪽 잘린 구름 정리/하늘 연장
 원본(생성물)은 art-src/title/ 에 그대로 보관.

  pip install pillow numpy && python3 tools/build-title-pixel-assets.py
"""
import os
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'art-src/title')
OUT = os.path.join(ROOT, 'public/assets/title')

BG_W, BG_H = 110, 245          # 도트 단위 장면 크기 (×4 = 440×980 CSS px 까지 덮음)
LOGO_W = 86                    # 로고 폭(도트) ×4 = 344px


def lab(rgb):
    """sRGB(0-255) → CIE Lab (팔레트 최근접 탐색용)"""
    c = rgb.astype(np.float64) / 255
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    m = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ m.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def snap(img_rgb, palette):
    p = np.array(palette, dtype=np.uint8)
    d = ((lab(img_rgb)[:, :, None, :] - lab(p)[None, None, :, :]) ** 2).sum(-1)
    return p[d.argmin(-1)]


def despeckle(rgb, passes=1):
    """4방향 이웃 중 같은 색이 하나도 없는 외톨이 도트를 가장 흔한 이웃색으로 교체"""
    h, w, _ = rgb.shape
    out = rgb.copy()
    for _ in range(passes):
        src = out.copy()
        for y in range(h):
            for x in range(w):
                c = src[y, x]
                nb = [src[yy, xx] for yy, xx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)) if 0 <= yy < h and 0 <= xx < w]
                if not any((n == c).all() for n in nb):
                    vals, cnt = np.unique(np.array(nb), axis=0, return_counts=True)
                    out[y, x] = vals[cnt.argmax()]
    return out


def hexes(*h):
    return [tuple(int(x[i:i + 2], 16) for i in (1, 3, 5)) for x in h]


# 큐레이션 팔레트: 고나(연두 옷·살구색 얼굴·갈색 윤곽)와 어울리는 밝지만 살짝 바랜 8비트풍 색
PALETTE = hexes(
    # 하늘 · 바다
    '#2f9fe6', '#58b8f0', '#8fd4f7', '#1c6fc4', '#35b6d8', '#6fd6e4', '#c8f0f4',
    # 구름 · 무지개
    '#ffffff', '#dcd6f2', '#b3a8dc', '#f6c9dd', '#fbe9a8',
    # 모래 · 절벽
    '#f6dca4', '#e7c07c', '#c9965a', '#9c6a40', '#6d4430',
    # 풀 · 야자 · 숲
    '#bfe05a', '#8cc43e', '#5a9e34', '#2f6e2c', '#1f4a24',
    # 꽃 · 열매 · 돌
    '#ffd23f', '#f08a3c', '#9a8f99', '#5b4a52',
    # 가장 어두운 윤곽 (고나의 갈색 윤곽과 같은 계열)
    '#3a2219',
)


def build_bg():
    im = Image.open(os.path.join(SRC, 'title-bg-original-752x1344.png')).convert('RGB')
    im = im.filter(ImageFilter.ModeFilter(7))                       # 꽃잎·잎맥 같은 잔 질감을 먼저 병합
    comp_h = round(im.height * BG_W / im.width)                      # 구도 그대로 폭 110도트
    comp = np.array(im.resize((BG_W, comp_h), Image.BOX))
    comp = snap(comp, PALETTE)
    comp = despeckle(comp, 2)
    # 위쪽에 하늘 연장 (키 큰 폰용): 맨 윗줄의 가장 흔한 하늘색 + 위에서 잘린 구름은 하늘색으로 정리
    sky = np.array(hexes('#2f9fe6')[0], dtype=np.uint8)
    top_rows = 14
    light = (comp[:top_rows].astype(int).sum(-1) > 560)             # 구름(밝은 색)
    for y in range(top_rows):
        for x in range(BG_W):
            if light[y, x] and (y < 3 or light[y - 1, x] if y else True):
                pass
    canvas = np.tile(sky, (BG_H, BG_W, 1))
    off = BG_H - comp_h
    canvas[off:] = comp
    # 장면 맨 위에서 잘려 있는 구름만 하늘색으로 지움 (위에서부터 이어지는 밝은 덩어리)
    seen = np.zeros((BG_H, BG_W), bool)
    stack = [(off, x) for x in range(BG_W) if (canvas[off, x].astype(int).sum() > 560)]
    while stack:
        y, x = stack.pop()
        if y < off or y >= BG_H or x < 0 or x >= BG_W or seen[y, x] or canvas[y, x].astype(int).sum() <= 560:
            continue
        seen[y, x] = True
        canvas[y, x] = sky
        stack += [(y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)]
    Image.fromarray(canvas, 'RGB').save(os.path.join(OUT, 'title-bg-px.png'))
    print('title-bg-px.png', canvas.shape[1], 'x', canvas.shape[0], '색', len({tuple(c) for c in canvas.reshape(-1, 3)}))
    return off


def build_logo():
    lg = Image.open(os.path.join(SRC, 'logo-rev2-original-transparent.png')).convert('RGBA')
    lh = round(lg.height * LOGO_W / lg.width)
    # 알파는 premultiplied 로 줄여 가장자리 색 번짐 방지
    a = np.array(lg).astype(np.float64)
    al = a[..., 3:4] / 255
    pre = np.concatenate([a[..., :3] * al, a[..., 3:4]], -1)
    small = Image.fromarray(pre.astype(np.uint8), 'RGBA').resize((LOGO_W, lh), Image.BOX)
    s = np.array(small).astype(np.float64)
    alpha = s[..., 3:4] / 255
    rgb = np.where(alpha > 0, s[..., :3] / np.maximum(alpha, 1e-6), 0).clip(0, 255).astype(np.uint8)
    mask = (alpha[..., 0] >= 0.42)   # 윤곽선이 가늘어지지 않게 살짝 낮춤
    LOGO_PAL = hexes('#3b1b5e', '#5a2d82', '#ffc21a', '#ffd84a', '#ff9a1c', '#e8741a', '#fff1b8')   # 분홍·흰 잡점이 생기지 않도록 보라 2 + 노랑 3 + 주황 2
    sn = snap(rgb, LOGO_PAL)
    sn = despeckle(sn, 2)
    out = np.dstack([sn, np.where(mask, 255, 0).astype(np.uint8)])
    Image.fromarray(out, 'RGBA').save(os.path.join(OUT, 'logo-px.png'))
    print('logo-px.png', LOGO_W, 'x', lh)


if __name__ == '__main__':
    print('bg 위쪽 연장 시작 행:', build_bg())
    build_logo()
