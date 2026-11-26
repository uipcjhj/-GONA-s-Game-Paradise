"""정식 플레이판(dist-adventure)을 설치형 웹앱(PWA)으로: 아이콘 · manifest · Service Worker · 홈 화면용 meta
   /GoNa/sky-adventure/ 하위 경로에서 동작하도록 모든 경로를 상대 경로('./')로 씀 · 다른 게임 경로에는 아무것도 넣지 않음
   사용: python3 tools/sky-pwa.py dist-adventure   (tools/sky-adventure-build.sh 가 자동 호출)
"""
import hashlib, json, os, re, sys
from PIL import Image, ImageDraw

D = sys.argv[1] if len(sys.argv) > 1 else 'dist-adventure'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.makedirs(f'{D}/pwa', exist_ok=True)

# ── 아이콘: 승인된 고나 일러스트(opening2/gona-hero) · 남색 바탕 + 금테 (새 그림 생성 없음)
src = Image.open(f'{ROOT}/public/assets/sky/v3-poop/opening2/gona-hero.png').convert('RGBA')
bb = src.split()[3].point(lambda v: 255 if v > 20 else 0).getbbox()
src = src.crop(bb)
def icon(size, pad, rounded=False, maskable=False):
    im = Image.new('RGBA', (size, size), (18, 10, 38, 255))
    d = ImageDraw.Draw(im)
    for i in range(size // 2):  # 은은한 노을빛 원형 그라데이션
        k = i / (size / 2)
        d.ellipse((size / 2 - i, size / 2 - i, size / 2 + i, size / 2 + i), outline=(int(60 + 120 * (1 - k)), int(30 + 60 * (1 - k)), int(90 + 40 * (1 - k)), 255))
    inner = int(size * (1 - 2 * pad))
    g = src.copy(); g.thumbnail((inner, inner), Image.LANCZOS)
    im.alpha_composite(g, ((size - g.width) // 2, (size - g.height) // 2 + int(size * 0.02)))
    if not maskable:
        w = max(2, size // 40)
        d.rectangle((w // 2, w // 2, size - 1 - w // 2, size - 1 - w // 2), outline=(232, 181, 60, 255), width=w)
    return im.convert('RGB')
icon(512, 0.08).save(f'{D}/pwa/icon-512.png', optimize=True)
icon(192, 0.08).save(f'{D}/pwa/icon-192.png', optimize=True)
icon(512, 0.18, maskable=True).save(f'{D}/pwa/icon-maskable-512.png', optimize=True)
icon(180, 0.1).save(f'{D}/pwa/apple-touch-icon.png', optimize=True)

# ── manifest (start_url · scope = 이 폴더)
manifest = {
    'name': "GONA's SKY ADVENTURE · 응가 대탈출 대작전", 'short_name': '고나 스카이',
    'description': '아기 공룡 고나와 가족의 하늘 슈팅 대모험',
    'start_url': './?pwa=1', 'scope': './', 'id': './', 'display': 'standalone', 'orientation': 'portrait',
    'background_color': '#120a26', 'theme_color': '#120a26', 'lang': 'ko',
    'icons': [
        {'src': 'pwa/icon-192.png', 'sizes': '192x192', 'type': 'image/png'},
        {'src': 'pwa/icon-512.png', 'sizes': '512x512', 'type': 'image/png'},
        {'src': 'pwa/icon-maskable-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'},
    ],
}
json.dump(manifest, open(f'{D}/manifest.webmanifest', 'w'), ensure_ascii=False, indent=1)

# ── 캐시 목록: shell(설치 즉시) · core(오프라인 플레이용 '전체 받기') — 앨범 원본 108장(20MB)은 볼 때만 캐시
def rel(p): return os.path.relpath(p, D).replace(os.sep, '/')
files = []
for dp, _, fs in os.walk(D):
    for f in fs: files.append(rel(os.path.join(dp, f)))
shell = ['./', 'index.html', 'manifest.webmanifest'] + sorted(f for f in files if re.match(r'assets/[^/]+\.(js|css|woff2)$', f)) + \
        sorted(f for f in files if f.startswith('assets/sky/v3-poop/title/') and 'cand/' not in f) + ['assets/sky/v3-poop/manifest.json', 'pwa/icon-192.png']
core = sorted(f for f in files if f.startswith('assets/') and not f.startswith('assets/sky/v3-poop/album/p/') and 'title/cand/' not in f and not f.endswith('.webmanifest'))
ver = hashlib.sha1(open(f'{D}/index.html', 'rb').read() + ''.join(core).encode()).hexdigest()[:10]
json.dump({'version': ver, 'core': core}, open(f'{D}/pwa/core.json', 'w'))

sw = f"""/* GONA's Sky Adventure Service Worker — 자동 생성 (tools/sky-pwa.py) · 버전 {ver} */
const VER = '{ver}';
const SHELL = {json.dumps(shell)};
const CACHE = 'gona-sky-' + VER;
self.addEventListener('install', (e) => {{
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));   // 새 버전: 기다렸다가 화면의 '업데이트' 버튼으로 교체
}});
self.addEventListener('activate', (e) => {{
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('gona-sky-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
}});
self.addEventListener('message', (e) => {{
  if (e.data === 'skip-waiting') self.skipWaiting();
  if (e.data === 'precache-core') {{
    e.waitUntil(fetch('pwa/core.json').then((r) => r.json()).then(async (j) => {{
      const c = await caches.open(CACHE);
      let done = 0;
      for (let i = 0; i < j.core.length; i += 8) {{
        await Promise.all(j.core.slice(i, i + 8).map((u) => c.match(u).then((m) => m || c.add(u)).catch(() => null)));
        done = Math.min(j.core.length, i + 8);
        (await self.clients.matchAll()).forEach((cl) => cl.postMessage({{ type: 'precache', done, total: j.core.length }}));
      }}
    }}));
  }}
}});
self.addEventListener('fetch', (e) => {{
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;            // 온라인 서버(Supabase) 요청은 건드리지 않음
  if (e.request.mode === 'navigate') {{                                                  // 페이지: 인터넷 먼저 · 안 되면 캐시
    e.respondWith(fetch(e.request).catch(() => caches.match('index.html')));
    return;
  }}
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {{   // 그림·소리·코드: 캐시 먼저 · 받은 건 캐시에
    if (res.ok && res.type === 'basic') {{ const cp = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); }}
    return res;
  }})));
}});
"""
open(f'{D}/sw.js', 'w').write(sw)

# ── index.html: manifest · 홈 화면 meta · 아이콘 (이 판에만)
h = open(f'{D}/index.html').read()
h = re.sub(r'<meta name="theme-color"[^>]*>', '<meta name="theme-color" content="#120a26" />', h)
h = h.replace('<link rel="apple-touch-icon" href="./apple-touch-icon.png" />', '<link rel="apple-touch-icon" href="./pwa/apple-touch-icon.png" />')
if 'manifest.webmanifest' not in h:
    h = h.replace('</head>', '    <link rel="manifest" href="./manifest.webmanifest" />\n    <meta name="apple-mobile-web-app-capable" content="yes" />\n    <meta name="mobile-web-app-capable" content="yes" />\n    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />\n    <meta name="apple-mobile-web-app-title" content="고나 스카이" />\n  </head>')
open(f'{D}/index.html', 'w').write(h)
mb = sum(os.path.getsize(os.path.join(D, f)) for f in core) / 1e6
print(f'PWA: 버전 {ver} · 설치 즉시 {len(shell)}개 · 오프라인 전체 받기 {len(core)}개 ({mb:.1f} MB)')
