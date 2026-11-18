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
             --remove-bg [--bg-tol 40] : 배경이 있는 그림의 배경 제거 (가장자리와 이어진 배경색만 지움 — 외곽선 안쪽은 보존)
             --box x,y,w,h            : 이 영역만 잘라서 사용 (0~1 비율 또는 픽셀) — 얼굴 아이콘을 원화의 얼굴 위치에서 뽑을 때
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
    a = np.array(im.convert('RGBA'))
    # AI 생성 PNG 는 '불투명'을 252~254, '빈칸'을 0~1 로 저장하는 경우가 많음 → 게임에서 살짝 비치거나 테두리 먼지가 생기므로 정리
    al = a[..., 3]
    a[..., 3] = np.where(al >= 250, 255, np.where(al <= 2, 0, al))
    return Image.fromarray(a, 'RGBA')


def remove_bg(im, tol=40):
    """가장자리와 연결된 배경만 투명하게: 테두리 색을 몇 가지로 묶고, 그 색과 가깝고 테두리에 닿아 있는 영역만 지움.
    캐릭터는 굵은 외곽선으로 둘러싸여 있어 안쪽(얼굴·옷의 흰색 등)은 지워지지 않는다."""
    from scipy import ndimage
    a = np.array(im).astype(np.int32)
    rgb = a[..., :3]
    h, w = rgb.shape[:2]
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    q = Image.fromarray(border.reshape(1, -1, 3).astype(np.uint8)).quantize(4, method=Image.Quantize.MEDIANCUT)
    full = np.array(q.getpalette())
    pal = np.array([full[i * 3:i * 3 + 3] for i in np.unique(np.array(q))])  # 실제로 쓰인 테두리 색만 (단색 배경이면 1개)
    near = np.zeros((h, w), bool)
    for c in pal:
        near |= np.abs(rgb - c).sum(2) < tol * 3 // 2
    lab, n = ndimage.label(near)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge))
    # 배경 경계 1px 는 반투명으로 (셀애니 안티앨리어싱 유지)
    grown = ndimage.binary_dilation(bg) & ~bg
    alpha = np.where(bg, 0, a[..., 3])
    alpha = np.where(grown, np.minimum(alpha, 160), alpha)
    out = a.copy(); out[..., 3] = alpha
    print(f'  배경 제거: 테두리 색 {[tuple(int(v) for v in c) for c in pal]} · 지운 비율 {bg.mean():.2f}')
    return Image.fromarray(out.astype(np.uint8), 'RGBA')


def crop_box(im, box):
    v = [float(t) for t in box.split(',')]
    if all(t <= 1 for t in v):
        v = [v[0] * im.width, v[1] * im.height, v[2] * im.width, v[3] * im.height]
    x, y, w, h = [round(t) for t in v]
    return im.crop((x, y, x + w, y + h))


