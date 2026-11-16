#!/usr/bin/env python3
"""
응가 대탈출 신규 그림 → 게임 에셋 변환기 (ChatGPT 등에서 받은 PNG 를 실제 게임 규격으로)

  python3 tools/sky-art-import.py <종류> <받은 그림.png> [옵션]

  종류        대상 파일 (public/assets/sky/v3-poop/…)      규격 (기존 에셋 실측 · 엔진 렌더 기준)
  illust      chars/<id>/illust.png                        높이 900 · 폭 ≤ 820 · 투명 · 사방 여백 ≥ 4% (셀애니, 안티앨리어싱 유지)
  face        chars/<id>/face.png                          160×160 · 투명 권장
  cutin       chars/<id>/cutin.png                         720×360 (배경 포함 가능)
  fly         chars/<id>/fly.png                           88×112 칸 × 4 = 352×112 · 칸 아래 가운데 정렬 · 픽셀아트(딱딱한 알파 · ≤150색)
  enemy       <stage>/enemy-<slot>.png                     slot 별 기존 폭 (drone 54 · fighter 60 · wyvern 68 · orb 56 · gunship 114) · ≤48색
  prop        <stage>/<slot>.png                           slot 별 기존 폭 (island-castle 163 …) · ≤64색
  midboss     <stage>/midboss.png                          프레임 폭 216 (k 0.5 → 화면 108px) × N프레임 · ≤96색
  boss        <stage>/boss.png                             프레임 폭 220 (k 0.5 → 화면 110px) × N프레임(페이즈) · ≤128색
  bg          <stage>/bg-backdrop.png                      360×640 · 위아래 이음 검사 (--fix-seam 으로 이음 보정)
  keyart      title/keyart.jpg                             688×1024
  logo        title/logo.png                               640×430 안에 맞춤 · 투명

  공통 옵션: --id mom|dad|imo|halmeoni|halabeoji|samchon|gona  --stage stage1|s2…  --slot drone|…  --frames N
             --final (최종 승인 그림으로 표시)  --tint 0.3 (배경 덮개)  --fix-seam  --dry-run
  결과: 변환 파일 저장 · 원본은 art-src/sky-poop/ 에 보관 · manifest.json 갱신 · 검사 보고 출력
"""
import argparse, json, os, shutil, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PACK = os.path.join(ROOT, 'public/assets/sky/v3-poop')
V2 = os.path.join(ROOT, 'public/assets/sky/v2')
SRC = os.path.join(ROOT, 'art-src/sky-poop')
OUTLINE = (26, 18, 38)  # 기존 인게임 픽셀아트 외곽선 #1a1226 (고나·동료·적 공통 실측값)
ENEMY_W = {'drone': 54, 'fighter': 60, 'wyvern': 68, 'orb': 56, 'gunship': 114}
FAMILY = ['mom', 'dad', 'imo', 'halmeoni', 'halabeoji', 'samchon', 'gona']


def die(msg):
    print('✗ ' + msg)
    sys.exit(1)


def load(path):
    im = Image.open(path)
    im.load()
    return im.convert('RGBA')


def has_alpha(im):
    a = np.array(im)[..., 3]
    return (a < 250).mean() > 0.02


def trim(im):
    a = np.array(im)[..., 3]
    ys, xs = np.nonzero(a > 16)
    if not len(xs):
        die('그림이 전부 투명합니다')
    return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def fit(im, w, h):
    """비율 유지로 w×h 안에 맞게 고품질 축소 (확대는 하지 않음 — 저해상도 확대 금지)"""
    k = min(w / im.width, h / im.height)
    if k > 1.0001:
        print(f'  ! 받은 그림이 작아 {k:.2f}배 확대가 필요합니다 — 더 큰 원본을 요청하세요 (확대 안 함)')
        k = 1
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)


def pixelize(im, colors, outline=True):
    """픽셀아트 정리: 딱딱한 알파(반투명 0) · 색 수 제한 · 아주 어두운 색은 기존 외곽선 색으로 통일"""
    a = np.array(im)
    alpha = (a[..., 3] >= 128)
    rgb = Image.fromarray(a[..., :3])
    q = rgb.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    out = np.dstack([np.array(q), np.where(alpha, 255, 0).astype(np.uint8)])
    if outline:
        lum = out[..., :3].mean(2)
        dark = (lum < 42) & alpha
        out[dark, :3] = OUTLINE
    out[~alpha] = 0
    return Image.fromarray(out.astype(np.uint8), 'RGBA')


