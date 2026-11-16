#!/usr/bin/env python3
"""ChatGPT 이미지 제작용 기준 자료 시트 (기존 승인 원화 · 인게임 픽셀아트 실측) → docs/sky-reboot/ref/
   사용: python3 tools/sky-ref-sheets.py"""
from PIL import Image, ImageDraw, ImageFont
import numpy as np
V = 'public/assets/sky/v2/'
OUT = 'docs/sky-reboot/ref/'
F = ImageFont.truetype('node_modules/galmuri/dist/Galmuri11.ttf', 16)
FB = ImageFont.truetype('node_modules/galmuri/dist/Galmuri11.ttf', 22)
BG, TX, SUB = (30, 24, 44), (255, 244, 214), (200, 190, 230)
NAMES = {'gona': '고나 — 아기 익룡 영웅', 'mom': '엄마 — 목욕의 물마법사', 'dad': '아빠 — 급수 소방 전사', 'imo': '이모 — 프룬의 보랏빛 요정',
         'halmeoni': '할머니 — 약손 치유사', 'halabeoji': '할아버지 — 유해균 방패 수호자', 'samchon': '삼촌 — 유산균 소환사'}


def palette(im, n=8):
    a = np.array(im.convert('RGBA')); px = a[a[..., 3] > 200][:, :3]
    q = Image.fromarray(px.reshape(1, -1, 3).astype(np.uint8)).quantize(n, method=Image.Quantize.MEDIANCUT)
    pal = q.getpalette()[:n * 3]; cnt = np.bincount(np.array(q).ravel(), minlength=n)
    return [tuple(pal[i * 3:i * 3 + 3]) for i in np.argsort(-cnt)]


