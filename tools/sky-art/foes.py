"""적·보스 전면 리디자인 (원본 몬스터 픽셀 미사용: 정체성 — 하트 뿔+큰 입술(뽀뽀괴물), 초록 몸+큰 코(냄새괴물), 큰 안경(안경잽이), 배불뚝이 — 만 참고)"""
from common import *

SMOKE = [hx(c) for c in ('#26262c', '#46464c', '#6e7a58', '#98a878', '#c8d4a8')]
GREENM = [hx(c) for c in ('#14301c', '#245a2c', '#3e8a3a', '#6cb850', '#b0e078')]

def creature_kiss(f, cx, cy, mood='calm', sc=1.0):
    k = sc
    f.begin().ell(cx, cy, 21 * k, 19 * k).commit('pink', light=(-0.5, -0.9), strength=1.2, edge=1 if f.k >= 3 else 0)
    for sd in (-1, 1):
        f.begin(); heart_shape(f, cx + sd * 12 * k, cy - 21 * k, 5.2 * k); f.commit('crimson', light=(-0.5 * sd, -0.9), strength=1.2, edge=1 if f.k >= 3 else 0)
    f.begin().ell(cx - 7 * k, cy - 8 * k, 6 * k, 3.5 * k).commit([hx('#ffd4ea')] * 5, flat=0)    # 하이라이트
    for sd in (-1, 1):
        ex, ey = cx + sd * 8 * k, cy - 3 * k
        if mood == 'kiss':
            f.line((ex - 4 * k, ey + 1), (ex, ey - 2 * k), hx('#3a1030'), 1.2); f.line((ex, ey - 2 * k), (ex + 4 * k, ey + 1), hx('#3a1030'), 1.2)
        elif mood == 'dizzy':
            f.line((ex - 3, ey - 3), (ex + 3, ey + 3), hx('#3a1030'), 1.2); f.line((ex - 3, ey + 3), (ex + 3, ey - 3), hx('#3a1030'), 1.2)
        else:
            f.begin().ell(ex, ey, 5 * k, 6 * k).commit([hx('#ffffff')] * 5, flat=0)
            f.begin().ell(ex - sd * 0.8, ey + 1, 2.6 * k, 3.4 * k).commit([hx('#2a0c28')] * 5, flat=0); f.px(ex - sd * 1.6, ey - 1, hx('#ffffff'))
            if mood == 'angry': f.line((ex - sd * 6 * k, ey - 8 * k), (ex + sd * 5 * k, ey - 4 * k), hx('#3a1030'), 1.6)
        f.begin().ell(ex + sd * 5 * k, ey + 6 * k, 3.2 * k, 2 * k).commit([hx('#ff7ab0')] * 5, flat=0)   # 볼터치
    # 입술 (뽀뽀괴물의 상징)
    my = cy + 9 * k; lw = 11 * k * (0.75 if mood == 'kiss' else 1)
    f.begin().ell(cx, my, lw, 5.6 * k).commit([hx('#5a0a2a'), hx('#a01442'), hx('#e0305a'), hx('#ff6a86'), hx('#ffb0c0')], light=(-0.3, -0.9), strength=1.3, edge=1 if f.k >= 3 else 0)
    f.line((cx - lw * 0.8, my + 0.3), (cx + lw * 0.8, my + 0.3), hx('#5a0a2a'), 0.9)
    f.px(cx - lw * 0.4, my - 2.4 * k, hx('#ffffff'))
    if mood == 'angry':
        for sd in (-1, 1): f.begin().poly([(cx + sd * 4 * k, my + 0.5), (cx + sd * 7 * k, my + 0.5), (cx + sd * 5.5 * k, my + 4 * k)]).commit([hx('#ffffff')] * 5, flat=0)

