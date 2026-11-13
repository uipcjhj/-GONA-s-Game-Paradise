#!/usr/bin/env python3
"""스테이지 1 신규 에셋 처리 (Higgsfield 생성 원본 → 게임용 PNG). 재그림 없음.
 규칙: 모든 스프라이트는 고나와 같은 '2배 격자'(화면 360×640 기준 픽셀)로 만들고 게임에서 0.5배로 그림.
 처리: 2×2 분리(그림이 가장 적게 걸치는 분할선) → 투명 여백 잘라냄 → 목표 크기로 박스 축소(프리멀티플라이)
       → 알파 0/255 → 에셋별 팔레트 정리 → 1px 어두운 외곽선
 입력: art-src/sky/stage1/*_raw.png   출력: public/assets/sky/v2/stage1/*.png, public/assets/sky/v2/chars/<id>/fly.png
"""
import os, sys, json
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'art-src/sky/stage1')
OUT = os.path.join(ROOT, 'public/assets/sky/v2/stage1')
CH = os.path.join(ROOT, 'public/assets/sky/v2/chars')
OUTLINE = (26, 18, 38, 255)
report = {}

def load(n):
    im = Image.open(os.path.join(SRC, n)).convert('RGBA'); a = np.array(im); al = a[..., 3]
    a[..., 3] = np.where(al < 8, 0, np.where(al >= 240, 255, al)); return Image.fromarray(a, 'RGBA')

def best_split(a, axis, lo, hi):
    s = (a[..., 3] > 32).sum(axis=1 - axis); return lo + int(np.argmin(s[lo:hi]))

def quads(im):
    a = np.array(im); w, h = im.size
    sy = best_split(a, 0, h // 2 - 220, h // 2 + 220)
    sxt = best_split(a[:sy], 1, w // 2 - 220, w // 2 + 220); sxb = best_split(a[sy:], 1, w // 2 - 220, w // 2 + 220)
    return [im.crop((0, 0, sxt, sy)), im.crop((sxt, 0, w, sy)), im.crop((0, sy, sxb, h)), im.crop((sxb, sy, w, h))]

def trim(im):
    bb = (np.array(im)[..., 3] > 16)
    ys, xs = np.nonzero(bb)
    return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)) if len(xs) else im

def shrink(im, scale):
    nw, nh = max(1, round(im.width * scale)), max(1, round(im.height * scale))
    s = im.convert('RGBa').resize((nw, nh), Image.BOX).convert('RGBA')
    a = np.array(s); a[..., 3] = np.where(a[..., 3] >= 110, 255, 0); a[a[..., 3] == 0, :3] = 0
    return Image.fromarray(a, 'RGBA')

def palettize(im, colors=40, outline=True):
    a = np.array(im); op = a[..., 3] > 0
    if op.any():
        q = np.array(Image.fromarray(a[..., :3], 'RGB').quantize(colors=colors, method=Image.MEDIANCUT, dither=Image.NONE).convert('RGB'))
        a[..., :3] = np.where(op[..., None], q, 0)
    if outline:
        pad = np.zeros((a.shape[0] + 2, a.shape[1] + 2, 4), np.uint8); pad[1:-1, 1:-1] = a; a = pad; op = a[..., 3] > 0
        edge = ~op & (np.roll(op, 1, 0) | np.roll(op, -1, 0) | np.roll(op, 1, 1) | np.roll(op, -1, 1)); a[edge] = OUTLINE
    return Image.fromarray(a, 'RGBA')

def sprite(im, target, by='max', colors=40, outline=True):
    t = trim(im); ref = max(t.size) if by == 'max' else (t.width if by == 'w' else t.height)
    return palettize(shrink(t, target / ref), colors, outline)

