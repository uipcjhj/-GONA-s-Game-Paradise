from humans import *

# ═════════════ 할머니: 폭주 연금술사 ═════════════
def hal_back(f, P, pose, t):
    # 구리 연금 탱크 + 프로펠러 2개 + 배관
    f.begin().ell(0, P['neck'][1] + 9, 11.5, 11).commit('brass', light=(-0.5, -0.9), strength=1.2, edge=1 if f.k >= 3 else 0)
    f.begin().poly([(-11, P['neck'][1] + 8), (11, P['neck'][1] + 8), (11, P['neck'][1] + 10.5), (-11, P['neck'][1] + 10.5)]).commit('brown', flat=2)
    for sd in (-1, 1):
        x = sd * 14
        f.line((sd * 8, P['neck'][1] + 4), (x, P['neck'][1] - 6), RAMPS['steel'][2], 1.4)
        ph = 5 if t % 2 else 3
        f.line((x - 9, P['neck'][1] - 8 + (t % 2)), (x + 9, P['neck'][1] - 8 - (t % 2)), RAMPS['steel'][4], 1.0)
        f.px(x, P['neck'][1] - 8, RAMPS['brass'][4])
    flame(f, 0, P['neck'][1] + 18, 9, 14 + 3 * (t % 2), t, 'orange')

def hal_torso(f, P, pose, t):
    f.begin().poly([(P['sL'][0] + 1, P['sL'][1] + 2), (P['sR'][0] - 1, P['sR'][1] + 2), (6.5, 2), (-6.5, 2)]).commit('brown', light=(-0.4, -0.9), edge=1 if f.k >= 3 else 0)   # 앞치마
    f.line(P['sL'], (5, -1), RAMPS['brown'][3], 1.2)
    for i, c in enumerate(('teal', 'orange', 'purple')):
        x, y = -3 + i * 3.4, -8 + i * 2.6
        f.begin().poly([(x - 1.1, y), (x + 1.1, y), (x + 1.4, y + 3.4), (x - 1.4, y + 3.4)]).commit(c, flat=3); f.px(x - 0.4, y - 1.2, RAMPS['brown'][4])
    f.begin().poly([(-10, 1), (10, 1), (13, 9 + (t % 2)), (0, 12), (-13, 9)]).commit('purple', light=(-0.4, -0.9), edge=1 if f.k >= 3 else 0)   # 치마

def hal_head(f, P, pose, t):
    hc = P['head']; hr = 6.4; ha = P['ha']
    # 곱슬 머리 구름 (여러 덩어리)
    for dx, dy, r in ((-6.5, -2, 4.2), (6.5, -2, 4.2), (-4.5, -6.5, 4.2), (4.5, -6.5, 4.2), (0, -8, 4.4), (-7.5, 3, 3.2), (7.5, 3, 3.2)):
        f.begin().ell(hc[0] + dx, hc[1] + dy, r, r).commit(HAIR_BR, light=(-0.5, -0.9), edge=1 if f.k >= 3 else 0)
    face(f, hc, hr, pose.get('expr', 'grin'), brow=-0.2, ha=ha)
    f.begin().poly([H(hc, -6, -2.5), H(hc, 6, -2.5), H(hc, 4, -5.6), H(hc, 0, -7), H(hc, -4, -5.6)]).commit(HAIR_BR, light=(-0.5, -0.9))
    # 이마 위 황동 고글
    f.begin().poly([H(hc, -7.6, -6.8), H(hc, 7.6, -6.8), H(hc, 7.6, -4.6), H(hc, -7.6, -4.6)]).commit('brown', flat=2)
    for sd in (-1, 1): f.begin().ell(hc[0] + sd * 3.4, hc[1] - 8.2, 2.8, 2.5).commit('brass', edge=1 if f.k >= 3 else 0); f.begin().ell(hc[0] + sd * 3.4, hc[1] - 8.2, 1.7, 1.5).commit('teal', flat=4)

