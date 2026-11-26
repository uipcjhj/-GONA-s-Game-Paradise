"""GONA's Sky Adventure 배지 리마스터 — 대표 시안 (도트 픽셀아트 · 64×64 · 정수 배율 표시용)
   규칙: 얼굴 없음 · 조건을 상징하는 문양 · 금속 테·보석·월계수·날개·리본 · 도트 단위 음영(윗면 빛 · 아랫면 그늘) · 2색 외곽
   사용: python3 tools/sky-badges/badges.py <outdir>"""
import os, sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True)
N = 64
def hx(c): return tuple(int(c[i:i + 2], 16) for i in (1, 3, 5)) + (255,)
RAMP = {  # 어두움 → 밝음
    'gold':   ['#4a2206', '#8a4c0c', '#c8801a', '#eeb42c', '#ffe066', '#fff8d0'],
    'silver': ['#262a3a', '#4e5670', '#8290aa', '#bcc8dc', '#e8eef8', '#ffffff'],
    'bronze': ['#2e1206', '#5e2c10', '#94521e', '#c47e3e', '#e8b07a', '#fbe0c0'],
    'red':    ['#3a0610', '#741020', '#b41e30', '#e0404a', '#ff8a80', '#ffd0c8'],
    'blue':   ['#0a1240', '#18307a', '#2a5cc0', '#4c9af0', '#9cd8ff', '#e8f8ff'],
    'green':  ['#0a2a10', '#145a20', '#2a8a30', '#5abc40', '#a8e070', '#e8ffc8'],
    'white':  ['#3a3a5a', '#7a7a9a', '#b8bcd0', '#e0e4f0', '#f8f8ff', '#ffffff'],
    'purple': ['#1a0830', '#3a1660', '#6a2aa0', '#9a5ad0', '#c89af0', '#f0dcff'],
    'navy':   ['#06061a', '#10123a', '#1c205a', '#2c3480', '#4450a8', '#6a78d0'],
    'pink':   ['#3a0620', '#7a1440', '#c02a6a', '#f05a98', '#ff9ac8', '#ffe0f0'],
    'brown':  ['#1e0c04', '#40200c', '#6a3a18', '#9a5e2c', '#c88a50', '#f0c890'],
}
OUTL = hx('#140804')
class Badge:
    def __init__(self): self.im = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    def layer(self, mask, ramp, light=0.0, outline=True, bevel=True, flat=None):
        """mask(bool 배열)를 금속/보석 음영으로 칠함: 위쪽이 밝고 아래가 어두운 세로 띠 + 빛 받는 윗변 · 그늘진 아랫변"""
        m = mask.astype(bool)
        if not m.any(): return
        a = np.array(self.im)
        if outline:
            o = ndimage.binary_dilation(m, structure=np.ones((3, 3))) & ~m
            a[o] = OUTL
        ys, xs = np.nonzero(m)
        y0, y1 = ys.min(), ys.max() + 1
        R = [hx(c) for c in RAMP[ramp]]
        for y, x in zip(ys, xs):
            t = (y - y0) / max(1, y1 - y0)
            i = 3.6 - 2.6 * t + light
            if bevel:
                up = y == 0 or not m[y - 1, x]; lf = x == 0 or not m[y, x - 1]
                dn = y == N - 1 or not m[y + 1, x]; rt = x == N - 1 or not m[y, x + 1]
                if up or lf: i += 1.3
                if dn or rt: i -= 1.4
            if flat is not None: i = flat
            a[y, x] = R[int(max(0, min(5, round(i))))]
        self.im = Image.fromarray(a)
    def px(self, pts, col):
        a = np.array(self.im)
        for x, y in pts:
            if 0 <= x < N and 0 <= y < N: a[y, x] = hx(col)
        self.im = Image.fromarray(a)
    def sprite(self, art, pal, ox, oy, k=1):
        """ASCII 도트 그림 붙이기 (. = 투명 · k = 도트 배율)"""
        a = np.array(self.im)
        for y, row in enumerate(art):
            for x, ch in enumerate(row):
                if ch == '.': continue
                for dy in range(k):
                    for dx in range(k):
                        yy, xx = oy + y * k + dy, ox + x * k + dx
                        if 0 <= xx < N and 0 <= yy < N: a[yy, xx] = hx(pal[ch])
        self.im = Image.fromarray(a)