def frames_to_strip(frames, cell_w, cell_h, anchor='center'):
    """같은 배율로 줄인 프레임들을 같은 크기 셀에 하단 중앙 정렬(캐릭터가 튀지 않게)"""
    strip = Image.new('RGBA', (cell_w * len(frames), cell_h), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        x = i * cell_w + (cell_w - f.width) // 2; y = (cell_h - f.height) // 2 if anchor == 'center' else cell_h - f.height
        strip.alpha_composite(f, (max(i * cell_w, x), max(0, y)))
    return strip

def save(im, path, key):
    os.makedirs(os.path.dirname(path), exist_ok=True); im.save(path)
    a = np.array(im)[..., 3]; report[key] = dict(size=im.size, alpha=sorted(set(np.unique(a).tolist())) if len(np.unique(a)) < 4 else 'mixed')

# ── 배경 원경: 360×640, 세로 이음새 보정(위·아래 40px 교차 페이드) ──
def backdrop():
    p = os.path.join(SRC, 'bg_backdrop_raw.png')
    if not os.path.exists(p): return
    im = Image.open(p).convert('RGB').resize((360, 640), Image.BOX)
    a = np.array(im).astype(float); n = 48
    top = a[:n].copy(); bot = a[-n:].copy()
    for i in range(n):
        t = i / n; a[-n + i] = bot[i] * (1 - t) + top[i] * t   # 아래 끝이 위 시작과 같아지도록
    q = Image.fromarray(a.astype(np.uint8), 'RGB').quantize(colors=64, method=Image.MEDIANCUT, dither=Image.NONE).convert('RGBA')
    save(q, os.path.join(OUT, 'bg-backdrop.png'), 'bg-backdrop')

# ── 소품: 부유섬·시계탑·비행선·구름 ──
PROPS = {
    'props_islands_raw.png': [('island-castle', 170), ('island-ruins', 150), ('island-small', 96), ('island-tower', 150)],
    'props_tower_ship_clouds_raw.png': [('clocktower', 190), ('airship', 130), ('cloud-big', 200), ('cloud-small', 170)],
}
def props():
    for fn, items in PROPS.items():
        p = os.path.join(SRC, fn)
        if not os.path.exists(p): continue
        for q, (name, size) in zip(quads(load(fn)), items):
            cloud = name.startswith('cloud')
            save(sprite(q, size, colors=24 if cloud else 48, outline=not cloud), os.path.join(OUT, f'{name}.png'), name)

# ── 가족 비행 스프라이트: 4프레임(비행2 + 공격2) → 셀 88×88 (캐릭터 높이 기준 통일) ──
FAM = ['mom', 'dad', 'imo', 'halmeoni', 'halabeoji', 'samchon']
def family():
    for fid in FAM:
        p = os.path.join(SRC, f'fam_{fid}_raw.png')
        if not os.path.exists(p): continue
        qs = [trim(q) for q in quads(load(f'fam_{fid}_raw.png'))]
        # 비행 프레임(0·1)의 캐릭터 크기로 배율 결정 → 공격 이펙트는 셀 위쪽으로 넘쳐도 캐릭터 크기는 동일
        ref = max(max(q.size) for q in qs[:2]); sc = 66 / ref
        fr = [palettize(shrink(q, sc), 40) for q in qs]
        # 정렬: 프레임 하단(발·탈것) 기준 맞춤 → 셀 88, 공격 이펙트가 위로 크면 잘릴 수 있어 셀 높이 112
        strip = Image.new('RGBA', (88 * 4, 112), (0, 0, 0, 0))
        for i, f in enumerate(fr):
            if f.width > 88: f = f.crop(((f.width - 88) // 2, 0, (f.width - 88) // 2 + 88, f.height))
            if f.height > 112: f = f.crop((0, f.height - 112, f.width, f.height))
            strip.alpha_composite(f, (i * 88 + (88 - f.width) // 2, 112 - f.height - 6))
        save(strip, os.path.join(CH, fid, 'fly.png'), f'fam-{fid}')

# ── 적 4종 · 중형 · 보스 · 폭발 ──
def enemies():
    p = os.path.join(SRC, 'enemies_raw.png')
    if os.path.exists(p):
        for q, (name, size) in zip(quads(load('enemies_raw.png')), [('enemy-drone', 52), ('enemy-fighter', 58), ('enemy-orb', 54), ('enemy-wyvern', 66)]):
            save(sprite(q, size, colors=32), os.path.join(OUT, f'{name}.png'), name)
    p = os.path.join(SRC, 'midboss_raw.png')
    if os.path.exists(p):
        save(sprite(trim(load('midboss_raw.png')), 112, colors=40), os.path.join(OUT, 'enemy-gunship.png'), 'enemy-gunship')
    p = os.path.join(SRC, 'boss_raw.png')
    if os.path.exists(p):
        im = load('boss_raw.png'); w, h = im.size
        a = np.array(im); sx = best_split(a, 1, w // 2 - 300, w // 2 + 300)
        halves = [trim(im.crop((0, 0, sx, h))), trim(im.crop((sx, 0, w, h)))]
        sc = 230 / max(max(x.size) for x in halves)
        fr = [palettize(shrink(x, sc), 56) for x in halves]
        cw = max(f.width for f in fr); chh = max(f.height for f in fr)
        save(frames_to_strip(fr, cw, chh), os.path.join(OUT, 'boss.png'), 'boss')
    p = os.path.join(SRC, 'explosion_raw.png')
    if os.path.exists(p):
        qs = [trim(q) for q in quads(load('explosion_raw.png'))]
        sc = 72 / max(max(q.size) for q in qs)
        fr = [palettize(shrink(q, sc), 24, outline=False) for q in qs]
        save(frames_to_strip(fr, 80, 80), os.path.join(OUT, 'fx-explosion.png'), 'fx-explosion')

if __name__ == '__main__':
    backdrop(); props(); family(); enemies()
    print(json.dumps(report, ensure_ascii=False, indent=1))
