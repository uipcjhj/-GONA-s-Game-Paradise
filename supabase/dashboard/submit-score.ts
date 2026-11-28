// ⚠ 대시보드 붙여넣기용 한 파일 판 (supabase/functions/submit-score + _shared 합침 · tools/sky-online/build-dashboard-functions.py 가 생성 · 직접 고치지 말 것)
// Supabase → Edge Functions → Deploy a new function → Via Editor · 이름: submit-score · 'Verify JWT' 끄기

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

// ── _shared/rules.ts ──
// 점수 검증 규칙 — 게임(src/sky/rank.ts · engine.ts finish())과 같은 계산을 서버에서 다시 함
// ⚠ 게임의 PAR · RANK_BONUS · 보너스 식을 바꾸면 이 파일도 함께 바꿀 것 (tools/sky-online-rules-test.mjs 가 둘이 같은지 검사)

export type Diff = 'easy' | 'normal' | 'hard';
export type Rank = 'S' | 'A' | 'B' | 'C' | 'D';
export const PAR = [
  { time: 165, combo: 70, score: 60000 },
  { time: 160, combo: 80, score: 75000 },
  { time: 165, combo: 90, score: 90000 },
  { time: 155, combo: 95, score: 100000 },
  { time: 168, combo: 100, score: 115000 },
  { time: 245, combo: 110, score: 140000 },
];
const DIFF_MUL: Record<Diff, number> = { easy: 0.85, normal: 1, hard: 1.1 };
const RANK_BONUS: Record<Rank, number> = { S: 30000, A: 15000, B: 6000, C: 2000, D: 0 };
const MAX_HP = 5;

export interface StageReport {
  stage: number; time: number; hits: number; bombsUsed: number; bombsLeft: number; hp: number; maxCombo: number;
  partsBroken: number; partsTotal: number; stageScore: number; rank: Rank;
}

export function evalRank(r: StageReport, diff: Diff): { rank: Rank; bonus: number } {
  const p = PAR[r.stage - 1];
  const pts =
    ([30, 20, 12, 6][r.hits] ?? 0) +
    ([15, 10, 5][r.bombsUsed] ?? 0) +
    (r.partsTotal ? Math.round((20 * r.partsBroken) / r.partsTotal) : 20) +
    Math.round(15 * Math.max(0, Math.min(1, (p.time * 1.6 - r.time) / (p.time * 0.6)))) +
    Math.round(10 * Math.min(1, r.maxCombo / p.combo)) +
    Math.round(10 * Math.min(1, r.stageScore / p.score));
  const points = Math.min(100, Math.round(pts * DIFF_MUL[diff]));
  const rank: Rank = points >= 90 ? 'S' : points >= 76 ? 'A' : points >= 60 ? 'B' : points >= 42 ? 'C' : 'D';
  return { rank, bonus: RANK_BONUS[rank] * r.stage };
}

/** 스테이지 하나의 합리성 검사 + 보너스 재계산 → 통과하면 그 스테이지 점수(보너스 포함), 아니면 사유 */
export function checkStage(r: StageReport, diff: Diff): { ok: true; total: number } | { ok: false; why: string } {
  const p = PAR[r.stage - 1];
  if (!p) return { ok: false, why: 'stage' };
  const int = (v: number) => Number.isFinite(v) && v >= 0;
  if (![r.time, r.hits, r.bombsUsed, r.bombsLeft, r.hp, r.maxCombo, r.partsBroken, r.partsTotal, r.stageScore].every(int)) return { ok: false, why: 'field' };
  if (r.time < p.time * 0.55) return { ok: false, why: 'too-fast' };               // 대본(적 편대·보스 등장)상 이보다 빨리 깰 수 없음
  if (r.time > 60 * 30) return { ok: false, why: 'too-slow' };
  if (r.stageScore > p.score * 4) return { ok: false, why: 'stage-score' };         // 기준 점수의 4배 초과 = 비정상
  if (r.maxCombo > 3000) return { ok: false, why: 'combo' };
  if (r.hp > MAX_HP || r.hp < 1) return { ok: false, why: 'hp' };
  if (r.partsTotal > 3 || r.partsBroken > r.partsTotal) return { ok: false, why: 'parts' };
  if (r.bombsUsed > 12 || r.bombsLeft > 9) return { ok: false, why: 'bombs' };
  const rk = evalRank(r, diff);
  if (rk.rank !== r.rank) return { ok: false, why: 'rank-mismatch' };
  const bonus = 10000 * r.stage + Math.min(r.hp, MAX_HP) * 2000 + r.bombsLeft * 1000 + (r.hits === 0 ? 20000 * r.stage : 0) + rk.bonus;
  return { ok: true, total: r.stageScore + bonus };
}

