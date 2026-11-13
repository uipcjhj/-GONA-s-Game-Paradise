#!/usr/bin/env python3
"""GONA's Sky Adventure 전용 PNG 에셋 생성 (원본은 읽기만 하고 절대 덮어쓰지 않음)
 입력(Food Adventure 원본, 읽기 전용): SRC=/home/user/uipcjhj/gona (uipcjhj/GoNa 저장소 클론)
 출력: public/assets/sky/*.png  (슈팅게임 전용)
  - gona-body.png   : 원본 dino.png 의 프레임(날기·공격·피격·대기)을 그대로 잘라 이어 붙임 (33x34 x4)
  - gona-wings.png  : 익룡 날개(오른쪽, 28x26 x4 프레임). 왼쪽은 게임에서 좌우 반전
  - family-*.png    : 엔딩 스프라이트 시트 v3 의 원본 정면 프레임 그대로
  - fx.png 외 소품   : 총알·구름·하트·폭탄 아이콘 (새로 제작)
"""
import os, shutil, sys
from PIL import Image, ImageDraw

SRC = os.environ.get('GONA_SRC', '/home/user/uipcjhj/gona')
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'sky')
os.makedirs(OUT, exist_ok=True)
LINE = (59, 42, 63, 255)  # #3b2a3f — 게임천국 공통 외곽선색

def save(im, name): im.save(os.path.join(OUT, name))
def hexc(h, a=255): return tuple(int(h[i:i+2], 16) for i in (1, 3, 5)) + (a,)

# ── 고나 몸통: 원본 dino.png (33x34 x13)에서 4프레임 ─────────────
dino = Image.open(os.path.join(SRC, 'public/assets/character/dino.png')).convert('RGBA')
W = 33
pick = [7, 5, 8, 0]  # 날기(두 팔 벌림) · 공격(점프 자세) · 피격(놀람) · 대기
body = Image.new('RGBA', (W * len(pick), 34))
for i, f in enumerate(pick):
    body.paste(dino.crop((f * W, 0, (f + 1) * W, 34)), (i * W, 0))
save(body, 'gona-body.png')

# ── 익룡 날개 ────────────────────────────────────────
def outline(im, col=LINE):
    w, h = im.size
    px = im.load(); out = im.copy(); o = out.load()
    for y in range(h):
        for x in range(w):
            if px[x, y][3] == 0:
                for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
                    nx, ny = x+dx, y+dy
                    if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] > 0:
                        o[x, y] = col; break
    return out

MEM = hexc('#9ed44e'); MEM_L = hexc('#d6f08a'); MEM_D = hexc('#5f9a32'); BONE = hexc('#e8b83a')
def wing(wrist, tip, scal, root_low):
    im = Image.new('RGBA', (28, 26))
    d = ImageDraw.Draw(im)
    S = (2, 11)
    poly = [S, wrist, tip] + scal + [root_low]
    d.polygon(poly, fill=MEM)
    # 밝은 윗면 띠 · 어두운 아랫가장자리
    d.line([S, wrist, tip], fill=MEM_L, width=1)
    d.line([tip] + scal + [root_low], fill=MEM_D, width=1)
    # 뼈(팔 + 긴 손가락) 와 막을 받치는 손가락 뼈
    d.line([S, wrist], fill=BONE, width=2)
    d.line([wrist, tip], fill=BONE, width=1)
    for p in scal:
        d.line([wrist, p], fill=BONE, width=1)
    # 날개 끝 갈고리
    d.point(tip, fill=LINE)
    return outline(im)

wing_frames = [
    wing((11, 14), (25, 22), [(19, 22), (12, 21)], (3, 19)),   # 내림
    wing((11, 8),  (26, 10), [(20, 16), (12, 17)], (3, 19)),   # 중간
    wing((10, 3),  (24, 0),  [(20, 9), (12, 12)],  (3, 18)),   # 올림
    wing((11, 8),  (26, 10), [(20, 16), (12, 17)], (3, 19)),   # 중간
]
sheet = Image.new('RGBA', (28 * 4, 26))
for i, f in enumerate(wing_frames): sheet.paste(f, (i * 28, 0))
save(sheet, 'gona-wings.png')

