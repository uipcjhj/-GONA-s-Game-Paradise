"""무료(OFL) 한글 표시용 폰트에서 '응가 대탈출 대작전' 글자 윤곽을 SVG path 로 뽑음 (fontsource 패키지의 woff2 조각에서)
   사용: python3 tools/sky-subtitle/glyphs.py <fontsource 패키지 폴더들의 부모> <out.json>"""
import glob, json, os, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
TEXT = '응가 대탈출 대작전'
root, out = sys.argv[1], sys.argv[2]
res = {}
for pkg in sorted(p for p in glob.glob(os.path.join(root, 'fontsource-*')) if os.path.isdir(p)):
    name = os.path.basename(pkg).replace('fontsource-', '').rsplit('-', 1)[0]
    w = '400'
    files = sorted(glob.glob(f'{pkg}/package/files/*-{w}-normal.woff2'))
    glyphs = {}
    upm = asc = None
    for f in files:
        ft = TTFont(f)
        cm = ft.getBestCmap()
        gs = ft.getGlyphSet()
        upm = ft['head'].unitsPerEm
        asc = ft['hhea'].ascent
        for ch in set(TEXT):
            if ch in glyphs or ord(ch) not in cm: continue
            gn = cm[ord(ch)]
            pen = SVGPathPen(gs)
            gs[gn].draw(TransformPen(pen, (1, 0, 0, -1, 0, asc)))  # y 뒤집기 (SVG 좌표)
            glyphs[ch] = {'d': pen.getCommands(), 'adv': ft['hmtx'][gn][0]}
    miss = [c for c in set(TEXT) if c not in glyphs]
    res[name] = {'upm': upm, 'asc': asc, 'glyphs': glyphs, 'missing': miss}
    print(name, 'upm', upm, '없는 글자', ''.join(miss) or '없음')
json.dump(res, open(out, 'w'))
