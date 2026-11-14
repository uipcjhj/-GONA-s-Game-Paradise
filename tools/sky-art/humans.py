from common import *

def H(hc, dx, dy): return (hc[0] + dx, hc[1] + dy)

# ═════════════ 엄마: 하트 마녀 ═════════════
def mom_back(f, P, pose, t):
    fl = 2 if t % 2 else -1
    # 망토
    f.begin().poly([P['sL'], P['sR'], (15, 20 + fl), (7, 27), (0, 21), (-7, 28), (-15, 21 - fl)]).commit('crimson', light=(-0.3, -0.9), strength=1.0, edge=1 if f.k >= 3 else 0)
    # 하트 날개 (마법 비행)
    for sd in (-1, 1):
        x, y = P['neck'][0] + sd * 15, P['neck'][1] + 1 + (fl if sd > 0 else -fl) * 0.5
        heart_shape(f.begin(), x, y, 6.2).commit('pink', light=(-0.5 * sd, -0.9), strength=1.2, edge=1 if f.k >= 3 else 0)
        f.px(x - 2 * sd, y - 1, RAMPS['pink'][4])

def mom_torso(f, P, pose, t):
    # 스커트 + 코르셋 장식
    f.begin().poly([(-5.5, -0.5), (5.5, -0.5), (10.5, 9 + (t % 2)), (3, 12), (-3, 10), (-10.5, 9)]).commit('purple', light=(-0.4, -0.9), edge=1 if f.k >= 3 else 0)
    f.begin(); heart_shape(f, 0, -9.3, 2.2); f.commit('yellow', light=(-0.4, -0.9))
    f.line((-4, -4), (4, -4), RAMPS['yellow'][3], 0.6)

def mom_head(f, P, pose, t):
    hc = P['head']; hr = 6.2; ha = P['ha']; sw = 2 if t % 2 else 0
    # 포니테일(옆으로 크게 휘날림) + 긴 머리
    f.begin().poly([H(hc, -5.5, -3), H(hc, -12, 1), H(hc, -17 - sw, 9), H(hc, -14, 16 + sw), H(hc, -9, 11), H(hc, -6, 4)]).commit(HAIR_BR, light=(-0.5, -0.8), edge=1 if f.k >= 3 else 0)
    f.begin().poly([H(hc, -7, -3), H(hc, 7, -3), H(hc, 8.5, 9), H(hc, 5, 11 + sw), H(hc, -5, 12), H(hc, -8.5, 7)]).commit(HAIR_BR, light=(-0.4, -0.9), edge=1 if f.k >= 3 else 0)
    face(f, hc, hr, pose.get('expr', 'grin'), lash=True, brow=-0.6, ha=ha)
    f.begin().poly([H(hc, -7, -0.5), H(hc, -7, -6.5), H(hc, 0, -8.5), H(hc, 7, -6), H(hc, 7, -0.5), H(hc, 4, -3.5), H(hc, 0.8, -1.2), H(hc, -3, -3.6)]).commit(HAIR_BR, light=(-0.5, -0.9), strength=1.1)
    # 마녀 모자
    f.begin().ell(hc[0] + 1, hc[1] - 6.5, 11.5, 2.5).commit('purple', light=(-0.5, -0.9), edge=1 if f.k >= 3 else 0)
    f.begin().poly([H(hc, -5.5, -7), H(hc, 7, -7), H(hc, 6, -13), H(hc, 10.5, -21), H(hc, 14, -19), H(hc, 4, -16), H(hc, -2, -14)]).commit('purple', light=(-0.5, -0.9), edge=1 if f.k >= 3 else 0)
    f.begin().poly([H(hc, -5.6, -7), H(hc, 7, -7), H(hc, 6.6, -9.6), H(hc, -5.2, -9.6)]).commit('pink', flat=3)
    f.begin(); heart_shape(f, hc[0] + 1, hc[1] - 8.7, 1.6); f.commit('yellow', flat=3)

def mom_front(f, P, pose, t):
    w = P['hR']; a = math.radians(P['aaR']); d = (math.sin(a), math.cos(a))
    a0 = (w[0] - d[0] * 7, w[1] - d[1] * 7); a1 = (w[0] + d[0] * 17, w[1] + d[1] * 17)
    f.line(a0, a1, RAMPS['brass'][1], 1.5); f.line(a0, a1, RAMPS['brass'][3], 0.8)
    f.begin(); heart_shape(f, a1[0] + d[0] * 3, a1[1] + d[1] * 3 - 1.5, 3.4); f.commit('pink', light=(-0.5, -0.9), strength=1.2, edge=1 if f.k >= 3 else 0)
    f.px(a1[0] - 0.5, a1[1] - 3.6 + d[1] * 3, RAMPS['pink'][4]); spark(f, a1[0] + 5, a1[1] - 4 + (t % 2), RAMPS['yellow'][4])

