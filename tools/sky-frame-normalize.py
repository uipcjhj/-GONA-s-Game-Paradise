#!/usr/bin/env python3
"""서로 다른 시트에서 온 고나 프레임의 크기·바닥선 맞추기 (프레임 전환 때 커졌다 작아지거나 떠 보이지 않게)
 - 기준: opening3/a-full.png (앉은 고나) 의 '후드 볏 위 ~ 신발 바닥' 높이
 - 같은 자세(앉음)의 대응 프레임으로 배율을 구해 그 시트의 모든 프레임에 적용 → 200×200 칸, 바닥 196 에 맞춤
사용: python3 tools/sky-frame-normalize.py
"""
import os
from PIL import Image
D = 'public/assets/sky/v3-poop'
def bbox(p):
    return Image.open(os.path.join(D, p)).getbbox()
ref_h = (lambda b: b[3] - b[1])(bbox('opening3/a-full.png'))
def place(src, dst, s):
    im = Image.open(os.path.join(D, src)).convert('RGBA'); im = im.crop(im.getbbox())
    im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.NEAREST if s >= 1 else Image.LANCZOS)
    c = Image.new('RGBA', (max(200, im.width), max(200, im.height + 4)), (0, 0, 0, 0))
    c.alpha_composite(im, ((c.width - im.width) // 2, c.height - 4 - im.height))
    c.save(os.path.join(D, dst)); print(dst, c.size, f'x{s:.2f}')
# 시트별 배율 (앉은 자세 대응 프레임 높이 비교)
fam = {
    'canva': ('opening2/gona-strain.png', ['gona-eat', 'gona-pat', 'gona-startle', 'gona-strain']),
    'hf1': ('opening2/gona-cry.png', ['gona-cry', 'gona-strain2', 'gona-eat2', 'gona-sleep']),
}
for k, (refp, names) in fam.items():
    b = bbox(refp); s = ref_h / (b[3] - b[1]) * (0.97 if k == 'canva' else 1.0)
    for n in names:
        place(f'opening2/{n}.png', f'opening3/n-{n[5:]}.png', s)
# B 시트: 배율 그대로 · 바닥선만 맞춤 (나는 프레임 제외)
for n in ['strain0', 'sleep', 'wake', 'rub', 'giggle']:
    place(f'opening3/b-{n}.png', f'opening3/b-{n}.png', 1.0)
# B 시트 배율 보정: 날기 프레임 때문에 작게 잘린 시트 → 힘주기 시작(b-strain0)을 n-strain 높이에 맞춤
bs = bbox('opening3/b-strain0.png'); ns_ = bbox('opening3/n-strain.png')
sB = (ns_[3] - ns_[1]) / (bs[3] - bs[1]) * 0.98
if abs(sB - 1) > 0.03:
    for n in ['strain0', 'sleep', 'wake', 'rub', 'giggle']:
        place(f'opening3/b-{n}.png', f'opening3/b-{n}.png', sB)
