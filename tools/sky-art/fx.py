import random
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from kit import *

FONT = '/home/user/-GONA-s-Game-Paradise/node_modules/galmuri/dist/Galmuri11.ttf'
FONT9 = '/home/user/-GONA-s-Game-Paradise/node_modules/galmuri/dist/Galmuri9.ttf'

def px_map(rows, pal):
    h, w = len(rows), max(len(r) for r in rows)
    im = Image.new('RGBA', (w, h)); a = im.load()
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c in pal: a[x, y] = pal[c]
    return im

P = {'w': hx('#ffffff'), 'y': hx('#ffe85a'), 'Y': hx('#ffb02c'), 'c': hx('#58e0ff'), 'C': hx('#1c8ae0'), 'o': hx('#0c2a6c'),
     'r': hx('#ff2a4a'), 'R': hx('#b0102c'), 'k': hx('#4a0820'), 'p': hx('#ff7ac8'), 'P': hx('#a02890'), 'g': hx('#a8ff7a'), 'G': hx('#2a9a3a')}

# 플레이어 탄: 청록·흰·노랑의 길쭉한 별사탕 (적 탄과 색·모양 분리)
STAR_CANDY = px_map(['...c...', '..cwc..', '.cwywc.', 'cwywywc', '.cwywc.', '..cwc..', '...c...'], P)
BOLT = px_map(['.c.', 'cwc', 'cwc', 'cyc', 'cyc', '.y.'], P)                       # LV1~2 직선 별사탕 꼬리
FEATHER = px_map(['..c..', '.cwc.', '.cwc.', 'cwyc.', 'cyy..', '.y...'], P)           # LV3~ 날개칼
# 적 탄: 빨강/마젠타 둥근 구슬(흰 코어 + 어두운 외곽) / 뾰족 / 레이저
ORB = px_map(['..kkk..', '.krrrk.', 'krrwrrk', 'krwwwrk', 'krrwrrk', '.krrrk.', '..kkk..'], P)
SHARD = px_map(['..k..', '.kpk.', 'kpwpk', 'kpwpk', '.kpk.', '.kPk.', '..k..'], P)
BIGORB = px_map(['...kkkk...', '..krrrrk..', '.krrwwrrk.', 'krrwwwwrrk', 'krwwwwwwrk', 'krrwwwwrrk', '.krrwwrrk.', '..krrrrk..', '...kkkk...'], P)

def crescent(w=64, h=34):
    """차지샷 '응애파': 익룡 날개 모양 초승달 충격파"""
    s = Spr(w, h)
    m = Image.new('L', (w, h), 0); d = ImageDraw.Draw(m)
    d.ellipse((0, 4, w - 1, h * 1.7), fill=255); d.ellipse((6, 12, w - 7, h * 1.9), fill=0)
    ramp = [hx(c) for c in ('#0c3a8c', '#1c78d8', '#58c8ff', '#b8f0ff', '#ffffff')]
    s.mask_fill(np.array(m) > 0, ramp, light=(0, -1), strength=1.3)
    for x in (4, w - 5): s.px(x, 6, hx('#ffffff'))
    return s.img()

def beam(w=14, h=120):
    s = Spr(w, h)
    s.rect(0, 0, w, h, [hx(c) for c in ('#0c3a8c', '#1c78d8', '#58c8ff', '#b8f0ff', '#ffffff')], light=(0, 0), flat=None)
    s.rect(w // 2 - 2, 0, 4, h, [hx('#ffffff')] * 5, flat=4)
    return s.img()

def boom(r, seed, stage=1.0):
    """굵은 불덩이 + 어두운 연기 덩어리 폭발 (stage 0~1: 불꽃 → 연기)"""
    rnd = random.Random(seed)
    S = r * 2 + 8
    s = Spr(S, S)
    c = S // 2
    smoke = [hx(c_) for c_ in ('#1a1018', '#3a2028', '#5e3030', '#8a4a3c', '#b8745a')]
    fire = [hx(c_) for c_ in ('#7a1010', '#c03010', '#f06a14', '#ffb42c', '#fff0a0')]
    core = [hx(c_) for c_ in ('#f06a14', '#ffb42c', '#ffe060', '#fff4b0', '#ffffff')]
    blobs = [(rnd.uniform(-r * .55, r * .55), rnd.uniform(-r * .55, r * .55), rnd.uniform(r * .38, r * .62)) for _ in range(7)]
    k_s = 0.5 + 0.5 * stage
    for ox, oy, rr in blobs:
        s.ellipse(c + ox * 1.15, c + oy * 1.15, rr * (0.85 + 0.3 * stage), rr * (0.85 + 0.3 * stage), smoke, light=(-0.5, -0.8))
    f = 1 - stage * 0.55
    for ox, oy, rr in blobs[:5]:
        s.ellipse(c + ox * .9, c + oy * .9, rr * f * 0.85, rr * f * 0.85, fire, light=(-0.3, -0.9), strength=1.2)
    s.ellipse(c, c, r * 0.42 * f, r * 0.42 * f, core, light=(-0.2, -0.9), strength=1.0)
    for _ in range(8):
        a = rnd.uniform(0, 6.28); d = rnd.uniform(r * .75, r * 1.0)
        s.px(c + np.cos(a) * d, c + np.sin(a) * d, hx('#ffe060'))
    s.outline(hx('#2a0c10'))
    return s.img()

def sparkle_star():
    return px_map(['..c..', '..c..', 'cwwwc', '..c..', '..c..'], P)

def text(d, xy, s, size=11, fill=(255, 255, 255), font=None, shadow=(26, 18, 38), anchor='la'):
    f = ImageFont.truetype(font or FONT, size)
    x, y = xy
    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1)):
        d.text((x + dx, y + dy), s, font=f, fill=shadow, anchor=anchor)
    d.text((x, y), s, font=f, fill=fill, anchor=anchor)

