"""GONA's Sky Adventure 도트 제작 도구 (PIL + numpy)
 - 램프(어두움→밝음) 기반 명암, 베벨(좌상단 하이라이트·우하단 그림자), 베이어 디더링, 색 외곽선
 - 원본 얼굴/머리 도트는 quantize 후 그대로 붙여 정체성 유지
"""
import numpy as np
from PIL import Image, ImageDraw

def hx(h, a=255):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)

OUTLINE = hx('#1a1226')
RAMPS = {
    'green':   [hx(c) for c in ('#1d3f2b', '#2f6b34', '#5f9e3a', '#99b450', '#d2e68a')],   # 고나 슈트(원본 #99b450 계열)
    'yellow':  [hx(c) for c in ('#5a3a10', '#a8731a', '#e0a82c', '#f6d046', '#fff4a0')],
    'steel':   [hx(c) for c in ('#1c2438', '#37496a', '#5b7699', '#8fb0cf', '#d4e6f4')],
    'brass':   [hx(c) for c in ('#35200e', '#7a4a14', '#b87a1e', '#e8b53c', '#fff0a0')],
    'crimson': [hx(c) for c in ('#380f26', '#7a1c3c', '#bf3450', '#ee6a5c', '#ffb48c')],
    'pink':    [hx(c) for c in ('#4a1650', '#8a2a7a', '#c8489a', '#f07cb8', '#ffc8de')],
    'purple':  [hx(c) for c in ('#1c1440', '#3a2a78', '#6a4ab0', '#9a7ae0', '#d2bcff')],
    'teal':    [hx(c) for c in ('#0c2a38', '#1a5664', '#2c8f90', '#5cc8b8', '#bcf2e0')],
    'orange':  [hx(c) for c in ('#4a1a0c', '#9a3a12', '#e0701c', '#ffa83c', '#ffe48c')],
    'cream':   [hx(c) for c in ('#40344c', '#85788f', '#c4bcbe', '#ece4d6', '#ffffff')],
    'navy':    [hx(c) for c in ('#0a1228', '#182a58', '#2a4a8c', '#4a78c4', '#90b8f4')],
    'red':     [hx(c) for c in ('#3a0a14', '#781424', '#c02838', '#f05a48', '#ffa890')],
    'brown':   [hx(c) for c in ('#26140c', '#4e2c18', '#7e4a26', '#b0753c', '#e0b070')],
    'slate':   [hx(c) for c in ('#161c2c', '#2a3850', '#445a78', '#6f8aa8', '#a8c0d8')],
    'sky':     [hx(c) for c in ('#1a2c5c', '#2c5a9c', '#4a90c8', '#7cc4e4', '#c4ecf6')],
}
BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0


def shift(m, dx, dy):
    out = np.zeros_like(m)
    h, w = m.shape
    ys = slice(max(0, dy), min(h, h + dy)); yd = slice(max(0, -dy), min(h, h - dy))
    xs = slice(max(0, dx), min(w, w + dx)); xd = slice(max(0, -dx), min(w, w - dx))
    out[ys, xs] = m[yd, xd]
    return out