# ── 가족: 원본 정면 프레임 그대로 ────────────────────
for fam in ['mom', 'dad', 'imo', 'halmeoni', 'halabeoji']:
    shutil.copy(os.path.join(SRC, f'art-src/ending/sprite-sheet-v3/frames/{fam}/idle_00.png'), os.path.join(OUT, f'family-{fam}.png'))

# ── 소품(새로 제작) ───────────────────────────────────
def from_map(rows, pal):
    h, w = len(rows), max(len(r) for r in rows)
    im = Image.new('RGBA', (w, h)); px = im.load()
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c in pal: px[x, y] = pal[c]
    return im

P = {'o': LINE, 'y': hexc('#ffe34a'), 'w': hexc('#fff8d0'), 'g': hexc('#8ccf4a'), 'G': hexc('#4f8f2a'),
     'p': hexc('#ff6f9f'), 'P': hexc('#ffc2d6'), 'r': hexc('#c8386a'), 'b': hexc('#5ec8f0'), 'B': hexc('#e8fbff'),
     'v': hexc('#9a6ad6'), 'V': hexc('#d8c4ff'), 'O': hexc('#ff9a3c'), 'R': hexc('#e0482c'), 'k': hexc('#3a3a4a')}
save(from_map(["..o..", ".owo.", "owyyo", "owyyo", "owyyo", ".oyyo", ".oyyo", "..oo."], P), 'shot-gona.png')    # 고나 깃털탄
save(from_map(["...oooo...", "..oyyyyo..", ".oywwwyyo.", "oywwwwyyyo", "oywwwwyyyo", "oyywwyyyyo", ".oyyyyyyo.", "..oOyyOo..", "..oOOOOo..", "...oOOo...", "...oOOo...", "....oo...."], P), 'shot-charge.png')
save(from_map([".oo.oo.", "oPpoPpo", "oPpppro", ".oppro.", "..opro.", "...oo.."], P), 'shot-heart.png')       # 엄마 하트
save(from_map(["oBBo", "oBbo", "oBbo", "oBbo", "oBbo", "oBBo"], P).resize((4, 6)), 'shot-dad.png')           # 아빠 직선탄 (세로 타일)
save(from_map([".ooo.", "oVvVo", "oVBvo", "ovvvo", ".ooo."], P), 'shot-imo.png')                              # 이모 유도 마법탄
save(from_map([".o.o.", "orRro", "orRro", ".orro", "..o.."], P), 'icon-heart.png') if False else None
save(from_map(["..oo.oo..", ".opppppo.", "opPPpppro", "opPpppppo", "oppppppro", ".opppppo.", "..oppro..", "...opo...", "....o...."], P), 'icon-heart.png')
save(from_map(["..oo.oo..", ".okkkkko.", "okkkkkkko", "okkkkkkko", "okkkkkkko", ".okkkkko.", "..ooooo.."], {**P, 'k': hexc('#c9bfc9')}), 'icon-heart-empty.png')
save(from_map(["....OO...", "...o.O...", "..oooo...", ".okkkko..", "okkkwkko.", "okkkkkko.", "okkkkkko.", ".okkkko..", "..oooo..."], P), 'icon-bomb.png')
save(from_map(["...y...", "...y...", "..yyy..", "yyywyyy", "..yyy..", "...y...", "...y..."], P), 'fx-spark.png')     # 회복 반짝
save(from_map(["..oooo..", ".oyyyyo.", "oywwwwyo", "oyyyyyyo", ".oOOOOo.", "..oooo.."], P).resize((8, 6)), 'fx-star.png')

