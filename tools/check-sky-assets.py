#!/usr/bin/env python3
"""ChatGPT 등 외부에서 납품된 신규 아트의 규격 검수 (게임에는 아직 연결하지 않음).
 사용: python3 tools/check-sky-assets.py [캐릭터id ...]
 위치: public/assets/sky/v2/chars/<id>/{illust,cutin,portrait,sprite}.png
"""
import os, sys
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'sky', 'v2', 'chars')
IDS = ['gona', 'mom', 'dad', 'imo', 'halmeoni', 'halabeoji', 'samchon']
ROWS = [('fly', 4), ('bankL', 4), ('bankR', 4), ('idle', 4), ('shoot', 4), ('charge', 4), ('bomb', 4), ('hurt', 4), ('defeat', 4), ('win', 4)]
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
    if not os.path.exists(p): out.append(f'  ✗ sprite.png 없음 (셀 {cw}×{ch}, 가로 4프레임 × {len(ROWS)}행 = {cw * 4}×{ch * len(ROWS)})')
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
            vals = set(a.getdata()) if hasattr(a, 'getdata') else set()
            if vals - {0, 255}: out.append(f'    △ 반투명 알파 {len(vals - {0, 255})}종 (도트 스프라이트는 0/255 권장)')
            touch = []
            for r, (nm, n) in enumerate(ROWS):
                for f in range(n):
                    c = a.crop((f * cw, r * ch, (f + 1) * cw, (r + 1) * ch))
                    w2, h2 = c.size; px = c.load()
                    if any(px[x, 0] or px[x, h2 - 1] for x in range(w2)) or any(px[0, y] or px[w2 - 1, y] for y in range(h2)): touch.append(f'{nm}#{f}')
            out.append(f'    {"✓" if not touch else "✗"} 셀 가장자리 접촉(잘림 의심) {len(touch)}칸' + (f': {", ".join(touch)}' if touch else ''))
    return out

if __name__ == '__main__':
    ids = sys.argv[1:] or IDS
    for cid in ids:
        print(cid); print('\n'.join(check(cid)))
