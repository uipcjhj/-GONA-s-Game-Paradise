// 공통: CORS · 로그인 사용자 확인 · service_role 클라이언트
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('SKY_ALLOWED_ORIGIN') ?? 'https://uipcjhj.github.io',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
export const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

/** Authorization 헤더의 사용자 토큰을 서버에서 확인 (클라이언트가 보낸 user_id 는 믿지 않음) */
export async function requireUser(req: Request): Promise<{ admin: SupabaseClient; userId: string } | Response> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
  if (!token) return json({ error: 'auth' }, 401);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return json({ error: 'auth' }, 401);
  return { admin, userId: data.user.id };
}
