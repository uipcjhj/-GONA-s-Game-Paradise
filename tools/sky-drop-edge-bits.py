#!/usr/bin/env python3
"""시트에서 칸을 잘랐을 때 옆 칸 그림 조각이 딸려 오면 제거: 칸 가장자리에 닿은 덩어리를 지우고 남은 부분으로 다듬기
사용: python3 tools/sky-drop-edge-bits.py <png>... (투명 PNG 덮어씀)"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage
for p in sys.argv[1:]:
    a = np.array(Image.open(p).convert('RGBA'))
    solid = a[..., 3] > 0
    lab, n = ndimage.label(solid, structure=np.ones((3, 3)))
    sizes = ndimage.sum(solid, lab, range(1, n + 1))
    big = int(np.argmax(sizes)) + 1
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0, big}
    edge = {k for k in edge if sizes[k - 1] < 0.3 * sizes[big - 1]}  # 큰 덩어리(본체)는 가장자리에 닿아도 남김
    for k in edge:
        a[lab == k, 3] = 0
    im = Image.fromarray(a)
    im = im.crop(im.getbbox())
    im.save(p)
    print(p.split('/')[-1], im.size, f'가장자리 조각 {len(edge)}개 제거')