MOM = dict(dims=dict(Lt=13, sw=9, ww=7, Ll=19, La=7, Lf=7, hr=6.2), thigh=3.6, shin=3.0, pants=RAMPS['purple'], boots=RAMPS['crimson'],
           top=RAMPS['pink'], sleeve=RAMPS['pink'], fore=RAMPS['purple'], hand=SKIN, arm=2.7, back=mom_back, torso=mom_torso, head=mom_head, front=mom_front)

# ═════════════ 아빠: 증기 비행 전사 ═════════════
def dad_back(f, P, pose, t):
    for sd in (-1, 1):
        x = P['neck'][0] + sd * 9; y = P['neck'][1] + 9
        f.begin().poly([(x - 4.5, y - 14), (x + 4.5, y - 14), (x + 4.5, y + 6), (x - 4.5, y + 6)]).ell(x, y - 14, 4.5, 2).commit('steel', edge=1 if f.k >= 3 else 0)
        f.begin().poly([(x - 4.5, y - 7), (x + 4.5, y - 7), (x + 4.5, y - 4.5), (x - 4.5, y - 4.5)]).commit('brass', flat=3)
        f.begin().poly([(x - 3.5, y + 6), (x + 3.5, y + 6), (x + 2.2, y + 9), (x - 2.2, y + 9)]).commit('slate', flat=1)
        flame(f, x, y + 9, 6.5, 13 + 3 * (t % 2), t)
    f.line((P['neck'][0] - 6, P['neck'][1] + 2), (P['neck'][0] - 9, P['neck'][1] + 4), RAMPS['brass'][3], 1)

def dad_torso(f, P, pose, t):
    # 가슴 장갑 + 황동 리벳 + 압력계
    f.begin().poly([(P['sL'][0] + 2, P['sL'][1] + 1), (P['sR'][0] - 2, P['sR'][1] + 1), (5, -3), (3, -0.5), (-3, -0.5), (-5, -3)]).commit('steel', light=(-0.5, -0.9), edge=1 if f.k >= 3 else 0)
    f.begin().ell(0, -9.5, 2.6, 2.6).commit('brass', light=(-0.5, -0.9)); f.px(-0.5, -10.3, RAMPS['brass'][4])
    f.line((-6, -6), (6, -6), RAMPS['brass'][2], 0.7)
    for sd in (-1, 1): f.begin().ell(P['neck'][0] + sd * 9.4, P['neck'][1] + 1.2, 4.6, 3.6).commit('steel', light=(-0.5 * sd, -0.9), edge=1 if f.k >= 3 else 0)

def dad_head(f, P, pose, t):
    hc = P['head']; hr = 6.6; ha = P['ha']
    f.begin().ell(hc[0], hc[1] - 1.5, 7.3, 7).commit(HAIR_BR, light=(-0.4, -0.9), edge=1 if f.k >= 3 else 0)
    face(f, hc, hr, pose.get('expr', 'grin'), brow=0.9, blush=False, ha=ha)
    # 짧게 솟은 머리 + 앞머리
    spikes = [(-7, -1), (-6.5, -7), (-3, -10), (0, -8.5), (3, -11), (6.5, -8), (7.2, -1), (4, -4), (0, -2.5), (-4, -4)]
    f.begin().poly([H(hc, *p) for p in spikes]).commit(HAIR_BR, light=(-0.4, -0.9), strength=1.1, edge=1 if f.k >= 3 else 0)
    # 고글(이마 위) + 턱수염 느낌 그림자
    f.begin().poly([H(hc, -7.5, -4.6), H(hc, 7.5, -4.6), H(hc, 7.5, -2.6), H(hc, -7.5, -2.6)]).commit('brown', flat=2)
    for sd in (-1, 1): f.begin().ell(hc[0] + sd * 3.2, hc[1] - 5.6, 2.6, 2.2).commit('steel', edge=1 if f.k >= 3 else 0); f.begin().ell(hc[0] + sd * 3.2, hc[1] - 5.6, 1.6, 1.3).commit('teal', flat=4)
    f.begin().poly([H(hc, -4, 4.6), H(hc, 4, 4.6), H(hc, 3, 6.6), H(hc, -3, 6.6)]).commit(HAIR_BR, flat=1)

