"""supabase/functions/* (+ _shared) → supabase/dashboard/<이름>.ts 한 파일 판 (대시보드 'Via Editor' 붙여넣기용)
   사용: python3 tools/sky-online/build-dashboard-functions.py   (함수를 고치면 다시 실행)"""
import re, os
R = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
auth = open(f'{R}/supabase/functions/_shared/auth.ts').read()
rules = open(f'{R}/supabase/functions/_shared/rules.ts').read()
os.makedirs(f'{R}/supabase/dashboard', exist_ok=True)
for fn in ['start-play', 'submit-score', 'delete-account']:
    s = open(f'{R}/supabase/functions/{fn}/index.ts').read()
    body = re.sub(r"^import .*?from '\.\./_shared/.*?';\n", '', s, flags=re.M)
    parts = [f"// ⚠ 대시보드 붙여넣기용 한 파일 판 (supabase/functions/{fn} + _shared 합침 · tools/sky-online/build-dashboard-functions.py 가 생성 · 직접 고치지 말 것)\n",
             f"// Supabase → Edge Functions → Deploy a new function → Via Editor · 이름: {fn} · 'Verify JWT' 끄기\n\n",
             '// ── _shared/auth.ts ──\n', auth, '\n']
    if 'rules' in s: parts += ['// ── _shared/rules.ts ──\n', rules, '\n']
    parts += ['// ── index.ts ──\n', body]
    open(f'{R}/supabase/dashboard/{fn}.ts', 'w').write(''.join(parts))
print('ok')
