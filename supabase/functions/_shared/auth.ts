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
