// ⚠ 대시보드 붙여넣기용 한 파일 판 (supabase/functions/delete-account + _shared 합침 · tools/sky-online/build-dashboard-functions.py 가 생성 · 직접 고치지 말 것)
// Supabase → Edge Functions → Deploy a new function → Via Editor · 이름: delete-account · 'Verify JWT' 끄기

// ── _shared/auth.ts ──
// 공통: CORS · 로그인 사용자 확인 · service_role 클라이언트
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('SKY_ALLOWED_ORIGIN') ?? 'https://uipcjhj.github.io',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
export const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

/** 서버 전용 키: 예전 방식 SUPABASE_SERVICE_ROLE_KEY 또는 새 방식 SUPABASE_SECRET_KEYS(JSON 또는 문자열) — 둘 다 Supabase 가 함수에 자동으로 넣어 줌 · 사람이 입력하지 않음 */
function serverKey(): string {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  const raw = Deno.env.get('SUPABASE_SECRET_KEYS') ?? '';
  try { const j = JSON.parse(raw); const v = typeof j === 'string' ? j : Object.values(j as Record<string, string>)[0]; if (v) return v; } catch { /* 문자열 그대로 */ }
  if (raw) return raw;
  throw new Error('server key missing');
}
/** Authorization 헤더의 사용자 토큰을 서버에서 확인 (클라이언트가 보낸 user_id 는 믿지 않음) */
export async function requireUser(req: Request): Promise<{ admin: SupabaseClient; userId: string } | Response> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
  if (!token) return json({ error: 'auth' }, 401);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, serverKey(), { auth: { persistSession: false } });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return json({ error: 'auth' }, 401);
  return { admin, userId: data.user.id };
}

// ── index.ts ──
// 계정 삭제: 로그인한 본인만 · 저장·세션·점수는 auth.users 삭제에 따라 cascade 로 함께 지워짐

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const u = await requireUser(req);
  if (u instanceof Response) return u;
  const b = await req.json().catch(() => ({}));
  if (b.confirm !== 'DELETE') return json({ error: 'confirm' }, 400);
  const { error } = await u.admin.auth.admin.deleteUser(u.userId);
  if (error) return json({ error: 'db' }, 500);
  return json({ deleted: true });
});