def dad_front(f, P, pose, t):
    # 로켓 펀치 건틀릿(오른팔): 큰 주먹 + 황동 밴드 + 분사 불꽃
    w = P['hR']; a = math.radians(P['aaR']); d = (math.sin(a), math.cos(a))
    c = (w[0] + d[0] * 3.5, w[1] + d[1] * 3.5)
    f.begin().limb((w[0] - d[0] * 6, w[1] - d[1] * 6), c, 6.4, 7.2).ell(c[0], c[1], 5.4, 5.0).commit('steel', light=(-0.5, -0.9), strength=1.2, edge=1 if f.k >= 3 else 0)
    f.begin().limb((w[0] - d[0] * 4.4, w[1] - d[1] * 4.4), (w[0] - d[0] * 2.4, w[1] - d[1] * 2.4), 7.6, 7.6).commit('brass', flat=3)
    for i in range(3): f.px(c[0] - 2 + i * 2, c[1] + d[1] * 2.5, RAMPS['steel'][0])
    flame(f, w[0] - d[0] * 8, w[1] - d[1] * 8, 5, 7, t, 'orange') if d[1] > 0.3 else None

def dad_boot(f, ft, pose, t):
    flame(f, ft[0], ft[1] + 2.5, 4.4, 6 + 2 * (t % 2), t, 'orange')

DAD = dict(dims=dict(Lt=15, sw=16, ww=10, Ll=17, La=8, Lf=8, hr=6.6), thigh=5.4, shin=4.4, pants=RAMPS['navy'], boots=RAMPS['steel'],
           top=RAMPS['navy'], sleeve=RAMPS['navy'], fore=RAMPS['steel'], hand=RAMPS['steel'], arm=4.0, back=dad_back, torso=dad_torso, head=dad_head, front=dad_front, boot_fx=dad_boot)

# ═════════════ 이모: 마법 포수 ═════════════
def imo_back(f, P, pose, t):
    sw = 3 if t % 2 else 0
    # 휘날리는 롱코트 자락
    f.begin().poly([(-5, 0), (5, 0), (12 + sw, 24), (5, 30), (0, 24), (-5, 31), (-12 - sw, 25)]).commit('teal', light=(-0.4, -0.9), edge=1 if f.k >= 3 else 0)
    f.begin().poly([(-3, 0), (3, 0), (6, 22), (0, 18), (-6, 23)]).commit('navy', light=(-0.4, -0.9), strength=0.7)
    # 별날개 견장(금색)
    for sd in (-1, 1):
        x, y = P['neck'][0] + sd * 8, P['neck'][1] - 1
        f.begin().poly([(x, y), (x + sd * 9, y - 6 - (t % 2)), (x + sd * 7, y - 1), (x + sd * 10, y + 2), (x + sd * 3, y + 3)]).commit('yellow', light=(-0.5 * sd, -0.9), edge=1 if f.k >= 3 else 0)

def imo_torso(f, P, pose, t):
    f.begin().poly([P['sL'], P['sR'], (3.5, -2), (-3.5, -2)]).commit('cream', light=(-0.4, -0.9))
    f.begin().poly([(P['sL'][0], P['sL'][1] + 1), (-1, P['sL'][1] + 2), (-3, 0), (-7, 1)]).commit('teal', light=(-0.4, -0.9))
    f.begin().poly([(P['sR'][0], P['sR'][1] + 1), (1, P['sR'][1] + 2), (3, 0), (7, 1)]).commit('teal', light=(0.4, -0.9))
    for i in range(3): f.px(-0.5, -11 + i * 3.4, RAMPS['yellow'][3])
    f.line((-6.5, -2.2), (6.5, -2.2), RAMPS['yellow'][2], 0.9)

def imo_head(f, P, pose, t):
    hc = P['head']; hr = 6.0; ha = P['ha']; sw = 3 if t % 2 else 0
    f.begin().poly([H(hc, 4, -4), H(hc, 11, 0), H(hc, 17 + sw, 8), H(hc, 15, 17 + sw), H(hc, 10, 12), H(hc, 6, 4)]).commit(HAIR_BR, light=(-0.5, -0.8), edge=1 if f.k >= 3 else 0)   # 긴 포니테일
    f.begin().ell(hc[0], hc[1] - 1, 7, 6.5).commit(HAIR_BR, edge=1 if f.k >= 3 else 0)
    face(f, hc, hr, pose.get('expr', 'grin'), lash=True, brow=-0.6, ha=ha)
    f.begin().poly([H(hc, -7, -0.5), H(hc, -7, -5.5), H(hc, 0, -7.5), H(hc, 7, -5), H(hc, 7, -0.5), H(hc, 4.5, -3.6), H(hc, 0, -1.8), H(hc, -4, -4)]).commit(HAIR_BR, light=(-0.5, -0.9), strength=1.1)
    # 별 삼각모(깃털 장식)
    f.begin().poly([H(hc, -9.5, -4.4), H(hc, 9.5, -4.4), H(hc, 6, -11.5), H(hc, 0, -13.5), H(hc, -6, -11.5)]).commit('teal', light=(-0.5, -0.9), edge=1 if f.k >= 3 else 0)
    f.begin().poly([H(hc, -9.8, -4.2), H(hc, 9.8, -4.2), H(hc, 9.2, -6.1), H(hc, -9.2, -6.1)]).commit('yellow', flat=3)
    f.begin(); star_shape(f, hc[0], hc[1] - 9.2, 2.6); f.commit('yellow', flat=4)
    f.begin().poly([H(hc, 6, -9), H(hc, 13, -17), H(hc, 11, -10)]).commit('pink', light=(0.4, -0.9))   # 깃털

