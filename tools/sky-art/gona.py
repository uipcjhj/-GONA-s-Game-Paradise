"""고나 — 아기 익룡 전사 (원본 스프라이트 픽셀 미사용: 얼굴 특징·머리 한 가닥·작은 눈·연두색 공룡 정체성만 참고해 새로 디자인)"""
from common import *

MEMB = [hx(c) for c in ('#0e2a22', '#1b5a3e', '#2f8a48', '#62b84c', '#a4e46c')]
GREEN = [hx(c) for c in ('#1c3d22', '#2f6a30', '#5aa23a', '#8ccf4a', '#c8f080')]
BELLY = [hx(c) for c in ('#8a5a14', '#c88a24', '#eab83c', '#fadf64', '#fff6b0')]
WING = {
    'up':   dict(W=(10, -18), T=(26, -30), E=[(22, -10), (14, -4), (8, 4)], H=(0, 14)),
    'mid':  dict(W=(12, -10), T=(28, -9), E=[(24, 2), (17, 9), (9, 14)], H=(0, 15)),
    'down': dict(W=(10, -1), T=(23, 13), E=[(22, 19), (14, 20), (8, 20)], H=(0, 16)),
    'back': dict(W=(8, -19), T=(17, -33), E=[(15, -13), (10, -5), (6, 4)], H=(0, 13)),
    'wide': dict(W=(15, -9), T=(34, -15), E=[(30, -2), (21, 6), (11, 13)], H=(0, 15)),
}

def wing(f, side, kind, reach=1.0, dy=0):
    d = WING[kind]; S = (side * 5, -9 + dy)
    P = lambda o: (S[0] + side * o[0] * reach, S[1] + o[1])
    pts = [S, P(d['W']), P(d['T'])]
    chain = [P(d['T'])] + [P(o) for o in d['E']] + [P(d['H'])]
    for a, b in zip(chain[:-1], chain[1:]):
        pts.append(((a[0] + b[0]) / 2 - side * 2.4 * reach, (a[1] + b[1]) / 2 - 2.2)); pts.append(b)
    f.begin().poly(pts).commit(MEMB, light=(-0.6 * side, -0.8), strength=1.2, edge=1 if f.k >= 3 else 0)
    bone, bone_d, bone_l = RAMPS['yellow'][3], RAMPS['yellow'][1], RAMPS['yellow'][4]
    f.line(S, P(d['W']), bone, 2.0); f.line(P(d['W']), P(d['T']), bone, 1.1)
    for o in d['E']: f.line(P(d['W']), P(o), bone_d, 0.8)
    f.px(*P(d['W']), bone_l); t = P(d['T']); f.px(t[0] + side * 0.8, t[1] - 1, bone_l)

GP = {
    'fly':    dict(wing='mid', arms=((-40, -10), (40, 10)), legs=(-9, 9), bank=0, expr='grin'),
    'bankL':  dict(wing='mid', arms=((-60, -10), (20, 10)), legs=(-2, 14), bank=-1, expr='grin'),
    'bankR':  dict(wing='mid', arms=((-20, -10), (60, 10)), legs=(-14, 2), bank=1, expr='grin'),
    'shoot':  dict(wing='wide', arms=((165, 0), (-165, 0)), legs=(-7, 7), bank=0, expr='shout'),
    'charge': dict(wing='back', arms=((-60, -80), (60, 80)), legs=(-4, 4), bank=0, expr='shout'),
    'hurt':   dict(wing='down', arms=((-130, -20), (125, 20)), legs=(-20, 24), bank=0, expr='xx', tilt=1),
    'win':    dict(wing='up', arms=((170, 0), (-30, -10)), legs=(-8, 8), bank=0, expr='grin'),
}

