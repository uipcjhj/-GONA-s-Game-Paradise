"""GONA's Sky Adventure — 슈팅 이펙트 도트 에셋 생성기 (PIL + numpy, 결정적 생성)
출력: public/assets/sky/v2/fx/*.png  (2배 격자 = 게임 캔버스 픽셀 1:1, 게임에서 논리 0.5배로 표시)

색 규칙 (탄 구분):
  - 플레이어 탄: 청록·하늘·흰색 계열의 '길쭉한' 에너지 탄, 어두운 외곽선 없음(빛나는 느낌) → 뒤쪽 레이어
  - 적 탄: 둥근 형태 + 짙은 외곽선 + 자홍·주황 테두리 + 흰 코어 (src/sky/bullets.ts) → 맨 위 레이어
"""
import math
import os
import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'sky', 'v2', 'fx')
os.makedirs(OUT, exist_ok=True)


def hx(h, a=255):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


class C:
    """작은 RGBA 캔버스 + 도형 도구 (안티앨리어싱 없음)"""

    def __init__(self, w, h):
        self.w, self.h = w, h
        self.a = np.zeros((h, w, 4), np.uint8)
        yy, xx = np.mgrid[0:h, 0:w]
        self.xx, self.yy = xx + 0.5, yy + 0.5

    def put(self, mask, col):
        self.a[mask] = col

    def ell(self, cx, cy, rx, ry, col):
        m = ((self.xx - cx) / max(rx, 0.01)) ** 2 + ((self.yy - cy) / max(ry, 0.01)) ** 2 <= 1
        self.put(m, col)
        return m

    def ring(self, cx, cy, r0, r1, col, sq=1.0):
        d = np.sqrt((self.xx - cx) ** 2 + ((self.yy - cy) / sq) ** 2)
        m = (d >= r0) & (d <= r1)
        self.put(m, col)
        return m

    def rect(self, x, y, w, h, col):
        self.a[max(0, y):max(0, y + h), max(0, x):max(0, x + w)] = col

    def px(self, x, y, col):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.a[int(y), int(x)] = col

    def line(self, x0, y0, x1, y1, col, wdt=1):
        n = int(max(abs(x1 - x0), abs(y1 - y0)) * 2) + 1
        for i in range(n + 1):
            t = i / n
            x = x0 + (x1 - x0) * t
            y = y0 + (y1 - y0) * t
            for dx in range(wdt):
                for dy in range(wdt):
                    self.px(int(x) + dx - wdt // 2, int(y) + dy - wdt // 2, col)

    def poly(self, pts, col):
        from PIL import ImageDraw
        im = Image.new('L', (self.w, self.h), 0)
        ImageDraw.Draw(im).polygon([tuple(p) for p in pts], fill=255)
        m = np.array(im) > 0
        self.put(m, col)
        return m

    def outline(self, col, diag=False):
        s = self.a[..., 3] > 0
        e = np.zeros_like(s)
        e[1:, :] |= s[:-1, :]
        e[:-1, :] |= s[1:, :]
        e[:, 1:] |= s[:, :-1]
        e[:, :-1] |= s[:, 1:]
        if diag:
            e[1:, 1:] |= s[:-1, :-1]
            e[:-1, :-1] |= s[1:, 1:]
            e[1:, :-1] |= s[:-1, 1:]
            e[:-1, 1:] |= s[1:, :-1]
        self.a[e & ~s] = col
        return self

    def img(self):
        return Image.fromarray(self.a, 'RGBA')


def sheet(frames):
    w = sum(f.width for f in frames)
    h = max(f.height for f in frames)
    s = Image.new('RGBA', (w, h))
    x = 0
    for f in frames:
        s.alpha_composite(f, (x, 0))
        x += f.width
    return s


def save(name, im):
    im.save(os.path.join(OUT, name + '.png'))
    print(name, im.size)


# 팔레트
CY = [hx('#0b3a6a'), hx('#1a78c8'), hx('#38c0f0'), hx('#9cf0ff'), hx('#ffffff')]
GOLD = [hx('#6a3a08'), hx('#c07a10'), hx('#f0b820'), hx('#ffe470'), hx('#fffbe0')]
PINK = [hx('#7a1450'), hx('#d0307a'), hx('#ff6aa8'), hx('#ffb8d8'), hx('#ffffff')]
LIME = [hx('#1a5010'), hx('#3a9a18'), hx('#7ad830'), hx('#c8ff80'), hx('#ffffff')]
STEEL = [hx('#2a2c3a'), hx('#5a6070'), hx('#9aa4b4'), hx('#d8e0ea'), hx('#ffffff')]
ORANGE = [hx('#5a1606'), hx('#c03a08'), hx('#ff7a18'), hx('#ffc040'), hx('#fff4c0')]
VIOLET = [hx('#2a0a5a'), hx('#6a2ac0'), hx('#a070ff'), hx('#d8c0ff'), hx('#ffffff')]


def bolt(w, h, pal, core_w, tail=True):
    """플레이어 에너지 탄: 위가 둥근 길쭉한 몸통 + 아래로 사라지는 잔상"""
    c = C(w, h)
    cx = w / 2
    head = h * 0.42
    if tail:  # 잔상 (점점 얇고 어둡게)
        for y in range(int(head), h):
            t = (y - head) / (h - head)
            ww = (w / 2 - 1) * (1 - t) ** 1.3
            if ww < 0.5:
                continue
            col = pal[1] if t > 0.55 else pal[2]
            c.rect(int(round(cx - ww)), y, max(1, int(round(ww * 2))), 1, col)
            if t < 0.5 and (y % 2 == 0):
                c.rect(int(cx) - 1, y, 2, 1, pal[3])
    c.ell(cx, head, w / 2, head, pal[2])
    c.ell(cx, head, w / 2 - 1.5, head - 1.5, pal[3])
    c.ell(cx, head - 1, core_w / 2, head - 3, pal[4])
    return c.img()


# ── 고나 일반탄 (무기 레벨별, 2프레임 깜박임) ──
# 모양: 흰 다이아몬드 머리 + 청록 불꽃 꼬리(들쭉날쭉) → 직사각형이 아닌 '날아가는 에너지 화살'
def dart(w, h, head_h, pal, frame, wing=False):
    c = C(w, h)
    cx = w / 2
    # 꼬리 불꽃: 아래로 갈수록 가늘어지고 프레임마다 좌우로 흔들림
    for y in range(int(head_h * 0.6), h):
        t = (y - head_h * 0.6) / (h - head_h * 0.6)
        ww = (w / 2 - 0.5) * (1 - t) ** 0.9
        ww *= 0.8 + 0.25 * math.sin(y * 1.3 + frame * 2.1)
        if ww < 0.5:
            if t < 0.95 and (y + frame) % 3 == 0:
                c.px(int(cx), y, pal[1])
            continue
        x0 = int(round(cx - ww))
        x1 = int(round(cx + ww))
        c.rect(x0, y, max(1, x1 - x0), 1, pal[1] if t > 0.55 else pal[2])
        if t < 0.6:
            c.rect(int(round(cx - ww * 0.45)), y, max(1, int(round(ww * 0.9))), 1, pal[3])
    if wing:
        for sx in (-1, 1):
            c.poly([(cx + sx * 1, head_h * 0.7), (cx + sx * (w / 2), head_h * 1.5), (cx + sx * (w / 2 - 1.5), head_h * 1.9), (cx + sx * 1, head_h * 1.2)], pal[2])
    # 머리: 다이아몬드 (밝은 테 → 흰 심)
    c.poly([(cx, 0), (cx + w * 0.42, head_h * 0.62), (cx, head_h * 1.25), (cx - w * 0.42, head_h * 0.62)], pal[2])
    c.poly([(cx, 1), (cx + w * 0.3, head_h * 0.62), (cx, head_h * 1.1), (cx - w * 0.3, head_h * 0.62)], pal[3])
    c.poly([(cx, 2.5), (cx + w * 0.15, head_h * 0.62), (cx, head_h * 0.95), (cx - w * 0.15, head_h * 0.62)], pal[4])
    return c.img()


save('shot-l1', sheet([dart(11, 32, 12, CY, f) for f in range(2)]))
save('shot-l2', sheet([dart(13, 36, 14, CY, f) for f in range(2)]))
GC = [hx('#0b3a6a'), hx('#1a9ad8'), hx('#58e0ff'), hx('#fff4a0'), hx('#ffffff')]  # Lv3: 금빛 심 + 청록 날개
save('shot-l3', sheet([dart(18, 40, 15, GC, f, wing=True) for f in range(2)]))
# Lv4 측면 파동탄 (초승달)
c = C(18, 14)
c.ring(9, 14, 6, 9.5, CY[2], sq=1.15)
c.ring(9, 14, 7, 8.5, CY[3], sq=1.15)
c.ring(9, 14, 7.6, 8.0, CY[4], sq=1.15)
c.a[11:, :] = 0
save('shot-wave', c.img())

# ── 머즐 플래시 3프레임 ──
fr = []
for i, (r, rr) in enumerate([(7, 9), (6, 7), (3, 4)]):
    c = C(22, 18)
    for k in range(5):
        a = -math.pi / 2 + (k - 2) * 0.55
        L = rr + (3 if k == 2 else 0)
        c.line(11, 13, 11 + math.cos(a) * L, 13 + math.sin(a) * L, CY[3], 2 if k == 2 else 1)
    c.ell(11, 13, r * 0.9, r * 0.6, CY[3])
    c.ell(11, 13, r * 0.5, r * 0.35, CY[4])
    fr.append(c.img())
save('muzzle', sheet(fr))


def burst(size, pal, n, frames, rays=True, ringc=None):
    out = []
    for f in range(frames):
        t = f / (frames - 1)
        c = C(size, size)
        m = size / 2
        r = 2 + t * (m - 3)
        if ringc is not None and f > 0:
            c.ring(m, m, r - 1.6, r, ringc)
        if rays:
            for k in range(n):
                a = k / n * math.tau + (0.3 if f % 2 else 0)
                L0 = r * 0.35
                L1 = r * (1.0 if k % 2 == 0 else 0.65)
                col = pal[3] if t < 0.5 else pal[2]
                c.line(m + math.cos(a) * L0, m + math.sin(a) * L0, m + math.cos(a) * L1, m + math.sin(a) * L1, col, 1 if f > 1 else 2)
        cr = (1 - t) * size * 0.2 + 1
        if f < frames - 1:
            c.ell(m, m, cr, cr, pal[3])
            c.ell(m, m, cr * 0.55, cr * 0.55, pal[4])
        out.append(c.img())
    return sheet(out)


save('spark', burst(24, CY, 8, 4))
# 금속 파편 (보스 장갑): 주황 불꽃 + 회색 파편
fr = []
rng = np.random.RandomState(7)
pts = [(rng.uniform(0, math.tau), rng.uniform(0.6, 1.0), rng.randint(0, 3)) for _ in range(9)]
for f in range(4):
    t = (f + 1) / 4
    c = C(28, 28)
    m = 14
    if f < 2:
        c.ell(m, m, 6 - f * 2, 5 - f * 2, ORANGE[3])
        c.ell(m, m, 3 - f, 2.5 - f, ORANGE[4])
    for a, s, kind in pts:
        d = 3 + t * 11 * s
        x, y = m + math.cos(a) * d, m + math.sin(a) * d + t * t * 4
        if kind == 0:
            c.rect(int(x), int(y), 2, 2, STEEL[2] if f < 3 else STEEL[1])
            c.px(int(x), int(y), STEEL[4])
        else:
            c.line(x, y, x - math.cos(a) * 3, y - math.sin(a) * 3, ORANGE[3] if f < 2 else ORANGE[2])
    fr.append(c.img())
save('metal', sheet(fr))
# 약점 피격: 분홍·흰 결정 파열 + 링
fr = []
for f in range(4):
    t = f / 3
    c = C(40, 40)
    m = 20
    r = 4 + t * 15
    c.ring(m, m, r - 2, r, PINK[3] if f < 2 else PINK[2])
    for k in range(6):
        a = k / 6 * math.tau + 0.26
        L = r * 0.9
        c.poly([(m + math.cos(a) * L * 0.3, m + math.sin(a) * L * 0.3), (m + math.cos(a + 0.18) * L, m + math.sin(a + 0.18) * L),
                (m + math.cos(a) * (L + 4), m + math.sin(a) * (L + 4)), (m + math.cos(a - 0.18) * L, m + math.sin(a - 0.18) * L)], PINK[3] if f < 3 else PINK[2])
    if f < 2:
        c.ell(m, m, 6 - f * 2, 6 - f * 2, PINK[4])
    fr.append(c.img())
save('weak', sheet(fr))
# 충격파 링 4프레임
fr = []
for f in range(4):
    t = f / 3
    c = C(64, 64)
    r = 8 + t * 22
    c.ring(32, 32, r - (3 - f * 0.6), r, GOLD[3] if f < 2 else GOLD[2])
    c.ring(32, 32, r - 1, r, GOLD[4] if f < 3 else GOLD[3])
    fr.append(c.img())
save('ring', sheet(fr))

# ── 차지샷 (금빛 혜성) 4프레임 ──
fr = []
for f in range(4):
    c = C(40, 60)
    for y in range(24, 60):
        t = (y - 24) / 36
        ww = 13 * (1 - t) ** 1.1 * (0.85 + 0.15 * math.sin(y * 0.9 + f * 1.6))
        if ww >= 0.5:
            c.rect(int(20 - ww), y, max(1, int(ww * 2)), 1, GOLD[1] if t > 0.6 else GOLD[2])
            if t < 0.6:
                c.rect(int(20 - ww * 0.45), y, max(1, int(ww * 0.9)), 1, GOLD[3])
    c.ell(20, 20, 15, 16, GOLD[2])
    c.ell(20, 20, 12, 13, GOLD[3])
    c.ell(20, 19, 7.5, 8.5, GOLD[4])
    for k in range(4):
        a = k / 4 * math.tau + f * 0.4
        c.line(20 + math.cos(a) * 12, 20 + math.sin(a) * 12, 20 + math.cos(a) * 19, 20 + math.sin(a) * 19, GOLD[4])
    fr.append(c.img())
save('charge', sheet(fr))
# 차지 중 모이는 구슬 (고나 머리 위) 4프레임
fr = []
for f in range(4):
    c = C(24, 24)
    r = 4 + f * 1.6
    c.ell(12, 12, r + 1, r + 1, GOLD[2])
    c.ell(12, 12, r, r, GOLD[3])
    c.ell(12, 11, r * 0.5, r * 0.5, GOLD[4])
    fr.append(c.img())
save('charge-orb', sheet(fr))

# ── 동료 탄 ──
# 엄마 하트(플레이어용: 밝은 분홍 + 흰 테두리, 어두운 외곽선 없음)
HEART = ['..XX.XX..', '.XPPXPPX.', 'XPWPPPPPX', 'XPPPPPPPX', '.XPPPPPX.', '..XPPPX..', '...XPX...', '....X....']
fr = []
for f in range(2):
    c = C(11, 10)
    cm = {'X': PINK[3] if f == 0 else PINK[4], 'P': PINK[2] if f == 0 else PINK[3], 'W': PINK[4]}
    for y, r in enumerate(HEART):
        for x, ch in enumerate(r):
            if ch in cm:
                c.px(x + 1, y + 1, cm[ch])
    fr.append(c.img())
save('heart-p', sheet(fr))
# 이모 별빛 유도탄 (금색 별 + 꼬리) 2프레임
fr = []
for f in range(2):
    c = C(16, 16)
    pts = []
    for k in range(10):
        a = -math.pi / 2 + k * math.pi / 5 + f * 0.31
        r = 7 if k % 2 == 0 else 3.2
        pts.append((8 + math.cos(a) * r, 8 + math.sin(a) * r))
    c.poly(pts, GOLD[3])
    c.ell(8, 8, 2.2, 2.2, GOLD[4])
    fr.append(c.img())
save('star-p', sheet(fr))
# 삼촌 전기탄 2프레임
fr = []
for f in range(2):
    c = C(10, 18)
    zz = [(5, 0), (8, 5), (3, 9), (7, 13), (5, 17)] if f == 0 else [(5, 0), (2, 5), (7, 9), (3, 13), (5, 17)]
    for (x0, y0), (x1, y1) in zip(zz, zz[1:]):
        c.line(x0, y0, x1, y1, LIME[3], 2)
    for (x0, y0), (x1, y1) in zip(zz, zz[1:]):
        c.line(x0, y0, x1, y1, LIME[4], 1)
    fr.append(c.img())
save('elec', sheet(fr))
# 할머니 물약 병
c = C(12, 14)
c.ell(6, 9, 5, 4.5, LIME[2])
c.ell(6, 9, 3.5, 3, LIME[3])
c.rect(4, 1, 4, 4, hx('#c8d8e8'))
c.rect(4, 0, 4, 2, hx('#8a5a2a'))
c.px(4, 8, LIME[4])
c.outline(hx('#14281a'))
save('potion', c.img())
# 할아버지 은빛 창
c = C(6, 24)
c.poly([(3, 0), (5.5, 7), (3, 9), (0.5, 7)], STEEL[3])
c.rect(2, 7, 2, 15, hx('#c8a050'))
c.rect(1, 8, 4, 2, GOLD[2])
c.px(3, 2, STEEL[4])
save('lance', c.img())
# 메가 미사일 2프레임 (삼촌 발명품)
fr = []
for f in range(2):
    c = C(8, 20)
    c.ell(4, 6, 3, 6, STEEL[3])
    c.rect(2, 6, 4, 6, STEEL[2])
    c.poly([(0, 12), (2, 9), (2, 13)], hx('#d02838'))
    c.poly([(8, 12), (6, 9), (6, 13)], hx('#d02838'))
    c.ell(4, 15 + f, 2, 3 + f, ORANGE[3])
    c.ell(4, 15, 1, 1.5, ORANGE[4])
    fr.append(c.img())
save('missile', sheet(fr))

# ── 필살기 이펙트 ──
# 엄마: 하트 마법진 (2프레임 회전)
fr = []
for f in range(2):
    c = C(112, 112)
    m = 56
    c.ring(m, m, 50, 53, PINK[2])
    c.ring(m, m, 47, 48, PINK[3])
    c.ring(m, m, 33, 35, PINK[2])
    for k in range(12):
        a = k / 12 * math.tau + f * math.tau / 24
        x, y = m + math.cos(a) * 41, m + math.sin(a) * 41
        for yy, r in enumerate(HEART):
            for xx, ch in enumerate(r):
                if ch != '.':
                    c.px(int(x) - 4 + xx, int(y) - 4 + yy, PINK[3] if ch == 'X' else PINK[4])
    # 별 다각형(육망성)
    for k in range(6):
        a0 = k / 6 * math.tau + f * 0.12
        a1 = (k + 2) / 6 * math.tau + f * 0.12
        c.line(m + math.cos(a0) * 33, m + math.sin(a0) * 33, m + math.cos(a1) * 33, m + math.sin(a1) * 33, PINK[3])
    fr.append(c.img())
save('sp-circle', sheet(fr))
# 아빠: 증기 레이저 몸통 조각 (세로 반복, 4프레임)
fr = []
for f in range(4):
    c = C(56, 32)
    for y in range(32):
        wob = math.sin((y + f * 8) * 0.39) * 2.5
        c.rect(int(4 + wob), y, int(48 - wob * 2), 1, CY[1])
        c.rect(int(9 + wob * 0.6), y, int(38 - wob * 1.2), 1, CY[2])
        c.rect(int(16), y, 24, 1, CY[3])
        c.rect(int(22), y, 12, 1, CY[4])
    for k in range(5):
        y = (k * 7 + f * 8) % 32
        c.rect(1, y, 3, 2, hx('#e8f0f8'))
        c.rect(52, (y + 13) % 32, 3, 2, hx('#e8f0f8'))
    fr.append(c.img())
save('sp-steam', sheet(fr))
# 증기 구름 3프레임
fr = []
for f in range(3):
    c = C(32, 32)
    for (dx, dy, r) in [(-6, 2, 8), (6, 3, 7), (0, -4, 9), (-2, 6, 7)]:
        rr = r * (0.7 + f * 0.2)
        c.ell(16 + dx * (1 + f * 0.2), 16 + dy * (1 + f * 0.2), rr, rr, hx('#c8d4e0') if f < 2 else hx('#9aa8b8'))
    for (dx, dy, r) in [(-5, 0, 5), (4, -3, 5)]:
        c.ell(15 + dx, 14 + dy, r * (0.7 + f * 0.2), r * (0.7 + f * 0.2), hx('#f4f8fc') if f < 2 else hx('#c8d4e0'))
    fr.append(c.img())
save('steam-puff', sheet(fr))
# 할머니: 황금 치유 오라 4프레임
fr = []
for f in range(4):
    c = C(80, 80)
    r = 22 + f * 5
    c.ring(40, 40, r - 2, r, GOLD[3] if f < 3 else GOLD[2])
    c.ring(40, 40, r - 9, r - 8, GOLD[2])
    for k in range(8):
        a = k / 8 * math.tau + f * 0.2
        x, y = 40 + math.cos(a) * (r - 4), 40 + math.sin(a) * (r - 4)
        c.rect(int(x) - 1, int(y) - 3, 2, 6, GOLD[4])
        c.rect(int(x) - 3, int(y) - 1, 6, 2, GOLD[4])
    fr.append(c.img())
save('sp-aura', sheet(fr))
# 할아버지: 가디언 실드 (반원 방패벽) 2프레임
fr = []
for f in range(2):
    c = C(120, 64)
    c.ring(60, 62, 52, 58, CY[2] if f == 0 else CY[3], sq=1.0)
    c.ring(60, 62, 49, 51, CY[3], sq=1.0)
    c.ring(60, 62, 56, 57, CY[4], sq=1.0)
    # 육각 무늬
    for k in range(9):
        a = math.pi + (k + 0.5) / 9 * math.pi
        x, y = 60 + math.cos(a) * 53.5, 62 + math.sin(a) * 53.5
        c.ell(x, y, 2.2, 2.2, GOLD[3] if (k + f) % 2 else CY[4])
    c.a[60:, :] = 0
    fr.append(c.img())
save('sp-dome', sheet(fr))
print('done')
