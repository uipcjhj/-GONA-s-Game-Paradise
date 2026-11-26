"""한글 부제 '응가 대탈출 대작전' 픽셀(도트) 레터링: 갈무리(OFL) 비트맵 폰트를 원래 크기로 찍고
   도트 단위로 외곽선 2겹 · 가로줄 색 띠(F 로고 색) · 윗줄 하이라이트 · 아래 입체 그림자를 칠한 뒤 정수배 확대
   사용: python3 tools/sky-subtitle/pixel.py <out.png> <폰트 ttf> <폰트 px> [확대=8]"""
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
out, font, px = sys.argv[1], sys.argv[2], int(sys.argv[3])
Z = int(sys.argv[4]) if len(sys.argv) > 4 else 8
TEXT = '응가 대탈출 대작전'
f = ImageFont.truetype(font, px)
l, t, r, b = f.getbbox(TEXT)
W, H = r - l + 12, b - t + 12
m = Image.new('L', (W, H), 0)
ImageDraw.Draw(m).text((6 - l, 5 - t), TEXT, font=f, fill=255)
m = m.point(lambda v: 255 if v > 110 else 0)           # 도트만 (번짐 없음)
K = int(sys.argv[5]) if len(sys.argv) > 5 else 2        # 폰트 1도트 = K×K 칸 (외곽선이 글자 틈을 메우지 않게)
m = m.resize((W * K, H * K), Image.NEAREST); W, H = W * K, H * K
gb = m.getbbox(); top, bot = gb[1], gb[3]
def grow(mask, n=1):
    for _ in range(n): mask = mask.filter(ImageFilter.MaxFilter(3))
    return mask
def shift(mask, dx, dy):
    o = Image.new('L', mask.size, 0); o.paste(mask, (dx, dy)); return o
o1 = m                                                 # (안쪽 외곽 없음 · 글자 틈 유지)
sh = shift(m, 1, 2)                                    # 입체 (오른쪽 아래)
o2 = grow(Image.composite(m, sh, m), 1)                # 바깥 외곽 1칸 — 입체까지 감쌈
BANDS = ['#fffbe0', '#fce93f', '#fce93f', '#f7b82e', '#f7b82e', '#df8227', '#df8227', '#cb530b', '#a8400a']
img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
W0 = W
def fill(mask, col): img.paste(Image.new('RGBA', (W, H), col), (0, 0), mask)
o3 = grow(o2, 1)                                       # 금색 테 1칸 (F 로고 금속 테두리)
fill(o3, '#e8a830'); fill(o2, '#2f0601'); fill(sh, '#8a2106')
# 글자: 가로줄마다 색 띠
band = Image.new('RGBA', (W, H)); d = ImageDraw.Draw(band)
for y in range(H):
    k = min(len(BANDS) - 1, max(0, int((y - top) / max(1, bot - top) * len(BANDS))))
    d.line((0, y, W, y), fill=BANDS[k])
img.paste(band, (0, 0), m)
# 하이라이트: 위가 비어 있는 글자 도트(윗면)를 크림색으로
up = shift(m, 0, 1); hl = Image.eval(Image.merge('LA', (m, up)).getchannel(0), lambda v: v)
import numpy as np
a, u = np.array(m) > 0, np.array(up) > 0
edge = a & ~u
hi = Image.fromarray((edge * 255).astype('uint8'))
fill(hi, '#fffbe0')
bb = img.getbbox(); img = img.crop(bb)
img = img.resize((img.width * Z, img.height * Z), Image.NEAREST)
img.save(out, optimize=True)
print(out, img.size, '도트', bb[2] - bb[0], '×', bb[3] - bb[1])
