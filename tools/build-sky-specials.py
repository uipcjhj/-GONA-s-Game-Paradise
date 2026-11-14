"""필살기 원화 → 게임 스프라이트 (art-src/sky/specials/*_raw.png → public/assets/sky/v2/fx/)
2배 격자: 게임에서 논리 0.5배로 표시. BOX 축소 → 이진 알파 → 팔레트 양자화 → (메카만) 1px 외곽선"""
import os
import numpy as np
from PIL import Image

SRC = 'art-src/sky/specials'
OUT = 'public/assets/sky/v2/fx'


def prep(name, w, colors, outline, fix=None):
    im = Image.open(f'{SRC}/{name}_raw.png').convert('RGBA')
    a = np.array(im).astype(float)
    if fix:
        a = fix(a)
    al = a[..., 3:4] / 255
    pm = a.copy()
    pm[..., :3] *= al
    im = Image.fromarray(pm.astype(np.uint8), 'RGBA')
    bb = im.getbbox()
    im = im.crop(bb)
    h = round(im.height * w / im.width)
    im = im.resize((w, h), Image.BOX)
    a = np.array(im).astype(float)
    al = a[..., 3:4] / 255
    rgb = np.where(al > 0, a[..., :3] / np.maximum(al, 1e-3), 0)
    alpha = (a[..., 3] > 110).astype(np.uint8) * 255
    q = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), 'RGB').quantize(colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    out = np.dstack([np.array(q), alpha])
    if outline:
        s = alpha > 0
        e = np.zeros_like(s)
        e[1:] |= s[:-1]; e[:-1] |= s[1:]; e[:, 1:] |= s[:, :-1]; e[:, :-1] |= s[:, 1:]
        e &= ~s
        out[e] = (26, 18, 38, 255)
        pad = np.zeros((out.shape[0] + 2, out.shape[1] + 2, 4), np.uint8)
        pad[1:-1, 1:-1] = out
        out = pad
    Image.fromarray(out, 'RGBA').save(f'{OUT}/{name}.png')
    print(name, out.shape[1], out.shape[0])


def brown_hair(a):
    # 조종석의 흰 머리 → 삼촌의 갈색 곱슬머리 (돔 안쪽 영역만)
    h, w = a.shape[:2]
    y0, y1, x0, x1 = int(h * 0.26), int(h * 0.46), int(w * 0.38), int(w * 0.62)
    reg = a[y0:y1, x0:x1]
    r, g, b = reg[..., 0], reg[..., 1], reg[..., 2]
    m = (r > 150) & (g > 150) & (b > 140) & (np.abs(r - b) < 45)
    lum = (r + g + b) / 3 / 255
    reg[..., 0] = np.where(m, 70 + 70 * lum, r)
    reg[..., 1] = np.where(m, 40 + 45 * lum, g)
    reg[..., 2] = np.where(m, 22 + 25 * lum, b)
    return a


prep('mech', 150, 40, True, brown_hair)
prep('roar', 340, 24, False)
