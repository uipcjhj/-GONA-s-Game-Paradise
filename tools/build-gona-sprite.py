#!/usr/bin/env python3
"""고나 전투 스프라이트 시트 제작 (Higgsfield 생성 원본 → 96×96 셀, 4열×10행, 384×960)
 입력: art-src/sky/illust/gona/frames/<row>_raw.png  (2048² 이미지 안에 2×2 = 4프레임, 순서 ↖ ↗ ↙ ↘)
 처리(재그림 없음): 사분면 분리 → 몸통(연두) 크기 기준으로 행 단위 배율 통일 → 몸통 중심을 셀 중앙에 정렬
       → 박스 축소(프리멀티플라이 알파) → 알파 이진화 → 시트 전체 공용 팔레트(32색) → 바깥 1px 외곽선
 출력: public/assets/sky/v2/chars/gona/sprite.png + 검수 리포트(stdout)
"""
import os, sys, json
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'art-src/sky/illust/gona/frames')
OUT = os.path.join(ROOT, 'public/assets/sky/v2/chars/gona/sprite.png')
ROWS = ['fly', 'bankL', 'bankR', 'idle', 'shoot', 'charge', 'bomb', 'hurt', 'defeat', 'win']
CELL = 96
FIT = 88           # 캐릭터(날개 포함)가 들어갈 최대 크기 — 외곽선 1px + 여백
ANCHOR = (48, 52)  # 몸통 중심이 놓일 셀 좌표
OUTLINE = (26, 18, 38, 255)
# 약한 기울기 보정(고해상도 원본을 축소 전에 회전, 도: +는 반시계=왼쪽으로 기울기). 생성 결과가 목표(10~15°)보다 약해 보정
ROTATE = {('bankL', 0): 9, ('bankL', 1): 4, ('bankR', 0): -11, ('bankR', 1): -9}
# 큰 이펙트가 있는 프레임: 배율(캐릭터 크기) 계산에서 제외 — 이펙트만 셀 밖으로 나가면 잘릴 수 있음
EFFECT = {('shoot', 1), ('shoot', 2), ('charge', 1), ('charge', 2), ('charge', 3), ('bomb', 1), ('bomb', 2), ('bomb', 3), ('win', 3), ('hurt', 0)}

def best_split(a, axis, lo, hi):
    """그림이 가장 적게 걸치는 분할선 (이펙트가 사분면 경계를 넘는 경우 대비)"""
    s = (a[..., 3] > 32).sum(axis=1 - axis)
    seg = s[lo:hi]; return lo + int(np.argmin(seg))

