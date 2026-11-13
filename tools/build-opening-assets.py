#!/usr/bin/env python3
"""
오프닝 전용 레이어 에셋 (재현 가능). 이미지 생성 AI(크레딧) 미사용.
모두 1칸 = 1도트 PNG 이며 화면에서는 고나와 같은 4px 정수 배율(image-rendering: pixelated)로 확대한다.
  - footprint.png : 공룡 발자국 (모래에 찍힌 갈색)
  - gona-fly.png  : 날개를 펼친 고나 실루엣 — 몸통은 승인된 고나 스프라이트(gona.png)의 알파 그대로 + 익룡 날개
  - spark.png     : 작은 별 반짝임
고나 스프라이트·배경·로고·부제 파일은 읽기만 하고 수정하지 않는다.

  pip install pillow numpy && python3 tools/build-opening-assets.py
"""
import os
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public/assets/opening')
os.makedirs(OUT, exist_ok=True)


def hexrgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def dilate(mask):
    p = np.pad(mask, 1)
    h, w = mask.shape
    out = np.zeros_like(mask)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            out |= p[1 + dy:1 + dy + h, 1 + dx:1 + dx + w]
    return out


def shift(mask, dx, dy):
    out = np.zeros_like(mask)
    h, w = mask.shape
    out[max(0, dy):min(h, h + dy), max(0, dx):min(w, w + dx)] = mask[max(0, -dy):min(h, h - dy), max(0, -dx):min(w, w - dx)]
    return out


def save(rgba, name):
    Image.fromarray(rgba, 'RGBA').save(os.path.join(OUT, name))
    print('saved', name, rgba.shape[1], 'x', rgba.shape[0])


def footprint():
    # 발톱 달린 3발가락 + 발바닥 (13×14도트 손그림)
    rows = [
        '......X......',
        '.....XXX.....',
        '.....XXX.....',
        '.X...XXX...X.',
        'XXX..XXX..XXX',
        'XXX..XXX..XXX',
        'XXX..XXX..XXX',
        '.XXX.XXX.XXX.',
        '..XXXXXXXXX..',
        '..XXXXXXXXX..',
        '...XXXXXXX...',
        '...XXXXXXX...',
        '....XXXXX....',
        '.....XXX.....',
    ]
    H, W = len(rows), len(rows[0])
    m = np.zeros((H + 2, W + 2), bool)
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            m[j + 1, i + 1] = ch == 'X'
    out = np.zeros(m.shape + (4,), np.uint8)
    line = dilate(m) & ~m
    out[line] = (*hexrgb('#5a3a28'), 255)
    out[m] = (*hexrgb('#a8774a'), 255)
    out[m & ~shift(m, 1, 1)] = (*hexrgb('#c9a06c'), 255)    # 왼쪽 위 밝은 면
    out[m & ~shift(m, -1, -1)] = (*hexrgb('#85583a'), 255)  # 오른쪽 아래 어두운 면
    save(out, 'footprint.png')


def fly():
    sp = np.array(Image.open(os.path.join(ROOT, 'public/assets/gona.png')).convert('RGBA'))
    sh, sw = sp.shape[:2]
    W, H = 80, 44
    body = np.zeros((H, W), bool)
    ox, oy = (W - sw) // 2, 8
    body[oy:oy + sh, ox:ox + sw] = sp[..., 3] > 0           # 승인된 고나 실루엣 그대로

    cx = ox + 13                                            # 몸통 중심
    sy = oy + 17                                            # 어깨 높이

    def wing(sign):
        pts = [(cx + sign * 8, sy + 1), (cx + sign * 16, sy - 7), (cx + sign * 26, sy - 14), (cx + sign * 37, sy - 18),
               (cx + sign * 35, sy - 9), (cx + sign * 38, sy - 6), (cx + sign * 31, sy - 2), (cx + sign * 33, sy + 4),
               (cx + sign * 26, sy + 2), (cx + sign * 25, sy + 8), (cx + sign * 18, sy + 5), (cx + sign * 15, sy + 11),
               (cx + sign * 10, sy + 7), (cx + sign * 8, sy + 9)]
        img = Image.new('L', (W, H), 0)
        ImageDraw.Draw(img).polygon(pts, fill=255)
        return np.array(img) > 0
    m = body | wing(-1) | wing(1)
    out = np.zeros((H, W, 4), np.uint8)
    out[m] = (*hexrgb('#2a1a4a'), 255)
    out[m & ~shift(m, 0, 1)] = (*hexrgb('#4d3a80'), 255)    # 윗면 림 — 하늘색 위에서도 윤곽이 읽히게
    save(out, 'gona-fly.png')


def spark():
    rows = ['..y..', '..y..', 'yyWyy', '..y..', '..y..']
    pal = {'y': hexrgb('#ffd23f'), 'W': hexrgb('#ffffff')}
    out = np.zeros((5, 5, 4), np.uint8)
    for j, r in enumerate(rows):
        for i, ch in enumerate(r):
            if ch in pal:
                out[j, i] = (*pal[ch], 255)
    save(out, 'spark.png')


if __name__ == '__main__':
    footprint()
    fly()
    spark()
