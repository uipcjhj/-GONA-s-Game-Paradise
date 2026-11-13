#!/usr/bin/env python3
"""
오프닝/타이틀 에셋 생성기 (재현 가능). 이미지 생성 AI(크레딧)는 쓰지 않음.
  - 로고/자막: Galmuri 도트 폰트(OFL)를 정수 배율로 키워 굵은 외곽선·음영을 입힘
  - 날아가는 고나 실루엣: 승인된 고나 스프라이트(public/assets/gona.png)의 알파 + 도트 날개
  - 발자국 · 반짝이 · 타이틀 배경: 도트 단위로 직접 그림
모든 PNG 는 1칸 = 1도트. 화면에서는 정수 배율(image-rendering: pixelated)로만 확대한다.

  pip install pillow numpy && python3 tools/build-opening-assets.py
"""
import math, os, random
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public/assets/opening')
FONT = os.path.join(ROOT, 'node_modules/galmuri/dist/')
os.makedirs(OUT, exist_ok=True)

# 밝지만 살짝 바랜 빈티지 팔레트
PLUM = (0x4a, 0x2f, 0x55)
CREAM = (0xff, 0xf3, 0xd6)
YEL_L = (0xff, 0xf0, 0xa0)
YEL = (0xf7, 0xd6, 0x5b)
YEL_D = (0xe9, 0x9c, 0x3c)
COR_L = (0xff, 0xb3, 0xa0)
COR = (0xf0, 0x7a, 0x6a)
COR_D = (0xd0, 0x55, 0x58)
MINT = (0x7b, 0xc9, 0xa8)
MINT_D = (0x4a, 0x9c, 0x86)


def hexrgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def text_mask(txt, fname, size, bold_px=0):
    f = ImageFont.truetype(FONT + fname, size)
    im = Image.new('L', (len(txt) * size * 2 + 8, size * 2 + 8), 0)
    d = ImageDraw.Draw(im)
    d.fontmode = '1'
    for dx in range(bold_px + 1):
        d.text((4 + dx, 4), txt, font=f, fill=255)
    bb = im.getbbox()
    return np.array(im.crop(bb)) > 0


def up(mask, k):
    return np.kron(mask, np.ones((k, k), dtype=bool))


def dilate(mask, r=1):
    m = mask.copy()
    h, w = mask.shape
    p = np.pad(mask, r)
    out = np.zeros_like(mask)
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            out |= p[r + dy:r + dy + h, r + dx:r + dx + w]
    return out | m


def shift(mask, dx, dy):
    out = np.zeros_like(mask)
    h, w = mask.shape
    ys, xs = slice(max(0, dy), min(h, h + dy)), slice(max(0, dx), min(w, w + dx))
    yd, xd = slice(max(0, -dy), min(h, h - dy)), slice(max(0, -dx), min(w, w - dx))
    out[ys, xs] = mask[yd, xd]
    return out