def M(): return Image.new('L', (N, N), 0)
def arr(img): return np.array(img) > 0
def poly(pts):
    m = M(); ImageDraw.Draw(m).polygon(pts, fill=255); return arr(m)
def ell(b):
    m = M(); ImageDraw.Draw(m).ellipse(b, fill=255); return arr(m)
def rect(b):
    m = M(); ImageDraw.Draw(m).rectangle(b, fill=255); return arr(m)
# ── 공통 부품 ──
def ribbons(b, ramp='red', y=44):
    b.layer(poly([(20, y), (27, y), (24, 62), (20, 58), (15, 62)]), ramp)
    b.layer(poly([(37, y), (44, y), (49, 62), (44, 58), (40, 62)]), ramp)
def laurel(b, cx=32, cy=33, r=22, start=100, end=225, ramp='green', n=6):
    """월계수: 아래(start°)에서 옆을 지나 위(end°)로 올라가는 잎 · 좌우 대칭 (각도: 0=오른쪽, 90=아래)"""
    import math
    for side in (-1, 1):
        for k in range(n):
            ang = math.radians(start + (end - start) * k / (n - 1))
            x = cx + r * math.cos(ang) * (1 if side < 0 else -1); y = cy + r * math.sin(ang)
            tx, ty = -math.sin(ang) * (1 if side < 0 else -1), math.cos(ang)   # 호 방향
            b.layer(poly([(x - tx * 4, y - ty * 4), (x + ty * 2.6 + tx, y - tx * 2.6 + ty), (x + tx * 5, y + ty * 5), (x - ty * 1.2, y + tx * 1.2)]), ramp, outline=True)
def wings(b, y=26, ramp='white', edge='gold'):
    """날개: 어깨에서 위·바깥으로 펼쳐지는 깃털 5장 (긴 깃 → 짧은 깃) + 금테 덮깃"""
    import math
    for side in (-1, 1):
        sx = 32 + side * 12
        for k, (deg, ln) in enumerate([(-62, 25), (-42, 26), (-22, 24), (-2, 20), (18, 15)]):
            a = math.radians(deg)
            ex, ey = sx + side * ln * math.cos(a), y + ln * math.sin(a)
            nx, ny = -math.sin(a) * 3.2, math.cos(a) * 3.2
            b.layer(poly([(sx, y - 2), (ex - side * nx * 0.2, ey - ny * 0.2), (ex + side * nx * 0.6, ey + ny * 0.6 + 2), (sx + side * 2, y + 5)]), ramp, light=0.3)
        b.layer(poly([(sx - side * 2, y - 4), (sx + side * 12, y - 10), (sx + side * 14, y - 5), (sx + side * 2, y + 6)]), edge, light=0.2)
def gem(b, x, y, ramp='red', r=3):
    b.layer(poly([(x, y - r), (x + r, y), (x, y + r), (x - r, y)]), ramp, light=0.4)
    b.px([(x - 1, y - 1)], '#ffffff')
def disc(b, r, ramp, cx=32, cy=30, light=0.0):
    b.layer(ell((cx - r, cy - r, cx + r, cy + r)), ramp, light=light)
def shield_mask(cx=32, top=12, w=19, h=30):
    pts = [(cx - w, top), (cx + w, top), (cx + w, top + h * 0.45), (cx + w * 0.75, top + h * 0.78), (cx, top + h), (cx - w * 0.75, top + h * 0.78), (cx - w, top + h * 0.45)]
    return poly(pts)
