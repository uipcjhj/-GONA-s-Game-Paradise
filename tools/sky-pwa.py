"""정식 플레이판(dist-adventure)을 설치형 웹앱(PWA)으로: 아이콘 · manifest · Service Worker · 홈 화면용 meta
   /GoNa/sky-adventure/ 하위 경로에서 동작하도록 모든 경로를 상대 경로('./')로 씀 · 다른 게임 경로에는 아무것도 넣지 않음
   사용: python3 tools/sky-pwa.py dist-adventure   (tools/sky-adventure-build.sh 가 자동 호출)
"""
import hashlib, json, os, re, sys
from PIL import Image, ImageDraw

D = sys.argv[1] if len(sys.argv) > 1 else 'dist-adventure'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.makedirs(f'{D}/pwa', exist_ok=True)

# ── 아이콘: 사용자 확정 픽셀아트 고나 아이콘 (2026-11-26) — 원본은 다시 그리지 않고 흰 여백만 정리한 정사각 판(tools/sky-icon.py)
#    iOS 가 모서리를 둥글게 깎으므로 둥근 테두리 없이 꽉 찬 불투명 정사각 · 파일명에 v2 를 붙여 예전 아이콘 캐시를 피함
IV = 'v2'
src = Image.open(f'{ROOT}/art-src/sky-poop/app-icon/gona-pixel-icon-square.png').convert('RGB')
def icon(size):
    return src.resize((size, size), Image.LANCZOS)   # 축소: 픽셀 덩어리를 고르게 평균 (최근접은 계단이 뭉개져 더 거칠게 보임)
for n, sz in [(f'icon-512-{IV}.png', 512), (f'icon-192-{IV}.png', 192), (f'apple-touch-icon-{IV}.png', 180), (f'icon-maskable-512-{IV}.png', 512), (f'favicon-32-{IV}.png', 32)]:
    icon(sz).save(f'{D}/pwa/{n}', optimize=True)
icon(64).save(f'{D}/pwa/favicon-{IV}.ico', sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])

# ── manifest (start_url · scope = 이 폴더)
manifest = {
    'name': "GONA's Sky Adventure", 'short_name': "GONA's Sky",
    'description': '아기 공룡 고나와 가족의 하늘 슈팅 대모험',
    'start_url': './?pwa=1', 'scope': './', 'id': './', 'display': 'standalone', 'orientation': 'portrait',
    'background_color': '#120a26', 'theme_color': '#120a26', 'lang': 'ko',
    'icons': [
        {'src': f'pwa/icon-192-{IV}.png', 'sizes': '192x192', 'type': 'image/png', 'purpose': 'any'},
        {'src': f'pwa/icon-512-{IV}.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any'},
        {'src': f'pwa/icon-maskable-512-{IV}.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'},
    ],
}
json.dump(manifest, open(f'{D}/manifest.webmanifest', 'w'), ensure_ascii=False, indent=1)

# ── 캐시 목록: shell(설치 즉시) · core(오프라인 플레이용 '전체 받기') — 앨범 원본 108장(20MB)은 볼 때만 캐시
def rel(p): return os.path.relpath(p, D).replace(os.sep, '/')
files = []
for dp, _, fs in os.walk(D):
    for f in fs: files.append(rel(os.path.join(dp, f)))
shell = ['./', 'index.html', 'manifest.webmanifest'] + sorted(f for f in files if re.match(r'assets/[^/]+\.(js|css|woff2)$', f)) + \
        sorted(f for f in files if f.startswith('assets/sky/v3-poop/title/') and 'cand/' not in f) + ['assets/sky/v3-poop/manifest.json', f'pwa/icon-192-{IV}.png', f'pwa/apple-touch-icon-{IV}.png', f'pwa/favicon-32-{IV}.png']
core = sorted(f for f in files if f.startswith('assets/') and not f.startswith('assets/sky/v3-poop/album/p/') and 'title/cand/' not in f and not f.endswith('.webmanifest'))
_h = hashlib.sha1(open(f'{D}/index.html', 'rb').read())
for f in sorted(set(core) | {x for x in shell if x not in ('./', 'manifest.webmanifest')}):   # 파일 내용까지 → 같은 이름 그림만 바뀌어도 새 버전
    if os.path.isfile(f'{D}/{f}'): _h.update(f.encode()); _h.update(open(f'{D}/{f}', 'rb').read())
ver = _h.hexdigest()[:10]
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
  if (u.pathname.endsWith('/online-config.js')) {{                                          // 온라인 설정: 항상 최신(인터넷 먼저)
    e.respondWith(fetch(e.request).then((res) => {{ const cp = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); return res; }}).catch(() => caches.match(e.request)));
    return;
  }}
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
h = re.sub(r'<link rel="apple-touch-icon"[^>]*>', f'<link rel="apple-touch-icon" sizes="180x180" href="./pwa/apple-touch-icon-{IV}.png" />', h)
h = re.sub(r'<link rel="icon" [^>]*>', f'<link rel="icon" type="image/png" sizes="32x32" href="./pwa/favicon-32-{IV}.png" />\n    <link rel="icon" href="./pwa/favicon-{IV}.ico" sizes="any" />', h, count=1)
if 'online-config.js' not in h:   # 온라인 설정(공개 URL·공개 키)을 다시 빌드 없이 넣는 파일 · 모듈보다 먼저 실행
    h = h.replace('<script type="module"', '<script src="./online-config.js"></script>\n    <script type="module"', 1)
cfg = f'{D}/online-config.js'
url_, key_ = os.environ.get('SKY_ONLINE_URL', ''), os.environ.get('SKY_ONLINE_ANON_KEY', '')
open(cfg, 'w').write(
    "/* GONA's Sky Adventure 온라인 설정 — 공개해도 되는 값만 (Project URL · anon/publishable 키)\n"
    " * service_role · sb_secret_ 키는 절대 넣지 마세요 (게임이 감지하면 온라인을 끕니다). 비우면 게스트·기기 저장만. */\n"
    f"window.SKY_ONLINE = {{ url: {json.dumps(url_)}, anonKey: {json.dumps(key_)} }};\n")
if 'manifest.webmanifest' not in h:
    h = h.replace('</head>', '    <link rel="manifest" href="./manifest.webmanifest" />\n    <meta name="apple-mobile-web-app-capable" content="yes" />\n    <meta name="mobile-web-app-capable" content="yes" />\n    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />\n    <meta name="apple-mobile-web-app-title" content="GONA\'s Sky" />\n  </head>')
open(f'{D}/index.html', 'w').write(h)
mb = sum(os.path.getsize(os.path.join(D, f)) for f in core) / 1e6
print(f'PWA: 버전 {ver} · 설치 즉시 {len(shell)}개 · 오프라인 전체 받기 {len(core)}개 ({mb:.1f} MB)')