def hal_front(f, P, pose, t):
    # 거대 폭발 물약병 (오른손으로 번쩍)
    w = P['hR']; a = math.radians(P['aaR']); d = (math.sin(a), math.cos(a))
    c = (w[0] + d[0] * 6, w[1] + d[1] * 6)
    f.begin().ell(c[0], c[1], 7.2, 7.2).commit([hx('#0c4a34'), hx('#16805a'), hx('#2cc070'), hx('#7cf0a0'), hx('#d8ffd8')], light=(-0.5, -0.9), strength=1.2, edge=1 if f.k >= 3 else 0)
    n = (c[0] - d[0] * 8, c[1] - d[1] * 8)
    f.begin().limb(n, (c[0] - d[0] * 4, c[1] - d[1] * 4), 4.2, 5.4).commit('sky', light=(-0.5, -0.9), edge=1 if f.k >= 3 else 0)
    f.begin().limb((n[0] - d[0] * 2, n[1] - d[1] * 2), n, 5, 5).commit('brown', flat=2)
    for i, (bx, by) in enumerate(((-2, 1), (2, -2), (0, 3))): f.px(c[0] + bx, c[1] + by - (t + i) % 3, RAMPS['sky'][4])
    f.px(n[0] - d[0] * 4, n[1] - d[1] * 4 - 1, RAMPS['yellow'][4]); spark(f, n[0] - d[0] * 6 + 2, n[1] - d[1] * 6 - 2 + (t % 2), RAMPS['yellow'][4])

def hal_boot(f, ft, pose, t):
    pass

HAL = dict(dims=dict(Lt=11, sw=12, ww=10, Ll=13, La=6.5, Lf=6.5, hr=6.4), thigh=4.6, shin=3.8, pants=RAMPS['purple'], boots=RAMPS['brown'],
           top=RAMPS['pink'], sleeve=RAMPS['pink'], fore=RAMPS['pink'], hand=SKIN, arm=3.2, back=hal_back, torso=hal_torso, head=hal_head, front=hal_front)

# ═════════════ 삼촌: 천재 괴짜 발명가 ═════════════
def sam_back(f, P, pose, t):
    sw = 3 if t % 2 else 0
    f.begin().poly([P['sL'], P['sR'], (11 + sw, 26), (4, 31), (0, 26), (-4, 31), (-11 - sw, 26)]).commit('cream', light=(-0.4, -0.9), edge=1 if f.k >= 3 else 0)   # 실험 가운 자락
    # 제트팩 + 큰 톱니바퀴 + 테슬라 코일
    for sd in (-1, 1):
        x, y = sd * 10, P['neck'][1] + 8
        f.begin().poly([(x - 4, y - 9), (x + 4, y - 9), (x + 4, y + 6), (x - 4, y + 6)]).commit('steel', edge=1 if f.k >= 3 else 0)
        f.begin().ell(x, y - 2, 4.6, 4.6).commit('brass', edge=1 if f.k >= 3 else 0)
        for a in range(8):
            ang = a * 0.785 + t * 0.4; f.px(x + math.cos(ang) * 5.6, y - 2 + math.sin(ang) * 5.6, RAMPS['brass'][3])
        f.px(x, y - 2, RAMPS['brass'][0])
        f.line((x, y - 9), (x + sd * 2, y - 16), RAMPS['steel'][3], 0.8); spark(f, x + sd * 2, y - 17 - (t % 2), RAMPS['yellow'][4])
        flame(f, x, y + 6, 5.4, 11 + 3 * (t % 2), t, 'yellow')

def sam_torso(f, P, pose, t):
    f.begin().poly([P['sL'], P['sR'], (3, -1), (-3, -1)]).commit('orange', light=(-0.4, -0.9))     # 안의 셔츠
    for i in range(3): f.px(-3 + i * 3, -10 + i * 2.5, RAMPS['yellow'][4])
    f.begin().poly([(P['sL'][0], P['sL'][1] + 1), (-3, P['sL'][1] + 2), (-5.5, 2), (-8, 3)]).commit('cream', light=(-0.4, -0.9), edge=1 if f.k >= 3 else 0)
    f.begin().poly([(P['sR'][0], P['sR'][1] + 1), (3, P['sR'][1] + 2), (5.5, 2), (8, 3)]).commit('cream', light=(0.4, -0.9), edge=1 if f.k >= 3 else 0)