# ── 16×16 상징 문양 (직접 찍은 도트) ──
ICON = {
 'S': (['.oooooo.', 'oyyyyyyo', 'oyoooooo', 'oyyyyyo.', '.oooooyo', 'oooooyyo', 'oyyyyyyo', '.oooooo.'], {'o': '#3a0c18', 'y': '#fff8d0'}),
 'bomb2': (['...rrrrrr...', '.rr..oy.rr..', 'r...o.y..rr.', 'r..okkko.r.r', 'r.okwkkro..r', 'r.okkkrkko.r', 'r.okkrkkko.r', 'r.okrkkkko.r', 'r.orkkkkko.r', '.rr.ooooo.r.', '..rr....rr..', '....rrrr....'], {'o': '#140804', 'k': '#3a3a5a', 'w': '#c8ccdc', 'y': '#ffe066', 'r': '#ff3040'}),
 'heart2': (['.oo...oo.', 'orro.orro', 'owrrorrro', 'orrrrrrro', '.orrrrro.', '..orrro..', '...oro...', '....o....'], {'o': '#140804', 'r': '#ff3a4a', 'w': '#ffd0c8'}),
 'gear': (['......oo......', '...o.oyyo.o....', '..oyoyyyyoyo...', '...oyyddyyo....', '.ooyydooodyyoo.', '.oyyd.....dyyo.', '..oyd.....dyo..', '..oyd.....dyo..', '.oyyd.....dyyo.', '.ooyydooodyyoo.', '...oyyddyyo....', '..oyoyyyyoyo...', '...o.oyyo.o....', '......oo......'],
          {'o': '#140804', 'y': '#c8d4e8', 'd': '#5a6478'}),
 'mush': (['....oooooo....', '..oorrrrrroo...', '.orrwwrrrrwro..', 'orrwwwrrrrrrro.', 'orrrrrrwwrrrro.', 'orrrrrwwwwrrro.', '.oooooooooooo..', '....ossssso....', '....oswwsso....', '....osssss o...', '....ossssso....', '....ossssso....', '...oooooooo....'],
          {'o': '#140804', 'r': '#e0404a', 'w': '#fff4e0', 's': '#f0d8b0'}),
 'heart': (['..ooo...ooo...', '.orrro.orrro..', 'orwwrrorrrrro.', 'orwrrrrrrrrro.', 'orrrrrrrrrrro.', '.orrrrrrrrro..', '..orrrrrrro...', '...orrrrro....', '....orrro.....', '.....oro......', '......o.......'],
           {'o': '#140804', 'r': '#e83a4a', 'w': '#ffd0c8'}),
 'nobomb': (['....rrrrrr....', '..rr......rr..', '.r....oyo...r.', '.r...o.o...rr.', 'r...okkko.r..r', 'r..okwkkkro..r', 'r..okkkkrko..r', 'r..okkkrkko..r', 'r..okkrkkko..r', 'r...orkkko...r', '.r.r.ooo....r.', '.rr........r..', '..rr......rr..', '....rrrrrr....'],
            {'o': '#140804', 'k': '#3a3a5a', 'w': '#b8bcd0', 'y': '#ffe066', 'r': '#e0304a'}),
 'star': (['......oo......', '.....oyyo.....', '.....oyyo.....', '....oywyyo....', 'oooooywyyooooo', 'oyyyyyyyyyyyyo', '.oyyyyyyyyyyo.', '..oyyyyyyyyo..', '...oyyyyyyo...', '...oyyooyyo...', '..oyyo..oyyo..', '..oyo....oyo..', '.ooo......ooo.'],
          {'o': '#5a2e08', 'y': '#ffe066', 'w': '#ffffff'}),
 'camera': (['...oooo.......', '..okkkko......', 'oooooooooooooo', 'okkkkkkkkkkkko', 'okkkoooookkrko', 'okkobbbbbokkko', 'okkobwbbbokkko', 'okkobbbbbokkko', 'okkobbbbbokkko', 'okkkoooookkkko', 'okkkkkkkkkkkko', 'oooooooooooooo'],
            {'o': '#140804', 'k': '#4e5670', 'b': '#4c9af0', 'w': '#e8f8ff', 'r': '#e0404a'}),
 'wand': (['..........ob..', '.........obbo.', '........obwbo.', '.......obbbo..', '......ooboo...', '.....oyo......', '....oyo.......', '...oyo........', '..oyo.........', '.oyo..........', 'oyo...........', 'oo............'],
          {'o': '#140804', 'y': '#eeb42c', 'b': '#4c9af0', 'w': '#e8f8ff'}),
 'crown': (['o.....o.....o.', 'oo...ooo...oo.', 'oyo..oyo..oyo.', 'oyyooyryooyyo.', 'oyyyyyyyyyyyo.', 'oyryyyryyyyryo', 'oyyyyyyyyyyyo.', 'oooooooooooo..'],
           {'o': '#4a2206', 'y': '#ffe066', 'r': '#e0404a'}),
}
def icon(b, name, cx, cy, k=2):
    art, pal = ICON[name]
    art = [r.replace(' ', '.') for r in art]
    w = max(len(r) for r in art); h = len(art)
    b.sprite(art, pal, cx - (w * k) // 2, cy - (h * k) // 2, k)
# ── 대표 시안 8종 ──
def boss_crest(name='gear', metal='silver'):   # 1) 보스 격파: 방패 문장 + 보스 상징
    b = Badge()
    ribbons(b, 'red', 42)
    laurel(b, cy=34, r=24)
    b.layer(shield_mask(top=9, w=19, h=40), 'gold')
    b.layer(shield_mask(top=13, w=15, h=32), 'navy', light=0.5)
    icon(b, name, 32, 29, 2)
    gem(b, 32, 11, 'red', 3)
    return b
def challenge(kind='heart', metal='gold'):     # 2) 노미스·노폭탄: 도전 조건 훈장
    b = Badge()
    ribbons(b, 'blue' if kind == 'heart' else 'red', 44)
    for k in range(8):  # 햇살 테 (뾰족한 8방향)
        import math
        a0 = math.radians(k * 45 + 22.5)
        b.layer(poly([(32 + 26 * math.cos(a0), 30 + 26 * math.sin(a0)), (32 + 14 * math.cos(a0 + 0.35), 30 + 14 * math.sin(a0 + 0.35)), (32 + 14 * math.cos(a0 - 0.35), 30 + 14 * math.sin(a0 - 0.35))]), metal, light=-0.2)
    disc(b, 18, metal)
    disc(b, 14, 'navy', light=0.6)
    icon(b, 'heart2' if kind == 'heart' else 'bomb2', 32, 30, 2)
    return b
def rank_s():                                  # 3) S 랭크: 별 훈장 + 날개
    b = Badge()
    ribbons(b, 'purple', 46)
    wings(b, 30, 'gold')
    import math
    pts = []
    for k in range(10):
        r = 22 if k % 2 == 0 else 10
        a0 = math.radians(-90 + k * 36)
        pts.append((32 + r * math.cos(a0), 31 + r * math.sin(a0)))
    b.layer(poly(pts), 'gold', light=0.2)
    disc(b, 10, 'purple', cx=32, cy=32, light=0.5)
    icon(b, 'S', 32, 32, 2)
    return b
def family(kind='wand', ramp='blue'):          # 4) 동료 배지: 무기·마법 상징 (얼굴 없음)
    b = Badge()
    ribbons(b, ramp, 44)
    b.layer(poly([(32, 4), (54, 18), (54, 38), (32, 56), (10, 38), (10, 18)]), 'silver')   # 육각 문장
    b.layer(poly([(32, 9), (49, 20), (49, 36), (32, 50), (15, 36), (15, 20)]), ramp, light=0.3)
    icon(b, kind, 32, 29, 2)
    gem(b, 32, 6, 'red', 2)
    return b
def photo():                                   # 5) 사진 수집: 카메라 + 폴라로이드 + 별
    b = Badge()
    ribbons(b, 'pink', 44)
    b.layer(poly([(12, 14), (46, 8), (52, 44), (18, 50)]), 'white', light=0.6)   # 기울어진 폴라로이드
    b.layer(poly([(16, 17), (44, 12), (48, 36), (20, 41)]), 'blue', light=0.4)
    disc(b, 17, 'gold', cx=34, cy=35)
    disc(b, 14, 'navy', cx=34, cy=35, light=0.6)
    icon(b, 'camera', 34, 35, 2)
    b.sprite(['..o..', '.oyo.', 'oyyyo', '.oyo.', '..o..'], {'o': '#5a2e08', 'y': '#ffe066'}, 8, 6)
    b.sprite(['.o.', 'oyo', '.o.'], {'o': '#5a2e08', 'y': '#ffe066'}, 50, 50)
    return b
def tier(metal):                               # 6) 난이도 정복: 같은 형태 · 동/은/금
    b = Badge()
    ribbons(b, {'bronze': 'green', 'silver': 'blue', 'gold': 'red'}[metal], 44)
    laurel(b, cy=31, r=23, ramp=metal if metal != 'bronze' else 'green')
    disc(b, 19, metal)
    disc(b, 15, metal, light=-0.8)
    n = {'bronze': 1, 'silver': 2, 'gold': 3}[metal]
    for i in range(n):
        x = 32 + (i - (n - 1) / 2) * 10
        b.sprite(['..o..', '.oyo.', 'oyyyo', '.oyo.', '.o.o.'], {'o': '#140804', 'y': '#fff8d0'}, int(x) - 5, 25, 2) if n == 1 else b.sprite(['..o..', '.oyo.', 'oyyyo', '.oyo.', '.o.o.'], {'o': '#140804', 'y': '#fff8d0'}, int(x) - 2, 27, 1)
    return b
def master():                                  # 7) MASTER: 황금 날개 · 왕관 · 보석
    b = Badge()
    ribbons(b, 'red', 46)
    wings(b, 30, 'gold')
    disc(b, 17, 'gold', cy=33)
    disc(b, 13, 'purple', cy=33, light=0.4)
    gem(b, 32, 33, 'blue', 7)
    icon(b, 'crown', 32, 13, 1)
    return b
SHEET = [
    ('boss3', '철벽 믹서 3000 격파', '보스 격파 · 방패 문장 + 톱니', boss_crest('gear')),
    ('boss2', '뿡뿡 버섯대왕 격파', '보스 격파 · 방패 문장 + 버섯', boss_crest('mush')),
    ('nomiss', '노미스 비행', '도전 훈장 · 하트', challenge('heart')),
    ('nobomb', '맨손의 용기', '도전 훈장 · 폭탄 금지', challenge('bomb', 'silver')),
    ('rankS', 'S 랭크', '별 훈장 + 날개', rank_s()),
    ('fam-mom', '엄마와 함께', '동료 문장 · 물방울 지팡이', family('wand', 'blue')),
    ('album', '추억 앨범', '사진 수집 · 카메라·폴라로이드', photo()),
    ('tier', 'EASY · NORMAL · HARD 정복', '동 · 은 · 금 등급', None),
    ('master', 'MASTER', '황금 날개 · 왕관 · 보석', master()),
]
TIERS = [tier('bronze'), tier('silver'), tier('gold')]
for k, nm, ds, bd in SHEET:
    if bd: bd.im.save(f'{OUT}/{k}.png')
for i, t in enumerate(TIERS): t.im.save(f'{OUT}/tier-{["easy", "normal", "hard"][i]}.png')
print('ok', len(SHEET))
