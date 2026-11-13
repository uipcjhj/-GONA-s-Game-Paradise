"""관절 리그 + 마스크 그룹 음영: 같은 디자인을 스프라이트(k=1)·일러스트(k=3)·컷인(k=5)으로 각각 직접 그려냄
 - 원본 스프라이트 픽셀은 일절 사용하지 않음 (얼굴 특징·헤어·안경·색만 참고해 새로 디자인)
 - 디자인 좌표계: 1 단위 = 게임용 스프라이트 1픽셀, 원점 = 골반, y 아래가 +
 - 각도: 0 = 아래, +는 +x(오른쪽) 방향, 180 = 위
"""
import math
import numpy as np
from PIL import Image, ImageDraw
from kit import *


class Fig:
    def __init__(s, w, h, k, ox, oy):
        s.spr = Spr(w, h); s.w, s.h, s.k, s.ox, s.oy = w, h, k, ox, oy
        s._m = None; s._d = None

    def T(s, p):
        return (s.ox + p[0] * s.k, s.oy + p[1] * s.k)

    # 마스크 그룹
    def begin(s):
        s._m = Image.new('L', (s.w, s.h), 0); s._d = ImageDraw.Draw(s._m)
        return s

    def poly(s, pts):
        s._d.polygon([s.T(p) for p in pts], fill=255); return s

    def ell(s, cx, cy, rx, ry):
        c = s.T((cx, cy)); s._d.ellipse((c[0] - rx * s.k, c[1] - ry * s.k, c[0] + rx * s.k, c[1] + ry * s.k), fill=255); return s

    def limb(s, a, b, w0, w1):
        dx, dy = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dy) or 1; nx, ny = -dy / L, dx / L
        s.poly([(a[0] + nx * w0 / 2, a[1] + ny * w0 / 2), (b[0] + nx * w1 / 2, b[1] + ny * w1 / 2), (b[0] - nx * w1 / 2, b[1] - ny * w1 / 2), (a[0] - nx * w0 / 2, a[1] - ny * w0 / 2)])
        s.ell(a[0], a[1], w0 / 2, w0 / 2); s.ell(b[0], b[1], w1 / 2, w1 / 2); return s

    def commit(s, ramp, light=(-0.6, -0.8), strength=1.0, flat=None, edge=0):
        ramp = RAMPS[ramp] if isinstance(ramp, str) else ramp
        m = np.array(s._m) > 0
        s.spr.mask_fill(m, ramp, light=light, strength=strength, flat=flat)
        if edge:  # 부위 사이를 구분하는 안쪽 윤곽(선택 외곽선)
            e = m & (~shift(m, 1, 0) | ~shift(m, -1, 0) | ~shift(m, 0, 1) | ~shift(m, 0, -1))
            s.spr.a[e] = ramp[0] if edge == 1 else ramp[1]
        s._m = None
        return s

    # 직접 그리기 (설계 단위)
    def px(s, x, y, c, n=1):
        X, Y = s.T((x, y))
        for i in range(int(s.k * n)):
            for j in range(int(s.k)):
                s.spr.px(int(X) + i, int(Y) + j, c)

    def line(s, a, b, c, w=1):
        im = Image.new('RGBA', (s.w, s.h), (0, 0, 0, 0))
        ImageDraw.Draw(im).line([s.T(a), s.T(b)], fill=c, width=max(1, int(round(w * s.k))))
        arr = np.array(im); sel = arr[..., 3] > 0; s.spr.a[sel] = arr[sel]

    def done(s, outline=True, color=OUTLINE):
        if outline:
            s.spr.outline(color, diag=False)
            if s.k >= 3: s._thick(color)
        return s.spr.img()

    def _thick(s, color):
        pass


def pt(a, ang, L):
    r = math.radians(ang)
    return (a[0] + math.sin(r) * L, a[1] + math.cos(r) * L)


def fk(h, p):
    """h: 체형, p: 포즈 → 관절 좌표"""
    t = math.radians(p.get('tilt', 0))
    up = (math.sin(t), -math.cos(t)); rt = (math.cos(t), math.sin(t))
    neck = (up[0] * h['Lt'], up[1] * h['Lt'])
    ha = math.radians(p.get('head', 0)) + t
    hc = (neck[0] + math.sin(ha) * h['hr'] * 0.9, neck[1] - math.cos(ha) * h['hr'] * 0.9)
    sL = (neck[0] - rt[0] * h['sw'] / 2 - up[0] * 1.2, neck[1] - rt[1] * h['sw'] / 2 - up[1] * 1.2)
    sR = (neck[0] + rt[0] * h['sw'] / 2 - up[0] * 1.2, neck[1] + rt[1] * h['sw'] / 2 - up[1] * 1.2)
    out = dict(neck=neck, head=hc, sL=sL, sR=sR, up=up, rt=rt, tilt=p.get('tilt', 0), ha=math.degrees(ha))
    for side, s0 in (('L', sL), ('R', sR)):
        a1, a2 = p.get('a' + side, (0, 0))
        e = pt(s0, a1, h['La']); w = pt(e, a1 + a2, h['Lf'])
        out['e' + side] = e; out['h' + side] = w; out['aa' + side] = a1 + a2
    for side, sx in (('L', -1), ('R', 1)):
        hip = (sx * h['ww'] / 2, 0)
        a1, a2 = p.get('l' + side, (0, 0))
        k = pt(hip, a1, h['Ll'] * 0.52); f = pt(k, a1 + a2, h['Ll'] * 0.48)
        out['hip' + side] = hip; out['k' + side] = k; out['f' + side] = f
    return out
