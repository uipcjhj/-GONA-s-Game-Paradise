import os, sys, random
sys.path.insert(0, os.path.dirname(__file__))
from sheet import *

def place(base, im, cx, cy):
    base.alpha_composite(im, (int(cx - im.width // 2), int(cy - im.height // 2))) if 0 <= cx - im.width // 2 and cx + im.width // 2 < base.width and 0 <= cy - im.height // 2 and cy + im.height // 2 < base.height else base.paste(im, (int(cx - im.width // 2), int(cy - im.height // 2)), im)

def bullets_fan(base, ox, oy, n, spread, spd_off, img):
    for i in range(n):
        a = math.pi / 2 + (i - (n - 1) / 2) * spread
        d = spd_off
        place(base, img, ox + math.cos(a) * d, oy + math.sin(a) * d)

def battle_mock():
    W, H = 270, 480
    L = bg.layers()
    im = bg.composite(L, 210).copy()
    for y in range(0, 440): pass
    im = im.crop((0, 0, W, H))
    rnd = random.Random(4)
    # 적 편대: 드론 V자 + 건십 2대
    for i, (x, y) in enumerate(((135, 62), (105, 80), (165, 80), (75, 98), (195, 98))):
        place(im, foes.drone(i % 2), x, y)
    place(im, foes.gunship(0), 56, 150); place(im, foes.gunship(1), 214, 168)
    # 적 탄(붉은 구슬) — 건십에서 부채꼴, 드론에서 직선
    bullets_fan(im, 56, 172, 7, 0.26, 52, ORB); bullets_fan(im, 56, 172, 7, 0.26, 92, ORB)
    bullets_fan(im, 214, 190, 5, 0.3, 40, ORB); bullets_fan(im, 214, 190, 5, 0.3, 76, ORB)
    for x in (105, 165): 
        for dy in (116, 160): place(im, ORB, x, dy)
    place(im, BIGORB, 135, 130)
    # 폭발
    place(im, boom(14, 1, 0.2), 120, 214); place(im, boom(22, 2, 0.55), 196, 252); place(im, boom(10, 3, 0.9), 40, 232)
    # 내 탄(별사탕, 청록) + 응애파
    for dx in (-10, 10): 
        for yy in range(300, 190, -22): place(im, STAR_CANDY, 135 + dx + (0 if yy > 250 else (yy - 250) // 12 * (1 if dx > 0 else -1)), yy)
    place(im, crescent(), 135, 210)
    # 아이템 반짝
    for (x, y) in ((100, 250), (170, 280), (60, 300), (230, 320)): place(im, fx.sparkle_star(), x, y)
    # 고나 + 동료(엄마)
    place(im, crop(G.make('shoot', 1, 0)), 135, 372)
    place(im, crop(sprite('mom', MOM, 'fly', 1, 1)), 198, 384)
    d = ImageDraw.Draw(im); text(d, (135, 330), 'NICE!', 11, (255, 240, 120), FONT9, anchor='ma')
    hud(im, 52802, 4, 5, 2, 3, 0.6, combo=12)
    return im

def boss_mock():
    W, H = 270, 480
    L = bg.layers(); im = bg.composite(L, 60).copy().crop((0, 0, W, H))
    boss = foes.kiss_boss(2, 1); place(im, boss, 135, 118)
    # 보스 탄막: 원형 + 부채꼴
    for i in range(18):
        a = i * math.pi * 2 / 18 + 0.2; place(im, ORB, 135 + math.cos(a) * 70, 150 + math.sin(a) * 52)
    for i in range(14):
        a = math.pi / 2 + (i - 6.5) * 0.17; place(im, BIGORB if i % 7 == 3 else ORB, 135 + math.cos(a) * 150, 175 + math.sin(a) * 150)
    # 측면 드론 호위
    place(im, foes.drone(0), 30, 214); place(im, foes.drone(1), 240, 200)
    place(im, boom(16, 7, 0.3), 70, 150)
    # 플레이어
    for dx in (-8, 8):
        for yy in range(330, 230, -22): place(im, STAR_CANDY, 135 + dx, yy)
    place(im, crop(G.make('fly', 1, 0)), 135, 380)
    place(im, crop(sprite('imo', IMO, 'shoot', 0, 1)), 206, 388)
    d = ImageDraw.Draw(im)
    # WARNING 띠 + 보스 이름은 HUD에서
    d.rectangle((0, 262, 270, 282), fill=(150, 20, 40)); d.line((0, 262, 270, 262), fill=GOLD); d.line((0, 282, 270, 282), fill=GOLD)
    text(d, (135, 265), 'WARNING!  LOVE CRUSHER', 11, (255, 235, 140), FONT9, anchor='ma')
    hud(im, 128440, 3, 5, 1, 4, 0.9, boss=('LOVE CRUSHER · 2단계', 0.62))
    return im

def select_mock(sel=1):
    W, H = 270, 480
    im = Image.new('RGBA', (W, H), (26, 14, 56, 255)); d = ImageDraw.Draw(im)
    for r in range(0, 480, 34):
        for c in range(-40, 270, 90):
            text(d, (c + (r // 34 % 2) * 45, r), 'GONA', 30, (44, 24, 90), FONT, shadow=(30, 16, 64))
    key, spec, name, job, skill, line, col = CH[sel]
    text(d, (135, 6), 'SELECT', 22, (255, 232, 120), FONT, anchor='ma'); text(d, (135, 32), '함께 출격할 가족을 고르세요', 10, (230, 220, 255), FONT9, anchor='ma')
    d.rectangle((8, 50, 262, 300), fill=(16, 10, 36), outline=GOLD)
    sp = speed_bg(252, 248, col, sel); im.paste(sp, (9, 51))
    ill = crop(illus(key, spec, 3)); sc = min(1.0, 236 / ill.width, 236 / ill.height)
    if sc < 1: ill = ill.resize((int(ill.width * sc), int(ill.height * sc)), Image.NEAREST)
    im.paste(ill, (135 - ill.width // 2, 296 - ill.height), ill)
    text(d, (16, 56), '1P', 12, GOLD_L, FONT)
    panel(d, (8, 306, 262, 372)); text(d, (16, 311), name, 18, (255, 255, 255), FONT); text(d, (16, 334), job, 11, col, FONT9)
    text(d, (254, 315), '필살기', 9, GOLD, FONT9, anchor='ra'); text(d, (254, 330), skill, 10, (255, 240, 170), FONT, anchor='ra')
    text(d, (16, 352), '“' + line + '”', 10, (210, 200, 255), FONT)
    # 로스터 7칸
    for i, c in enumerate(CH):
        x0 = 8 + i * 36
        d.rectangle((x0, 382, x0 + 33, 436), fill=(20, 14, 44), outline=(90, 70, 140) if i != sel else GOLD)
        s = crop(sprite(c[0], c[1], 'fly', 0, 1)); sc2 = min(30 / s.width, 46 / s.height)
        s = s.resize((max(1, int(s.width * sc2)), max(1, int(s.height * sc2))), Image.NEAREST); im.paste(s, (x0 + 17 - s.width // 2, 434 - s.height), s)
        if i == sel:
            d.line((x0 - 2, 380, x0 + 8, 380), fill=GOLD_L, width=2); d.line((x0 - 2, 380, x0 - 2, 390), fill=GOLD_L, width=2)
            d.line((x0 + 35, 380, x0 + 25, 380), fill=GOLD_L, width=2); d.line((x0 + 35, 380, x0 + 35, 390), fill=GOLD_L, width=2)
            text(d, (x0 + 17, 438), '1P', 9, GOLD_L, FONT9, anchor='ma')
    d.rectangle((0, 452, 270, 480), fill=(18, 12, 40)); d.line((0, 452, 270, 452), fill=GOLD)
    panel(d, (10, 456, 120, 476)); text(d, (65, 459), '출격!', 12, (255, 232, 90), FONT, anchor='ma')
    panel(d, (150, 456, 260, 476)); text(d, (205, 459), '월드맵', 12, (210, 210, 255), FONT, anchor='ma')
    return im

def foes_sheet():
    items = [('연금 드론 (안경잽이)', foes.drone(0, 1), 'glasses'), ('증기 건십 (배불뚝이)', foes.gunship(0, 1), 'uncle'), ('킁카 캐논 (냄새괴물 · 중간보스)', foes.sniff_boss(0, 1), 'sniff'),
             ('러브 크러셔 1단계 (뽀뽀괴물)', foes.kiss_boss(1, 0, 1), 'kiss'), ('2단계 · 장갑 파열', foes.kiss_boss(2, 0, 1), None), ('3단계 · 날개 변신 + 발광', foes.kiss_boss(3, 0, 1), None)]
    W, H = 1280, 760
    im = Image.new('RGBA', (W, H), (22, 14, 44, 255)); d = ImageDraw.Draw(im)
    text(d, (24, 14), '적·보스 전면 리디자인 (원본 픽셀 미사용) — 기존 레퍼런스는 점선 칸', 20, (255, 240, 170), FONT)
    x, y = 24, 60
    for lab, img, ref in items:
        big = img.resize((img.width * 2, img.height * 2), Image.NEAREST)
        if x + big.width > W - 20: x, y = 24, y + 330
        if ref:
            ro = Image.open(f'/tmp/claude-0/s/orig/{ref}.png').convert('RGBA'); n = {'glasses': 3, 'uncle': 5, 'kiss': 5, 'sniff': 5}[ref]
            r0 = ro.crop((0, 0, ro.width // n, ro.height)); r0 = r0.resize((r0.width * 2, r0.height * 2), Image.NEAREST)
            im.paste(r0, (x, y + 20), r0); text(d, (x, y), '기존:', 10, (180, 170, 200), FONT)
            d.rectangle((x - 4, y + 16, x + r0.width + 4, y + 24 + r0.height), outline=(90, 70, 140))
        im.paste(big, (x, y + 100), big)
        text(d, (x, y + 104 + big.height), lab, 11, (255, 240, 200), FONT)
        x += max(big.width, 130) + 24
    return im

def bg_sheet():
    L = bg.layers(); names = [('sky', '① 하늘(노을)'), ('far', '② 먼 구름'), ('island', '③ 부유 요새·비행선'), ('mid', '④ 중간 구름'), ('near', '⑤ 근경 구름'), ('wisp', '⑥ 바람결')]
    W = 6 * 280 + 20; H = 560
    im = Image.new('RGBA', (W + 290, H), (22, 14, 44, 255)); d = ImageDraw.Draw(im)
    for i, (k, lab) in enumerate(names):
        base = Image.new('RGBA', (270, 480), (70, 70, 80, 255))
        for y in range(0, 480, 16):
            for x in range(0, 270, 16):
                if (x // 16 + y // 16) % 2: d.rectangle((0, 0, 0, 0), fill=None)
        chk = Image.new('RGBA', (270, 480), (60, 60, 70, 255)); cd = ImageDraw.Draw(chk)
        for y in range(0, 480, 16):
            for x in range(0, 270, 16):
                if (x // 16 + y // 16) % 2: cd.rectangle((x, y, x + 15, y + 15), fill=(80, 80, 92, 255))
        chk.alpha_composite(L[k]); im.paste(chk, (10 + i * 280, 40))
        text(d, (10 + i * 280, 12), lab, 12, (255, 240, 170), FONT)
    comp = bg.composite(L, 140); im.paste(comp, (10 + 6 * 280, 40)); text(d, (10 + 6 * 280, 12), '합성 (패럴랙스 속도 0 / .25 / .5 / .8 / 1.3 / 2.2)', 10, (255, 240, 170), FONT)
    return im

def overview():
    W, H = 1500, 760
    im = Image.new('RGBA', (W, H), (22, 14, 44, 255)); d = ImageDraw.Draw(im)
    text(d, (24, 12), '캐릭터 7명 한눈에 보기 — 선택 화면 일러스트(위) / 실제 게임 스프라이트 ×3(아래)', 20, (255, 240, 170), FONT)
    for i, c in enumerate(CH):
        x = 14 + i * 212
        d.rectangle((x, 56, x + 204, 470), fill=(30, 20, 60), outline=GOLD)
        ill = crop(illus(c[0], c[1], 3)); sc = min(1.0, 192 / ill.width, 330 / ill.height)
        if sc < 1: ill = ill.resize((int(ill.width * sc), int(ill.height * sc)), Image.NEAREST)
        sp = speed_bg(202, 340, c[6], i); im.paste(sp, (x + 1, 57))
        im.paste(ill, (x + 102 - ill.width // 2, 400 - ill.height), ill)
        text(d, (x + 102, 410), c[2], 16, (255, 255, 255), FONT, anchor='ma'); text(d, (x + 102, 436), c[3], 11, c[6], FONT, anchor='ma')
        s = crop(sprite(c[0], c[1], 'fly', 0, 1)); s = s.resize((s.width * 3, s.height * 3), Image.NEAREST)
        if s.width > 200: s = s.resize((200, int(s.height * 200 / s.width)), Image.NEAREST)
        d.rectangle((x, 480, x + 204, 740), fill=(30, 22, 62), outline=(90, 70, 140)); im.paste(s, (x + 102 - s.width // 2, 735 - s.height), s)
    return im

if __name__ == '__main__':
    os.makedirs(OUTD, exist_ok=True)
    b = battle_mock(); b.convert('RGB').save(f'{OUTD}/battle-270x480-1x.png'); b.resize((810, 1440), Image.NEAREST).convert('RGB').save(f'{OUTD}/12-battle-mockup.png')
    bm = boss_mock(); bm.resize((810, 1440), Image.NEAREST).convert('RGB').save(f'{OUTD}/13-boss-mockup.png')
    sm = select_mock(1); sm.resize((810, 1440), Image.NEAREST).convert('RGB').save(f'{OUTD}/11-select-mockup.png')
    foes_sheet().convert('RGB').save(f'{OUTD}/09-foes-bosses.png'); bg_sheet().convert('RGB').save(f'{OUTD}/10-background-layers.png')
    overview().convert('RGB').save(f'{OUTD}/00-overview.png'); print('ok')