def imo_front(f, P, pose, t):
    # 별빛 마도포: 오른손 그립 + 왼손 받침, 긴 포신 + 금색 별 포구
    wR, wL = P['hR'], P['hL']; a = math.radians(P['aaR']); d = (math.sin(a), math.cos(a))
    if pose.get('_fwd', True) and d[1] > -0.5:
        d = (0.5, -0.86) if abs(d[0]) < 0.3 else d
    base = (wR[0] - d[0] * 8, wR[1] - d[1] * 8); tip = (wR[0] + d[0] * 20, wR[1] + d[1] * 20)
    f.begin().limb(base, tip, 3.6, 3.0).commit('steel', light=(-0.5, -0.9), edge=1 if f.k >= 3 else 0)
    f.begin().limb((tip[0] - d[0] * 7, tip[1] - d[1] * 7), tip, 4.6, 4.0).commit('yellow', light=(-0.5, -0.9), edge=1 if f.k >= 3 else 0)
    f.begin().ell(base[0], base[1], 3, 3).commit('teal', flat=4)
    f.begin(); star_shape(f, tip[0] + d[0] * 3, tip[1] + d[1] * 3, 3.6); f.commit('yellow', flat=4)
    spark(f, tip[0] + d[0] * 6, tip[1] + d[1] * 6 - 1, RAMPS['sky'][4])

def imo_boot(f, ft, pose, t):
    f.begin().ell(ft[0], ft[1] + 3.2, 4.2, 1.5).commit('teal', flat=4)
    flame(f, ft[0], ft[1] + 3.6, 4, 6 + 2 * (t % 2), t, 'teal')

IMO = dict(dims=dict(Lt=14, sw=9, ww=7, Ll=21, La=7.5, Lf=7.5, hr=6.0), thigh=3.4, shin=2.8, pants=RAMPS['cream'], boots=RAMPS['brown'],
           top=RAMPS['teal'], sleeve=RAMPS['teal'], fore=RAMPS['yellow'], hand=SKIN, arm=2.6, back=imo_back, torso=imo_torso, head=imo_head, front=imo_front, boot_fx=imo_boot)

def render(spec, pose_name, k=1, t=0, size=None, pose=None):
    w, h = size or (84 * k, 92 * k)
    f = Fig(w, h, k, w // 2, int(h * 0.64))
    p = dict(POSES[pose_name]) if pose is None else dict(pose)
    draw_human(f, spec, p, t)
    return f.done()

if __name__ == '__main__':
    from PIL import Image
    specs = [MOM, DAD, IMO]
    sh = Image.new('RGBA', (84 * 3 * 4 + 10, 92 * 3 + 92 * 2 + 20), (30, 24, 60, 255))
    for i, sp in enumerate(specs):
        for j, pn in enumerate(('fly', 'shoot')):
            im = render(sp, pn, 3, 0); sh.paste(im, (j * 252 + i * 504 // 1 if False else i * 336 + j * 0, 0), im) if False else None
    row = Image.new('RGBA', (84 * 3 * 3, 92 * 3), (30, 24, 60, 255))
    for i, sp in enumerate(specs):
        im = render(sp, 'fly', 3, 0); row.paste(im, (i * 252, 0), im)
    row.save('/tmp/claude-0/s/h_ill.png')
    row2 = Image.new('RGBA', (84 * 4 * 6, 92 * 4), (30, 24, 60, 255)); x = 0
    for sp in specs:
        for pn in ('fly', 'shoot'):
            im = render(sp, pn, 1, 0).resize((84 * 4, 92 * 4), Image.NEAREST); row2.paste(im, (x, 0), im); x += 84 * 4
    row2.save('/tmp/claude-0/s/h_spr.png')
