"""할아버지 문제 14컷 대형 비교: 승인 원화 · 승인 컷인 얼굴 | 현재 라이브(재생성) | 이전(수염 리젝트) + 판정
   사용: python3 tools/sky-halabeoji-compare.py <outdir>"""
import sys, os
from PIL import Image, ImageDraw, ImageFont
G = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
F = ImageFont.truetype(G + '/node_modules/galmuri/dist/Galmuri11.ttf', 30)
FS = ImageFont.truetype(G + '/node_modules/galmuri/dist/Galmuri11.ttf', 22)
B = ['쌀떡 골렘', '뿡뿡 버섯대왕', '철벽 믹서 3000', '젤리 크라켄', '철벽 똥기사', '변비마왕 꽉막혀']
CUTS = {'easy-3': 'fail', 'easy-5': 'fail', 'normal-1': 'fail', 'normal-4': 'fail', 'hard-5': 'fail',
        'easy-4': 'warn', 'easy-6': 'warn', 'normal-3': 'warn', 'normal-5': 'warn', 'normal-6': 'warn',
        'hard-1': 'warn', 'hard-3': 'warn', 'hard-4': 'warn', 'hard-6': 'warn'}
def flat(im):
    im = im.convert('RGBA'); b = Image.new('RGBA', im.size, (255, 255, 255, 255)); b.alpha_composite(im); return b.convert('RGB')
il = flat(Image.open(f'{G}/public/assets/sky/v3-poop/chars/halabeoji/illust.png')); il.thumbnail((520, 560))
ci = flat(Image.open(f'{G}/public/assets/sky/v3-poop/chars/halabeoji/cutin.png')); ci = ci.crop((ci.width // 2, 0, ci.width, ci.height)); ci.thumbnail((520, 380))
ok = Image.open(f'{G}/public/assets/sky/v3-poop/album/p/halabeoji-easy-2.jpg').convert('RGB'); ok.thumbnail((250, 333))
PW, PH = 720, 960
for key, v in CUTS.items():
    d_, b = key.split('-'); b = int(b)
    W = Image.new('RGB', (560 + PW + 24 + 540 + 40, PH + 150), '#1a1430'); d = ImageDraw.Draw(W)
    col = '#ff3050' if v == 'fail' else '#ffb020'
    d.text((20, 18), f'할아버지 {d_.upper()} ST{b} {B[b-1]} — {"불합격" if v == "fail" else "경계"}', fill=col, font=F)
    d.text((20, 62), '기준: 수염 없음 · 짧은 회흑색 머리 · 원화와 같은 얼굴/체형(과하게 통통·우락부락 X) · 파랑/금 방패 수호자', fill='#cfc6f0', font=FS)
    y0 = 110
    W.paste(il, (20, y0)); d.text((20, y0 + il.height + 6), '승인 원화', fill='#9cd8ff', font=FS)
    yc = y0 + il.height + 40
    if yc + ci.height < PH + 140: W.paste(ci, (20, yc)); d.text((20, yc + ci.height + 6), '승인 컷인 얼굴', fill='#9cd8ff', font=FS)
    x = 560
    cur = Image.open(f'{G}/public/assets/sky/v3-poop/album/p/halabeoji-{key}.jpg').convert('RGB').resize((PW, PH), Image.LANCZOS)
    W.paste(cur, (x, y0)); d.rectangle((x - 4, y0 - 4, x + PW + 3, y0 + PH + 3), outline=col, width=5)
    d.text((x, y0 + PH - 34), ' 현재 라이브 (수염 제거 재생성본) ', fill='#fff', font=FS)
    x2 = x + PW + 24
    rj = f'{G}/art-src/sky-poop/v9/album-rejected/halabeoji-{key}.webp'
    if os.path.exists(rj):
        r = Image.open(rj).convert('RGB'); r.thumbnail((540, 720)); W.paste(r, (x2, y0)); d.text((x2, y0 + r.height + 6), '이전판 (수염 → 리젝트)', fill='#ff9090', font=FS)
    W.paste(ok, (x2, y0 + 760 - 40)); d.text((x2 + 260, y0 + 760 - 40), '참고: 합격 컷\nEASY ST2', fill='#80e090', font=FS)
    W.save(f'{out}/halabeoji-{key}.jpg', quality=88)
print('ok', len(CUTS))