# 방패 거품 (할아버지) 40x40 · 픽셀 원 테두리
sh = Image.new('RGBA', (40, 40)); d = ImageDraw.Draw(sh)
d.ellipse((1, 1, 38, 38), outline=hexc('#5ec8f0'), width=2)
d.ellipse((3, 3, 36, 36), outline=hexc('#cdefff', 140), width=1)
d.arc((6, 6, 20, 20), 200, 290, fill=hexc('#ffffff'), width=2)
save(outline(sh, hexc('#1e5a7a')), 'fx-shield.png')

# 작은 구름 받침 (가족이 타는 것이 아니라 발밑에 뭉게 구름이 따라다님)
cl = from_map(["...oooo....", "..owwwwo.o.", ".owwwwwwowo", "owwwwwwwwwo", ".ooooooooo."], {'o': hexc('#9fc3e0'), 'w': hexc('#ffffff')})
save(cl, 'puff.png')

# ── 배경(하늘 타일, 세로 반복) + 구름 ────────────────
H = 320
bg = Image.new('RGBA', (180, H)); d = ImageDraw.Draw(bg)
bands = ['#6fb9e8', '#78c0ec', '#82c7ee', '#8dceef', '#98d4f1', '#8dceef', '#82c7ee', '#78c0ec']  # 위아래 대칭 → 이음새 없음
bh = H // len(bands)
for i, c in enumerate(bands): d.rectangle((0, i * bh, 180, (i + 1) * bh), fill=hexc(c))
# 띠 경계 디더링(체크무늬 한 줄)
for i in range(len(bands)):
    y = i * bh
    for x in range(0, 180, 2): d.point((x + (i % 2), y), fill=hexc(bands[i - 1]))
save(bg, 'sky-tile.png')

def cloud(w, h, seed):
    import random
    r = random.Random(seed)
    im = Image.new('RGBA', (w, h)); d = ImageDraw.Draw(im)
    n = max(3, w // 14)
    blobs = []
    for i in range(n):
        cx = int(w * (0.18 + 0.64 * i / (n - 1))); rw = r.randint(w // 6, w // 4); cy = h - rw - r.randint(0, h // 4)
        blobs.append((cx, cy, rw))
    for cx, cy, rw in blobs: d.ellipse((cx - rw, cy - rw, cx + rw, cy + rw), fill=hexc('#ffffff'))
    d.rectangle((w // 8, h - 6, w - w // 8, h - 1), fill=hexc('#ffffff'))
    for cx, cy, rw in blobs: d.ellipse((cx - rw + 2, cy - rw // 2, cx + rw - 2, cy + rw + 4), fill=hexc('#e1f1fb'))
    mask = im.copy()
    # 윗면 흰색을 다시 덮어 밝은 면 유지
    for cx, cy, rw in blobs: d.ellipse((cx - rw, cy - rw, cx + rw - 3, cy + rw - 5), fill=hexc('#ffffff'))
    d.rectangle((w // 8, h - 6, w - w // 8, h - 4), fill=hexc('#e1f1fb'))
    return im
for i, (w, h) in enumerate([(54, 24), (38, 18), (70, 28)]):
    save(cloud(w, h, i + 3), f'cloud-{i}.png')

# 미리보기 시트
prev = Image.new('RGBA', (420, 70), (111, 185, 232, 255)); x = 4
for n in ['gona-body.png', 'gona-wings.png', 'family-mom.png', 'family-dad.png', 'family-imo.png', 'family-halmeoni.png', 'family-halabeoji.png']:
    im = Image.open(os.path.join(OUT, n)); prev.paste(im, (x, 4), im); x += im.width + 4
prev = prev.resize((prev.width * 3, prev.height * 3), Image.NEAREST)
prev.save(os.path.join(os.environ.get('PREVIEW_DIR', '/tmp'), 'sky-assets-preview.png'))
print('ok')
