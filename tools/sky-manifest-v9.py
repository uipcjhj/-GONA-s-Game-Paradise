"""v9 에셋(108장 기념사진 · 오프닝 수호자 하늘 등)을 manifest 에 등록 — 실제 있는 파일만"""
import json, os
root = 'public/assets/sky/v3-poop'
p = f'{root}/manifest.json'
m = json.load(open(p))
f = m['files']
for d in ('album/p', 'album/t'):
    for n in sorted(os.listdir(f'{root}/{d}')):
        f[f'{d}/{n}'] = {'src': 'higgsfield', 'note': '보스 격파 기념사진' + (' 썸네일' if d.endswith('t') else '')}
for k, note in [('opening3/guard-bg.jpg', '오프닝 여섯 수호자 하늘'), ('title/logo-v9.png', '타이틀 로고 v9'), ('ending/finale.jpg', '엔딩 마지막 장면')]:
    if os.path.exists(f'{root}/{k}'): f[k] = {'src': 'higgsfield', 'note': note}
json.dump(m, open(p, 'w'), ensure_ascii=False, indent=2)
print(sum(1 for k in f if k.startswith('album/p/')), 'photos')