def compose_cutin(im, color):
    """필살기 컷인 720×360: 대각선 집중선(단순 이펙트) + 확정 원화 상반신을 크게 (얼굴이 잘리지 않게 위쪽 기준)"""
    from PIL import ImageDraw
    import math
    tw, th = 720, 360
    c = tuple(int(color.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4))
    dark = tuple(max(0, v // 4) for v in c)
    bg = Image.new('RGBA', (tw, th), dark + (255,))
    lines = Image.new('RGBA', (tw, th), (0, 0, 0, 0))  # 반투명 선은 따로 그려서 섞음 (바로 그리면 배경 알파가 뚫림)
    d = ImageDraw.Draw(lines)
    cx, cy = -60, th * 0.55  # 왼쪽에서 퍼지는 집중선
    for i in range(46):
        a0 = -0.95 + i * 0.043
        a1 = a0 + 0.018
        r = 1400
        col = c if i % 2 else tuple(min(255, v + 60) for v in c)
        d.polygon([(cx, cy), (cx + r * math.cos(a0), cy + r * math.sin(a0)), (cx + r * math.cos(a1), cy + r * math.sin(a1))], fill=col + (90 if i % 3 else 150,))
    bg.alpha_composite(lines)
    t = trim(im)
    top = t.crop((0, 0, t.width, round(t.height * 0.58)))  # 상반신 (머리·얼굴·무기 위쪽)
    k = 400 / top.height
    body = top.resize((round(top.width * k), 400), Image.LANCZOS)
    x = tw - body.width + round(body.width * 0.08)
    bg.alpha_composite(body, (max(tw - body.width - 10, min(x, tw - body.width // 2)), 6))
    d = ImageDraw.Draw(bg)
    d.rectangle([0, 0, tw - 1, 4], fill=(255, 227, 74, 255))
    d.rectangle([0, th - 5, tw - 1, th - 1], fill=(255, 227, 74, 255))
    return bg


def has_alpha(im):
    a = np.array(im)[..., 3]
    return (a < 250).mean() > 0.02


def trim(im):
    a = np.array(im)[..., 3]
    ys, xs = np.nonzero(a > 64)
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


def auto_split(im, n):
    """생성 그림이 정확한 칸 나눔이 아닐 때: 투명 배경 위 캐릭터 덩어리 n 개를 찾아 왼쪽부터 순서대로 자름"""
    from scipy import ndimage
    al = np.array(im)[..., 3] > 64  # 생성 그림의 옅은 그림자 안개(알파 1~64)는 무시
    lab, cnt = ndimage.label(ndimage.binary_dilation(al, iterations=6))  # 같은 캐릭터의 떨어진 조각(물방울 등)을 한 덩어리로
    if cnt < n:
        die(f'캐릭터 덩어리를 {n}개 찾지 못했습니다 ({cnt}개) — 칸이 붙어 있으면 --frames 로 균등 분할을 쓰세요')
    sizes = ndimage.sum(al, lab, range(1, cnt + 1))
    keep = np.argsort(-sizes)[:n] + 1
    boxes = []
    for i in keep:
        ys, xs = np.nonzero(lab == i)
        boxes.append((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    boxes.sort()
    return [im.crop(b) for b in boxes]


def motion_check(cells):
    """프레임별 실제 움직임 검사: 같은 그림 복제(차이 거의 0) 금지 · 실루엣이 너무 달라 다른 캐릭터처럼 보이는 것 경고"""
    arr = [np.array(c).astype(int) for c in cells]
    def diff(a, b):
        A, B = a[..., 3] > 128, b[..., 3] > 128
        union = (A | B).sum()
        both = A & B
        changed = (A ^ B).sum() + (both & (np.abs(a[..., :3] - b[..., :3]).sum(2) > 60)).sum()
        return changed / max(1, union), (A & B).sum() / max(1, union)
    ok = True
    for i, j, name in [(0, 1, '비행 1↔2'), (2, 3, '공격 1↔2'), (0, 2, '비행↔공격')]:
        d, iou = diff(arr[i], arr[j])
        flag = ''
        if d < 0.02:
            flag = '  ✗ 거의 같은 그림 (복제) — 실제 동작 차이가 필요'
            ok = False
        elif iou < 0.45:
            flag = '  ! 실루엣이 크게 다름 — 같은 캐릭터인지 눈으로 확인'
        print(f'  움직임 {name}: 바뀐 픽셀 {d * 100:.1f}% · 실루엣 겹침 {iou:.2f}{flag}')
    return ok


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
    # 원본 보관 (이미 art-src/sky-poop/ 안에 보관된 마스터를 쓴 경우에는 중복 복사하지 않음)
    if not os.path.abspath(orig).startswith(os.path.abspath(SRC) + os.sep):
        os.makedirs(os.path.join(SRC, os.path.dirname(rel)), exist_ok=True)
        shutil.copyfile(orig, os.path.join(SRC, rel.rsplit('.', 1)[0] + '.orig.png'))
    mpath = os.path.join(PACK, 'manifest.json')
    m = json.load(open(mpath, encoding='utf-8')) if os.path.exists(mpath) else {'version': 1, 'files': {}}
    if args.final:
        meta['final'] = True
    old = m['files'].get(rel, {})  # 손으로 넣은 값(포탑 위치·약점·탄 모양 등)은 다시 변환해도 유지
    old.update(meta)
    m['files'][rel] = old
    json.dump(m, open(mpath, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print(f'  ✓ 저장 · manifest 갱신 ({"최종" if args.final else "시안/임시"})')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('kind', choices=['illust', 'face', 'cutin', 'fly', 'grid', 'enemy', 'prop', 'midboss', 'boss', 'bg', 'keyart', 'logo'])
    ap.add_argument('src')
    ap.add_argument('--id', choices=FAMILY)
    ap.add_argument('--stage', default='stage1')
    ap.add_argument('--slot')
    ap.add_argument('--frames', type=int)
    ap.add_argument('--final', action='store_true')
    ap.add_argument('--tint', type=float)
    ap.add_argument('--fix-seam', action='store_true')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--remove-bg', action='store_true')
    ap.add_argument('--bg-tol', type=int, default=40)
    ap.add_argument('--box')
    ap.add_argument('--amber-red', help='boss: 이 프레임들(0부터, 쉼표)의 진한 빨강을 호박색으로 (피처럼 보이는 소스 보정)')
    ap.add_argument('--clip-effect', action='store_true', help='fly: 공격 이펙트 때문에 큰 프레임은 배율 계산에서 빼고 넘치는 위쪽만 자름')
    ap.add_argument('--auto-split', action='store_true', help='fly: 칸이 고르지 않은 생성 시트에서 캐릭터 4개를 자동으로 찾아 분리')
    ap.add_argument('--compose', action='store_true', help='cutin: 확정 원화(상반신)를 집중선 배경 위에 배치해 720×360 컷인 합성')
    ap.add_argument('--color', default='#8a3fd1', help='cutin --compose 집중선 색')
    ap.add_argument('--grid', help='grid: 행x열 (예 3x4) — 생성 시트를 고른 칸으로 나눔')
    ap.add_argument('--cell', help='grid: 결과 칸 크기 WxH (예 40x40)')
    ap.add_argument('--out', help='grid: 팩 안 저장 경로 (예 chars/samchon/probiotic.png)')
    ap.add_argument('--main-blob', action='store_true', help='grid: 칸마다 가장 큰 덩어리만 남김 (옆 프레임 조각 제거)')
    ap.add_argument('--row-scale', action='store_true', help='grid: 배율을 행마다 따로 (행 = 한 캐릭터 애니메이션)')
    args = ap.parse_args()
    im = load(args.src)
    if args.remove_bg:
        im = remove_bg(im, args.bg_tol)
    if args.box:
        im = crop_box(im, args.box)
    k = args.kind
    print(f'{k}: {args.src} ({im.width}×{im.height})')
    meta = {}

    if k in ('illust', 'face', 'cutin', 'fly') and not args.id:
        die('--id 가 필요합니다')

    if k == 'grid':
        # 고른 칸 시트 (유산균 소환체 3종×4프레임, 이펙트 모음 등): 칸마다 트림 → 공통 배율 → 칸 가운데 정렬
        if not (args.grid and args.cell and args.out):
            die('grid 는 --grid RxC --cell WxH --out 경로 가 필요합니다')
        R, C = map(int, args.grid.lower().split('x'))
        cw, ch = map(int, args.cell.lower().split('x'))
        gw, gh = im.width / C, im.height / R
        def main_blob(cell):
            # 칸 경계 밖에서 넘어온 옆 프레임 조각 제거: 가장 큰 덩어리(가까운 조각 포함)만 남김
            if not args.main_blob:
                return cell
            from scipy import ndimage
            a = np.array(cell)
            lab, cnt = ndimage.label(ndimage.binary_dilation(a[..., 3] > 64, iterations=10))
            if cnt <= 1:
                return cell
            sizes = ndimage.sum(a[..., 3] > 64, lab, range(1, cnt + 1))
            keep = lab == (int(np.argmax(sizes)) + 1)
            a[~keep] = 0
            return Image.fromarray(a, 'RGBA')
        tr = [[trim(main_blob(im.crop((round(c * gw), round(r * gh), round((c + 1) * gw), round((r + 1) * gh))))) for c in range(C)] for r in range(R)]
        m = 2  # 칸 안 여백
        def scale(cells):
            return min((cw - m * 2) / max(t.width for t in cells), (ch - m * 2) / max(t.height for t in cells), 1.0)
        kall = scale([t for row in tr for t in row])
        out = Image.new('RGBA', (cw * C, ch * R))
        for r, row in enumerate(tr):
            kk = scale(row) if args.row_scale else kall
            for c, t in enumerate(row):
                f = t.resize((max(1, round(t.width * kk)), max(1, round(t.height * kk))), Image.LANCZOS)
                out.paste(f, (c * cw + (cw - f.width) // 2, r * ch + (ch - f.height) // 2), f)
        out = pixelize(out, 96)
        if args.row_scale and C >= 2:
            for r in range(R):
                motion_check([out.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch)) for c in range(C)])
        report(out, args.out)
        meta = {'rows': R, 'cols': C, 'cell': [cw, ch]}
        save(out, args.out, args, meta, args.src)
        return

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
    elif k == 'cutin' and args.compose:
        out = compose_cutin(im, args.color)
        rel = f'chars/{args.id}/cutin.png'
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
        parts = auto_split(im, 4) if args.auto_split else split_frames(im, 4)
        # 4프레임을 '같은 배율'로 줄임 (프레임마다 따로 맞추면 물줄기 같은 이펙트가 있는 프레임만 캐릭터가 작아짐)
        tr = [trim(f) for f in parts]
        if args.clip_effect:
            # 공격 이펙트(물줄기 등)로 유난히 큰 프레임은 배율 계산에서 빼고, 넘치는 이펙트 위쪽만 칸에 맞게 자름
            # → 이펙트 하나 때문에 4프레임 몸 전체가 작아지는 것을 막음 (몸·얼굴 크기는 4프레임 동일)
            hmin = min(t.height for t in tr)
            body = [t for t in tr if t.height <= hmin * 1.3] or tr
            k = min(80 / max(t.width for t in body), 104 / max(t.height for t in body), 1.0)
            print(f'  이펙트 프레임 위쪽 잘라 맞춤: 배율 기준 {len(body)}프레임 · 큰 프레임 {len(tr) - len(body)}개')
        else:
            k = min(80 / max(t.width for t in tr), 104 / max(t.height for t in tr), 1.0)
        cells = [t.resize((max(1, round(t.width * k)), max(1, round(t.height * k))), Image.LANCZOS) for t in tr]
        out = Image.new('RGBA', (352, 112))
        for i, f in enumerate(cells):
            if f.height > 110 or f.width > 86:  # 칸(88×112)을 넘는 이펙트: 아래(몸) 기준으로 위·좌우만 잘라 냄
                cw = min(f.width, 86)
                x0 = (f.width - cw) // 2
                f = f.crop((x0, max(0, f.height - 110), x0 + cw, f.height))
            out.paste(f, (i * 88 + (88 - f.width) // 2, 112 - 4 - f.height if f.height <= 108 else 112 - 2 - f.height), f)
        out = pixelize(out, 150)  # 4프레임이 같은 팔레트를 쓰도록 시트 전체를 한 번에 정리
        if not motion_check([out.crop((i * 88, 0, i * 88 + 88, 112)) for i in range(4)]) and not args.dry_run:
            die('프레임이 서로 복제라서 비행 스프라이트로 쓸 수 없습니다 (저장 안 함)')
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
        # 페이즈끼리 같은 배율 (크기가 들쭉날쭉하지 않게) · 고르지 않은 생성 시트는 --auto-split
        tr = [trim(f) for f in (auto_split(im, n) if args.auto_split else split_frames(im, n))]
        kk = min(fw / max(t.width for t in tr), fh / max(t.height for t in tr), 1.0)
        frames = [t.resize((max(1, round(t.width * kk)), max(1, round(t.height * kk))), Image.LANCZOS) for t in tr]
        h = max(f.height for f in frames)
        out = Image.new('RGBA', (fw * n, h))
        for i, f in enumerate(frames):
            out.paste(f, (i * fw + (fw - f.width) // 2, (h - f.height) // 2), f)
        out = pixelize(out, colors)  # 페이즈끼리 같은 팔레트
        if args.amber_red:
            # 붉은 소스·액체가 피처럼 보이지 않게: 채도 높은 빨강을 밝은 황금 시럽(조청·꿀) 색으로 (지정한 프레임만)
            import colorsys
            a = np.array(out).astype(float)
            fr = [int(x) for x in args.amber_red.split(',')]
            for fi in fr:
                x0, x1 = fi * fw, (fi + 1) * fw
                sub = a[:, x0:x1]
                for yy in range(sub.shape[0]):
                    for xx in range(sub.shape[1]):
                        r, g, b_, al = sub[yy, xx]
                        if al < 128:
                            continue
                        h, sat, val = colorsys.rgb_to_hsv(r / 255, g / 255, b_ / 255)
                        if 80 <= xx <= 140 and 70 <= yy <= 118:
                            continue  # 입 안(붉은 입속)은 그대로
                        if (h < 0.035 or h > 0.94) and sat > 0.45 and val > 0.22:
                            nv = val * 1.28 if val > 0.45 else val * 1.05  # 어두운 그림자는 밝기 유지 (점박이 방지)
                            nr, ng, nb = colorsys.hsv_to_rgb(0.1, min(1, sat * 0.92), min(1, nv))
                            sub[yy, xx, :3] = (nr * 255, ng * 255, nb * 255)
            out = Image.fromarray(a.astype(np.uint8), 'RGBA')
            print(f'  붉은 액체 → 호박색 보정 (프레임 {fr})')
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