def split_frames(im, n):
    if n <= 1:
        return [im]
    fw = im.width // n
    return [im.crop((i * fw, 0, (i + 1) * fw, im.height)) for i in range(n)]


def report(im, rel, seam=None):
    a = np.array(im)
    al = a[..., 3]
    semi = ((al > 0) & (al < 255)).sum() / max(1, (al > 0).sum())
    cols = len(np.unique(a[al > 200][:, :3], axis=0)) if (al > 200).any() else 0
    ys, xs = np.nonzero(al > 16)
    margin = min(xs.min(), ys.min(), im.width - 1 - xs.max(), im.height - 1 - ys.max()) if len(xs) else '-'
    print(f'  → {rel}  {im.width}×{im.height}  색 {cols}  반투명 비율 {semi:.2f}  최소 여백 {margin}px' + (f'  위아래 이음 차이 {seam:.1f}' if seam is not None else ''))


def save(im, rel, args, meta, orig):
    out = os.path.join(PACK, rel)
    if args.dry_run:
        print('  (dry-run: 저장 안 함)')
        return
    os.makedirs(os.path.dirname(out), exist_ok=True)
    if rel.endswith('.jpg'):
        im.convert('RGB').save(out, quality=90)
    else:
        im.save(out, optimize=True)
    os.makedirs(os.path.join(SRC, os.path.dirname(rel)), exist_ok=True)
    shutil.copyfile(orig, os.path.join(SRC, rel.rsplit('.', 1)[0] + '.orig.png'))
    mpath = os.path.join(PACK, 'manifest.json')
    m = json.load(open(mpath, encoding='utf-8')) if os.path.exists(mpath) else {'version': 1, 'files': {}}
    if args.final:
        meta['final'] = True
    m['files'][rel] = meta
    json.dump(m, open(mpath, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print(f'  ✓ 저장 · manifest 갱신 ({"최종" if args.final else "시안/임시"})')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('kind', choices=['illust', 'face', 'cutin', 'fly', 'enemy', 'prop', 'midboss', 'boss', 'bg', 'keyart', 'logo'])
    ap.add_argument('src')
    ap.add_argument('--id', choices=FAMILY)
    ap.add_argument('--stage', default='stage1')
    ap.add_argument('--slot')
    ap.add_argument('--frames', type=int)
    ap.add_argument('--final', action='store_true')
    ap.add_argument('--tint', type=float)
    ap.add_argument('--fix-seam', action='store_true')
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()
    im = load(args.src)
    k = args.kind
    print(f'{k}: {args.src} ({im.width}×{im.height})')
    meta = {}

    if k in ('illust', 'face', 'cutin', 'fly') and not args.id:
        die('--id 가 필요합니다')

    if k == 'illust':
        if not has_alpha(im):
            die('배경이 투명하지 않습니다 — 투명 배경 PNG 로 다시 받아 주세요')
        t = trim(im)
        pad = round(max(t.width, t.height) * 0.05)  # 사방 여백 5% (기존 원화는 여백 0 — 잘림 원인)
        c = Image.new('RGBA', (t.width + pad * 2, t.height + pad * 2))
        c.paste(t, (pad, pad))
        out = fit(c, 820, 900)
        if out.height < 900 and c.height >= 900:
            out = c.resize((round(c.width * 900 / c.height), 900), Image.LANCZOS)
        rel = f'chars/{args.id}/illust.png'
    elif k == 'face':
        if abs(im.width - im.height) > im.width * 0.05:
            print('  ! 정사각형이 아닙니다 — 가운데 위쪽 기준으로 잘라 냄')
        s = min(im.width, im.height)
        im = im.crop(((im.width - s) // 2, 0, (im.width - s) // 2 + s, s))
        out = im.resize((160, 160), Image.LANCZOS)
        rel = f'chars/{args.id}/face.png'
    elif k == 'cutin':
        tw, th = 720, 360
        kk = max(tw / im.width, th / im.height)
        r = im.resize((round(im.width * kk), round(im.height * kk)), Image.LANCZOS)
        x, y = (r.width - tw) // 2, (r.height - th) // 2
        out = r.crop((x, y, x + tw, y + th))
        rel = f'chars/{args.id}/cutin.png'
    elif k == 'fly':
        n = args.frames or 4
        if n != 4:
            die('비행 스프라이트는 4프레임 (대기 2 · 공격 2) 이어야 합니다')
        cells = [fit(trim(f), 80, 104) for f in split_frames(im, 4)]
        out = Image.new('RGBA', (352, 112))
        for i, f in enumerate(cells):
            out.paste(f, (i * 88 + (88 - f.width) // 2, 112 - 4 - f.height), f)
        out = pixelize(out, 150)  # 4프레임이 같은 팔레트를 쓰도록 시트 전체를 한 번에 정리
        rel = f'chars/{args.id}/fly.png'
    elif k == 'enemy':
        if args.slot not in ENEMY_W:
            die(f'--slot 은 {list(ENEMY_W)} 중 하나 (쌀알 병사=drone · 당근 전투기=fighter · 브로콜리 박쥐=wyvern · 완두콩 포탑=orb · 냄비 수송선=gunship)')
        t = trim(im)
        w = ENEMY_W[args.slot]
        out = pixelize(fit(t, w, round(w * 1.3)), 48)
        rel = f'{args.stage}/enemy-{args.slot}.png'
    elif k == 'prop':
        old = os.path.join(V2, 'stage1', f'{args.slot}.png')
        if not args.slot or not os.path.exists(old):
            die('--slot 은 기존 소품 이름 (island-castle · island-ruins · island-small · island-tower · clocktower · airship · cloud-big · cloud-small)')
        w = Image.open(old).width
        out = pixelize(fit(trim(im), w, w * 2), 64, outline=False)
        rel = f'{args.stage}/{args.slot}.png'
    elif k in ('midboss', 'boss'):
        n = args.frames or (3 if k == 'boss' else 1)
        fw, fh, colors = (216, 230, 96) if k == 'midboss' else (220, 240, 128)
        frames = [fit(trim(f), fw, fh) for f in split_frames(im, n)]
        h = max(f.height for f in frames)
        out = Image.new('RGBA', (fw * n, h))
        for i, f in enumerate(frames):
            out.paste(f, (i * fw + (fw - f.width) // 2, (h - f.height) // 2), f)
        out = pixelize(out, colors)  # 페이즈끼리 같은 팔레트
        meta = {'frames': n, 'k': 0.5}
        rel = f'{args.stage}/{k}.png'
    elif k == 'bg':
        tw, th, band = 360, 640, 48
        eh = th + (band if args.fix_seam else 0)  # 이음 보정 때는 48줄 더 길게 잘라서 위쪽에 섞음
        kk = max(tw / im.width, eh / im.height)
        r = im.resize((round(im.width * kk), round(im.height * kk)), Image.LANCZOS).convert('RGB')
        x0, y0 = (r.width - tw) // 2, (r.height - eh) // 2
        a = np.array(r.crop((x0, y0, x0 + tw, y0 + eh))).astype(float)
        if args.fix_seam:
            # 반복 타일: 위쪽 48줄을 '아래에 이어지는 48줄' 과 서서히 섞음 → 맨 아래줄 다음이 맨 위줄로 자연스럽게 이어짐
            for i in range(band):
                t = i / band
                a[i] = a[i] * t + a[th + i] * (1 - t)
        out = Image.fromarray(a[:th].astype(np.uint8), 'RGB').convert('RGBA')
        meta = {'tint': args.tint if args.tint is not None else 0.3}
        rel = f'{args.stage}/bg-backdrop.png'
    elif k == 'keyart':
        tw, th = 688, 1024
        kk = max(tw / im.width, th / im.height)
        r = im.resize((round(im.width * kk), round(im.height * kk)), Image.LANCZOS)
        out = r.crop(((r.width - tw) // 2, (r.height - th) // 2, (r.width - tw) // 2 + tw, (r.height - th) // 2 + th))
        rel = 'title/keyart.jpg'
    elif k == 'logo':
        if not has_alpha(im):
            die('로고는 투명 배경이어야 합니다')
        out = fit(trim(im), 640, 430)
        rel = 'title/logo.png'

    seam = None
    if k == 'bg':
        b = np.array(out)[..., :3].astype(int)
        seam = float(np.abs(b[0] - b[-1]).mean())
        avg = float(np.abs(b[1:] - b[:-1]).mean())
        print(f'  위아래 이음: 차이 {seam:.1f} (줄 사이 평균 {avg:.1f})' + ('  ✓ 자연스럽게 이어짐' if seam <= avg * 2.5 else '  ! 이음이 보일 수 있음 — --fix-seam 또는 세로 반복 그림으로 다시 요청'))
    report(out, rel, seam)
    save(out, rel, args, meta, args.src)


if __name__ == '__main__':
    main()