// ── index.ts ──
// 점수 제출: 세션 확인 → 스테이지별 보고를 서버 규칙으로 다시 계산 → 합계 일치 · 실제 경과 시간 확인 → 기록
// 통과 못 하면 verified=false 로 남기고(사유 기록) 공식 랭킹에는 나오지 않음

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const u = await requireUser(req);
  if (u instanceof Response) return u;
  const b = await req.json().catch(() => null) as { session: string; stages: StageReport[]; total: number; nickname: string } | null;
  if (!b || typeof b.session !== 'string' || !Array.isArray(b.stages) || b.stages.length < 1 || b.stages.length > 6) return json({ error: 'bad-request' }, 400);
  const { data: s } = await u.admin.from('sky_play_sessions').select('*').eq('id', b.session).single();
  if (!s || s.user_id !== u.userId) return json({ error: 'session' }, 403);
  if (s.used_at) return json({ error: 'duplicate' }, 409);
  // 세션 사용 처리 먼저 (같은 세션으로 동시에 두 번 보내도 한 번만 통과)
  const { data: used } = await u.admin.from('sky_play_sessions').update({ used_at: new Date().toISOString() }).eq('id', s.id).is('used_at', null).select('id');
  if (!used?.length) return json({ error: 'duplicate' }, 409);

  let why = '';
  let total = 0;
  let playTime = 0;
  b.stages.forEach((r, i) => {
    if (why) return;
    const want = s.mode === 'story' ? i + 1 : s.stage;
    if (r.stage !== want) { why = 'stage-order'; return; }
    const c = checkStage(r, s.diff as Diff);
    if (!c.ok) { why = `s${r.stage}:${c.why}`; return; }
    total += c.total;
    playTime += r.time;
  });
  if (!why && (s.mode !== 'story' ? b.stages.length !== 1 : false)) why = 'stage-count';
  if (!why && total !== Math.round(b.total)) why = 'total-mismatch';
  const wall = (Date.now() - new Date(s.started_at).getTime()) / 1000;
  if (!why && wall < playTime * 0.95) why = 'wall-clock';              // 게임 속 시간보다 실제 시간이 짧을 수 없음
  const last = b.stages[b.stages.length - 1];
  const board = s.mode === 'story' ? `story:${s.diff}` : s.mode === 'hunt' ? `hunt:${s.stage}:${s.diff}` : `daily:${s.daily_date}`;
  const { data: p } = await u.admin.from('sky_players').select('nickname').eq('user_id', u.userId).single();
  const { error } = await u.admin.from('sky_scores').insert({
    user_id: u.userId, session_id: s.id, nickname: p?.nickname ?? '모험가', mode: s.mode, board, stage: last?.stage ?? s.stage, diff: s.diff, fam: s.fam,
    score: Math.max(0, Math.round(b.total) || 0), rank: last?.rank ?? null, time_s: Math.round(playTime), verified: !why, reject_reason: why || null,
  });
  if (error) return json({ error: 'db' }, 500);
  if (why) return json({ verified: false, reason: why });
  // 내 순위 (보드 안 나보다 높은 사람 수 + 1)
  const { count } = await u.admin.from('sky_leaderboard').select('user_id', { count: 'exact', head: true }).eq('board', board).gt('score', total);
  return json({ verified: true, board, place: (count ?? 0) + 1 });
});
