"""확정 픽셀아트 앱 아이콘(사용자 제공) → PWA/iOS 아이콘 원본(정사각·불투명)
   원본 그림은 다시 그리지 않음: 바깥 흰 여백과 둥근 테두리(이미지 가장자리와 이어진 흰 영역)만
   가장 가까운 안쪽 배경색으로 채워 꽉 찬 정사각형으로 만들고, 필요하면 안전 여백만큼 축소해 가장자리를 같은 방식으로 채움
   사용: python3 tools/sky-icon.py <원본> <out.png> [안전여백 비율=0]"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage
src, out = sys.argv[1], sys.argv[2]
pad = float(sys.argv[3]) if len(sys.argv) > 3 else 0.0
im = np.array(Image.open(src).convert('RGB')).astype(np.int16)
H, W, _ = im.shape
white = (im > 232).all(axis=2)
lab, n = ndimage.label(white)
edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
outer = np.isin(lab, list(edge))
outer = ndimage.binary_dilation(outer, iterations=2)          # 흰 여백과 맞닿은 안티에일리어스 테두리까지
def fill(img, mask):
    idx = ndimage.distance_transform_edt(mask, return_distances=False, return_indices=True)
    return img[idx[0], idx[1]]
im = fill(im, outer)
img = Image.fromarray(im.astype(np.uint8))
if pad > 0:   # 안전 여백: 그림을 줄여 가운데 두고 바깥은 가장 가까운 색으로 이어 칠함
    s = round(W * (1 - 2 * pad))
    small = img.resize((s, s), Image.LANCZOS)
    big = np.zeros((H, W, 3), np.int16); m = np.ones((H, W), bool)
    o = (W - s) // 2
    big[o:o + s, o:o + s] = np.array(small); m[o:o + s, o:o + s] = False
    img = Image.fromarray(fill(big, m).astype(np.uint8))
img.save(out)
print(out, img.size, '바깥 흰 영역 채움', int(outer.sum()), 'px')
