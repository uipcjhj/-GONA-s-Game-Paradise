"""선택 화면·필살 버튼용 얼굴 초상화 (승인된 원화에서 얼굴 중심을 캐릭터별로 지정해 잘라냄 · 모자·머리카락 포함)
출력: public/assets/sky/v2/chars/<id>/face.png (160×160)"""
from PIL import Image

# (얼굴 중심 x 비율(원화 폭), 중심 y 비율(원화 높이), 한 변 크기(원화 높이 비율))
FACE = {
    'gona': (0.52, 0.34, 0.42), 'mom': (0.47, 0.29, 0.36), 'dad': (0.70, 0.30, 0.34), 'imo': (0.31, 0.31, 0.33),
    'halmeoni': (0.63, 0.34, 0.31), 'halabeoji': (0.57, 0.33, 0.31), 'samchon': (0.53, 0.32, 0.33),
}
for fid, (cx, cy, s) in FACE.items():
    im = Image.open(f'public/assets/sky/v2/chars/{fid}/illust.png').convert('RGBA')
    S = int(s * im.height)
    x0 = int(cx * im.width - S / 2)
    y0 = int(cy * im.height - S / 2)
    out = Image.new('RGBA', (S, S))
    out.alpha_composite(im.crop((max(0, x0), max(0, y0), min(im.width, x0 + S), min(im.height, y0 + S))), (max(0, -x0), max(0, -y0)))
    out.resize((160, 160), Image.LANCZOS).save(f'public/assets/sky/v2/chars/{fid}/face.png')
    print(fid, S)
