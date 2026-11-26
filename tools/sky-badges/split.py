"""사용자 확정 배지 시트(4행×8열·32종 · 투명 배경) → 배지별 PNG (한글 명판 제거 · 원본 화소 그대로 · 확대 없음)
   1) 명판 높이 찾기: 한 행의 명판 8개는 같은 높이 → 시트 전체에서 '어두운 갈색이 가로로 넓게 이어지는 줄'의 첫 줄 = 명판 바깥 윗선
   2) 칸마다 그 줄 바로 위까지를 메달로 · 가장 큰 덩어리만(옆 칸 조각 제외) · 흐린 그림자(알파 낮은 화소) 정리
   3) 모든 배지를 같은 정사각 캔버스(가장 큰 배지 + 여백)에 가운데 맞춤 — 원본 화소 · 크기 비율 그대로
   사용: python3 tools/sky-badges/split.py <sheet.png> <outdir>"""
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
A = np.array(Image.open(src).convert('RGBA'))
H, W = A.shape[:2]
dark = (A[..., :3].max(axis=2) < 95) & (A[..., 3] > 200)
prof = dark.sum(axis=1)
band = H / 4
cuts = []
for r in range(4):
    y0, y1 = int(r * band), int((r + 1) * band)
    ys = [y for y in range(y0 + int(band * 0.45), y1) if prof[y] > 340]
    cuts.append(min(ys))
print('명판 윗선', cuts)
crops = []
for r in range(4):
    # 좌우 경계: 이 행의 메달 영역에서 진하게 칠해진 화소(알파>230)가 없는 빈 열 = 배지 사이 틈 (7개)
    ya = int(r * band) if r == 0 else cuts[r - 1] + 30
    col = (A[ya:cuts[r] - 1, :, 3] > 230).sum(axis=0)
    gaps, st = [], None
    for x, v in enumerate(list(col) + [1]):
        if v == 0 and st is None: st = x
        if v > 0 and st is not None: gaps.append((st, x)); st = None
    gaps = sorted([g for g in gaps if 0 < g[0] and g[1] < W], key=lambda g: g[1] - g[0], reverse=True)[:7]
    gaps.sort()
    assert len(gaps) == 7, (r, gaps)
    edges = [0] + [(g[0] + g[1]) // 2 for g in gaps] + [W]
    for c in range(8):
        x0, x1 = edges[c], edges[c + 1]
        y0 = ya
        y1 = cuts[r] + 12                     # 명판 윗선 아래 12줄까지 보고, 그 구간은 가운데 보석 화소만 살림
        x0 = max(0, x0); x1 = min(W, x1)
        cell = A[y0:y1, x0:x1].copy()
        cy = cuts[r] - 1 - y0                 # 메달/명판 경계 (cell 좌표)
        m = cell[..., 3] > 140
        m[cy:] = False
        lab, n = ndimage.label(m)
        cnt = np.bincount(lab.ravel()); cnt[0] = 0
        big = int(np.argmax(cnt))
        keep = ndimage.binary_dilation(lab == big, iterations=2) & (cell[..., 3] > 0)
        keep[cy:] = False
        # 가운데 보석: 경계 아래 구간에서 메달 가운데 ±11px · 금색/갈색/어두운 테두리가 아닌 채도 높은 화소
        xs_m = np.nonzero(keep.any(axis=0))[0]; mx = (xs_m.min() + xs_m.max()) // 2
        rgb = cell[..., :3].astype(int)
        for yy in range(cy, cell.shape[0]):
            for xx in range(max(0, mx - 11), min(cell.shape[1], mx + 12)):
                R, G, B = rgb[yy, xx]
                sat = max(R, G, B) - min(R, G, B)
                gold = R >= G >= B and R > 120
                if cell[yy, xx, 3] > 140 and sat > 60 and not gold: keep[yy, xx] = True
        # 보석 구조: 메달 본체와 이어진 것만 (명판 윗선 잔여 화소 제거)
        lab3, _ = ndimage.label(keep)
        core = lab3[:cy][lab3[:cy] > 0]
        main_id = np.argmax(np.bincount(core)) if core.size else 0
        keep = lab3 == main_id
        # 옆 칸 조각: 비어 있는 열로 끊긴 가장 큰 연속 열 묶음만
        colsum = (keep & (cell[..., 3] > 0)).sum(axis=0)
        runs, st = [], None
        for i, v in enumerate(list(colsum) + [0]):
            if v > 0 and st is None: st = i
            if v == 0 and st is not None: runs.append((st, i)); st = None
        a0, a1 = max(runs, key=lambda q: colsum[q[0]:q[1]].sum())
        keep[:, :a0] = False; keep[:, a1:] = False
        cell[~keep] = 0
        cell[..., 3] = np.where(cell[..., 3] < 70, 0, cell[..., 3])      # 흐린 그림자·잔광 제거
        ys, xs = np.nonzero(cell[..., 3])
        crops.append(Image.fromarray(cell).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)))
S = max(max(c.size) for c in crops) + 4
for i, cr in enumerate(crops, 1):
    cv = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    cv.alpha_composite(cr, ((S - cr.width) // 2, (S - cr.height) // 2))
    cv.save(f'{out}/badge-{i:02d}.png', optimize=True)
    print(i, cr.size)
print('캔버스', S)
