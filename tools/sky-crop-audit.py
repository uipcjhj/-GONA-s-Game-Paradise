#!/usr/bin/env python3
"""잘림 검사: 그림(프레임별) 가장자리에 '곧게 잘린' 불투명 띠가 있는지 — 가장 긴 연속 불투명 길이로 판정
사용: python3 tools/sky-crop-audit.py   (기준: 연속 ≥ 18px 이고 그 변 길이의 12% 이상이면 의심)"""
import os, json, numpy as np
from PIL import Image
D = 'public/assets/sky/v3-poop'
man = json.load(open(os.path.join(D, 'manifest.json')))['files']
def run(v):
    best = cur = 0
    for x in v:
        cur = cur + 1 if x else 0
        best = max(best, cur)
    return best
out = []
for root, _, fs in os.walk(D):
    if 'thumbs' in root: continue
    for f in fs:
        if not f.endswith('.png'): continue
        p = os.path.join(root, f); rel = os.path.relpath(p, D)
        im = Image.open(p)
        if im.mode != 'RGBA': continue
        a = np.array(im)[..., 3] > 100
        meta = man.get(rel, {}) or {}
        n = meta.get('frames', 1) if isinstance(meta, dict) else 1
        if rel.endswith('/fly.png'): n = 4
        if 'cutin' in rel or 'face' in rel or 'bg-' in rel: continue
        fw = a.shape[1] // n
        for i in range(n):
            fr = a[:, i * fw:(i + 1) * fw]
            sides = {'위': fr[0], '아래': fr[-1], '왼': fr[:, 0], '오른': fr[:, -1]}
            bad = {k: run(v) for k, v in sides.items() if run(v) >= 18 and run(v) >= 0.12 * len(v)}
            if bad: out.append(f'{rel}' + (f' #{i + 1}' if n > 1 else '') + ' ' + ' '.join(f'{k}{v}px' for k, v in bad.items()))
print('\n'.join(sorted(out)) or '없음')
