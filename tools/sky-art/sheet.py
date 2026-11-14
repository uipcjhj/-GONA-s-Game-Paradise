import os, sys, math
sys.path.insert(0, os.path.dirname(__file__))
from PIL import Image, ImageDraw, ImageFont
import numpy as np
from humans2 import *
import gona as G
import foes, bg, fx
from fx import text, FONT, FONT9, panel, hud, GOLD, GOLD_L, STAR_CANDY, ORB, BIGORB, BOLT, FEATHER, P as FXP, px_map, boom, crescent

SRC = '/home/user/uipcjhj/gona'
OUTD = '/home/user/-GONA-s-Game-Paradise/docs/screenshots/sky-proof'
os.makedirs(OUTD, exist_ok=True)

def ref_img(key):
    if key == 'gona':
        im = Image.open(f'{SRC}/public/assets/character/dino.png').convert('RGBA'); return im.crop((7 * 33, 0, 7 * 33 + 33, 34))
    return Image.open(f'{SRC}/art-src/ending/sprite-sheet-v3/frames/{key}/idle_00.png').convert('RGBA')

ILLUS = {
    'mom': dict(tilt=6, head=4, aL=(-75, -20), aR=(150, 12), lL=(-16, -26), lR=(12, -10), expr='grin'),
    'dad': dict(tilt=-6, head=-4, aL=(-50, -40), aR=(128, 24), lL=(-12, -6), lR=(14, 8), expr='shout'),
    'imo': dict(tilt=8, head=6, aL=(70, -30), aR=(112, 8), lL=(-8, -6), lR=(10, 4), expr='grin'),
    'halmeoni': dict(tilt=-4, head=-2, aL=(-40, -20), aR=(160, 8), lL=(-10, -6), lR=(8, 4), expr='shout'),
    'samchon': dict(tilt=4, head=4, aL=(-60, -20), aR=(112, 8), lL=(-10, -6), lR=(10, 6), expr='shout'),
    'halabeoji': dict(tilt=0, head=0, aL=(-30, -10), aR=(100, 8), lL=(0, 0), lR=(0, 0), expr='grin', shooting=True),
}
CH = [
    # key, spec, 이름, 직업, 필살기, 대사, 대표색
    ('gona', None, '고나', '아기 익룡 전사', '고나의 대폭발', '아부부!', (120, 210, 70)),
    ('mom', MOM, '엄마', '하트 마녀', '엄마의 폭풍 뽀뽀!', '우리 고나 건드리지 마!', (210, 70, 150)),
    ('dad', DAD, '아빠', '증기 비행 전사', '아빠의 슈퍼 펀치!', '고나야, 아빠만 믿어!', (70, 130, 230)),
    ('imo', IMO, '이모', '마법 포수', '조카 사랑 무한 폭격!', '우리 고나한테는 이모가 최고지!', (50, 200, 190)),
    ('halmeoni', HAL, '할머니', '폭주 연금술사', '할머니의 밥 먹어라!', '고나 밥 먹어야 되니까 비켜라!', (70, 210, 120)),
    ('halabeoji', CAP, '할아버지', '비행선 함장', '할아버지의 철벽 방어!', '걱정 마라. 할아버지가 있다.', (70, 100, 200)),
    ('samchon', SAM, '삼촌', '천재 괴짜 발명가', '이론상 완벽한 무기!', '이론상 완벽한데… 왜 터지지?', (240, 195, 50)),
]

def sprite(key, spec, pose, t=0, k=1):
    if key == 'gona': return G.make(pose, k, t)
    p = dict(POSES[pose])
    if key == 'halabeoji':
        p['shooting'] = pose in ('shoot', 'charge'); p['aR'] = (100, 8) if pose == 'shoot' else p['aR']
    if key == 'imo' and pose in ('fly', 'bankL', 'bankR', 'charge', 'hurt', 'win'):
        p['aR'] = (118, 10) if pose != 'hurt' else p['aR']
    return render(spec, pose, k, t, pose=p)

def illus(key, spec, k=3):
    if key == 'gona': return G.make('shoot', k, 0)
    return render(spec, 'fly', k, 0, pose=dict(ILLUS[key]))

def crop(im):
    a = np.array(im); ys, xs = np.nonzero(a[..., 3] > 0)
    return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))

