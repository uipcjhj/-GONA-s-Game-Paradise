import random
import numpy as np
from PIL import Image
from kit import *

W, H = 270, 480

def band_sky():
    stops = ['#120d34', '#1c1450', '#2c1c68', '#46247c', '#6a2e88', '#8e3a90', '#b04a8c', '#c85a84']
    cols = [hx(c) for c in stops]
    cols = cols + cols[::-1]            # 위아래 대칭 → 세로로 이어 붙여도 이음새 없음
    im = np.zeros((H, W, 4), dtype=np.uint8)
    n = len(cols)
    for y in range(H):
        f = y / H * n
        i = int(f); frac = f - i
        for x in range(W):
            # 띠 경계 디더링
            c = cols[i % n] if frac + (BAYER[y % 4, x % 4] - 0.5) * 0.9 < 0.5 else cols[(i + 1) % n]
            im[y, x] = c
    return Image.fromarray(im, 'RGBA')

def clouds(ramp, count, seed, size=(40, 90), band=(0, H), flat_bottom=True):
    r = random.Random(seed)
    s = Spr(W, H)
    for _ in range(count):
        cx = r.randint(-10, W + 10); cy = r.randint(*band); w = r.randint(*size)
        # 클라우드: 여러 타원을 합쳐 하나의 마스크로 → 하나의 덩어리로 음영
        from PIL import ImageDraw
        m = Image.new('L', (W, H), 0); d = ImageDraw.Draw(m)
        for k in range(r.randint(4, 7)):
            ox = r.randint(-w, w); oy = -abs(r.randint(0, w // 3))
            rx = r.randint(w // 3, w // 2 + 6); ry = int(rx * r.uniform(0.55, 0.8))
            d.ellipse((cx + ox - rx, cy + oy - ry, cx + ox + rx, cy + oy + ry), fill=255)
        if flat_bottom:
            d.rectangle((0, cy + 6, W, H), fill=0)
        # 양끝 wrap(타일링): 위아래로 H 만큼 복제
        mk = np.array(m) > 0
        for off in (-H, 0, H):
            mm = np.roll(mk, off, axis=0) if off else mk
            s.mask_fill(mm & ~(s.solid() & False), ramp, light=(-0.5, -0.85), strength=1.1)
    return s.img()

def islands(seed=7):
    r = random.Random(seed)
    s = Spr(W, H)
    rock = [hx(c) for c in ('#1a1230', '#2a2050', '#3e3470', '#5a4c8c', '#8878b4')]
    grass = [hx(c) for c in ('#143a3c', '#1f5a50', '#2f8a5c', '#5cb870', '#a0e090')]
    spots = [(48, 90, 70), (196, 250, 84), (80, 400, 60)]
    for (cx, cy, w) in spots:
        # 바위 밑동(역삼각)
        pts = [(cx - w // 2, cy), (cx + w // 2, cy), (cx + w // 4, cy + w // 2), (cx + 4, cy + w * 0.78), (cx - w // 5, cy + w // 2 + 4)]
        s.poly(pts, rock, light=(-0.5, -0.8), strength=1.2)
        s.poly([(cx - w // 2, cy), (cx + w // 2, cy), (cx + w // 2 - 3, cy - 8), (cx - w // 2 + 3, cy - 10)], grass, light=(-0.5, -0.8))
        # 스팀펑크 탑 + 굴뚝
        tx = cx + r.randint(-w // 5, w // 5)
        s.rect(tx - 7, cy - 34, 14, 26, [hx(c) for c in ('#2a1a30', '#4e2c44', '#7a4458', '#b0705c', '#e0a880')], strength=1.0)
        s.poly([(tx - 9, cy - 34), (tx + 9, cy - 34), (tx, cy - 48)], [hx(c) for c in ('#3a1020', '#6a1c30', '#a03040', '#d85a50', '#ff9a78')])
        s.rect(tx + 8, cy - 40, 4, 12, RAMPS['slate']); s.rect(tx + 7, cy - 42, 6, 3, RAMPS['brass'])
        s.rect(tx - 2, cy - 26, 3, 4, RAMPS['yellow'], flat=3)
        # 매달린 사슬/톱니
        s.line((cx - w // 4, cy + 4), (cx - w // 4, cy + w // 3), RAMPS['steel'][1], 1)
    # 비행선 실루엣(멀리)
    ax, ay = 190, 120
    s.ellipse(ax, ay, 22, 7, [hx(c) for c in ('#241a48', '#382a68', '#523e88', '#7a62a8', '#a890c8')])
    s.rect(ax - 6, ay + 6, 12, 4, RAMPS['slate']); s.line((ax - 22, ay), (ax - 28, ay - 6), RAMPS['steel'][2], 1)
    return s.img()

def wisps(seed=3):
    r = random.Random(seed)
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); a = np.array(im)
    for _ in range(26):
        x = r.randint(0, W); y = r.randint(0, H); l = r.randint(14, 40)
        for i in range(l):
            if 0 <= x + i < W: a[y % H, x + i] = (255, 220, 230, 150 if i % 3 else 90)
    return Image.fromarray(a, 'RGBA')

CL_FAR = [hx(c) for c in ('#2e1858', '#4e2a78', '#7e3e8c', '#b85a98', '#f08ca8')]
CL_MID = [hx(c) for c in ('#3a2468', '#6a3a8c', '#a85aa0', '#e888b0', '#ffc4c0')]
CL_NEAR_PINK = [hx(c) for c in ('#4c2c7c', '#8a4a98', '#d070a8', '#ff9cb4', '#fff0e0')]
CL_NEAR_CYAN = [hx(c) for c in ('#1c3c70', '#2c6aa0', '#58b0c8', '#a4e4e0', '#f4ffff')]

def layers():
    L = {}
    L['sky'] = band_sky()
    L['far'] = clouds(CL_FAR, 5, 1, (60, 100), (40, 460))
    L['island'] = islands()
    L['mid'] = clouds(CL_MID, 4, 5, (50, 90), (30, 470))
    L['near'] = clouds(CL_NEAR_CYAN, 2, 11, (60, 100), (60, 460))
    near_pink = clouds(CL_NEAR_PINK, 2, 21, (60, 100), (20, 440))
    L['near'] = Image.alpha_composite(L['near'], near_pink)
    L['wisp'] = wisps()
    return L

def composite(L, scroll=0, order=('sky', 'far', 'island', 'mid', 'near', 'wisp'), speeds=(0.0, 0.25, 0.5, 0.8, 1.3, 2.2)):
    out = Image.new('RGBA', (W, H))
    for name, sp in zip(order, speeds):
        off = int(scroll * sp) % H
        a = np.array(L[name]); a = np.roll(a, off, axis=0)
        out = Image.alpha_composite(out, Image.fromarray(a, 'RGBA'))
    return out

if __name__ == '__main__':
    L = layers(); c = composite(L, 140)
    sheet = Image.new('RGBA', (W * 4 + 30, H), (20, 20, 30, 255))
    for i, k in enumerate(('sky', 'island', 'near')):
        sheet.paste(L[k], (i * (W + 10), 0))
    sheet.paste(c, (3 * (W + 10), 0))
    sheet.save('/tmp/claude-0/s/bg_test.png')
