"""가족 필살기 컷인 (승인된 선택 화면 원화를 그대로 잘라 사용 · 다시 그리지 않음)
배경: 캐릭터 대표색의 집중선 + 별 파티클 (고나 컷인과 같은 720×360 띠)"""
import math
import numpy as np
from PIL import Image, ImageDraw

COL = {'mom': ('#3a0a3a', '#d24696', '#ffb8e0'), 'dad': ('#0a1838', '#3a6ad0', '#c8e0ff'), 'imo': ('#1a0a40', '#7a4ad8', '#ffe470'),
       'halmeoni': ('#0a2a18', '#3aa860', '#ffe8a0'), 'halabeoji': ('#0a1430', '#3a5ab8', '#e0f0ff'), 'samchon': ('#2a1a06', '#d8a020', '#a0fff0')}
# 원화에서 얼굴·상반신이 들어가는 영역 (원화 높이 대비 비율: 위, 아래)
CROP = {'mom': (0.04, 0.62), 'dad': (0.0, 0.6), 'imo': (0.02, 0.6), 'halmeoni': (0.0, 0.62), 'halabeoji': (0.0, 0.62), 'samchon': (0.0, 0.62)}


def hx(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


W, H = 720, 360
for fid, (dk, md, lt) in COL.items():
    bg = Image.new('RGB', (W, H), hx(dk))
    d = ImageDraw.Draw(bg)
    rng = np.random.RandomState(len(fid))
    cx, cy = 470, 170
    for k in range(70):
        a = rng.uniform(0, math.tau)
        w = rng.uniform(0.01, 0.035)
        r0 = rng.uniform(60, 160)
        pts = [(cx + math.cos(a) * r0, cy + math.sin(a) * r0), (cx + math.cos(a - w) * 900, cy + math.sin(a - w) * 900), (cx + math.cos(a + w) * 900, cy + math.sin(a + w) * 900)]
        d.polygon(pts, fill=hx(md) if k % 3 else hx(lt))
    for k in range(26):
        x, y, r = rng.uniform(0, W), rng.uniform(0, H), rng.uniform(4, 10)
        d.polygon([(x, y - r), (x + r * 0.3, y - r * 0.3), (x + r, y), (x + r * 0.3, y + r * 0.3), (x, y + r), (x - r * 0.3, y + r * 0.3), (x - r, y), (x - r * 0.3, y - r * 0.3)], fill=hx(lt))
    # 픽셀감: 1/4 로 줄였다가 최근접 확대
    bg = bg.resize((W // 4, H // 4), Image.BOX).resize((W, H), Image.NEAREST).convert('RGBA')
    il = Image.open(f'public/assets/sky/v2/chars/{fid}/illust.png').convert('RGBA')
    t, b = CROP[fid]
    if fid == 'dad':  # 원화 왼쪽 가장자리의 잘린 분홍 획(다른 그림의 잔여) 제거
        a = np.array(il)
        a[:, : int(il.width * 0.15), 3] = 0
        il = Image.fromarray(a)
    il = il.crop((0, int(il.height * t), il.width, int(il.height * b)))
    k = (H * 1.08) / il.height
    il = il.resize((round(il.width * k), round(il.height * k)), Image.LANCZOS)
    x = W - il.width - 30
    bg.alpha_composite(il, (max(150, x), 6))
    # 위·아래 금색 테두리
    dd = ImageDraw.Draw(bg)
    dd.rectangle((0, 0, W, 5), fill=hx('#e8b53c'))
    dd.rectangle((0, H - 6, W, H), fill=hx('#e8b53c'))
    bg.convert('RGB').save(f'public/assets/sky/v2/chars/{fid}/cutin.jpg', quality=86)
    print(fid)
