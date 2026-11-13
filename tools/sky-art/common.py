import math
from rig import *

SKIN = [hx(c) for c in ('#6e2f26', '#b4603f', '#e09468', '#f8c496', '#ffe6c8')]
HAIR_BR = [hx(c) for c in ('#1a0c08', '#3a1c10', '#66381a', '#9a5a2a', '#d48a48')]
HAIR_GR = [hx(c) for c in ('#26263a', '#50506a', '#8a8aa2', '#bcbcd0', '#ececf8')]
POSES = {
    'fly':    dict(tilt=0, head=0, aL=(-30, -16), aR=(30, 16), lL=(-7, -5), lR=(7, 5), expr='grin'),
    'bankL':  dict(tilt=-20, head=-10, aL=(-62, -22), aR=(14, 10), lL=(8, 4), lR=(24, 12), expr='grin'),
    'bankR':  dict(tilt=20, head=10, aL=(-14, -10), aR=(62, 22), lL=(-24, -12), lR=(-8, -4), expr='grin'),
    'shoot':  dict(tilt=0, head=0, aL=(-26, -6), aR=(168, 6), lL=(-9, -7), lR=(6, 4), expr='shout'),
    'charge': dict(tilt=-3, head=0, aL=(-70, -70), aR=(70, 70), lL=(-4, -2), lR=(4, 2), expr='shout'),
    'hurt':   dict(tilt=24, head=20, aL=(-128, -30), aR=(118, 30), lL=(-22, -18), lR=(26, 12), expr='xx'),
    'win':    dict(tilt=-4, head=-4, aL=(-34, -10), aR=(176, 0), lL=(-8, -4), lR=(8, 4), expr='grin'),
}

def face(f, hc, hr, expr='grin', eye_gap=0.40, eye_h=0.0, big=False, brow=0, blush=True, lash=False, glasses=None, ha=0):
    """얼굴 직접 그리기: 피부 → 눈·눈썹·입 (k≥3 에서는 홍채·하이라이트·속눈썹까지)"""
    sh = math.sin(math.radians(ha)) * hr * 0.25
    f.begin().ell(hc[0], hc[1] + 0.3, hr * 0.92, hr).commit(SKIN, light=(-0.5, -0.85), strength=0.9)
    ex = hr * eye_gap; ey = hc[1] + hr * (0.05 + eye_h)
    dark = hx('#241018'); white = hx('#ffffff')
    hi = f.k >= 3
    for sd in (-1, 1):
        x = hc[0] + sd * ex + sh
        if expr == 'xx':
            f.line((x - 1.1, ey - 1), (x + 1.1, ey + 1), dark, 0.7); f.line((x - 1.1, ey + 1), (x + 1.1, ey - 1), dark, 0.7)
        elif expr in ('shout', 'grin') and big:
            f.begin().ell(x, ey, 1.5, 1.9).commit([dark] * 5, flat=0)
            if hi: f.begin().ell(x - 0.4, ey - 0.6, 0.55, 0.65).commit([white] * 5, flat=0)
        else:
            f.begin().ell(x, ey, 0.9, 1.25).commit([dark] * 5, flat=0)
            if hi: f.px(x - 0.3, ey - 0.6, white)
        if lash and hi: f.line((x - 1.8 * sd, ey - 0.6), (x - 1.0 * sd, ey - 1.0), dark, 0.5)
        if brow is not None:
            f.line((x - sd * 1.7, ey - 2.3 - brow * 0.45), (x + sd * 1.7, ey - 2.3 + brow * 0.45), HAIR_BR[1] if not glasses else dark, 0.55)
        if blush:
            f.begin().ell(x + sd * 0.9, ey + 2.1, 1.3, 0.8).commit([hx('#d4685c')] * 5, flat=0)
    my = hc[1] + hr * 0.62
    mc = hx('#7a2030')
    if expr == 'shout':
        f.begin().ell(hc[0] + sh, my, 1.9, 1.5).commit([mc] * 5, flat=0); f.px(hc[0] + sh - 0.5, my - 0.8, white)
    elif expr == 'xx':
        f.line((hc[0] - 1.5, my + 0.5), (hc[0] + 1.5, my + 0.5), mc, 0.6)
    elif expr == 'grin':
        f.line((hc[0] - 2, my - 0.4), (hc[0], my + 0.7), mc, 0.6); f.line((hc[0], my + 0.7), (hc[0] + 2, my - 0.4), mc, 0.6)
    else:
        f.line((hc[0] - 1.2, my), (hc[0] + 1.2, my), mc, 0.6)
    if glasses:
        rim, gl = glasses
        for sd in (-1, 1):
            x = hc[0] + sd * ex + sh
            f.begin().ell(x, ey, 3.0, 3.0).commit([rim] * 5, flat=0)
            f.begin().ell(x, ey, 2.2, 2.2).commit([hx('#bfe8ff'), hx('#bfe8ff'), hx('#e8f8ff'), hx('#ffffff'), hx('#ffffff')], flat=2)
            f.begin().ell(x, ey, 0.9, 1.2).commit([dark] * 5, flat=0)
            f.px(x - 1.2, ey - 1.4, white)
        f.line((hc[0] - ex + 3, ey), (hc[0] + ex - 3, ey), rim, 0.5)

