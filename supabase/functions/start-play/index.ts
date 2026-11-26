// 플레이 세션 발급: 출격 순간 서버 시간을 기록 → 점수 제출 때 실제 걸린 시간과 비교
import { cors, json, requireUser } from '../_shared/auth.ts';

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