def checker(w, h, s=8):
    c = Image.new('RGB', (w, h), (58, 52, 72)); d = ImageDraw.Draw(c)
    for y in range(0, h, s):
        for x in range(0, w, s):
            if (x // s + y // s) % 2: d.rectangle([x, y, x + s - 1, y + s - 1], fill=(70, 64, 86))
    return c


for cid, title in NAMES.items():
    W, H = 1320, 800; c = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(c)
    d.text((20, 14), f'{title}  ·  기준 자료 (기존 승인 원화 · 실측)', font=FB, fill=TX)
    d.text((20, 44), '유지: 얼굴 · 헤어 · 체형 · 외곽선 굵기 · 셀 명암 2~3단   /   변경: 의상 · 무기 · 스킬 이펙트 (변비 세계관)', font=F, fill=SUB)
    il = Image.open(V + f'chars/{cid}/illust.png').convert('RGBA'); k = 640 / il.height
    il2 = il.resize((round(il.width * k), 640), Image.LANCZOS)
    bgc = checker(il2.width, il2.height); bgc.paste(il2, (0, 0), il2); c.paste(bgc, (20, 80))
    d.text((20, 728), f'원화 illust.png  {il.width}×{il.height} (현재 여백 0 — 잘림 원인) → 새 규격: 높이 900 · 사방 여백 5% · 투명', font=F, fill=TX)
    x0 = 40 + il2.width
    fc = Image.open(V + f'chars/{cid}/face.png').convert('RGBA'); fb = checker(160, 160); fb.paste(fc, (0, 0), fc); c.paste(fb, (x0, 80))
    d.text((x0, 246), '얼굴 160²', font=F, fill=TX)
    ct = V + f'chars/{cid}/cutin.' + ('png' if cid == 'gona' else 'jpg')
    cu = Image.open(ct).convert('RGBA').resize((360, 180), Image.LANCZOS); c.paste(cu.convert('RGB'), (x0 + 180, 80))
    d.text((x0 + 180, 266), '컷인 cutin 720×360', font=F, fill=TX)
    y = 300
    if cid == 'gona':
        sp = Image.open(V + 'chars/gona/sprite.png').convert('RGBA'); row = sp.crop((0, 0, 384, 96)).resize((768, 192), Image.NEAREST)
        rb = checker(768, 192); rb.paste(row, (0, 0), row); c.paste(rb, (x0, y))
        d.text((x0, y + 198), '전투 sprite.png 96×96 칸 × 4열 × 10행 (대기 행 · 2배 확대) — 재사용 권장', font=F, fill=TX)
        src = sp
    else:
        fl = Image.open(V + f'chars/{cid}/fly.png').convert('RGBA').resize((704, 224), Image.NEAREST)
        rb = checker(704, 224); rb.paste(fl, (0, 0), fl); c.paste(rb, (x0, y))
        d.text((x0, y + 230), '비행 fly.png 88×112 × 4칸 (0·1 대기 / 2·3 공격) · 화면 44×56 · 2배 확대 표시', font=F, fill=TX)
        src = Image.open(V + f'chars/{cid}/fly.png')
    y = 580
    d.text((x0, y), '원화 대표색', font=F, fill=TX)
    for i, col in enumerate(palette(il)): d.rectangle([x0 + i * 44, y + 22, x0 + i * 44 + 38, y + 60], fill=col)
    d.text((x0, y + 72), '인게임 픽셀 대표색 · 외곽선 #1a1226', font=F, fill=TX)
    for i, col in enumerate(palette(src)): d.rectangle([x0 + i * 44, y + 94, x0 + i * 44 + 38, y + 132], fill=col)
    d.rectangle([x0 + 8 * 44, y + 94, x0 + 8 * 44 + 38, y + 132], fill=(26, 18, 38), outline=(255, 255, 255))
    c.save(f'{OUT}ref-{cid}.png', optimize=True)

W, H = 1320, 760; c = Image.new('RGB', (W, H), BG); d = ImageDraw.Draw(c)
d.text((20, 14), 'STAGE 1 기준 자료 — 기존 인게임 픽셀아트 규격 (화면 1:1 = 360×640 캔버스)', font=FB, fill=TX)
bg = Image.open(V + 'stage1/bg-backdrop.png').convert('RGB'); c.paste(bg, (20, 60))
d.text((20, 706), '배경 360×640 · 세로 반복 스크롤 (위아래 이음 필수)', font=F, fill=TX)
x, y = 400, 60
for n, lab in [('enemy-drone', '쌀알 병사 54×43'), ('enemy-fighter', '당근 전투기 60×51'), ('enemy-wyvern', '브로콜리 박쥐 68×56'), ('enemy-orb', '완두콩 포탑 56×50')]:
    e = Image.open(V + f'stage1/{n}.png').convert('RGBA'); e3 = e.resize((e.width * 3, e.height * 3), Image.NEAREST)
    cb = checker(e3.width, e3.height); cb.paste(e3, (0, 0), e3); c.paste(cb, (x, y))
    d.text((x, y + e3.height + 6), lab, font=F, fill=TX)
    x += max(e3.width, int(d.textlength(lab, font=F))) + 28
d.text((400, 262), '↑ 일반 적 자리 (3배 확대 표시 · 파일 크기 = 화면 픽셀 1:1)', font=F, fill=SUB)
bo = Image.open(V + 'stage1/boss.png').convert('RGBA'); cb = checker(bo.width, bo.height); cb.paste(bo, (0, 0), bo); c.paste(cb, (400, 300))
d.text((400, 540), '보스 boss.png 219×232 프레임 × 2 (원본 2배 · 화면 110px)', font=F, fill=TX)
d.text((400, 564), '→ 새 규격: 프레임 폭 220 × 3페이즈 (거대 쌀떡 골렘)', font=F, fill=TX)
gs = Image.open(V + 'stage1/enemy-gunship.png').convert('RGBA'); g2 = gs.resize((gs.width * 2, gs.height * 2), Image.NEAREST)
cb = checker(g2.width, g2.height); cb.paste(g2, (0, 0), g2); c.paste(cb, (870, 300))
d.text((870, 530), '냄비 수송선 114×111 (2배)', font=F, fill=TX)
d.text((1120, 300), '공통 외곽선', font=F, fill=TX); d.rectangle([1120, 322, 1180, 362], fill=(26, 18, 38), outline=(255, 255, 255)); d.text((1190, 332), '#1a1226', font=F, fill=TX)
d.text((1120, 380), '적: 약 32색', font=F, fill=TX); d.text((1120, 404), '보스: 약 110색', font=F, fill=TX); d.text((1120, 428), '동료: 약 140색', font=F, fill=TX); d.text((1120, 452), '반투명 없음', font=F, fill=TX)
c.save(f'{OUT}ref-stage1.png', optimize=True)
print('ok')
