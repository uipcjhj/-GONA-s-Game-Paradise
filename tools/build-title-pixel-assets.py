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


def soften_horizon(canvas):
    """수평선 부분 수정: 일자로 그어진 흰 줄을 없애고 '아지랑이(하늘) → 먼 바다 → 가까운 바다'로 자연스럽게 잇는다.
    구름·섬·나무·거품 등은 건드리지 않고, 하늘/바다 파랑 픽셀만 다시 칠한다 (배경을 새로 생성하지 않음)."""
    import random
    rnd = random.Random(7)
    H, W, _ = canvas.shape
    white_rows = [(int((canvas[y].min(axis=1) > 235).sum()), y) for y in range(H)]
    cnt, hz = max(white_rows)
    assert cnt > 80, '수평선 흰 줄을 찾지 못함'

    def blue(c):   # 하늘·바다의 파란 계열만 대상 (구름·나무·섬은 제외)
        return int(c[2]) >= 235 and int(c[0]) < 45 and int(c[1]) >= 140

    def hx(h):
        return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], dtype=np.uint8)

    # ① 하늘 쪽 아지랑이 — 수평선으로 갈수록 연해지는 6단계 팔레트 + 2×2 규칙 디더(경계 줄무늬 방지)
    HAZE = [hx(c) for c in ('#12a7fd', '#2bb3fd', '#4fc4fe', '#78d3fe', '#a3e2ff', '#c8eeff', '#e0f6ff')]
    BAYER = [[0, 2], [3, 1]]
    top = hz - 9
    for y in range(top, hz):
        f = ((y - top + 1) / 9.0) ** 1.35 * (len(HAZE) - 1)
        for x in range(W):
            if not blue(canvas[y, x]):
                continue
            lv = f + (BAYER[y % 2][x % 2] - 1.5) / 4.0
            canvas[y, x] = HAZE[int(np.clip(round(lv), 0, len(HAZE) - 1))]
    # ② 수평선 행: 직선 대신 아주 연한 하늘색 + 군데군데 반짝이는 흰 점
    for x in range(W):
        c = canvas[hz, x]
        if int(c.min()) > 235 or blue(c):
            canvas[hz, x] = hx('#e6f7ff') if rnd.random() > 0.28 else hx('#bfeaff')
    # ③ 바다: 먼 곳(연한 청록) → 가까운 곳(원래 파랑)으로 점점 진해지는 띠 (띠 높이는 아래로 갈수록 커짐 = 원근감)
    BANDS = [(1, 2, '#9ee3fb'), (3, 4, '#6fd3f8'), (5, 7, '#45c3f7'), (8, 11, '#1fb0f6'), (12, 16, '#08a2f5')]
    DASH = {1: ('#d6f3ff', 2), 2: ('#d6f3ff', 2), 3: ('#b9ebfc', 3), 4: ('#b9ebfc', 3), 5: ('#8fdcf9', 4), 6: ('#8fdcf9', 4), 7: ('#8fdcf9', 4)}
    for r in range(1, 17):
        y = hz + r
        if y >= H:
            break
        band = next((b for b in BANDS if b[0] <= r <= b[1]), None)
        if band is None:
            continue
        col = hx(band[2])
        nxt = next((b for b in BANDS if b[0] == band[1] + 1), None)
        for x in range(W):
            if not blue(canvas[y, x]):
                continue
            c = col
            if nxt is not None and r == band[1] and (x + y) % 2 == 0:   # 띠 경계는 디더로 부드럽게
                c = hx(nxt[2])
            canvas[y, x] = c
    # ④ 잔물결: 가까울수록 길고 간격이 넓은 가로 점선 (연한 하이라이트)
    for r in range(1, 12):
        y = hz + r
        if y >= H:
            break
        col, ln = DASH.get(r, ('#8fdcf9', 5)) if r < 8 else ('#5cc8f8', 5 + (r - 8))
        gap = 5 + r
        x = rnd.randrange(0, gap)
        while x < W - ln:
            if all(blue(canvas[y, x + k]) or tuple(canvas[y, x + k]) in {tuple(hx(b[2])) for b in BANDS} for k in range(ln)):
                canvas[y, x:x + ln] = hx(col)
            x += ln + gap + rnd.randrange(0, 6)
    # ⑤ 반짝임: 먼 바다 쪽에 작은 흰 점 · 십자 반짝이
    spots = 0
    tries = 0
    while spots < 11 and tries < 400:
        tries += 1
        x = rnd.randrange(2, W - 3)
        y = hz + rnd.randrange(1, 10)
        if blue(canvas[y, x]) or tuple(canvas[y, x]) in {tuple(hx(b[2])) for b in BANDS}:
            canvas[y, x] = hx('#ffffff')
            if spots % 3 == 0 and y > hz + 2:       # 가끔 십자(+) 모양
                for dx, dy in ((-1, 0), (1, 0), (0, -1)):
                    if tuple(canvas[y + dy, x + dx]) in {tuple(hx(b[2])) for b in BANDS} or blue(canvas[y + dy, x + dx]):
                        canvas[y + dy, x + dx] = hx('#e6f7ff')
            spots += 1
    return hz


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
    hz = soften_horizon(canvas)
    Image.fromarray(canvas, 'RGB').save(os.path.join(OUT, 'title-bg-px.png'))
    print('수평선 행', hz, '→ 아지랑이 · 먼 바다 띠 · 잔물결 · 반짝임 적용')
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
