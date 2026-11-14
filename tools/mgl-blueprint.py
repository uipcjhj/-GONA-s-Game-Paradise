#!/usr/bin/env python3
"""
Mini Game Land 디자인 '구도 청사진' 생성기 (로컬 PIL, 이미지 생성 도구·크레딧 미사용).
최종 아트가 아니라 구도 · 색 배치 · 크기(도트 규격) 확인용. 고나만 승인된 스프라이트(gona.png)를 그대로 사용.
  python3 tools/mgl-blueprint.py docs/mini-game-land/blueprint
"""
import sys, os
from PIL import Image, ImageDraw, ImageFont

OUT = sys.argv[1] if len(sys.argv) > 1 else 'docs/mini-game-land/blueprint'
os.makedirs(OUT, exist_ok=True)
FD = 'node_modules/galmuri/dist/'
GONA = Image.open('public/assets/gona.png').convert('RGBA')

# ── 팔레트 (월드맵·고나에서 추출 + 따뜻한 게임판 색)
NAVY = '#173073'; BROWN = '#3b2419'; NIGHT = '#0d1b45'
CREAM = '#fff1d0'; CREAM_D = '#f3dfa8'; BUTTER = '#f9e49a'; GOLD = '#f9c161'
CORAL = '#ef845b'; CORAL_D = '#c75a3a'; MINT = '#a8e6cf'; MINT_D = '#6fc4a2'; MINT_L = '#c8f2df'
BLUE = '#1dadfd'; BLUE_D = '#0f7fd0'; WOOD = '#b57b4e'; WOOD_D = '#8f5c3a'
GRASS = '#b3f56d'; GRASS_D = '#7fc24a'; WHITE = '#f6f5fd'; LAV = '#ddd0f9'; PINK = '#ff9fb8'; RED = '#e8584f'

def font(name, size):
    return ImageFont.truetype(FD + name, size)
F11 = font('Galmuri11.ttf', 11); F22 = font('Galmuri11-Bold.ttf', 22); F14 = font('Galmuri14.ttf', 28); F11B = font('Galmuri11-Bold.ttf', 11)

def new(W, H, c): 
    im = Image.new('RGBA', (W, H), c); return im, ImageDraw.Draw(im)
