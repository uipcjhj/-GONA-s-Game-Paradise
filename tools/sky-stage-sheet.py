#!/usr/bin/env python3
"""스테이지 시트(마젠타 배경) → 투명 조각 PNG 들. 이후 tools/sky-art-import.py 로 게임 규격 변환.

  enemies  <시트> <출력폴더>   3x2 칸 → cell1..cell6.png (칸 가장자리 조각 제거)
  frames   <시트> <출력.png>   배경만 지운 투명 시트 (보스·중간보스 — import 가 프레임 분할)
"""
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage


def smooth_bg(rgb, step=9, seed=None):
    """마젠타 대신 그라디언트 배경이 온 경우: 가장자리에서 이웃과 색 차이가 작은 곳만 퍼져 나감 (굵은 외곽선에서 멈춤)"""
    from collections import deque
    h, w = rgb.shape[:2]
    bg = np.zeros((h, w), bool)
    q = deque()
    if seed is not None:  # 이미 지운 영역(마젠타)에서 출발 → 그 둘레의 은은한 빛 배경까지 지움
        bg |= seed
        for y, x in zip(*np.where(ndimage.binary_dilation(seed) & ~seed)):
            bg[y, x] = True; q.append((y, x))
    else:
        for x in range(w):
            for y in (0, h - 1):
                bg[y, x] = True; q.append((y, x))
        for y in range(h):
            for x in (0, w - 1):
                bg[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        c = rgb[y, x]
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not bg[ny, nx] and np.abs(rgb[ny, nx] - c).max() <= step:
                bg[ny, nx] = True; q.append((ny, nx))
    return bg


def key(im):
    a = np.array(im.convert('RGBA')).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    bg = (r > 150) & (b > 150) & (g < 120) & (np.abs(r - b) < 90)
    if bg.mean() < 0.15:  # 마젠타가 아님 → 매끈한 배경 제거
        bg = smooth_bg(a[..., :3])
        a[..., 3] = np.where(bg, 0, 255)
        return Image.fromarray(a.astype(np.uint8), 'RGBA')
    fringe = (r > 140) & (b > 110) & (g < 150) & (b > g + 30)
    if os.environ.get('GLOW'):  # 마젠타 안에 은은한 빛 배경이 그려진 시트
        bg = smooth_bg(a[..., :3], int(os.environ['GLOW']), bg)
    alpha = np.where(bg, 0, 255)
    alpha[ndimage.binary_dilation(bg, iterations=2) & fringe] = 0
    a[..., 3] = alpha
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


def clean(im):
    a = np.array(im)
    solid = a[..., 3] > 0
    lab, n = ndimage.label(solid, structure=np.ones((3, 3)))
    if n == 0:
        return im
    sizes = ndimage.sum(solid, lab, range(1, n + 1))
    big = int(np.argmax(sizes)) + 1
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0, big}
    for k in range(1, n + 1):
        if (k in edge and sizes[k - 1] < 0.3 * sizes[big - 1]) or sizes[k - 1] < 12:
            a[lab == k, 3] = 0
    out = Image.fromarray(a)
    return out.crop(out.getbbox())


mode, src, dst = sys.argv[1:4]
im = key(Image.open(src))
if mode == 'enemies-grid':
    # 그라디언트 배경 시트처럼 덩어리가 붙는 경우: 3x2 격자로 자른 뒤 칸마다 본체만 남김
    os.makedirs(dst, exist_ok=True)
    W, H = im.size
    for i in range(6):
        x, y = (i % 3) * W / 3, (i // 3) * H / 2
        c = clean(im.crop((int(x), int(y), int(x + W / 3), int(y + H / 2))))
        c.save(os.path.join(dst, f'cell{i + 1}.png'))
        print(f'cell{i + 1}', c.size)
elif mode == 'enemies':
    # 격자로 자르지 않고 '덩어리'로 찾음: 마스크를 조금 부풀려(김·날개 조각을 본체에 붙임) 큰 덩어리 6개 → 줄(위/아래)·왼쪽부터 순서
    os.makedirs(dst, exist_ok=True)
    a = np.array(im)
    solid = a[..., 3] > 0
    grown = ndimage.binary_dilation(solid, iterations=int(os.environ.get("GROW", "6")))
    lab, n = ndimage.label(grown)
    sizes = ndimage.sum(solid, lab, range(1, n + 1))
    order = np.argsort(sizes)[::-1][:6]
    boxes = []
    for k in order:
        ys, xs = np.where(lab == k + 1)
        boxes.append((k + 1, xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    H = a.shape[0]
    boxes.sort(key=lambda b: (0 if (b[2] + b[4]) / 2 < H / 2 else 1, b[1]))
    for i, (k, x0, y0, x1, y1) in enumerate(boxes):
        c = a[y0:y1, x0:x1].copy()
        c[lab[y0:y1, x0:x1] != k, 3] = 0
        out = Image.fromarray(c)
        out = out.crop(out.getbbox())
        out.save(os.path.join(dst, f'cell{i + 1}.png'))
        print(f'cell{i + 1}', out.size)
else:
    a = np.array(im)
    solid = a[..., 3] > 0
    lab, n = ndimage.label(solid, structure=np.ones((3, 3)))
    sizes = ndimage.sum(solid, lab, range(1, n + 1))
    for k in range(1, n + 1):
        if sizes[k - 1] < 30:
            a[lab == k, 3] = 0
    Image.fromarray(a).save(dst)
    print('저장', dst, im.size)