GOLD = (232, 181, 60); GOLD_D = (122, 74, 20); GOLD_L = (255, 240, 160)
NAVY = (14, 22, 52); NAVY_L = (28, 44, 92)

def panel(d, box, title=None):
    x0, y0, x1, y1 = box
    d.rectangle(box, fill=NAVY)
    d.rectangle((x0 + 1, y0 + 1, x1 - 1, y1 - 1), outline=GOLD_D)
    d.rectangle((x0, y0, x1, y1), outline=GOLD)
    d.line((x0 + 1, y0 + 1, x1 - 1, y0 + 1), fill=NAVY_L)
    for (x, y) in ((x0 + 2, y0 + 2), (x1 - 2, y0 + 2), (x0 + 2, y1 - 2), (x1 - 2, y1 - 2)): d.point((x, y), fill=GOLD_L)
    if title:
        text(d, (x0 + 5, y0 + 2), title, 9, GOLD, FONT9)

def hud(img, score=52802, hp=5, hp_max=5, bombs=2, lv=3, charge=0.6, boss=None, combo=None):
    d = ImageDraw.Draw(img)
    # 좌상단: 점수 패널 + 체력 칸
    panel(d, (3, 3, 112, 33), 'SCORE')
    text(d, (108, 11), f'{score:08d}', 11, GOLD_L, FONT, anchor='ra')
    for i in range(hp_max):
        c = (240, 90, 80) if i < hp else (60, 40, 70)
        d.rectangle((8 + i * 14, 24, 19 + i * 14, 28), fill=c, outline=(26, 18, 38))
        if i < hp: d.line((9 + i * 14, 25, 17 + i * 14, 25), fill=(255, 170, 150))
    # 우상단: 폭탄 + 무기 레벨
    panel(d, (156, 3, 267, 33), 'BOMB')
    for i in range(bombs):
        ic = Image.open('/home/user/-GONA-s-Game-Paradise/public/assets/sky/icon-bomb.png').convert('RGBA')
        img.paste(ic, (161 + i * 12, 14), ic)
    text(d, (213, 13), f'LV{lv}', 11, (255, 232, 90), FONT)
    for i in range(4):
        d.rectangle((234 + i * 8, 17, 239 + i * 8, 24), fill=(88, 224, 255) if i < lv else (40, 56, 100), outline=(26, 18, 38))
    if combo:
        text(d, (135, 38), f'{combo} HIT!', 11, (255, 160, 200), FONT, anchor='ma')
    if boss:
        name, f = boss
        panel(d, (22, 40, 248, 58))
        text(d, (28, 41), name, 9, (255, 170, 190), FONT9)
        d.rectangle((28, 51, 242, 55), fill=(40, 10, 30))
        for seg in range(3):
            x0 = 28 + seg * 72; x1 = x0 + 69
            fill = min(1, max(0, f * 3 - seg))
            d.rectangle((x0, 51, x1, 55), fill=(60, 20, 40))
            if fill > 0: d.rectangle((x0, 51, x0 + int(69 * fill), 55), fill=(240, 70, 100))
    # 하단 컨트롤 덱 (플레이 영역과 분리: y 440~480)
    d.rectangle((0, 440, 270, 480), fill=(18, 12, 40)); d.line((0, 440, 270, 440), fill=GOLD); d.line((0, 441, 270, 441), fill=GOLD_D)
    for x in range(6, 270, 24): d.point((x, 444), fill=GOLD_L)
    panel(d, (8, 446, 84, 474)); text(d, (46, 453), 'CHARGE', 11, (255, 232, 90), FONT, anchor='ma')
    d.rectangle((14, 468, 78, 471), fill=(40, 56, 100)); d.rectangle((14, 468, 14 + int(64 * charge), 471), fill=(88, 224, 255))
    panel(d, (186, 446, 262, 474)); text(d, (224, 453), 'BOMB', 11, (255, 140, 170), FONT, anchor='ma')
    d.rectangle((96, 452, 174, 468), outline=GOLD_D); text(d, (135, 454), 'MARION' if False else 'MOM  Lv1', 9, GOLD, FONT9, anchor='ma')
    return img
