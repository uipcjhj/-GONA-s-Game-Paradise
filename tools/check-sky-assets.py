#!/usr/bin/env python3
"""ChatGPT 등 외부에서 납품된 신규 아트의 규격 검수 (게임에는 아직 연결하지 않음).
 사용: python3 tools/check-sky-assets.py [캐릭터id ...]
 위치: public/assets/sky/v2/chars/<id>/{illust,cutin,portrait,sprite}.png
"""
import os, sys
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'sky', 'v2', 'chars')
IDS = ['gona', 'mom', 'dad', 'imo', 'halmeoni', 'halabeoji', 'samchon']
ROWS = [('fly', 4), ('bankL', 2), ('bankR', 2), ('shoot', 3), ('charge', 3), ('bomb', 3), ('hurt', 2), ('win', 2)]
CELL = {'halabeoji': (128, 112)}      # 비행선 함장은 큰 셀
SPEC = {'illust': ('세로형 ≥1024×1536', lambda w, h: w >= 1024 and h >= 1536 and h > w),
        'cutin': ('가로형 ≥1200×600', lambda w, h: w >= 1200 and h >= 600 and w > h),
        'portrait': ('정사각 ≥128', lambda w, h: w == h and w >= 128)}

def check(cid):
    d = os.path.join(ROOT, cid); out = []
    for name, (desc, ok) in SPEC.items():
        p = os.path.join(d, f'{name}.png')
        if not os.path.exists(p): out.append(f'  ✗ {name}.png 없음 ({desc})'); continue
        im = Image.open(p); out.append(f'  {"✓" if ok(*im.size) else "✗"} {name}.png {im.size[0]}×{im.size[1]} ({desc})')
    p = os.path.join(d, 'sprite.png'); cw, ch = CELL.get(cid, (96, 96))
    if not os.path.exists(p): out.append(f'  ✗ sprite.png 없음 (셀 {cw}×{ch}, 가로 4프레임 × {len(ROWS)}행)')
    else:
        im = Image.open(p).convert('RGBA'); w, h = im.size
        ok = w == cw * 4 and h == ch * len(ROWS)
        out.append(f'  {"✓" if ok else "✗"} sprite.png {w}×{h} (기대 {cw * 4}×{ch * len(ROWS)})')
        if ok:
            a = im.split()[3]
            for r, (nm, n) in enumerate(ROWS):
                for f in range(n):
                    if a.crop((f * cw, r * ch, (f + 1) * cw, (r + 1) * ch)).getbbox() is None: out.append(f'    ✗ 빈 프레임: {nm} #{f}')
            if a.getextrema()[0] != 0: out.append('    ✗ 투명 배경이 아님')
    return out

if __name__ == '__main__':
    ids = sys.argv[1:] or IDS
    for cid in ids:
        print(cid); print('\n'.join(check(cid)))