def quadrants(im):
    a = np.array(im); w, h = im.size
    sy = best_split(a, 0, h // 2 - 220, h // 2 + 220)
    top, bot = a[:sy], a[sy:]
    sx_t = best_split(top, 1, w // 2 - 220, w // 2 + 220); sx_b = best_split(bot, 1, w // 2 - 220, w // 2 + 220)
    return [im.crop((0, 0, sx_t, sy)), im.crop((sx_t, 0, w, sy)), im.crop((0, sy, sx_b, h)), im.crop((sx_b, sy, w, h))]

def masks(a):
    r, g, b, al = [a[..., i].astype(int) for i in range(4)]
    solid = al >= 128
    green = solid & (r >= 110) & (r <= 205) & (g >= 95) & (g <= 182) & (b <= 80) & (r - g >= -12) & (r - g <= 48)   # 올리브 후드·슈트 (밝은 노랑 이펙트·주황 날개 제외)
    char = solid & ~((r > 225) & (g > 205) & (b > 120))                        # 아주 밝은 노랑/흰 이펙트 제외한 캐릭터 근사
    return solid, green, char

def bbox(m):
    ys, xs = np.nonzero(m)
    return (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1) if len(xs) else None

def main():
    frames = {}; report = {}
    for row in ROWS:
        p = os.path.join(SRC, f'{row}_raw.png')
        if not os.path.exists(p): print('없음:', row); sys.exit(1)
        im = Image.open(p).convert('RGBA')
        a = np.array(im); al = a[..., 3]
        a[..., 3] = np.where(al < 8, 0, np.where(al >= 240, 255, al))
        im = Image.fromarray(a, 'RGBA')
        qs = quadrants(im)
        qs = [q.rotate(ROTATE[(row, i)], resample=Image.BICUBIC, expand=True) if (row, i) in ROTATE else q for i, q in enumerate(qs)]
        # 사분면 경계를 넘는 그림이 있는지(분리 가능성) 검사
        w, h = im.size; s = a[..., 3] > 128
        cross = int(s[:, w // 2 - 1:w // 2 + 1].sum() + s[h // 2 - 1:h // 2 + 1, :].sum())
        info = []
        for q in qs:
            qa = np.array(q); solid, green, char = masks(qa)
            gb = bbox(green); cb = bbox(char); sb = bbox(solid)
            edge = bool(solid[0, :].any() or solid[-1, :].any() or solid[:, 0].any() or solid[:, -1].any())
            gy, gx = np.nonzero(green)
            cen = (float(gx.mean()), float(gy.mean())) if len(gx) else (q.width / 2, q.height / 2)
            info.append(dict(green=gb, char=cb, solid=sb, edge=edge, gh=float(np.sqrt(green.sum())), gw=(gb[2] - gb[0]) if gb else 0, cen=cen))
        frames[row] = qs; report[row] = dict(cross_px=cross, frames=info)
    # 행별 몸통 기준 크기(연두 영역 높이 중앙값) → 전체 공통 목표 크기 T
    med = {r: float(np.median([f['gh'] for f in report[r]['frames'] if f['gh'] > 0])) for r in ROWS}
    # T: 모든 프레임의 캐릭터 bbox 가 FIT 안에 들어가는 최대값
    T = 1e9
    M = 2  # 셀 가장자리 여유(외곽선 1px 포함)
    for r in ROWS:
        for fi_, f in enumerate(report[r]['frames']):
            if not f['solid'] or (r, fi_) in EFFECT: continue   # 큰 이펙트 프레임은 배율 계산에서 제외 (캐릭터 크기 우선)
            x0, y0, x1, y1 = f['solid']; cx, cy = f['cen']
            lims = [(cx - x0, ANCHOR[0] - M), (x1 - cx, CELL - ANCHOR[0] - M), (cy - y0, ANCHOR[1] - M), (y1 - cy, CELL - ANCHOR[1] - M)]
            for ext, room in lims:
                if ext > 0: T = min(T, room * med[r] / ext)
    sheet = Image.new('RGBA', (CELL * 4, CELL * len(ROWS)), (0, 0, 0, 0))
    placed = {}
    for ri, r in enumerate(ROWS):
        sc = T / med[r]
        for fi, q in enumerate(frames[r]):
            f = report[r]['frames'][fi]
            qa = np.array(q)
            _, green, _ = masks(qa)
            gy, gx = np.nonzero(green)
            cx, cy = (gx.mean(), gy.mean()) if len(gx) else (q.width / 2, q.height / 2)
            nw, nh = max(1, round(q.width * sc)), max(1, round(q.height * sc))
            small = q.convert('RGBa').resize((nw, nh), Image.BOX).convert('RGBA')
            sa = np.array(small); sa[..., 3] = np.where(sa[..., 3] >= 110, 255, 0)
            small = Image.fromarray(sa, 'RGBA')
            ox = int(round(ANCHOR[0] - cx * sc)); oy = int(round(ANCHOR[1] - cy * sc))
            cell = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0)); cell.alpha_composite(small, (0, 0) if False else (0, 0)) if False else None
            canvas = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
            # 셀 밖으로 나가는 부분 측정
            full = Image.new('RGBA', (CELL + 400, CELL + 400), (0, 0, 0, 0)); full.alpha_composite(small, (ox + 200, oy + 200))
            fa_rgba = np.array(full); fa = fa_rgba[..., 3] > 0
            rr, gg, bb = [fa_rgba[..., i].astype(int) for i in range(3)]
            fx = fa & (rr > 215) & (gg > 185)          # 밝은 노랑·흰 이펙트(볏 일부 포함 가능)
            ch_m = fa & ~fx
            inside = fa[200:200 + CELL, 200:200 + CELL].sum(); total = fa.sum()
            ch_clip = int(ch_m.sum() - ch_m[200:200 + CELL, 200:200 + CELL].sum())
            canvas = full.crop((200, 200, 200 + CELL, 200 + CELL))
            sheet.alpha_composite(canvas, (fi * CELL, ri * CELL))
            placed[f'{r}{fi}'] = dict(scale=round(sc, 4), clipped_px=int(total - inside), char_clipped_px=ch_clip)
    # 공용 팔레트(32색) + 바깥 외곽선
    sa = np.array(sheet); op = sa[..., 3] > 0
    rgb = Image.fromarray(sa[..., :3], 'RGB').quantize(colors=32, method=Image.MEDIANCUT, dither=Image.NONE).convert('RGB')
    q = np.array(rgb); sa[..., :3] = np.where(op[..., None], q, 0)
    edge = ~op & (np.roll(op, 1, 0) | np.roll(op, -1, 0) | np.roll(op, 1, 1) | np.roll(op, -1, 1))
    # 셀 경계를 넘는 외곽선 방지: 각 셀 안에서만
    for y in range(sa.shape[0]):
        for x in range(sa.shape[1]):
            if edge[y, x]:
                cyc, cxc = y // CELL, x // CELL
                nb = [(y + dy, x + dx) for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= y + dy < sa.shape[0] and 0 <= x + dx < sa.shape[1] and (y + dy) // CELL == cyc and (x + dx) // CELL == cxc]
                if any(op[p] for p in nb): sa[y, x] = OUTLINE
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    Image.fromarray(sa, 'RGBA').save(OUT)
    print(json.dumps(dict(target_green_px=round(T, 1), row_median_green=med, quadrant_cross_px={r: report[r]['cross_px'] for r in ROWS},
                          src_edge_touch={r: [f['edge'] for f in report[r]['frames']] for r in ROWS}, placed=placed), ensure_ascii=False, indent=1))

if __name__ == '__main__':
    main()