def flame(f, x, y, w, h, t, ramp='orange'):
    r = RAMPS[ramp]; w2 = w / 2
    f.begin().poly([(x - w2, y), (x + w2, y), (x + w2 * 0.6, y + h * 0.5), (x + (0.5 if t % 2 else -0.5), y + h), (x - w2 * 0.6, y + h * 0.5)]).commit(r, light=(0, -1), strength=1.5)
    f.begin().poly([(x - w2 * 0.45, y), (x + w2 * 0.45, y), (x, y + h * 0.55)]).commit([r[4]] * 5, flat=0)

def spark(f, x, y, c=None):
    c = c or hx('#ffffff')
    f.px(x, y, c); f.px(x - 1, y, c); f.px(x + 1, y, c); f.px(x, y - 1, c); f.px(x, y + 1, c)

def heart_shape(f, cx, cy, r):
    f.ell(cx - r * 0.5, cy, r * 0.55, r * 0.55).ell(cx + r * 0.5, cy, r * 0.55, r * 0.55).poly([(cx - r * 1.02, cy + r * 0.2), (cx + r * 1.02, cy + r * 0.2), (cx, cy + r * 1.25)])
    return f

def star_shape(f, cx, cy, r):
    pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5; rr = r if i % 2 == 0 else r * 0.45
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
    f.poly(pts); return f

def draw_human(f, spec, pose, t=0):
    h = spec['dims']; P = fk(h, pose)
    pose['_t'] = t
    if 'back' in spec: spec['back'](f, P, pose, t)
    # 다리
    for side in ('L', 'R'):
        hip, k_, ft = P['hip' + side], P['k' + side], P['f' + side]
        f.begin().limb(hip, k_, spec['thigh'], spec['shin'] + 0.6).limb(k_, ft, spec['shin'] + 0.6, spec['shin']).commit(spec['pants'], edge=1 if f.k >= 3 else 0)
        f.begin().ell(ft[0], ft[1] + 0.8, spec['shin'] * 0.9, 2.0).poly([(ft[0] - spec['shin'] * 0.8, ft[1] - 3), (ft[0] + spec['shin'] * 0.8, ft[1] - 3), (ft[0] + spec['shin'] * 0.9, ft[1] + 1.4), (ft[0] - spec['shin'] * 0.9, ft[1] + 1.4)]).commit(spec['boots'], edge=1 if f.k >= 3 else 0)
        if 'boot_fx' in spec: spec['boot_fx'](f, ft, pose, t)
    # 몸통 (+ 치마·코트자락 등)
    f.begin().poly([P['sL'], P['sR'], (h['ww'] / 2 + 1.5, 0), (-h['ww'] / 2 - 1.5, 0)]).ell(0, 0, h['ww'] / 2 + 1.6, 2.6).commit(spec['top'], edge=1 if f.k >= 3 else 0)
    if 'torso' in spec: spec['torso'](f, P, pose, t)
    # 팔
    for side in ('L', 'R'):
        s0, e_, w_ = P['s' + side], P['e' + side], P['h' + side]
        f.begin().limb(s0, e_, spec['arm'] + 0.8, spec['arm']).commit(spec['sleeve'], edge=1 if f.k >= 3 else 0)
        f.begin().limb(e_, w_, spec['arm'], spec['arm'] * 0.85).commit(spec.get('fore', spec['sleeve']), edge=1 if f.k >= 3 else 0)
        f.begin().ell(w_[0], w_[1], spec['arm'] * 0.75, spec['arm'] * 0.75).commit(spec.get('hand', SKIN), edge=1 if f.k >= 3 else 0)
    spec['head'](f, P, pose, t)
    if 'front' in spec: spec['front'](f, P, pose, t)
