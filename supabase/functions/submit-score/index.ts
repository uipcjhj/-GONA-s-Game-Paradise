// 점수 제출: 세션 확인 → 스테이지별 보고를 서버 규칙으로 다시 계산 → 합계 일치 · 실제 경과 시간 확인 → 기록
// 통과 못 하면 verified=false 로 남기고(사유 기록) 공식 랭킹에는 나오지 않음
import { cors, json, requireUser } from '../_shared/auth.ts';
import { checkStage, type Diff, type StageReport } from '../_shared/rules.ts';

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