def speed_bg(w, h, col, seed=1):
    import random; r = random.Random(seed)
    im = Image.new('RGBA', (w, h), (18, 10, 40, 255)); d = ImageDraw.Draw(im)
    dark = tuple(int(c * 0.35) for c in col); mid = tuple(int(c * 0.7) for c in col)
    cx, cy = w * 0.62, h * 0.5
    for i in range(46):
        a = r.uniform(0, 6.28); L = max(w, h)
        a1, a2 = a - r.uniform(0.01, 0.05), a + r.uniform(0.01, 0.05)
        d.polygon([(cx, cy), (cx + math.cos(a1) * L, cy + math.sin(a1) * L), (cx + math.cos(a2) * L, cy + math.sin(a2) * L)], fill=dark if i % 2 else mid)
    return im

def cutin(key, spec, name, skill, line, col):
    k = 6
    full = sprite(key, spec, 'shoot', 0, k) if key != 'halabeoji' else sprite(key, spec, 'shoot', 0, 5)
    full = crop(full)
    W, H = 600, 300
    bgim = speed_bg(W, H, col)
    d = ImageDraw.Draw(bgim)
    d.polygon([(0, 210), (W, 170), (W, 300), (0, 300)], fill=(14, 8, 30))
    d.line([(0, 210), (W, 170)], fill=col, width=4)
    # 상반신 위주로 크게
    hh = min(full.height, 330)
    part = full.crop((0, 0, full.width, int(full.height * 0.62)))
    sc = min(1.0, 290 / part.height, 330 / part.width)
    part = part.resize((int(part.width * sc), int(part.height * sc)), Image.NEAREST)
    bgim.paste(part, (420 - part.width // 2, 300 - part.height + 6), part)
    d = ImageDraw.Draw(bgim)
    text(d, (20, 96), skill, 22, (255, 240, 150), FONT, shadow=(30, 10, 40))
    text(d, (22, 134), name, 16, col, FONT); text(d, (22, 160), '“' + line + '”', 11, (255, 255, 255), FONT)
    return bgim

def attack_row(key, col, spec):
    W, H = 4 * 200, 230
    im = Image.new('RGBA', (W, H), (40, 24, 80, 255)); d = ImageDraw.Draw(im)
    for i in range(4):
        d.rectangle((i * 200, 0, i * 200 + 199, H), outline=(90, 60, 140))
        pose = 'shoot' if i % 2 == 0 else 'fly'
        spr = crop(sprite(key, spec, pose, i, 2))
        im.paste(spr, (i * 200 + 100 - spr.width // 2, H - spr.height - 8), spr)
        # 탄(캐릭터 고유 형태): 위로 날아감
        yb = H - spr.height - 14 - i * 30
        for j in range(3):
            x = i * 200 + 100 + (j - 1) * 26; y = max(10, yb - j * 24)
            shot = SHOTS[key]
            sh = shot.resize((shot.width * 2, shot.height * 2), Image.NEAREST)
            im.paste(sh, (int(x - sh.width / 2) + (28 if key in ('imo', 'halabeoji') else 0), int(y)), sh)
        if i == 0:
            for sx, sy in ((i * 200 + 100, yb + 8),): pass
    return im

SHOTS = {
    'gona': STAR_CANDY, 'mom': px_map(['.oo.oo.', 'oPpoPpo', 'oPpppro', '.oppro.', '..opro.', '...oo..'], {**FXP, 'o': hx('#3a0a2a')}),
    'dad': px_map(['..o..', '.oYo.', 'oYwYo', 'oYwYo', 'orYro', '.orro', '..o..'], {**FXP, 'o': hx('#2a1208')}),
    'imo': px_map(['..c..', '.cwc.', 'cwwwc', '.cwc.', '..c..'], FXP),
    'halmeoni': px_map(['.ggg.', 'gGGGg', 'gGwGg', 'gGGGg', '.ggg.'], FXP),
    'halabeoji': px_map(['.o.', 'oYo', 'oYo', 'oyo', '.y.'], {**FXP, 'o': hx('#2a1208')}),
    'samchon': px_map(['..y..', '.yw..', '..yw.', '.yw..', '..y..'], FXP),
}

def char_page(i):
    key, spec, name, job, skill, line, col = CH[i]
    W, H = 1280, 900
    im = Image.new('RGBA', (W, H), (22, 14, 44, 255)); d = ImageDraw.Draw(im)
    text(d, (24, 14), f'{name} — {job}', 30, (255, 240, 170), FONT)
    # ① 레퍼런스
    d.rectangle((20, 70, 210, 400), outline=GOLD, fill=(34, 24, 66)); text(d, (30, 78), '① 기존 레퍼런스', 12, GOLD_L, FONT)
    r = ref_img(key); r = r.resize((r.width * 6, r.height * 6), Image.NEAREST); im.paste(r, (115 - r.width // 2, 120), r)
    text(d, (30, 372), '(참고용 · 게임에 쓰지 않음)', 10, (180, 170, 200), FONT)
    # ② 일러스트
    ill = crop(illus(key, spec, 4))
    d.rectangle((230, 70, 640, 520), outline=GOLD, fill=(0, 0, 0, 0)); bgim = speed_bg(410, 450, col, i); im.paste(bgim, (231, 71))
    d.rectangle((230, 70, 640, 520), outline=GOLD)
    sc = min(1.0, 400 / ill.width, 350 / ill.height)
    if sc < 1: ill = ill.resize((int(ill.width * sc), int(ill.height * sc)), Image.NEAREST)
    im.paste(ill, (435 - ill.width // 2, 436 - ill.height), ill)
    text(d, (240, 78), '② 선택 화면용 전신 일러스트', 12, GOLD_L, FONT)
    panel(d, (240, 440, 630, 512)); text(d, (250, 444), f'{name} / {job}', 16, (255, 255, 255), FONT); text(d, (250, 468), f'필살기: {skill}', 12, col, FONT); text(d, (250, 488), f'“{line}”', 12, (255, 240, 170), FONT)
    # ③ 스프라이트 8종 (2x)
    d.rectangle((660, 70, 1262, 520), outline=GOLD, fill=(30, 22, 62)); text(d, (670, 78), '③ 게임용 비행 스프라이트 (실제 크기 ×2)', 12, GOLD_L, FONT)
    poses = [('fly', 0, '기본 비행A'), ('fly', 1, '기본 비행B'), ('bankL', 0, '좌 기울기'), ('bankR', 0, '우 기울기'), ('shoot', 0, '공격'), ('charge', 0, '차지'), ('hurt', 0, '피격'), ('win', 0, '승리')]
    for n, (pn, t, lab) in enumerate(poses):
        spr = sprite(key, spec, pn, t, 1)
        cx = 660 + (n % 4) * 150 + 75; cy = 110 + (n // 4) * 205
        s2 = crop(spr); s2 = s2.resize((s2.width * 2, s2.height * 2), Image.NEAREST)
        if s2.width > 148 or s2.height > 190: s2 = s2.resize((min(148, s2.width), int(s2.height * min(148, s2.width) / s2.width)), Image.NEAREST)
        im.paste(s2, (cx - s2.width // 2, cy + 190 - s2.height), s2)
        text(d, (cx, cy + 192), lab, 10, (200, 190, 220), FONT, anchor='ma')
    # ④ 공격 애니메이션
    text(d, (24, 540), '④ 공격 애니메이션 예시 (발사 포즈 ↔ 비행 포즈 · 고유 탄 형태)', 12, GOLD_L, FONT)
    ar = attack_row(key, col, spec).resize((620, 175), Image.NEAREST); im.paste(ar, (24, 560))
    # ⑤ 필살기 컷인
    text(d, (670, 540), '⑤ 필살기 컷인', 12, GOLD_L, FONT)
    ci = cutin(key, spec, name, skill, line, col); im.paste(ci, (660, 560))
    d.rectangle((660, 560, 1260, 860), outline=GOLD)
    # 하단: 전투 화면 실제 크기 스프라이트 (270px 기준 비교)
    text(d, (24, 750), '⑥ 실제 크기(1배) 비교', 12, GOLD_L, FONT)
    bgc = bg.composite(bg.layers(), 90).crop((0, 100, 270, 240)); im.paste(bgc, (24, 770))
    spr = crop(sprite(key, spec, 'fly', 0, 1)); im.paste(spr, (24 + 135 - spr.width // 2, 770 + 70 - spr.height // 2), spr)
    return im

if __name__ == '__main__':
    for i, c in enumerate(CH):
        pg = char_page(i); pg.convert('RGB').save(f'{OUTD}/{i + 1:02d}-{c[0]}.png')
        print('saved', c[0])