def sam_head(f, P, pose, t):
    hc = P['head']; hr = 6.0; ha = P['ha']
    f.begin().ell(hc[0], hc[1] - 1, 7.4, 7).commit(HAIR_BR, edge=1 if f.k >= 3 else 0)
    face(f, hc, hr, pose.get('expr', 'grin'), brow=0, blush=False, glasses=(hx('#1a1226'), None), ha=ha)
    for dx, dy, r in ((-6, -4.5, 3.2), (-2, -7.5, 3.4), (3, -7.6, 3.4), (6.5, -4, 3.2), (0, -4.2, 2.8)):
        f.begin().ell(hc[0] + dx, hc[1] + dy, r, r).commit(HAIR_BR, light=(-0.5, -0.9), edge=1 if f.k >= 3 else 0)   # 부스스 곱슬
    f.begin().ell(hc[0], hc[1] + 5.4, 3.2, 1.8).commit(HAIR_BR, flat=1)  # 수염 그림자
    face_glint(f, hc, hr, t)

def face_glint(f, hc, hr, t):
    if t % 2:
        spark(f, hc[0] - hr * 0.4 - 2, hc[1] - 2.4, hx('#ffffff'))   # 안경 반짝

def sam_front(f, P, pose, t):
    w = P['hR']; a = math.radians(P['aaR']); d = (math.sin(a), math.cos(a))
    base = (w[0] - d[0] * 4, w[1] - d[1] * 4); tip = (w[0] + d[0] * 13, w[1] + d[1] * 13)
    f.begin().limb(base, tip, 5.6, 4.4).commit('yellow', light=(-0.5, -0.9), edge=1 if f.k >= 3 else 0)
    f.begin().ell(tip[0] + d[0] * 2, tip[1] + d[1] * 2, 3.2, 3.2).commit('steel', edge=1 if f.k >= 3 else 0)
    f.line((tip[0] + d[0] * 4, tip[1] + d[1] * 4), (tip[0] + d[0] * 9 + 3, tip[1] + d[1] * 9 - 1), RAMPS['sky'][4], 0.8)
    f.line((tip[0] + d[0] * 9 + 3, tip[1] + d[1] * 9 - 1), (tip[0] + d[0] * 12, tip[1] + d[1] * 12 - 5 + (t % 2)), RAMPS['sky'][4], 0.8)
    spark(f, tip[0] + d[0] * 13, tip[1] + d[1] * 13 - 6, RAMPS['yellow'][4])

def sam_boot(f, ft, pose, t):
    flame(f, ft[0], ft[1] + 2.6, 4, 6 + 2 * (t % 2), t, 'yellow')

SAM = dict(dims=dict(Lt=15, sw=10, ww=7, Ll=21, La=8, Lf=8, hr=6.0), thigh=3.4, shin=2.8, pants=RAMPS['brown'], boots=RAMPS['steel'],
           top=RAMPS['orange'], sleeve=RAMPS['cream'], fore=RAMPS['cream'], hand=SKIN, arm=2.8, back=sam_back, torso=sam_torso, head=sam_head, front=sam_front, boot_fx=sam_boot)

# ═════════════ 할아버지: 비행선 함장 (소형 전투 비행선 + 함장) ═════════════
def cap_back(f, P, pose, t):
    # 비행선 선체(뒤): 측면 날개 + 선미 프로펠러
    for sd in (-1, 1):
        f.begin().poly([(sd * 10, 8), (sd * 30, -6 - (t % 2)), (sd * 33, 6), (sd * 22, 20), (sd * 10, 18)]).commit('cream', light=(-0.4 * sd, -0.9), edge=1 if f.k >= 3 else 0)
        f.line((sd * 12, 9), (sd * 31, -4), RAMPS['brass'][3], 1)
    f.begin().poly([(-20, 6), (20, 6), (26, 22), (14, 36), (-14, 36), (-26, 22)]).commit('navy', light=(-0.3, -0.95), strength=1.2, edge=1 if f.k >= 3 else 0)
    flame(f, 0, 36, 10, 14 + 3 * (t % 2), t, 'orange')
    for sd in (-1, 1):   # 함포
        f.begin().poly([(sd * 17 - 3, 6), (sd * 17 + 3, 6), (sd * 17 + 3, -14), (sd * 17 - 3, -14)]).commit('steel', edge=1 if f.k >= 3 else 0)
        f.begin().poly([(sd * 17 - 4.4, -14), (sd * 17 + 4.4, -14), (sd * 17 + 4.4, -17), (sd * 17 - 4.4, -17)]).commit('brass', flat=3)

