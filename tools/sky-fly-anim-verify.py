"""sky-fly-anim-check.cjs 가 저장한 캔버스 조각이 실제로 시트의 몇 번 프레임인지 픽셀 비교로 확인 + 띠 이미지·GIF 생성
사용: python3 tools/sky-fly-anim-verify.py <캡처폴더> <id> <out-prefix>"""
import sys, glob, re, os
import numpy as np
from PIL import Image
d, fid, outp = sys.argv[1:4]
sheet = np.array(Image.open(f'public/assets/sky/v3-poop/chars/{fid}/fly.png').convert('RGBA')).astype(int)
cells = [sheet[:, i * 88:(i + 1) * 88] for i in range(4)]
files = sorted(glob.glob(f'{d}/{fid}-*.png'))
ok = 0; seen = []; ims = []
for fp in files:
    eng = int(re.search(r'-f(\d)\.png$', fp).group(1))
    c = np.array(Image.open(fp).convert('RGBA')).astype(int)
    best = (-1, None)
    for fi, cell in enumerate(cells):
        m = cell[..., 3] == 255
        for oy in range(8, 34):
            for ox in range(12, 22):
                reg = c[oy:oy + 112, ox:ox + 88, :3]
                if reg.shape[:2] != (112, 88): continue
                sc = (np.abs(reg - cell[..., :3]).sum(2)[m] < 40).mean()
                if sc > best[0]: best = (sc, fi)
    seen.append(best[1]); ok += best[1] == eng
    ims.append(Image.open(fp).convert('RGB'))
print(f'{fid}: 화면 프레임 = 엔진 프레임 {ok}/{len(files)} · 화면에 나온 프레임 종류 {sorted(set(seen))} · 순서 {"".join(map(str, seen))}')
strip = Image.new('RGB', (120 * 12, 140))
for i, im in enumerate(ims[:12]): strip.paste(im, (i * 120, 0))
strip.resize((strip.width * 2, 280), Image.NEAREST).save(outp + '-strip.png')
big = [im.resize((240, 280), Image.NEAREST) for im in ims]
big[0].save(outp + '.gif', save_all=True, append_images=big[1:], duration=33, loop=0)