def kiss_boss(phase=1, t=0, k=1):
    W, H = 150 * k, 124 * k
    f = Fig(W, H, k, W // 2, 52 * k)
    if phase == 3:   # 3단계: 하트 날개 전개 + 후광
        for sd in (-1, 1):
            f.begin().poly([(sd * 20, -8), (sd * 68, -44 + 3 * (t % 2)), (sd * 72, -20), (sd * 64, -8), (sd * 70, 12), (sd * 50, 6), (sd * 38, 24), (sd * 24, 12)]).commit('pink', light=(-0.4 * sd, -0.9), strength=1.2, edge=1 if k >= 3 else 0)
            f.line((sd * 22, -6), (sd * 68, -42), RAMPS['crimson'][4], 2)
    for sd in (-1, 1):   # 위쪽 프로펠러 + 하트 뿔
        f.line((sd * 40 - 12, -28 + (t % 2)), (sd * 40 + 12, -28 - (t % 2)), RAMPS['steel'][4], 1)
    # 하트형 장갑 동체
    f.begin().ell(-26, -12, 28, 26).ell(26, -12, 28, 26).poly([(-52, 0), (52, 0), (0, 58)]).commit('crimson', light=(-0.3, -0.95), strength=1.3, edge=1 if k >= 3 else 0)
    for sd in (-1, 1):
        f.begin().poly([(sd * 40, 8), (sd * 34, 2), (0, 54), (sd * 4, 58)]).commit('brass', light=(-0.5 * sd, -0.9), edge=1 if k >= 3 else 0)
        for i in range(6): f.px(sd * (38 - i * 6), 6 + i * 7, RAMPS['yellow'][4])
    # 캐노피 + 뽀뽀괴물
    if phase == 1:
        f.begin().ell(0, -8, 31, 27).commit('sky', flat=1)
        creature_kiss(f, 0, -8, 'calm' if t % 4 < 3 else 'kiss', 1.0)
        f.px(-24, -24, RAMPS['sky'][4]); f.px(-23, -25, RAMPS['sky'][4]); f.line((-26, -20), (-22, -26), RAMPS['sky'][4], 1)
    else:
        f.begin().poly([(-30, -10), (-22, -34), (-12, -28), (-4, -38), (6, -29), (16, -36), (24, -24), (31, -8), (24, 14), (-24, 14)]).commit('slate', flat=1)   # 깨진 캐노피 틀
        creature_kiss(f, 0, -8, 'angry' if phase == 2 else 'angry', 1.12 if phase == 3 else 1.0)
    # 균열·불꽃(2단계 이후)
    if phase >= 2:
        for pts in (((-40, -24), (-33, -14), (-38, -4)), ((34, -30), (27, -18), (33, -6))):
            f.line(pts[0], pts[1], RAMPS['crimson'][0], 1); f.line(pts[1], pts[2], RAMPS['crimson'][0], 1); f.px(*pts[1], RAMPS['yellow'][4])
        spark(f, -40, -26 - (t % 2), RAMPS['orange'][4]); spark(f, 38, -22 - ((t + 1) % 2), RAMPS['yellow'][4])
    # 측면 포탑 (1단계만 온전)
    for sd in (-1, 1):
        px_ = sd * 62
        if phase == 1:
            f.begin().ell(px_, 2, 9, 9).commit('steel', edge=1 if k >= 3 else 0)
            f.begin().poly([(px_ - 3, 6), (px_ + 3, 6), (px_ + 3, 24), (px_ - 3, 24)]).commit('slate', edge=1 if k >= 3 else 0)
            f.begin().poly([(px_ - 4.4, 22), (px_ + 4.4, 22), (px_ + 4.4, 25), (px_ - 4.4, 25)]).commit('brass', flat=3); f.px(px_, 27, RAMPS['red'][4])
        else:
            f.begin().poly([(px_ - 8, -3), (px_ + 6, -8), (px_ + 9, 8), (px_ - 4, 12)]).commit('slate', flat=1)
            spark(f, px_ - 2, -10, RAMPS['orange'][4])
    # 입술 포 / 하트 배기구
    lip = RAMPS['yellow'] if phase == 3 else RAMPS['pink']
    f.begin().ell(0, 40, 8, 5).commit('crimson', flat=1); f.begin().ell(0, 40, 5, 2.5).commit(lip, flat=4)
    return f.done()

def sniff_boss(t=0, k=1, mood='sleepy'):
    W, H = 120 * k, 104 * k
    f = Fig(W, H, k, W // 2, 46 * k)
    for sd in (-1, 1):    # 녹색 가스 탱크
        x = sd * 44
        f.begin().poly([(x - 11, -28), (x + 11, -28), (x + 11, 14), (x - 11, 14)]).ell(x, -28, 11, 4).commit('teal', light=(-0.5 * sd, -0.9), strength=1.3, edge=1 if k >= 3 else 0)
        f.begin().poly([(x - 11, -22), (x + 11, -22), (x + 11, -19), (x - 11, -19)]).commit('brass', flat=3); f.begin().poly([(x - 11, 8), (x + 11, 8), (x + 11, 11), (x - 11, 11)]).commit('brass', flat=3)
        for i, (dx, dy) in enumerate(((-4, 0), (3, -8), (-1, -14), (5, 4))): f.px(x + dx, dy - (t * 2 + i) % 5, RAMPS['teal'][4])
        f.line((x - sd * 11, -4), (x - sd * 20, -2), RAMPS['brass'][3], 2)
    f.begin().poly([(-34, -6), (34, -6), (30, 14), (-30, 14)]).commit('slate', light=(-0.3, -0.95))
    f.begin().ell(0, 0, 42, 24).commit(GREENM, light=(-0.3, -0.95), strength=1.3, edge=1 if k >= 3 else 0)
    f.begin().poly([(-40, 2), (40, 2), (40, 5), (-40, 5)]).commit('brass', flat=2)
    for x in range(-36, 38, 7): f.px(x, 3, RAMPS['yellow'][4])
    # 캐노피 + 냄새괴물(초록 몸 · 잎사귀 왕관 · 졸린 눈 · 커다란 코)
    f.begin().ell(0, -12, 30, 24).commit('sky', flat=1)
    f.begin().ell(0, -10, 22, 18).commit(GREENM, light=(-0.5, -0.9), strength=1.2, edge=1 if k >= 3 else 0)
    for i, dx in enumerate((-16, -8, 0, 8, 16)):
        f.begin().poly([(dx - 3.6, -24), (dx + 3.6, -24), (dx + (dx * 0.2), -34 - (i % 2) * 3)]).commit(GREENM, light=(-0.5, -0.9), edge=1 if k >= 3 else 0)
    for sd in (-1, 1):
        ex = sd * 9
        f.begin().ell(ex, -14, 5, 4.2).commit([hx('#f4f4e0')] * 5, flat=0)
        f.begin().ell(ex, -13, 2.2, 2.2).commit([hx('#241a10')] * 5, flat=0)
        f.begin().poly([(ex - 6, -18.6), (ex + 6, -18.6), (ex + 6, -13.4), (ex - 6, -15)]).commit(GREENM, flat=1)    # 졸린 눈꺼풀
        f.line((ex - 6, -14.6), (ex + 6, -13.2 - (1 if mood == 'angry' else 0)), hx('#14301c'), 0.8)
    f.begin().ell(0, -2, 10, 8.4).commit('brown', light=(-0.5, -0.9), strength=1.3, edge=1 if k >= 3 else 0)          # 큰 코
    for sd in (-1, 1): f.begin().ell(sd * 3.6, -1, 1.7, 2.4).commit([hx('#2a1208')] * 5, flat=0)
    f.px(-4, -6, RAMPS['brown'][4]); f.px(-3, -6, RAMPS['brown'][4])
    for i in range(3): f.line((-14 + i * 14, -22), (-12 + i * 14, -30 - t % 2 * 2), hx('#98a878'), 0.8)   # 냄새 줄
    # 코 대포 나팔
    f.begin().poly([(-12, 14), (12, 14), (18, 38), (-18, 38)]).commit('brass', light=(-0.4, -0.95), edge=1 if k >= 3 else 0)
    f.begin().ell(0, 39, 19, 5.4).commit('brown', flat=1); f.begin().ell(0, 39, 13, 3.4).commit([hx('#1a2a10')] * 5, flat=0)
    f.begin().poly([(-14, 22), (14, 22), (15, 25), (-15, 25)]).commit('yellow', flat=3)
    for (dx, dy, r) in ((-6, 44, 3), (4, 46, 4), (-1, 42, 2.4)): f.begin().ell(dx, dy, r, r).commit(SMOKE)
    return f.done()

def drone(t=0, k=1):
    W, H = 40 * k, 40 * k
    f = Fig(W, H, k, W // 2, 22 * k)
    ph = t % 2
    for sd in (-1, 1): f.begin().poly([(sd * 8, 2), (sd * 17, -4), (sd * 18, 6), (sd * 9, 8)]).commit('steel', light=(-0.5 * sd, -0.9), edge=1 if k >= 3 else 0)
    f.line((0, -12), (0, -8), RAMPS['steel'][3], 2); f.line((-13, -13 + ph), (13, -13 - ph), RAMPS['steel'][4], 1); f.px(0, -13, RAMPS['brass'][4])
    f.begin().ell(0, 0, 11.5, 10).commit('purple', light=(-0.5, -0.9), strength=1.3, edge=1 if k >= 3 else 0)       # 몸통(보라)
    f.begin().poly([(-11, 4), (11, 4), (10, 7), (-10, 7)]).commit('brass', flat=3)
    for sd in (-1, 1):   # 안경잽이의 커다란 동그란 안경 → 황동 렌즈 눈
        f.begin().ell(sd * 5.4, -2, 5, 5).commit('brass', light=(-0.5, -0.9), edge=1 if k >= 3 else 0)
        f.begin().ell(sd * 5.4, -2, 3.4, 3.4).commit('sky', flat=3 if ph else 4); f.px(sd * 5.4 - 1, -3.5, hx('#ffffff')); f.px(sd * 5.4, -2, RAMPS['purple'][0])
        f.line((sd * 9, -8), (sd * 2, -7), RAMPS['purple'][0], 1)       # 잘난 척 눈썹
    f.begin().poly([(-2, 10), (2, 10), (2, 17), (-2, 17)]).commit('steel', edge=1 if k >= 3 else 0); f.px(-0.5, 17, RAMPS['red'][4]); f.px(0, 17, RAMPS['red'][3])
    return f.done()

def gunship(t=0, k=1):
    W, H = 80 * k, 68 * k
    f = Fig(W, H, k, W // 2, 34 * k)
    for sd in (-1, 1):   # 증기 굴뚝 + 연기
        x = sd * 14
        f.begin().poly([(x - 3, -24), (x + 3, -24), (x + 3, -8), (x - 3, -8)]).commit('steel', edge=1 if k >= 3 else 0); f.begin().poly([(x - 4, -26), (x + 4, -26), (x + 4, -23), (x - 4, -23)]).commit('brass', flat=3)
        for (dx, dy, r) in ((0, -30, 3), (2 + t, -34, 2.4), (-1, -37, 2)): f.begin().ell(x + dx, dy, r, r).commit(SMOKE)
        f.begin().poly([(sd * 25, -2), (sd * 36, -10), (sd * 36, 12), (sd * 27, 16)]).commit('steel', light=(-0.5 * sd, -0.9), edge=1 if k >= 3 else 0)
        f.begin().poly([(sd * 33 - 2, 12), (sd * 33 + 2, 12), (sd * 33 + 2, 26), (sd * 33 - 2, 26)]).commit('slate', edge=1 if k >= 3 else 0); f.px(sd * 33, 28, RAMPS['red'][4])
    f.begin().ell(0, 4, 24, 18).commit('brass', light=(-0.4, -0.95), strength=1.3, edge=1 if k >= 3 else 0)           # 보일러 배
    f.begin().poly([(-22, -3), (22, -3), (23, 0), (-23, 0)]).commit('brown', flat=2); f.begin().poly([(-20, 10), (20, 10), (19, 12), (-19, 12)]).commit('brown', flat=2)
    for x in range(-18, 19, 5): f.px(x, -2, RAMPS['yellow'][4])
    f.begin().ell(0, 8, 5.4, 5.4).commit('cream', flat=3); f.line((0, 8), (3 + t, 5), RAMPS['red'][2], 1)      # 압력계
    # 조종석 + 배불뚝이 아저씨 얼굴(직접 그린 것)
    f.begin().ell(0, -12, 10, 9).commit('sky', flat=3)
    f.begin().ell(0, -11, 5.4, 5.6).commit(SKIN, light=(-0.5, -0.9)); f.begin().poly([(-5.2, -14), (5.2, -14), (4, -16.4), (0, -17.4), (-4, -16.4)]).commit(HAIR_BR, flat=1)
    for sd in (-1, 1): f.px(sd * 2, -11.6, hx('#241018'))
    f.begin().poly([(-3, -8.6), (3, -8.6), (2, -7.4), (-2, -7.4)]).commit(HAIR_BR, flat=1)     # 콧수염
    f.px(-6, -17, RAMPS['sky'][4]); f.px(-5, -18, RAMPS['sky'][4])
    flame(f, 0, 20, 10, 11 + 3 * (t % 2), t)
    return f.done()

if __name__ == '__main__':
    from PIL import Image
    items = [drone(0), drone(1), gunship(0), sniff_boss(0), kiss_boss(1), kiss_boss(2), kiss_boss(3)]
    Wt = sum(i.width for i in items) + 10 * len(items)
    sh = Image.new('RGBA', (Wt, 140), (50, 30, 80, 255)); x = 4
    for im in items: sh.paste(im, (x, 4), im); x += im.width + 10
    zoom(sh, 2).save('/tmp/claude-0/s/foes.png'); print(sh.size)