def cap_torso(f, P, pose, t):
    f.begin().poly([P['sL'], P['sR'], (5, -2), (-5, -2)]).commit('navy', light=(-0.4, -0.9), edge=1 if f.k >= 3 else 0)
    for i in range(3): f.px(-0.5, -9 + i * 3, RAMPS['yellow'][4])
    for sd in (-1, 1): f.begin().ell(P['neck'][0] + sd * 7.8, P['neck'][1] + 1, 3.6, 2.2).commit('yellow', edge=1 if f.k >= 3 else 0)   # 견장

def cap_head(f, P, pose, t):
    hc = P['head']; hr = 6.2; ha = P['ha']
    f.begin().ell(hc[0], hc[1] - 0.5, 7.2, 6.8).commit(HAIR_GR, edge=1 if f.k >= 3 else 0)
    face(f, hc, hr, pose.get('expr', 'grin'), brow=0.3, blush=False, ha=ha)
    f.begin().poly([H(hc, -7, 0), H(hc, -7, -4), H(hc, -4, -2.4), H(hc, -5.2, 3)]).commit(HAIR_GR, light=(-0.5, -0.9))
    f.begin().poly([H(hc, 7, 0), H(hc, 7, -4), H(hc, 4, -2.4), H(hc, 5.2, 3)]).commit(HAIR_GR, light=(0.5, -0.9))
    f.begin().poly([H(hc, -3.6, 3.6), H(hc, 3.6, 3.6), H(hc, 2.4, 5.4), H(hc, 0, 4.4), H(hc, -2.4, 5.4)]).commit(HAIR_GR, light=(-0.3, -0.9))   # 콧수염
    # 함장 모자
    f.begin().poly([H(hc, -8, -4.2), H(hc, 8, -4.2), H(hc, 7, -10), H(hc, 0, -12), H(hc, -7, -10)]).commit('cream', light=(-0.5, -0.9), edge=1 if f.k >= 3 else 0)
    f.begin().poly([H(hc, -8, -4.2), H(hc, 8, -4.2), H(hc, 8, -6.2), H(hc, -8, -6.2)]).commit('navy', flat=2)
    f.begin().ell(hc[0], hc[1] - 8.2, 2.2, 2.2).commit('yellow', flat=4)

def cap_front(f, P, pose, t):
    # 앞쪽 난간 + 키 휠(선체 위에 가려지는 다리)
    f.begin().poly([(-22, 8), (22, 8), (26, 22), (14, 36), (-14, 36), (-26, 22)]).commit('navy', light=(-0.3, -0.95), strength=1.2, edge=1 if f.k >= 3 else 0)
    f.begin().poly([(-22, 8), (22, 8), (23, 11), (-23, 11)]).commit('brass', flat=3)
    f.begin().poly([(-20, 24), (20, 24), (19, 26), (-19, 26)]).commit('brass', flat=2)
    for x in range(-16, 17, 8): f.px(x, 17, RAMPS['yellow'][4]); f.px(x, 16, RAMPS['brass'][4])
    f.begin().ell(0, 20, 5, 5).commit('brown', edge=1 if f.k >= 3 else 0); f.begin().ell(0, 20, 2, 2).commit('brass', flat=3)
    if pose.get('shooting'):
        for sd in (-1, 1): spark(f, sd * 17, -20, RAMPS['yellow'][4]); f.begin().ell(sd * 17, -21, 3, 2).commit('yellow', flat=4)

CAP = dict(dims=dict(Lt=14, sw=12, ww=9, Ll=8, La=7, Lf=7, hr=6.2), thigh=3.8, shin=3.2, pants=RAMPS['navy'], boots=RAMPS['brown'],
           top=RAMPS['navy'], sleeve=RAMPS['navy'], fore=RAMPS['navy'], hand=SKIN, arm=3.0, back=cap_back, torso=cap_torso, head=cap_head, front=cap_front)