class Spr:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.a = np.zeros((h, w, 4), dtype=np.uint8)

    # ── 기본 ──
    def px(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.a[int(y), int(x)] = c

    def mask_fill(self, mask, ramp, light=(-0.7, -0.7), strength=1.0, flat=None):
        """마스크 영역을 램프로 칠함: 좌상단 광원 그라디언트 + 베벨 + 디더"""
        ys, xs = np.nonzero(mask)
        if len(xs) == 0:
            return
        n = len(ramp)
        x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
        gx = (xs - (x0 + x1) / 2) / max(1, (x1 - x0) / 2)
        gy = (ys - (y0 + y1) / 2) / max(1, (y1 - y0) / 2)
        g = -(gx * light[0] + gy * light[1])  # 좌상단일수록 +
        base = (n - 1) / 2 + 0.2
        val = base + g * 1.15 * strength
        val += (BAYER[ys % 4, xs % 4] - 0.5) * 0.9
        idx = np.clip(np.floor(val + 0.5), 0, n - 1).astype(int)
        if flat is not None:
            idx[:] = flat
        out = np.zeros(mask.shape, dtype=int) - 1
        out[ys, xs] = idx
        # 베벨
        hl = mask & ~shift(mask, 1, 1)
        hl2 = mask & ~shift(mask, 1, 0) | mask & ~shift(mask, 0, 1)
        sh = mask & ~shift(mask, -1, -1)
        sh2 = mask & ~shift(mask, -1, 0) | mask & ~shift(mask, 0, -1)
        for m, d in ((hl2, 1), (hl, 1), (sh2, -1), (sh, -1)):
            sel = m & (out >= 0)
            out[sel] = np.clip(out[sel] + d, 0, n - 1)
        for i in range(n):
            sel = out == i
            self.a[sel] = ramp[i]

    def poly(self, pts, ramp, **kw):
        im = Image.new('L', (self.w, self.h), 0)
        ImageDraw.Draw(im).polygon([tuple(p) for p in pts], fill=255)
        self.mask_fill(np.array(im) > 0, ramp if isinstance(ramp, list) else RAMPS[ramp], **kw)

    def ellipse(self, cx, cy, rx, ry, ramp, **kw):
        im = Image.new('L', (self.w, self.h), 0)
        ImageDraw.Draw(im).ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=255)
        self.mask_fill(np.array(im) > 0, ramp if isinstance(ramp, list) else RAMPS[ramp], **kw)

    def rect(self, x, y, w, h, ramp, **kw):
        m = np.zeros((self.h, self.w), dtype=bool)
        m[max(0, y):max(0, y + h), max(0, x):max(0, x + w)] = True
        self.mask_fill(m, ramp if isinstance(ramp, list) else RAMPS[ramp], **kw)

    def line(self, p0, p1, c, width=1):
        im = Image.new('RGBA', (self.w, self.h), (0, 0, 0, 0))
        ImageDraw.Draw(im).line([tuple(p0), tuple(p1)], fill=c, width=width)
        arr = np.array(im)
        sel = arr[..., 3] > 0
        self.a[sel] = arr[sel]

    def paste(self, img, x, y):
        arr = np.array(img.convert('RGBA'))
        h, w = arr.shape[:2]
        for yy in range(h):
            for xx in range(w):
                if arr[yy, xx, 3] > 0 and 0 <= x + xx < self.w and 0 <= y + yy < self.h:
                    self.a[y + yy, x + xx] = arr[yy, xx]

    def solid(self):
        return self.a[..., 3] > 0

    def outline(self, color=OUTLINE, diag=False):
        s = self.solid()
        edge = ~s & (shift(s, 1, 0) | shift(s, -1, 0) | shift(s, 0, 1) | shift(s, 0, -1))
        if diag:
            edge |= ~s & (shift(s, 1, 1) | shift(s, -1, -1) | shift(s, 1, -1) | shift(s, -1, 1))
        self.a[edge] = color
        return self

    def img(self):
        return Image.fromarray(self.a, 'RGBA')


def quant(img, colors=16, step=26):
    """원본 스프라이트(안티앨리어싱 섞임)의 색을 계단식으로 묶어 도트를 또렷하게 — 얼굴 점·입 같은 희귀색은 보존, 알파는 이진화"""
    img = img.convert('RGBA')
    arr = np.array(img)
    a = arr[..., 3]
    rgb = (arr[..., :3].astype(int) // step) * step + step // 2
    out = np.dstack([np.clip(rgb, 0, 255).astype(np.uint8), np.where(a > 100, 255, 0).astype(np.uint8)])
    return Image.fromarray(out, 'RGBA')


def crop_rows(img, y0, y1):
    return img.crop((0, y0, img.width, y1))


def zoom(img, k):
    return img.resize((img.width * k, img.height * k), Image.NEAREST)


def tint_flash(img, color=(255, 255, 255), amt=0.7):
    a = np.array(img).astype(float)
    m = a[..., 3] > 0
    for i in range(3):
        a[..., i][m] = a[..., i][m] * (1 - amt) + color[i] * amt
    return Image.fromarray(a.astype(np.uint8), 'RGBA')
