#!/usr/bin/env python3
"""테스트 허브 갤러리용 작은 미리보기 (원본은 눌렀을 때만 받음) → public/assets/sky/v3-poop/thumbs/<같은 경로>.webp
사용: python3 tools/sky-thumbs.py  (그림을 추가하면 다시 실행)"""
import os
from PIL import Image
D = 'public/assets/sky/v3-poop'
n = 0
for root, _, files in os.walk(D):
    if '/thumbs' in root or root.endswith('thumbs'):
        continue
    for f in files:
        if not f.lower().endswith(('.png', '.jpg', '.jpeg')):
            continue
        src = os.path.join(root, f)
        rel = os.path.relpath(src, D)
        dst = os.path.join(D, 'thumbs', os.path.splitext(rel)[0] + '.webp')
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        im = Image.open(src)
        im = im.convert('RGBA' if im.mode in ('RGBA', 'LA', 'P') else 'RGB')
        im.thumbnail((240, 240), Image.NEAREST if max(im.size) <= 480 else Image.LANCZOS)
        im.save(dst, 'WEBP', quality=80)
        n += 1
print('thumbs', n)
