// ⚠ 대시보드 붙여넣기용 한 파일 판 (supabase/functions/start-play + _shared 합침 · tools/sky-online/build-dashboard-functions.py 가 생성 · 직접 고치지 말 것)
// Supabase → Edge Functions → Deploy a new function → Via Editor · 이름: start-play · 'Verify JWT' 끄기

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
// 플레이 세션 발급: 출격 순간 서버 시간을 기록 → 점수 제출 때 실제 걸린 시간과 비교

const MODES = ['story', 'hunt', 'daily'];
const DIFFS = ['easy', 'normal', 'hard'];
const FAMS = ['mom', 'dad', 'imo', 'samchon', 'halmeoni', 'halabeoji'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const u = await requireUser(req);
  if (u instanceof Response) return u;
  const b = await req.json().catch(() => ({}));
  if (!MODES.includes(b.mode) || !DIFFS.includes(b.diff) || !FAMS.includes(b.fam) || !(b.stage >= 1 && b.stage <= 6)) return json({ error: 'bad-request' }, 400);
  if (b.mode === 'story' && b.stage !== 1) return json({ error: 'story-starts-at-1' }, 400);
  // 남용 방지: 최근 1분에 세션 20개 넘게 만들면 거절
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await u.admin.from('sky_play_sessions').select('id', { count: 'exact', head: true }).eq('user_id', u.userId).gte('started_at', since);
  if ((count ?? 0) > 20) return json({ error: 'rate' }, 429);
  const { data, error } = await u.admin.from('sky_play_sessions').insert({
    user_id: u.userId, mode: b.mode, stage: b.stage, diff: b.diff, fam: b.fam, daily_date: b.mode === 'daily' ? b.date : null,
  }).select('id, started_at').single();
  if (error) return json({ error: 'db' }, 500);
  return json({ session: data.id, startedAt: data.started_at });
});