GLYPHS = {
    'G': ['.XXX.', 'X...X', 'X....', 'X.XXX', 'X...X', 'X...X', '.XXX.'],
    'O': ['.XXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.XXX.'],
    'N': ['X...X', 'XX..X', 'XX..X', 'X.X.X', 'X..XX', 'X..XX', 'X...X'],
    'A': ['.XXX.', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X', 'X...X'],
    'E': ['XXXXX', 'X....', 'X....', 'XXXX.', 'X....', 'X....', 'XXXXX'],
    'W': ['X...X', 'X...X', 'X...X', 'X.X.X', 'X.X.X', 'XX.XX', 'X...X'],
    'I': ['XXXXX', '..X..', '..X..', '..X..', '..X..', '..X..', 'XXXXX'],
    'L': ['X....', 'X....', 'X....', 'X....', 'X....', 'X....', 'XXXXX'],
    'D': ['XXXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', 'XXXX.'],
    '!': ['..X..', '..X..', '..X..', '..X..', '..X..', '.....', '..X..'],
    ' ': ['..', '..', '..', '..', '..', '..', '..'],
}


def block_text(txt, k):
    """5×7 굵은 아케이드 글리프를 k배로 키운 마스크 (글자 사이 1칸)"""
    cols = []
    for ch in txt:
        g = GLYPHS[ch]
        w = len(g[0])
        m = np.array([[c == 'X' for c in row] for row in g], dtype=bool)
        cols.append(np.pad(m, ((0, 0), (0, 1))))
    return up(np.concatenate(cols, axis=1)[:, :-1], k)


def paint(canvas, mask, color, ox=0, oy=0):
    h, w = mask.shape
    ch, cw = canvas.shape[:2]
    for y in range(h):
        for x in range(w):
            if mask[y, x] and 0 <= y + oy < ch and 0 <= x + ox < cw:
                canvas[y + oy, x + ox] = (*color, 255)


def styled_text(mask, bands, hi, pad=4):
    """글자 마스크 → (RGBA 배열) : 밴드 색 · 윗면 하이라이트 · 플럼 외곽선 · 크림 테두리 · 아래 그림자"""
    h, w = mask.shape
    H, W = h + pad * 2 + 2, w + pad * 2
    m = np.zeros((H, W), dtype=bool)
    m[pad:pad + h, pad:pad + w] = mask
    cv = np.zeros((H, W, 4), dtype=np.uint8)
    rim = dilate(m, 2)
    line = dilate(m, 1)
    paint(cv, shift(rim, 0, 2), PLUM)          # 그림자
    paint(cv, rim, CREAM)
    paint(cv, line, PLUM)
    ys = np.where(m.any(1))[0]
    y0, y1 = ys.min(), ys.max()
    for y in range(H):
        for x in range(W):
            if m[y, x]:
                t = (y - y0) / max(1, (y1 - y0))
                c = bands[0] if t < 0.45 else bands[1] if t < 0.75 else bands[2]
                if y - y0 < max(1, round((y1 - y0 + 1) * 0.12)) and hi:
                    c = hi
                cv[y, x] = (*c, 255)
    return cv


def save(arr, name):
    Image.fromarray(arr, 'RGBA').save(os.path.join(OUT, name))
    print('saved', name, arr.shape[1], 'x', arr.shape[0])


# ───────────── 로고 ─────────────
def build_logo():
    l1 = styled_text(block_text('GONA GONE', 2), (YEL, YEL, YEL_D), YEL_L)
    l2 = styled_text(block_text('WILD!', 3), (COR_L, COR, COR_D), (255, 205, 190))
    W = max(l1.shape[1], l2.shape[1]) + 4
    H = l1.shape[0] + l2.shape[0] - 5 + 2
    cv = np.zeros((H, W, 4), dtype=np.uint8)

    def blit(src, ox, oy):
        sh, sw = src.shape[:2]
        for y in range(sh):
            for x in range(sw):
                if src[y, x, 3]:
                    cv[oy + y, ox + x] = src[y, x]
    blit(l1, (W - l1.shape[1]) // 2, 1)
    blit(l2, (W - l2.shape[1]) // 2, l1.shape[0] - 5)
    save(cv, 'title-logo.png')


def build_sub():
    t = text_mask('고나가 떴고나!', 'Galmuri11-Bold.ttf', 11, 0)
    th, tw = t.shape
    W, H = tw + 22, th + 10
    cv = np.zeros((H, W, 4), dtype=np.uint8)
    # 리본 몸통 + 양끝 제비꼬리
    body = np.zeros((H, W), dtype=bool)
    body[1:H - 1, 5:W - 5] = True
    for i in range(5):
        body[1 + i // 2:H - 1 - i // 2, i:5] |= True
        body[1 + i // 2:H - 1 - i // 2, W - 5:W - i] |= True
    # 제비꼬리 홈
    for i in range(3):
        body[H // 2 - i:H // 2 + i + 1, 0:3 - i] = False
        body[H // 2 - i:H // 2 + i + 1, W - 3 + i:W] = False
    paint(cv, shift(dilate(body, 1), 0, 1), PLUM)
    paint(cv, dilate(body, 1), PLUM)
    paint(cv, body, MINT)
    inner = body.copy()
    inner[H - 3:, :] = False
    paint(cv, np.logical_and(body, ~inner), MINT_D)
    paint(cv, t, MINT_D, 11, 5)       # 아래 그림자 1칸
    paint(cv, t, CREAM, 11, 4)
    # 윗 하이라이트 줄
    cv[2, 6:W - 6] = (*hexrgb('#a9e6cd'), 255)
    save(cv, 'title-sub.png')


# ───────────── 발자국 · 반짝이 ─────────────
def build_footprint():
    W, H = 15, 18
    img = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(img)
    d.ellipse((0, 5, 3, 12), fill=255)       # 왼발가락
    d.ellipse((5, 1, 9, 11), fill=255)       # 가운데발가락
    d.ellipse((11, 5, 14, 12), fill=255)     # 오른발가락
    d.ellipse((3, 10, 11, 17), fill=255)     # 발바닥
    m = np.array(img) > 0
    for x in (1, 7, 12):                     # 발톱 끝
        m[0 if x == 7 else 4, x] = True
    cv = np.zeros((H + 2, W + 2, 4), dtype=np.uint8)
    inner = np.zeros((H + 2, W + 2), dtype=bool)
    inner[1:H + 1, 1:W + 1] = m
    paint(cv, dilate(inner, 1), (0x6b, 0x4a, 0x3a))
    paint(cv, inner, (0xa6, 0x7c, 0x55))
    paint(cv, np.logical_and(inner, ~shift(inner, -1, -1)), (0x84, 0x5e, 0x42))
    paint(cv, np.logical_and(inner, ~shift(inner, 1, 1)), (0xc4, 0x9b, 0x70))
    save(cv, 'footprint.png')


def build_spark():
    m = ['..y..', '..y..', 'yywyy', '..y..', '..y..']
    cv = np.zeros((7, 7, 4), dtype=np.uint8)
    pal = {'y': YEL, 'w': (255, 255, 255)}
    for j, row in enumerate(m):
        for i, ch in enumerate(row):
            if ch in pal:
                cv[j + 1, i + 1] = (*pal[ch], 255)
    # 외곽선
    mk = cv[..., 3] > 0
    paint(cv, dilate(mk, 1) & ~mk & ~shift(mk, 1, 1) | (dilate(mk, 1) & ~mk), PLUM)
    save(cv, 'spark.png')


# ───────────── 날아가는 고나 실루엣 ─────────────
def build_fly():
    sp = np.array(Image.open(os.path.join(ROOT, 'public/assets/gona.png')).convert('RGBA'))
    sh, sw = sp.shape[:2]
    W, H = 100, 54
    m = np.zeros((H, W), dtype=bool)
    ox, oy = (W - sw) // 2, 14
    m[oy:oy + sh, ox:ox + sw] = sp[..., 3] > 0   # 승인된 고나 스프라이트의 실루엣 그대로

    def wing(sign):
        cx = 50
        pts = [(cx + sign * 8, 26), (cx + sign * 22, 17), (cx + sign * 38, 7), (cx + sign * 48, 3),
               (cx + sign * 44, 13), (cx + sign * 49, 17), (cx + sign * 41, 21), (cx + sign * 44, 28),
               (cx + sign * 35, 27), (cx + sign * 33, 35), (cx + sign * 25, 31), (cx + sign * 20, 38),
               (cx + sign * 14, 33), (cx + sign * 9, 36)]
        img = Image.new('L', (W, H), 0)
        ImageDraw.Draw(img).polygon(pts, fill=255)
        return np.array(img) > 0
    m |= wing(-1) | wing(1)
    cv = np.zeros((H, W, 4), dtype=np.uint8)
    paint(cv, m, (0x35, 0x2a, 0x5a))
    # 날개 윗가장자리에 아주 옅은 림라이트 (실루엣이 배경에 묻히지 않게)
    rim = m & ~shift(m, 0, 1)
    paint(cv, rim & (np.arange(W)[None, :] % 2 == 0), (0x5a, 0x4a, 0x88))
    save(cv, 'gona-fly.png')


# ───────────── 타이틀 배경 (150×340 도트) ─────────────
BW, BH = 150, 340
GROUND_Y = 262


def cloud(cv, cx, cy, w, seed):
    r = random.Random(seed)
    h = max(4, w // 3)
    m = np.zeros((BH, BW), dtype=bool)
    bumps = max(3, w // 8)
    for i in range(bumps):
        bx = cx - w // 2 + int(i * w / (bumps - 1))
        rad = int(h * (0.55 + r.random() * 0.45) * (1 - abs(i / (bumps - 1) - .5) * .8))
        for y in range(-rad, 1):
            for x in range(-rad, rad + 1):
                if x * x + y * y <= rad * rad:
                    if 0 <= cy + y < BH and 0 <= bx + x < BW:
                        m[cy + y, bx + x] = True
    m[cy - 1:cy + 1, cx - w // 2:cx + w // 2 + 1] |= True
    line = dilate(m, 1)
    paint(cv, line & ~m, (0x8f, 0xb0, 0xd0))
    for y in range(BH):
        for x in range(BW):
            if m[y, x]:
                lower = y >= cy - 1 or (y > 0 and not m[y - 2:y, x].all()) and False
                cv[y, x] = (*((0xd8, 0xe6, 0xf4) if y >= cy - 1 else (0xff, 0xff, 0xff)), 255)


def build_bg():
    cv = np.zeros((BH, BW, 4), dtype=np.uint8)
    # 하늘: 바랜 하늘색 → 크림 노을빛 띠(디더 경계)
    stops = [(0, '#6fb6dc'), (70, '#86c6e4'), (130, '#a3d6ea'), (185, '#c4e4ea'), (225, '#efe6c0'), (GROUND_Y, '#f6dcae')]
    def sky(y):
        for i in range(len(stops) - 1):
            if stops[i][0] <= y < stops[i + 1][0]:
                a, b = hexrgb(stops[i][1]), hexrgb(stops[i + 1][1])
                return a, b, stops[i][0], stops[i + 1][0]
        return hexrgb(stops[-1][1]), hexrgb(stops[-1][1]), 0, 1
    band = 9
    for y in range(GROUND_Y):
        a, b, y0, y1 = sky(y)
        k = int((y - y0) // band)
        n = max(1, (y1 - y0) // band)
        for x in range(BW):
            t = (y - y0) / (y1 - y0)
            step = int(t * n)
            frac = t * n - step
            use_b = (step + (1 if frac > 0.7 and (x + y) % 2 == 0 else 0)) >= (n // 2 + 1)
            cv[y, x] = (*(b if use_b else a), 255)
    # 해 뒤 햇살 (아케이드 느낌): 해 중심에서 퍼지는 연한 쐐기
    sx, sy = 116, 150
    for y in range(GROUND_Y):
        for x in range(BW):
            ang = math.atan2(y - sy, x - sx)
            wedge = int(((ang + math.pi) / (2 * math.pi)) * 18)
            if wedge % 2 == 0 and math.hypot(x - sx, y - sy) > 17:
                r, g, b = (int(v) for v in cv[y, x][:3])
                cv[y, x] = (min(255, r + 14), min(255, g + 12), min(255, b + 6), 255)
    # 해 (웃는 얼굴)
    sun = np.zeros((BH, BW), dtype=bool)
    for y in range(BH):
        for x in range(BW):
            if (x - sx) ** 2 + (y - sy) ** 2 <= 15 ** 2:
                sun[y, x] = True
    paint(cv, dilate(sun, 1), PLUM)
    for y in range(BH):
        for x in range(BW):
            if sun[y, x]:
                d = math.hypot(x - sx, y - sy)
                cv[y, x] = (*(YEL_L if d < 8 else YEL if d < 12 else YEL_D), 255)
    for dx in (-5, 5):                                       # 눈
        cv[sy - 3:sy + 1, sx + dx] = (*PLUM, 255)
        cv[sy - 3:sy + 1, sx + dx + 1] = (*PLUM, 255)
    for x in range(-5, 6):                                   # 웃는 입
        yy = sy + 5 + (1 if abs(x) < 3 else 0 if abs(x) < 5 else -1)
        cv[yy, sx + x] = (*PLUM, 255)
    cv[sy + 2:sy + 4, sx - 9:sx - 6] = (*COR_L, 255)         # 볼
    cv[sy + 2:sy + 4, sx + 7:sx + 10] = (*COR_L, 255)
    # 구름
    cloud(cv, 24, 70, 34, 1)
    cloud(cv, 112, 38, 28, 2)
    cloud(cv, 40, 128, 24, 3)
    cloud(cv, 22, 206, 30, 4)
    cloud(cv, 128, 222, 22, 5)
    cloud(cv, 76, 18, 20, 6)
    # 바다 수평선 띠 + 땅
    for y in range(GROUND_Y - 18, GROUND_Y):
        for x in range(BW):
            c = '#7fc1d8' if (y - (GROUND_Y - 18)) < 9 else '#6aaecb'
            cv[y, x] = (*hexrgb(c), 255)
    for x in range(0, BW, 7):                                  # 수평선 반짝
        cv[GROUND_Y - 16 + (x // 7) % 5 * 3, x:x + 3] = (*hexrgb('#c9ecf5'), 255)
    paint(cv, np.pad(np.ones((1, BW), bool), ((GROUND_Y - 19, BH - GROUND_Y + 18), (0, 0)))[:BH], PLUM)
    # 땅: 모래길 + 풀 가장자리
    for y in range(GROUND_Y, BH):
        for x in range(BW):
            depth = y - GROUND_Y
            wave = int(2 * math.sin(x / 9.0))
            if depth + wave < 5:
                c = '#9ccf6e' if (x + y) % 2 else '#8bc45f'
            elif depth + wave < 7:
                c = '#6fae52'
            else:
                c = '#f2dcab' if (x // 3 + y // 3) % 2 == 0 else '#ecd29b'
                if depth > 52:
                    c = '#e6c78c' if (x // 3 + y // 3) % 2 == 0 else '#dfbf82'
            cv[y, x] = (*hexrgb(c), 255)
    r = random.Random(9)
    for _ in range(26):                                        # 풀잎
        x = r.randrange(2, BW - 3)
        y = GROUND_Y + int(2 * math.sin(x / 9.0)) + 4
        cv[y - 3:y, x] = (*hexrgb('#4f9a47'), 255)
        cv[y - 2:y, x + 1] = (*hexrgb('#6fae52'), 255)
    for _ in range(14):                                        # 모래 알갱이 / 작은 돌
        x, y = r.randrange(3, BW - 3), r.randrange(GROUND_Y + 14, BH - 3)
        cv[y, x:x + 2] = (*hexrgb('#cfae72'), 255)
    for (x, y, c) in [(14, GROUND_Y + 8, '#ff9ab0'), (130, GROUND_Y + 9, '#fff0a0'), (60, GROUND_Y + 7, '#ffffff')]:  # 꽃
        cv[y, x] = (*hexrgb(c), 255)
        cv[y - 1, x], cv[y + 1, x], cv[y, x - 1], cv[y, x + 1] = [(*hexrgb(c), 255)] * 4
        cv[y, x] = (*YEL, 255)
    save(cv, 'title-bg.png')


if __name__ == '__main__':
    build_logo(); build_sub(); build_footprint(); build_spark(); build_fly(); build_bg()