def make(pose='fly', k=1, t=0, size=None):
    p = GP[pose]; w, h = size or (104 * k, 100 * k)
    f = Fig(w, h, k, w // 2, int(h * 0.68))
    bank = p['bank']; hx_off = bank * 2.0
    kinds = {'fly': ['mid', 'up', 'mid', 'down'][t % 4], 'bankL': ['mid', 'up', 'mid', 'down'][t % 4], 'bankR': ['mid', 'up', 'mid', 'down'][t % 4]}
    kind = kinds.get(pose, p['wing'])
    rr = 1 - 0.3 * bank if bank > 0 else 1 + 0.1 * -bank
    rl = 1 - 0.3 * -bank if bank < 0 else 1 + 0.1 * bank
    if pose == 'charge': rr = rl = 0.8
    # 스카프 (뒤)
    sw = 3 if t % 2 else 0
    f.begin().poly([(-3, -9), (3, -9), (9 + sw - bank * 3, -3), (13, 6 + sw), (6, 2), (0, -3)]).commit('red', light=(-0.5, -0.9), edge=1 if k >= 3 else 0)
    wing(f, 1, kind, rr, dy=-bank); wing(f, -1, kind, rl, dy=bank)
    # 꼬리(가시 달린 익룡 꼬리)
    tl = [(1, 1.5), (8, 7), (15, 8 + t % 2), (21, 5 + t % 2)]
    f.begin().limb(tl[0], tl[1], 4.4, 3.4).limb(tl[1], tl[2], 3.4, 2.4).limb(tl[2], tl[3], 2.4, 1.0).commit(GREEN, light=(-0.4, -0.9), edge=1 if k >= 3 else 0)
    for (x, y) in ((8, 5), (13.5, 6.2 + t % 2), (18.4, 5 + t % 2)): f.begin().poly([(x - 1.5, y), (x + 1.5, y), (x, y - 3.8)]).commit('yellow', flat=3)
    f.begin().poly([(20, 4.5 + t % 2), (26, 1 + t % 2), (23, 7 + t % 2)]).commit('yellow', flat=3)
    # 다리 + 발톱 부츠
    lg = p['legs']
    for sd, a in ((-1, lg[0]), (1, lg[1])):
        hip = (sd * 3.2, 1.5); ft = pt(hip, a, 8.5)
        f.begin().limb(hip, ft, 4.6, 4.0).commit(GREEN, edge=1 if k >= 3 else 0)
        f.begin().ell(ft[0], ft[1] + 0.8, 3.6, 2.2).commit('yellow', light=(-0.5, -0.9), edge=1 if k >= 3 else 0)
        for dx in (-1.9, 0, 1.9): f.px(ft[0] + dx, ft[1] + 3, RAMPS['yellow'][4])
    # 몸통 + 배
    f.begin().ell(hx_off * 0.3, -4.6, 7.2, 7.6).commit(GREEN, light=(-0.5, -0.9), strength=1.1, edge=1 if k >= 3 else 0)
    f.begin().ell(hx_off * 0.3, -3.4, 4.4, 5.2).commit(BELLY, light=(-0.4, -0.9), edge=1 if k >= 3 else 0)
    f.line((-3, -3), (3, -3), BELLY[1], 0.5)
    for sd in (-1, 1): f.begin().ell(sd * 6.8, -9.4, 3.6, 2.6).commit('yellow', light=(-0.5, -0.9), edge=1 if k >= 3 else 0)   # 어깨 갑옷
    # 팔 + 발톱 장갑
    hands = []
    for sd, (a1, a2) in zip((-1, 1), p['arms'] if pose != 'shoot' else ((-30, -8), (165, 6))):
        s0 = (sd * 7, -8.6); e = pt(s0, a1, 5.2); wst = pt(e, a1 + a2, 5.2); hands.append(wst)
        f.begin().limb(s0, e, 3.8, 3.4).limb(e, wst, 3.4, 3.2).commit(GREEN, edge=1 if k >= 3 else 0)
        f.begin().ell(wst[0], wst[1], 3.0, 3.0).commit('yellow', light=(-0.5, -0.9), edge=1 if k >= 3 else 0)
        for dx in (-1.4, 0, 1.4): f.px(wst[0] + dx, wst[1] - 3.2, RAMPS['yellow'][4])
    # 머리: 익룡 후드(긴 뒷 볏) + 아기 얼굴 + 머리카락 한 가닥
    hc = (hx_off, -17)
    f.begin().poly([(hc[0] - 1.5, hc[1] - 8.4), (hc[0] + 2.4, hc[1] - 8.4), (hc[0] - 4 - bank * 2, hc[1] - 19), (hc[0] - 12 - bank * 3, hc[1] - 26), (hc[0] - 8 - bank * 2, hc[1] - 16)]).commit('yellow', light=(-0.4, -0.9), edge=1 if k >= 3 else 0)   # 긴 익룡 볏
    f.begin().ell(hc[0], hc[1] - 0.5, 10, 9.6).commit(GREEN, light=(-0.5, -0.9), strength=1.2, edge=1 if k >= 3 else 0)
    for dx in (-7.6, -4, 4, 7.6): f.begin().poly([(hc[0] + dx - 1.8, hc[1] - 7 + abs(dx) * 0.3), (hc[0] + dx + 1.8, hc[1] - 7 + abs(dx) * 0.3), (hc[0] + dx * 1.15, hc[1] - 12.4 + abs(dx) * 0.4)]).commit('yellow', flat=3)
    face(f, (hc[0], hc[1] + 0.6), 6.1, p['expr'], eye_gap=0.42, brow=None, big=(pose in ('shoot', 'charge')), ha=bank * 8)
    # 머리카락 한 가닥(상징): 위로 솟아 동그랗게 말림
    c = hx('#4a2412'); c2 = hx('#8a4a24')
    pts = [(hc[0], hc[1] - 8), (hc[0] + 0.6, hc[1] - 11.5), (hc[0] + 3, hc[1] - 13.6), (hc[0] + 5.2, hc[1] - 12.2), (hc[0] + 4.4, hc[1] - 10.2)]
    for a, b in zip(pts[:-1], pts[1:]): f.line(a, b, c, 1.3)
    f.px(pts[2][0], pts[2][1], c2)
    if pose == 'charge':
        f.begin().ell(0, -2, 5.0, 5.0).commit([hx('#ffd04a'), hx('#ffe880'), hx('#fff4b0'), hx('#ffffff'), hx('#ffffff')], flat=3)
        for i in range(8): spark(f, math.cos(i * 0.785) * 10, -2 + math.sin(i * 0.785) * 10, hx('#fff4b0')) if k >= 3 else f.px(math.cos(i * 0.785) * 9, -2 + math.sin(i * 0.785) * 9, hx('#fff4b0'))
    im = f.done()
    if pose == 'hurt': im = tint_flash(im, (255, 50, 50), 0.35)
    return im

if __name__ == '__main__':
    from PIL import Image
    row = Image.new('RGBA', (104 * 3 * 4, 100 * 3 * 2), (30, 24, 60, 255))
    for i, pn in enumerate(('fly', 'bankL', 'shoot', 'charge', 'hurt', 'win', 'bankR')):
        im = make(pn, 3, 0); row.paste(im, ((i % 4) * 312, (i // 4) * 300), im)
    row.save('/tmp/claude-0/s/gona_new.png')