def R(d, x, y, w, h, c): d.rectangle([x, y, x + w - 1, y + h - 1], fill=c)
def notch(d, x, y, w, h, n, c):
    n = max(0, min(n, (min(w, h) - 1) // 2))
    R(d, x + n, y, w - 2 * n, h, c); R(d, x, y + n, w, h - 2 * n, c)
def panel(d, x, y, w, h, fill, line=BROWN, t=2, n=4, shadow=None):
    if shadow: notch(d, x, y + 5, w, h, n, shadow)
    notch(d, x, y, w, h, n, line); notch(d, x + t, y + t, w - 2 * t, h - 2 * t, max(n - t, 2), fill)
def button(d, x, y, w, h, fill, line=NAVY, depth=6, hi=None):
    panel(d, x, y, w, h, fill, line, 2, 4, shadow=line)
    if hi: R(d, x + 6, y + 4, w - 12, 2, hi)
def text(d, xy, s, f, fill, ol=None, ow=2, anchor='la'):
    d.fontmode = '1'
    x, y = xy
    if ol:
        for dx in range(-ow, ow + 1):
            for dy in range(-ow, ow + 1):
                if dx or dy: d.text((x + dx, y + dy), s, font=f, fill=ol, anchor=anchor)
    d.text((x, y), s, font=f, fill=fill, anchor=anchor)
def up(layer, k=2): return layer.resize((layer.width * k, layer.height * k), Image.NEAREST)
def gona(im, x, y, k):
    im.alpha_composite(GONA.resize((27 * k, 34 * k), Image.NEAREST), (x, y))

# ── 논리(2px) 레이어 위에 그리는 장식: 구름·텐트·대관람차·풍선
def cloud(d, x, y, s=1):
    for dx, dy, w, h in [(0, 6, 40, 10), (6, 2, 14, 10), (16, 0, 18, 12), (28, 4, 14, 8)]:
        R(d, x + dx * s, y + dy * s, w * s, h * s, WHITE)
    R(d, x, y + 14 * s, 42 * s, 2 * s, LAV)
def tent(d, x, y, w, h, c1=CORAL):
    for i in range(h):
        half = int((w / 2) * (i + 1) / h)
        for j in range(-half, half):
            stripe = ((j + w) // 5) % 2
            d.point((x + w // 2 + j, y + i), fill=c1 if stripe == 0 else WHITE)
    R(d, x + 4, y + h, w - 8, 12, CREAM); R(d, x + 4, y + h, w - 8, 2, BROWN)
    R(d, x + w // 2 - 5, y + h + 4, 10, 8, WOOD_D)
    R(d, x + w // 2 - 1, y - 6, 2, 8, BROWN); R(d, x + w // 2 + 1, y - 6, 8, 5, GOLD)
def wheel(d, cx, cy, r):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=NAVY, width=2)
    d.ellipse([cx - r + 4, cy - r + 4, cx + r - 4, cy + r - 4], outline=WHITE, width=1)
    import math
    cols = [CORAL, BLUE, BUTTER, MINT, PINK, GOLD, CORAL, BLUE]
    for k in range(8):
        a = k * math.pi / 4
        d.line([cx, cy, cx + r * math.cos(a), cy + r * math.sin(a)], fill=NAVY, width=1)
        gx, gy = cx + r * math.cos(a), cy + r * math.sin(a)
        R(d, int(gx) - 3, int(gy) - 3, 7, 7, cols[k]); 
    R(d, cx - 18, cy + r, 4, 30, WOOD_D); R(d, cx + 14, cy + r, 4, 30, WOOD_D); R(d, cx - 20, cy + r + 28, 40, 4, WOOD_D)
def balloon(d, x, y, c, on=True):
    col = c if on else '#9fb5d8'
    R(d, x + 2, y, 8, 12, col); R(d, x, y + 2, 12, 8, col); R(d, x + 4, y + 2, 2, 3, WHITE if on else '#c3d2ea')
    R(d, x + 5, y + 12, 2, 2, col); R(d, x + 5, y + 14, 1, 6, NAVY if on else '#7d93b8')
def bulbs(d, x, y, w, step=8, c=BUTTER):
    for i in range(0, w, step): R(d, x + i, y, 3, 3, c)

# ── 젤리 친구 (24×24 도트 → ×4 = 96px). 월드맵의 웃는 젤리 느낌. 임시 형태(최종 스프라이트 아님)
BODY = {'blue': ('#4aa3f0', '#8cc8ff', '#2d74c4'), 'coral': (CORAL, '#ffae8c', CORAL_D), 'mint': ('#7fdcb0', '#b9f2d6', '#4aa886'), 'butter': (BUTTER, '#fff6c4', '#d9b84e')}
def jelly(color='blue', face='smile', feature='none'):
    im = Image.new('RGBA', (24, 24), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    b, l, s = BODY[color]
    def N(x0, y0, x1, y1, n, c):
        d.rectangle([x0 + n, y0, x1 - n, y1], fill=c); d.rectangle([x0, y0 + n, x1, y1 - n], fill=c)
    N(1, 4, 22, 22, 3, BROWN); N(2, 5, 21, 21, 2, b)
    d.rectangle([4, 19, 19, 20], fill=s); d.rectangle([5, 6, 9, 7], fill=l); d.rectangle([4, 8, 5, 10], fill=l)
    eyes = {'smile': [(7, 11, 8, 12), (15, 11, 16, 12)], 'sleepy': [(6, 12, 9, 12), (14, 12, 17, 12)], 'cry': [(7, 11, 8, 14), (16, 11, 17, 14)], 'angry': [(6, 10, 9, 10), (14, 10, 17, 10), (7, 12, 8, 13), (15, 12, 16, 13)]}[face]
    for e in eyes: d.rectangle(list(e), fill=BROWN)
    if face == 'smile': d.rectangle([9, 15, 14, 15], fill=BROWN); d.point([(8, 14), (15, 14)], fill=BROWN)
    d.rectangle([4, 14, 5, 15], fill=PINK); d.rectangle([18, 14, 19, 15], fill=PINK)
    if feature == 'ribbon':
        d.rectangle([14, 1, 17, 5], fill=PINK); d.rectangle([20, 1, 23, 5], fill=PINK); d.rectangle([18, 2, 19, 4], fill=RED)
        for r in [(14, 0, 17, 0), (20, 0, 23, 0), (14, 6, 17, 6), (20, 6, 23, 6)]: d.rectangle(list(r), fill=BROWN)
    if feature == 'hat':
        d.rectangle([5, 2, 18, 5], fill=NAVY); d.rectangle([3, 5, 20, 6], fill=NAVY); d.rectangle([8, 0, 15, 1], fill=NAVY); d.rectangle([11, 0, 12, 0], fill=GOLD)
    if feature == 'glasses':
        for x0 in (5, 13): d.rectangle([x0, 9, x0 + 5, 14], outline=BROWN)
        d.rectangle([11, 11, 12, 11], fill=BROWN)
    return im.resize((96, 96), Image.NEAREST)

def booth_icon(d, kind, x, y):
    if kind == 'sort':
        for i, c in enumerate([CORAL, '#4aa3f0', '#7fdcb0']): panel(d, x + i * 22, y + (i % 2) * 6, 20, 20, c, BROWN, 2, 2)
    if kind == 'tower':
        for i, (w, c) in enumerate([(44, GOLD), (34, CORAL), (24, MINT)]): panel(d, x + 12 + (44 - w) // 2, y + 36 - i * 12, w, 12, c, BROWN, 2, 2)
    if kind == 'toy':
        R(d, x + 4, y + 8, 56, 4, WOOD_D); R(d, x + 4, y + 30, 56, 4, WOOD_D)
        panel(d, x + 8, y - 2, 14, 10, CORAL, BROWN, 2, 2); panel(d, x + 28, y, 12, 8, '#4aa3f0', BROWN, 2, 2); panel(d, x + 12, y + 20, 12, 10, MINT, BROWN, 2, 2); panel(d, x + 38, y + 18, 14, 12, BUTTER, BROWN, 2, 2)

def awning(d, x, y, w, c1=CORAL, h=18):
    for i in range(0, w, 12):
        R(d, x + i, y, 12, h, c1 if (i // 12) % 2 == 0 else CREAM)
        R(d, x + i + 2, y + h, 8, 4, c1 if (i // 12) % 2 == 0 else CREAM)
    R(d, x, y, w, 2, BROWN); R(d, x, y + h - 2, w, 2, BROWN)

# ═══════════════════════ A. 홈
def home(W, H):
    im, d = new(W, H, BLUE)
    k = max(0.0, min(1.0, (H - 636) / 208))           # 화면이 길수록 여백·크기를 늘림
    ground = int(H * 0.435)
    L = Image.new('RGBA', (W // 2, H // 2), (0, 0, 0, 0)); ld = ImageDraw.Draw(L)
    for (cx, cy, s_) in [(6, int(H * 0.16), 1), (int(W * 0.40), int(H * 0.20), 1), (int(W * 0.30), int(H * 0.13), 1)]: cloud(ld, cx, cy, s_)
    gl = ground // 2
    wheel(ld, int(W * 0.37), gl - 52, 34)                                  # 대관람차(뒤)
    tent(ld, int(W * 0.03), gl - 40, 56, 28, CORAL); tent(ld, int(W * 0.20), gl - 34, 44, 24, '#4aa3f0')
    R(ld, 0, gl, W // 2, H // 2 - gl, GRASS); R(ld, 0, gl, W // 2, 3, GRASS_D)
    for x in range(0, W // 2, 14): R(ld, x, gl + 8 + (x // 14 % 2) * 6, 4, 2, GRASS_D)
    im.alpha_composite(up(L), (0, 0)); d = ImageDraw.Draw(im)
    # 타이틀 간판 (전구 테두리 + 양옆 게임패드)
    tw = W - 56; tx = 28; ty0 = 20
    R(d, tx + 24, 0, 6, ty0 + 6, WOOD_D); R(d, tx + tw - 30, 0, 6, ty0 + 6, WOOD_D)
    panel(d, tx, ty0, tw, 74, WOOD, BROWN, 3, 6, shadow=BROWN); panel(d, tx + 6, ty0 + 6, tw - 12, 62, NAVY, NIGHT, 2, 4)
    bulbs(d, tx + 12, ty0 + 10, tw - 24, 12); bulbs(d, tx + 12, ty0 + 56, tw - 24, 12, GOLD)
    for gx_ in (tx + 20, tx + tw - 58):
        R(d, gx_, ty0 + 26, 38, 14, '#2a4fa8'); R(d, gx_ + 6, ty0 + 30, 10, 4, WHITE); R(d, gx_ + 9, ty0 + 27, 4, 10, WHITE); R(d, gx_ + 24, ty0 + 29, 4, 4, CORAL); R(d, gx_ + 30, ty0 + 33, 4, 4, MINT)
    text(d, (W // 2, ty0 + 8), "GONA's", F22, BUTTER, BROWN, 2, 'ma'); text(d, (W // 2, ty0 + 33), "Mini Game Land", F22, WHITE, NIGHT, 2, 'ma')
    R(d, W // 2 - 74, ty0 + 70, 148, 24, CORAL); R(d, W // 2 - 74, ty0 + 70, 148, 2, BROWN); R(d, W // 2 - 74, ty0 + 92, 148, 2, BROWN)
    text(d, (W // 2, ty0 + 75), "고나의 미니게임천국", F11B, WHITE, CORAL_D, 1, 'ma')
    # 고나 (×4 = 108×136, 게임천국과 같은 도트 크기) + 말풍선
    gx = 34; gyy = ground - 136
    R(d, gx + 18, ground - 6, 72, 8, GRASS_D); gona(im, gx, gyy, 4)
    bx = gx + 124; by = gyy + 8
    panel(d, bx, by, W - bx - 24, 44, CREAM, BROWN, 2, 4); R(d, bx - 8, by + 20, 10, 6, CREAM); R(d, bx - 8, by + 20, 2, 6, BROWN)
    text(d, (bx + (W - bx - 24) // 2, by + 6), "오늘은 뭐", F11B, BROWN, None, 0, 'ma'); text(d, (bx + (W - bx - 24) // 2, by + 22), "할까?", F11B, BROWN, None, 0, 'ma')
    # 광장 패널 (티켓 보드)
    py = ground + 14
    panel(d, 8, py, W - 16, H - py - 8, CREAM, BROWN, 3, 6, shadow=BROWN); R(d, 14, py + 6, W - 28, 2, CREAM_D)
    tw2 = (W - 16 - 24 - 8) // 2; ty = py + 14 + int(6 * k)
    button(d, 20, ty, tw2, 46, CORAL, NAVY, hi='#ffae8c'); text(d, (20 + tw2 // 2, ty + 12), "자유 플레이", F22, WHITE, CORAL_D, 2, 'ma')
    button(d, 28 + tw2, ty + 4, tw2, 42, MINT, NAVY); text(d, (28 + tw2 + tw2 // 2, ty + 14), "랜덤 챌린지", F22, NAVY, None, 0, 'ma')
    R(d, 20 + tw2 // 2 - 6, ty + 46, 12, 6, CORAL)
    by0 = ty + 66 + int(8 * k); bw = (W - 16 - 24 - 16) // 3; bh = 116 + int(34 * k)
    items = [('sort', '편가르기', True, ''), ('tower', '탑 쌓기', False, 'COMING SOON'), ('toy', '장난감방', False, 'COMING SOON')]
    for i, (kind, name, on, sub) in enumerate(items):
        x = 20 + i * (bw + 8)
        panel(d, x, by0, bw, bh, CREAM_D if on else '#d9d0b6', BROWN, 2, 4, shadow=BROWN)
        awning(d, x + 2, by0 + 2, bw - 4, CORAL if on else '#9aa3b5')
        booth_icon(d, kind, x + (bw - 66) // 2, by0 + 34 + int(10 * k))
        text(d, (x + bw // 2, by0 + bh - 44), name, F22, BROWN if on else '#7a7f8c', None, 0, 'ma')
        if on:
            for sx in range(3): R(d, x + bw // 2 - 24 + sx * 18, by0 + bh - 18, 12, 10, GOLD if sx < 2 else CREAM); R(d, x + bw // 2 - 24 + sx * 18, by0 + bh - 18, 12, 2, BROWN)
        else:
            text(d, (x + bw // 2, by0 + bh - 18), sub, F11, '#7a7f8c', None, 0, 'ma')
    d.rectangle([20 - 3, by0 - 3, 20 + bw + 2, by0 + bh + 2], outline=BLUE, width=3)
    cy = by0 + bh + 14 + int(8 * k); ch = 56
    button(d, 20, cy, W - 40, ch, GOLD, NAVY, hi=BUTTER); text(d, (W // 2, cy + 15), "▶  편가르기 시작!", F22, BROWN, None, 0, 'ma')
    fy = cy + ch + 20 + int(10 * k); fw = (W - 40 - 16) // 3
    for i, label in enumerate(["← 게임천국", "내 기록", "소리 ON"]):
        button(d, 20 + i * (fw + 8), fy, fw, 38, WHITE, NAVY); text(d, (20 + i * (fw + 8) + fw // 2, fy + 10), label, F11B, NAVY, None, 0, 'ma')
    return im

# ═══════════════════════ B. 편가르기 플레이
def sortplay(W, H, three=True):
    im, d = new(W, H, CREAM_D)
    # 배경: 따뜻한 부스 안쪽(크림 벽 + 나무 바닥 줄무늬)
    R(d, 0, 0, W, H, CREAM)
    for y in range(0, H, 16): R(d, 0, y, W, 2, CREAM_D)
    # HUD 전광판
    R(d, 0, 0, W, 90, NAVY); R(d, 0, 88, W, 2, NIGHT); bulbs(d, 4, 84, W - 8, 12, GOLD)
    button(d, 10, 10, 44, 44, CREAM, NAVY); R(d, 25, 22, 5, 20, NAVY); R(d, 36, 22, 5, 20, NAVY)
    panel(d, 62, 10, 176, 44, NIGHT, BLUE_D, 2, 4); text(d, (228, 14), "2,925", F14, '#ffe27a', '#7a5a00', 1, 'ra')
    text(d, (70, 16), "SCORE", F11, '#7fb6ff'); R(d, 70, 32, 40, 2, '#2a4fa8')
    panel(d, 246, 10, 60, 44, CORAL, NAVY, 2, 4); text(d, (276, 13), "COMBO", F11B, WHITE, None, 0, 'ma'); text(d, (276, 26), "×12", F22, BUTTER, CORAL_D, 2, 'ma')
    # 시간 리본(왼쪽) + 목숨 풍선 5칸 중 3개(오른쪽)
    panel(d, 10, 60, W - 20 - 110, 20, NIGHT, BLUE_D, 2, 2)
    tw = int((W - 24 - 110) * 0.78)
    for x in range(14, 14 + tw, 12): R(d, x, 64, 12, 12, CORAL if (x // 12) % 2 == 0 else CREAM)
    R(d, 14, 64, tw, 2, '#ffae8c'); text(d, (W - 130 - 6, 63), "36", F11B, WHITE, NIGHT, 1, 'ra')
    L = Image.new('RGBA', (60, 20), (0, 0, 0, 0)); ld = ImageDraw.Draw(L)
    for i in range(5):
        c = [RED, '#ffd84a', '#7fdcb0', RED, RED][i]; on = i < 3; col = c if on else '#7d93b8'
        R(ld, 1 + i * 11, 1, 6, 1, col); R(ld, i * 11, 2, 8, 6, col); R(ld, 1 + i * 11, 8, 6, 1, col); R(ld, 3 + i * 11, 9, 2, 1, col)
        if on: R(ld, 2 + i * 11, 3, 1, 2, WHITE)
        R(ld, 3 + i * 11, 10, 1, 5, '#cfe3ff' if on else '#51668f')
    im.alpha_composite(up(L), (W - 116, 58)); d = ImageDraw.Draw(im)
    # 규칙 간판 + 고나 심판
    ry = 100; rh = 98
    panel(d, 8, ry, W - 16, rh, WOOD, BROWN, 3, 6, shadow=BROWN); panel(d, 14, ry + 6, W - 28, rh - 12, CREAM, WOOD_D, 2, 4)
    R(d, 24, ry - 6, 54, 18, CORAL); R(d, 24, ry - 6, 54, 2, BROWN); R(d, 24, ry + 10, 54, 2, BROWN); text(d, (51, ry - 3), "규칙", F11B, WHITE, CORAL_D, 1, 'ma')
    gona(im, 22, ry + 2, 3)  # 심판 고나 ×3 (81×102) — 가독성 위해 4px→3px 조정 제안
    R(d, 90, ry + 56, 10, 6, GOLD); R(d, 88, ry + 58, 4, 2, BROWN)  # 호루라기
    text(d, (118, ry + 20), "3분류!  나머지는 ▲ 위로", F22, BROWN)
    cx = 118
    for lab, c in [("노랑", BUTTER), ("파랑", '#4aa3f0')]:
        panel(d, cx, ry + 52, 92, 32, WHITE, BROWN, 2, 2); R(d, cx + 8, ry + 62, 12, 12, c); R(d, cx + 8, ry + 62, 12, 2, BROWN); R(d, cx + 8, ry + 72, 12, 2, BROWN)
        text(d, (cx + 26, ry + 58), lab, F22, BROWN); cx += 100
    # 진행 / 실수
    iy = ry + rh + 8
    panel(d, 10, iy, 132, 30, MINT, NAVY, 2, 2); text(d, (76, iy + 4), "카드 7/14", F22, NAVY, None, 0, 'ma')
    text(d, (W // 2 + 6, iy + 9), "ROUND 7 · LV 7", F11B, NAVY, None, 0, 'ma')
    text(d, (W - 118, iy + 4), "실수", F22, NAVY)
    for i in range(3):
        bx_ = W - 76 + i * 24; panel(d, bx_, iy + 4, 20, 20, RED if i < 1 else WHITE, NAVY, 2, 2)
        if i < 1: d.line([bx_ + 5, iy + 9, bx_ + 14, iy + 18], fill=WHITE, width=2); d.line([bx_ + 14, iy + 9, bx_ + 5, iy + 18], fill=WHITE, width=2)
    # 게임판(민트 펠트)
    sy = iy + 36; bins_h = 118; sh = H - sy - bins_h - 28
    panel(d, 6, sy, W - 12, sh, WOOD, BROWN, 3, 6, shadow=BROWN); panel(d, 14, sy + 8, W - 28, sh - 16, MINT, MINT_D, 2, 4)
    for gx in range(24, W - 24, 16):
        for gy in range(sy + 18, sy + sh - 18, 16): R(d, gx, gy, 2, 2, MINT_D)
    d.rectangle([24, sy + 18, W - 25, sy + sh - 19], outline=MINT_L, width=2)  # 스티치 테두리
    mx = W // 2; my = sy + sh // 2
    # 레인 화살표
    for sx, ch in ((34, "◀"), (W - 56, "▶")): text(d, (sx, my - 14 + 20), ch, F22, MINT_D)
    if three: text(d, (mx - 10, sy + 24), "▲", F22, MINT_D)
    # 카드 받침 + 다음 카드 + 현재 카드
    R(d, mx - 56, my + 52, 112, 8, MINT_D)
    panel(d, 24, sy + 18, 62, 70, CREAM, BROWN, 2, 2); text(d, (55, sy + 22), "NEXT", F11B, CORAL_D, None, 0, 'ma')
    im.alpha_composite(jelly('coral', 'sleepy', 'ribbon').resize((48, 48), Image.NEAREST), (31, sy + 36))
    im.alpha_composite(jelly('blue', 'smile', 'glasses'), (mx - 48, my - 44))
    # 점수 팝업
    panel(d, W - 144, sy + 14, 124, 32, GOLD, BROWN, 2, 2); text(d, (W - 82, sy + 18), "+150 빠르다!", F11B, BROWN, None, 0, 'ma')
    # 분류함 (줄무늬 차양 바구니)
    by = H - bins_h - 12; n = 3 if three else 2; gap = 8; bw = (W - 16 - gap * (n - 1)) // n
    labs = ["노랑", "나머지", "파랑"] if three else ["빨강 + 안경", "나머지"]
    arrows = ["◀", "▲", "▶"] if three else ["◀", "▶"]
    for i in range(n):
        x = 8 + i * (bw + gap)
        panel(d, x, by + 22, bw, bins_h - 22, WOOD, BROWN, 2, 4, shadow=BROWN)
        for yy in range(by + 30, by + bins_h - 8, 8): R(d, x + 4, yy, bw - 8, 2, WOOD_D)
        awning(d, x, by, bw, CORAL if i != 1 else '#4aa3f0', 18)
        panel(d, x + 10, by + 44, bw - 20, 40, CREAM, BROWN, 2, 2)
        text(d, (x + bw // 2, by + 52), labs[i], F22, BROWN, None, 0, 'ma')
        panel(d, x + bw // 2 - 14, by + 82 - 4, 28, 20, BLUE, NAVY, 2, 2); text(d, (x + bw // 2, by + 80), arrows[i], F11B, WHITE, None, 0, 'ma')
    return im

# ═══════════════════════ 규격 시트
def spec():
    W, H = 393, 636
    im, d = new(W, H, CREAM)
    text(d, (14, 10), "디자인 규격 시트 (청사진)", F22, BROWN)
    text(d, (14, 38), "최종 아트 아님 · 구도·색·크기 확인용", F11, WOOD_D)
    sw = [('하늘', BLUE), ('네이비', NAVY), ('브라운', BROWN), ('크림', CREAM), ('버터', BUTTER), ('코랄', CORAL), ('민트', MINT), ('나무', WOOD), ('잔디', GRASS), ('금색', GOLD), ('구름', WHITE), ('연보라', LAV)]
    for i, (n, c) in enumerate(sw):
        x = 14 + (i % 4) * 94; y = 66 + (i // 4) * 62
        panel(d, x, y, 40, 40, c, BROWN, 2, 2); text(d, (x + 46, y + 4), n, F11B, BROWN); text(d, (x + 46, y + 20), c, F11, WOOD_D)
    y = 262
    text(d, (14, y), "도트 크기", F22, BROWN)
    gona(im, 20, y + 34, 4); text(d, (20, y + 174), "캐릭터 1도트=4px", F11B, BROWN); text(d, (20, y + 190), "고나 27×34 → 108×136", F11, WOOD_D)
    j = jelly('blue', 'smile', 'ribbon'); im.alpha_composite(j, (160, y + 40)); text(d, (160, y + 142), "친구 24×24 ×4 = 96", F11B, BROWN)
    for i in range(6):
        c = '#4aa3f0' if i % 2 else CORAL
        R(d, 280 + (i % 3) * 20, y + 50 + (i // 3) * 20, 18, 18, c)
    text(d, (270, y + 100), "UI 1도트=2px", F11B, BROWN); text(d, (270, y + 116), "버튼·프레임·아이콘", F11, WOOD_D)
    y = 470
    text(d, (14, y), "윤곽선 구분", F22, BROWN)
    panel(d, 14, y + 34, 110, 40, CREAM, NAVY, 2, 2); text(d, (69, y + 44), "UI = 네이비", F11B, NAVY, None, 0, 'ma')
    panel(d, 134, y + 34, 120, 40, CREAM, BROWN, 2, 2); text(d, (194, y + 44), "캐릭터·소품 = 브라운", F11B, BROWN, None, 0, 'ma')
    text(d, (14, y + 90), "게임판 = 크림·민트·코랄(따뜻한 색)", F11B, BROWN); text(d, (14, y + 108), "파랑은 포인트(배경 하늘·버튼 배지·강조)로만", F11B, BROWN)
    text(d, (14, y + 130), "그림자: 번짐 없는 2~3도트 오프셋 · 둥근 모서리 금지(모서리 도트 깎기)", F11, WOOD_D)
    return im

def save(im, name):
    im.convert('RGB').resize((im.width * 2, im.height * 2), Image.NEAREST).save(os.path.join(OUT, name))
for (W, H) in [(393, 636), (390, 844)]:
    save(home(W, H), f'A-home-{W}x{H}.png'); save(sortplay(W, H), f'B-sort-play-{W}x{H}.png')
save(spec(), '00-spec-sheet.png')
print(sorted(os.listdir(OUT)))
