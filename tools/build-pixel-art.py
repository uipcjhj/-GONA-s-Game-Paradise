#!/usr/bin/env python3
"""
코드로 그린 오리지널 픽셀아트 (이미지 생성 도구 미사용). 1도트 = 1px PNG, 화면에서 정수 배율 + pixelated 로 확대.
  python3 tools/build-pixel-art.py
출력: src/mini-game-land/skin/pixel/art/*.png (미니게임 픽셀 스킨) · src/ui/art/*.png (게임천국 UI 프레임)
팔레트: docs/mini-game-land/DESIGN-CONCEPT.md §2 (월드맵·고나에서 뽑은 색) 기준.
승인 원본(gona.png · gona-world-map.png)은 읽지도 수정하지도 않음.
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MINI = os.path.join(ROOT, 'src/mini-game-land/skin/pixel/art')
UI = os.path.join(ROOT, 'src/ui/art')
os.makedirs(MINI, exist_ok=True); os.makedirs(UI, exist_ok=True)

def hx(s):
    s = s.lstrip('#'); return (int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16), 255)
T = (0, 0, 0, 0)
INK = hx('3b2419'); NAVY = hx('173073'); CREAM = hx('fff4d6'); CREAM2 = hx('f3dfae'); WHITE = hx('fbf8ee')
PINK = hx('ff9fb2'); TEAR = hx('7cc8ff')

class C:
    def __init__(self, w, h): self.im = Image.new('RGBA', (w, h), T); self.w, self.h = w, h
    def p(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h: self.im.putpixel((x, y), c)
    def r(self, x, y, w, h, c):
        for yy in range(y, y + h):
            for xx in range(x, x + w): self.p(xx, yy, c)
    def rows(self, ox, oy, rows, pal):
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch != '.' and ch in pal: self.p(ox + x, oy + y, pal[ch])
    def save(self, d, name): self.im.save(os.path.join(d, name))

# ───────────────────── 편가르기 친구 (24×26: 귀 6줄 + 몸 20줄)
BODY = [
    '......oooooooo......',
    '....oohhbbbbbbboo...',
    '...ohhhbbbbbbbbbbo..',
    '..ohhbbbbbbbbbbbbbo.',
    '.ohbbbbbbbbbbbbbbbbo',
    '.obbbbbbbbbbbbbbbbbo',
    'obbbbbbbbbbbbbbbbbbo',
    'obbbbbbbbbbbbbbbbbbo',
    'obbbbbbbbbbbbbbbbbbo',
    'obbbbbbbbbbbbbbbbbbo',
    'obbbbbbbbbbbbbbbbbbo',
    'obbbbbbbbbbbbbbbbbbo',
    'obbbbbbbbbbbbbbbbbso',
    'obbbbbbbbbbbbbbbbbso',
    'osbbbbbbbbbbbbbbbsso',
    '.osbbbbbbbbbbbbbsso.',
    '.ossbbbbbbbbbbbssso.',
    '..ossssssssssssss o.',
    '...oo.oooooooo.oo...',
    '...................',
]
COLORS = {  # base, shade, highlight
    'red': ('ef6a5b', 'c4473f', 'ffb4a2'),
    'blue': ('4aa3f0', '2c74c2', 'b2deff'),
    'green': ('8fd96a', '58a842', 'd6f6bd'),
    'yellow': ('ffd84a', 'd9a024', 'fff4b0'),
}
EARS = {  # 색마다 귀 모양이 달라 흑백에서도 구분(색약 배려)
    'red': ['..oo..........oo..', '.obbo........obbo.', '.obsbo......obsbo.', '..obbo......obbo..', '...ob........bo...', '..................'],  # 고양이 귀
    'blue': ['........oo........', '.......ohho.......', '........oo........', '........ob........', '........ob........', '........ob........'],  # 더듬이
    'green': ['.........ooo......', '........ohhho.....', '.......ohhbo......', '........oo........', '........ob........', '........ob........'],  # 새싹 잎
    'yellow': ['...oo........oo...', '..ohbo......ohbo..', '..ohbo......ohbo..', '..obbo......obbo..', '..obbo......obbo..', '...ob........bo...'],  # 토끼 귀
}
for name, (b, s, h) in COLORS.items():
    c = C(24, 26)
    pal = {'o': INK, 'b': hx(b), 's': hx(s), 'h': hx(h)}
    c.rows(3, 0, EARS[name], pal)
    c.rows(2, 6, BODY, pal)
    c.save(MINI, f'friend-{name}.png')

# 표정 (24×26 겹치기, 몸 기준 좌표 = (2,6))
def face(name):
    c = C(24, 26); ox, oy = 2, 6
    E = INK
    if name == 'smile':
        for ex in (5, 12):
            c.p(ox + ex, oy + 8, E); c.p(ox + ex + 1, oy + 7, E); c.p(ox + ex + 2, oy + 8, E)
        c.r(ox + 3, oy + 10, 2, 1, PINK); c.r(ox + 15, oy + 10, 2, 1, PINK)
        c.p(ox + 8, oy + 10, E); c.r(ox + 9, oy + 11, 2, 1, E); c.p(ox + 11, oy + 10, E)
    elif name == 'cry':
        for ex in (5, 12):
            c.r(ox + ex, oy + 7, 3, 1, E); c.p(ox + ex + 1, oy + 8, E)
            c.p(ox + ex + 1, oy + 9, TEAR); c.p(ox + ex + 1, oy + 10, TEAR); c.p(ox + ex + 1, oy + 11, TEAR)
        c.r(ox + 8, oy + 12, 4, 1, E); c.p(ox + 7, oy + 13, E); c.p(ox + 12, oy + 13, E)
    elif name == 'angry':
        c.p(ox + 5, oy + 6, E); c.p(ox + 6, oy + 7, E); c.p(ox + 7, oy + 7, E)
        c.p(ox + 14, oy + 6, E); c.p(ox + 13, oy + 7, E); c.p(ox + 12, oy + 7, E)
        c.r(ox + 6, oy + 8, 2, 2, E); c.r(ox + 12, oy + 8, 2, 2, E)
        c.r(ox + 8, oy + 11, 4, 1, E); c.p(ox + 7, oy + 12, E); c.p(ox + 12, oy + 12, E)
        c.p(ox + 16, oy + 4, hx('e8402f')); c.p(ox + 17, oy + 3, hx('e8402f')); c.p(ox + 17, oy + 5, hx('e8402f'))
    else:  # sleepy
        c.r(ox + 5, oy + 8, 3, 1, E); c.r(ox + 12, oy + 8, 3, 1, E)
        c.r(ox + 9, oy + 11, 2, 2, E)
        c.r(ox + 15, oy + 1, 3, 1, NAVY); c.p(ox + 16, oy + 2, NAVY); c.r(ox + 15, oy + 3, 3, 1, NAVY)
    c.save(MINI, f'face-{name}.png')
for f in ('smile', 'cry', 'angry', 'sleepy'): face(f)

# 특징
c = C(24, 26)  # 모자 (중산모)
c.rows(6, 0, ['....oooooo....', '...oNNNNNNo...', '...oNNNNNNo...', '...orrrrrro...', 'ooooNNNNNNoooo', 'oNNNNNNNNNNNNo', '.oooooooooooo.'], {'o': INK, 'N': hx('3f4a8a'), 'r': hx('ef6a5b')})
c.save(MINI, 'feat-hat.png')
c = C(24, 26)  # 리본
c.rows(13, 3, ['oo...oo..', 'oRRoooRRo', 'oRRRORRRo'.replace('O', 'o'), 'oRRoooRRo', 'oo.....oo'], {'o': INK, 'R': hx('ff6f91')})
c.p(17, 5, hx('ffd1dc'))
c.save(MINI, 'feat-ribbon.png')
c = C(24, 26)  # 안경 (몸 좌표 눈 위치 둘레)
c.rows(2 + 3, 6 + 6, ['ooooo..ooooo', 'o...o..o...o', 'o...oooo...o', 'o...o..o...o', 'ooooo..ooooo'], {'o': NAVY})
for (x, y) in ((6, 13), (13, 13)): c.p(x, y, (255, 255, 255, 140))
c.save(MINI, 'feat-glasses.png')

# 분류함 바구니 (32×20)
for name, (b, s, h) in {'basket': ('d99a5b', 'a86b35', 'f2c48a'), 'basket-hot': ('ffd84a', 'd9a024', 'fff4b0')}.items():
    c = C(32, 20); pal = {'o': INK, 'b': hx(b), 's': hx(s), 'h': hx(h), 'w': CREAM}
    rows = ['oooooooooooooooooooooooooooooooo',
            'ohhhhhhhhhhhhhhhhhhhhhhhhhhhhhho',
            'oooooooooooooooooooooooooooooooo']
    for i in range(14):
        rows.append('.o' + ''.join('b' if ((x // 3) + (i // 2)) % 2 == 0 else 's' for x in range(28)) + 'o.')
    rows += ['.osssssssssssssssssssssssssssso.', '..oooooooooooooooooooooooooooo..', '................................']
    c.rows(0, 0, rows, pal)
    c.save(MINI, f'{name}.png')

# ───────────────────── 장난감 (16×16)
TOYS = {
    'ball': ['.....oooooo.....', '...ooRRWWBBoo...', '..oRRRRWWBBBBo..', '.oRhRRRWWBBBBBo.', '.oRRRRRWWBBBBBo.', 'oRRRRRRWWBBBBBBo', 'oRRRRRRWWBBBBBBo', 'oRRRRRRWWBBBBBBo', 'oRRRRRRWWBBBBBBo', 'oRRRRRRWWBBBBBBo', '.oRRRRRWWBBBBBo.', '.ossRRRWWBBBsso.', '..osssRWWBssso..', '...oossssssoo...', '.....oooooo.....', '................'],
    'block': ['oooooooooooooo..', 'oYYYYYYYYYYYYoo.', 'oYhhhhhhhhhhYoso', 'oYhWWWWWWWWhYoso', 'oYhWWooooWWhYoso', 'oYhWooWWooWhYoso', 'oYhWooWWooWhYoso', 'oYhWooooooWhYoso', 'oYhWooWWooWhYoso', 'oYhWooWWooWhYoso', 'oYhWWWWWWWWhYoso', 'oYhhhhhhhhhhYoso', 'oYYYYYYYYYYYYoso', 'oooooooooooooso.', '.osssssssssssso.', '..oooooooooooo..'],
    'robot': ['.......oo.......', '......oRRo......', '.......oo.......', '.......oo.......', '..oooooooooooo..', '..oGGGGGGGGGGo..', '.ooGCCGGGGCCGoo.', 'oGoGCCGGGGCCGoGo', 'oGoGGGGGGGGGGoGo', '.ooGGooooooGGoo.', '..oGGoYYYYoGGo..', '..oGGooooooGGo..', '..oSSSSSSSSSSo..', '..oooooooooooo..', '...oSo....oSo...', '...ooo....ooo...'],
    'car': ['................', '....oooooooo....', '...oRRRRRRRRo...', '..oRRCCoRRCCRo..', '..oRRCCoRRCCRRo.', 'ooooRRRRRRRRRRoo', 'oRRRRRRRRRRRRRRo', 'oYRRRRRRRRRRRRWo', 'oRRRRRRRRRRRRRRo', 'osssssssssssssso', 'oooooooooooooooo', '..oKKo....oKKo..', '.oKGGKo..oKGGKo.', '.oKGGKo..oKGGKo.', '..oKKo....oKKo..', '................'],
    'bear': ['.ooo........ooo.', 'oBBBo......oBBBo', 'oBpBoooooooBpBo.'.ljust(16, '.'), 'oBBBBBBBBBBBBBBo', '.oBBBBBBBBBBBBo.', 'oBBBBBBBBBBBBBBo', 'oBBBoBBBBBBoBBBo', 'oBBBBBBBBBBBBBBo', 'oBBBBBTTTTBBBBBo', 'oBBBBTToTTTBBBBo', 'oBpBBTTTTTTBBpBo', '.oBBBBTTTTBBBBo.', '.oBBBBBBBBBBBBo.', '..osBBBBBBBBso..', '...oossssssoo...', '.....oooooo.....'],
    'duck': ['.....oooo.......', '....oYYYYo......', '...oYYYYYYo.....', '...oYYoYYYo.....', '...oYYYYYYoOOo..', '...oYYYYYYOOOOo.', '....oYYYYYooooo.', '.....oYYYo......', '.ooooYYYYYoooo..', 'oYYYYYYYYYYYYYo.', 'oYhhhYYYYYYYYYYo', 'oYYYYYYYYYYYYYYo', '.oYYYYYYYYYYYYso', '..oYYYYYYYYYsso.', '...oossssssoo...', '....oooooooo....'],
    'star': ['.......oo.......', '.......oo.......', '......oYYo......', '......oYYo......', 'ooooooYYYYoooooo', 'oYYYYYYhYYYYYYYo', '.oYYYYhhYYYYYYo.', '..oYYYYYYYYYYo..', '...oYYYYYYYYo...', '...oYYYYYYYYo...', '..oYYYYooYYYYo..', '..oYYYo..oYYYo..', '.oYYYo....oYYYo.', '.oYYo......oYYo.', 'oooo........oooo', '................'],
    'lock': ['................', '.....oooooo.....', '....oGGGGGGo....', '...oGo....oGo...', '...oGo....oGo...', '...oGo....oGo...', '.oooooooooooooo.', '.oYYYYYYYYYYYYo.', '.oYhhhhhhhhhhYo.', '.oYYYYYooYYYYYo.', '.oYYYYYooYYYYYo.', '.oYYYYYYoYYYYYo.', '.osssssssssssso.', '.oooooooooooooo.', '................', '................'],
    'pin': ['....oo..', '...oRRo.', '...oRho.', '....oo..', '....o...', '....o...', '........', '........'],
}
TP = {'o': INK, 'R': hx('ef6a5b'), 'W': WHITE, 'B': hx('4aa3f0'), 'h': hx('ffffff'), 's': hx('00000040'.ljust(8, '0')) if False else (59, 36, 25, 90),
      'Y': hx('ffd84a'), 'G': hx('9aa5b5'), 'C': hx('7ce8ff'), 'S': hx('6c7688'), 'K': hx('3a3a48'), 'O': hx('ff9a3c'), 'p': hx('f2b8a0'), 'T': hx('e9c39b')}
TPB = dict(TP); TPB['B'] = hx('b57b4e')
for name, rows in TOYS.items():
    c = C(len(rows[0]), len(rows))
    c.rows(0, 0, rows, TPB if name == 'bear' else TP)
    c.save(MINI, f'toy-{name}.png')

# ───────────────────── 배경 타일
c = C(16, 16)  # 편가르기: 무대 커튼 줄무늬
for x in range(16):
    for y in range(16):
        c.p(x, y, hx('ef845b') if (x // 4) % 2 == 0 else hx('f6b78f'))
for x in range(0, 16, 4): c.p(x, 0, hx('d96a44'))
c.save(MINI, 'tile-curtain.png')
c = C(16, 16)  # 무대 바닥 체크
for x in range(16):
    for y in range(16):
        c.p(x, y, hx('f9e49a') if ((x // 8) + (y // 8)) % 2 == 0 else hx('f3d278'))
c.save(MINI, 'tile-stage.png')
c = C(32, 16)  # 탑: 구름
c.rows(0, 0, ['................................', '..........oooooo................', '........ooWWWWWWoo.....oooo.....', '.......oWWWWWWWWWWo...oWWWWo....', '...ooooWWWWWWWWWWWWooooWWWWWWo...', '..oWWWWWWWWWWWWWWWWWWWWWWWWWWWo..', '.oWWWWWWWWWWWWWWWWWWWWWWWWWWWWWo.', '.oLLLLLLLLLLLLLLLLLLLLLLLLLLLLLo.', '..ooooooooooooooooooooooooooooo..'], {'o': hx('c9d6f2'), 'W': WHITE, 'L': hx('e4ebfb')})
c.save(MINI, 'cloud.png')
c = C(16, 16)  # 장난감방 벽지(민트 + 점)
for x in range(16):
    for y in range(16): c.p(x, y, hx('bfeedd'))
for (x, y) in ((3, 3), (11, 11)): c.r(x, y, 2, 2, hx('9fdcc7'))
c.p(11, 3, hx('ffffff')); c.p(3, 11, hx('ffffff'))
c.save(MINI, 'tile-wall.png')
c = C(16, 8)  # 나무 판자
for x in range(16):
    for y in range(8): c.p(x, y, hx('c98a52') if y not in (0, 7) else hx('a86b35'))
for x in (5, 12): c.p(x, 3, hx('a86b35')); c.p(x + 1, 4, hx('a86b35'))
c.r(0, 1, 16, 1, hx('e0a86c'))
c.save(MINI, 'tile-wood.png')

# ───────────────────── 9-slice UI 프레임 (12×12, 코너 4) — 미니게임과 게임천국이 같이 씀
def frame(name, fill, light, dark, line=NAVY, outdirs=(MINI, UI)):
    c = C(12, 12)
    rows = ['..oooooooo..', '.oLLLLLLLLo.', 'oLLFFFFFFFLo', 'oLFFFFFFFFDo', 'oLFFFFFFFFDo', 'oLFFFFFFFFDo', 'oLFFFFFFFFDo', 'oLFFFFFFFFDo', 'oLFFFFFFFFDo', 'oLFFFFFFFDDo', '.oDDDDDDDDo.', '..oooooooo..']
    c.rows(0, 0, rows, {'o': line, 'L': light, 'F': fill, 'D': dark})
    for d in outdirs: c.save(d, f'{name}.png')
frame('frame-panel', CREAM, WHITE, CREAM2)
frame('frame-btn', hx('ffd84a'), hx('fff1a0'), hx('e8a92c'))
frame('frame-btn-sub', WHITE, hx('ffffff'), hx('d9d9e6'))
frame('frame-btn-danger', hx('ff8a80'), hx('ffc2bc'), hx('d85c58'))
frame('frame-btn-off', hx('d8d2c4'), hx('e8e3d8'), hx('b9b2a2'))
frame('frame-dark', hx('2b1d4a'), hx('4a3577'), hx('1b1230'), line=INK)
frame('frame-mint', hx('c9f5e2'), hx('effff8'), hx('8fd9bb'))
frame('frame-pink', hx('ffd3dd'), hx('fff0f3'), hx('f29bb0'))
# 리본 배너 끝 (8×12)
c = C(8, 12)
c.rows(0, 0, ['oooooooo', 'oRRRRRRo', 'oRRRRRRo', '.oRRRRRo', '..oRRRRo', '...oRRRo', '..oRRRRo', '.oRRRRRo', 'oRRRRRRo', 'oRRRRRRo', 'oDDDDDDo', 'oooooooo'], {'o': INK, 'R': hx('ef6a5b'), 'D': hx('c4473f')})
c.save(UI, 'ribbon-end.png'); c.save(MINI, 'ribbon-end.png')
# 반짝이·코인·별 (8×8)
c = C(8, 8); c.rows(0, 0, ['...o....', '...o....', '..oWo...', 'ooWWWoo.', '..oWo...', '...o....', '...o....', '........'], {'o': hx('ffd84a'), 'W': WHITE}); c.save(UI, 'spark.png'); c.save(MINI, 'spark.png')
c = C(10, 10); c.rows(0, 0, ['..oooooo..', '.oYYYYYYo.', 'oYhYYYYDYo', 'oYhYooYDYo', 'oYYYooYDYo', 'oYYYooYDYo', 'oYYYooYDYo', 'oYYYYYYDYo', '.oDDDDDDo.', '..oooooo..'], {'o': INK, 'Y': hx('ffc21a'), 'h': hx('fff1a0'), 'D': hx('d9921a')}); c.save(UI, 'coin.png'); c.save(MINI, 'coin.png')
c = C(11, 11); c.rows(0, 0, ['.....o.....', '....oYo....', '....oYo....', 'oooooYooooo', 'oYYYYhYYYYo', '.oYYhYYYYo.', '..oYYYYYo..', '..oYYoYYo..', '.oYYo.oYYo.', '.oYo...oYo.', '.oo.....oo.'], {'o': INK, 'Y': hx('ffd84a'), 'h': hx('fff4b0')}); c.save(UI, 'star.png'); c.save(MINI, 'star.png')
c = C(9, 8); c.rows(0, 0, ['.oo...oo.', 'oRRo.oRRo', 'oRhRoRRRo', 'oRRRRRRRo', '.oRRRRRo.', '..oRRRo..', '...oRo...', '....o....'], {'o': INK, 'R': hx('ef5b6b'), 'h': hx('ffc2cc')}); c.save(MINI, 'heart.png'); c.save(UI, 'heart.png')
c = C(9, 8); c.rows(0, 0, ['.oo...oo.', 'o..o.o..o', 'o...o...o', 'o.......o', '.o.....o.', '..o...o..', '...o.o...', '....o....'], {'o': hx('8a7a9a')}); c.save(MINI, 'heart-off.png')
print('ok')
