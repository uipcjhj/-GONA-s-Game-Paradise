"""[임시 에셋] 스테이지 2~6 용 색변환본 — 정식 원화가 나오기 전까지 기능 완성용.
스테이지 1 승인 에셋(배경·소품·적·보스)을 스테이지 팔레트로 색만 바꿔 public/assets/sky/v2/temp/s<N>/ 에 저장.
새로 그린 그림이 아님. 정식 교체 목록: docs/sky-art/asset-requests.md"""
import colorsys
import os
import numpy as np
from PIL import Image

SRC = 'public/assets/sky/v2/stage1'
NAMES = ['bg-backdrop', 'island-castle', 'island-ruins', 'island-small', 'island-tower', 'clocktower', 'airship', 'cloud-big', 'cloud-small',
         'enemy-drone', 'enemy-fighter', 'enemy-orb', 'enemy-wyvern', 'enemy-gunship', 'boss']
# 스테이지별 (색상 회전, 채도 배율, 명도 배율, 덧입힐 색, 덧입힘 비율)
PAL = {
    2: (-0.36, 1.05, 0.92, (40, 140, 90), 0.18),    # 마법의 버섯숲: 청록·초록
    3: (0.0, 0.35, 0.95, (176, 120, 64), 0.30),    # 기계도시: 녹슨 청동·강철
    4: (-0.2, 1.1, 0.85, (16, 96, 170), 0.28),      # 별빛의 심해: 남청·청록
    5: (0.22, 1.15, 0.8, (170, 20, 50), 0.25),      # 악몽의 달: 핏빛 붉은색
    6: (0.05, 0.55, 0.7, (60, 16, 96), 0.35),       # 마왕성: 어두운 보라
}
# 적·보스용 (기본색 빨강·황동 기준): 색상 회전, 채도, 명도, 덧입힐 색, 비율
EPAL = {
    2: (0.36, 0.95, 1.0, (40, 160, 110), 0.12),     # 청록 숲 생물·마법 기계
    3: (0.0, 0.3, 1.0, (176, 130, 80), 0.25),      # 강철·청동
    4: (0.52, 1.0, 1.0, (20, 120, 200), 0.15),     # 심해 청색
    5: (0.0, 1.1, 0.78, (120, 0, 30), 0.25),       # 핏빛 진홍
    6: (0.78, 0.6, 0.72, (40, 10, 70), 0.3),       # 어둠의 보라
}


def recolor(im, hs, ss, vs, tint, tk, keep_enemy=False):
    a = np.array(im.convert('RGBA')).astype(np.float32) / 255
    rgb = a[..., :3]
    mx = rgb.max(-1)
    mn = rgb.min(-1)
    v = mx
    d = mx - mn
    s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.zeros_like(mx)
    m = d > 1e-6
    rc = np.where(m, (mx - r) / np.maximum(d, 1e-6), 0)
    gc = np.where(m, (mx - g) / np.maximum(d, 1e-6), 0)
    bc = np.where(m, (mx - b) / np.maximum(d, 1e-6), 0)
    h = np.where(r == mx, bc - gc, np.where(g == mx, 2 + rc - bc, 4 + gc - rc))
    h = (h / 6) % 1
    h = (h + hs) % 1
    s = np.clip(s * ss, 0, 1)
    v = np.clip(v * vs, 0, 1)
    i = np.floor(h * 6).astype(int) % 6
    f = h * 6 - np.floor(h * 6)
    p = v * (1 - s)
    q = v * (1 - s * f)
    t = v * (1 - s * (1 - f))
    out = np.zeros_like(rgb)
    for k, (cr, cg, cb) in enumerate([(v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q)]):
        sel = i == k
        out[..., 0][sel] = cr[sel]
        out[..., 1][sel] = cg[sel]
        out[..., 2][sel] = cb[sel]
    tc = np.array(tint, np.float32) / 255
    out = out * (1 - tk) + tc * tk * (0.4 + 0.6 * v[..., None])
    res = np.dstack([np.clip(out, 0, 1), a[..., 3:4]])
    return Image.fromarray((res * 255).astype(np.uint8), 'RGBA')


for st, (hs, ss, vs, tint, tk) in PAL.items():
    out = f'public/assets/sky/v2/temp/s{st}'
    os.makedirs(out, exist_ok=True)
    for n in NAMES:
        im = Image.open(f'{SRC}/{n}.png')
        enemy = n.startswith('enemy') or n == 'boss'
        r = recolor(im, *EPAL[st]) if enemy else recolor(im, hs, ss, vs, tint, tk)
        r.save(f'{out}/{n}.png', optimize=True)
    print('stage', st)
