/* 실제 Supabase 서버 검사 (서버를 만든 뒤 1번 실행) — 공개 값만 사용 (Project URL · anon/publishable 키)
 *  두 테스트 계정 가입 → 저장 분리·RLS · rev 충돌 · 위조 점수 거절 · 중복 제출 거절 · 정상 점수 통과(약 1분 40초 대기)
 *  · 보드 분리(스테이지·주간·일일) · 비로그인 랭킹 읽기 · 계정 삭제
 * 사용: SKY_URL=https://<ref>.supabase.co SKY_KEY=<공개 키> SKY_MAIL_DOMAIN=<받을 수 있는 메일 도메인> \
 *       node --experimental-strip-types tools/sky-online/live-test.mts
 *  (Authentication 의 "Confirm email" 을 끈 상태여야 가입 즉시 로그인됨 · 테스트 계정은 끝에 지움)
 */
import { evalRank, checkStage, type StageReport } from '../../supabase/functions/_shared/rules.ts';
const URL_ = (process.env.SKY_URL ?? '').replace(/\/$/, '');
const KEY = process.env.SKY_KEY ?? '';
const DOMAIN = process.env.SKY_MAIL_DOMAIN ?? 'example.com';
if (!URL_ || !KEY) { console.log('SKY_URL · SKY_KEY 가 필요해요 (공개 값만)'); process.exit(1); }
if (KEY.startsWith('sb_secret_') || /service_role/.test(Buffer.from(KEY.split('.')[1] ?? '', 'base64').toString())) { console.log('⛔ 비밀 키가 들어왔어요. 공개(anon/publishable) 키만 쓰세요.'); process.exit(1); }
const res: string[] = [];
const ok = (n: string, c: boolean, x = ''): void => { res.push(`${c ? 'PASS' : 'FAIL'} · ${n}${x ? ' — ' + x : ''}`); };
const call = async (path: string, init: RequestInit & { tok?: string } = {}) => {
  const h: Record<string, string> = { apikey: KEY, 'Content-Type': 'application/json', ...(init.tok ? { Authorization: `Bearer ${init.tok}` } : {}) };
  const r = await fetch(URL_ + path, { ...init, headers: { ...h, ...(init.headers as Record<string, string> ?? {}) } });
  let j: unknown = null; try { j = await r.json(); } catch { /* 빈 응답 */ }
  return { s: r.status, j: j as any };
};
const ts = Date.now();
const acct = async (tag: string) => {
  const email = `gona-qa-${tag}-${ts}@${DOMAIN}`, password = `Qa!${ts}x`;
  const r = await call('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email, password }) });
  return { email, tok: r.j?.access_token as string, id: r.j?.user?.id as string, s: r.s, j: r.j };
};
const A = await acct('a'); const B = await acct('b');
ok('가입 두 계정 (메일 확인 끈 상태)', !!A.tok && !!B.tok, `${A.s}/${B.s} ${A.tok ? '' : JSON.stringify(A.j).slice(0, 80)}`);
if (!A.tok || !B.tok) { console.log(res.join('\n')); process.exit(1); }
await call('/rest/v1/sky_players', { method: 'POST', tok: A.tok, headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ user_id: A.id, nickname: 'QA-A' }) });
await call('/rest/v1/sky_players', { method: 'POST', tok: B.tok, headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ user_id: B.id, nickname: 'QA-B' }) });
const s1 = await call('/rest/v1/rpc/sky_save_put', { method: 'POST', tok: A.tok, body: JSON.stringify({ p_bundle: { schema: 3, mark: 'A' }, p_rev: 0 }) });
const s2 = await call('/rest/v1/rpc/sky_save_put', { method: 'POST', tok: A.tok, body: JSON.stringify({ p_bundle: { schema: 3, mark: 'A2' }, p_rev: 0 }) });
ok('클라우드 저장 · rev 충돌 시 덮어쓰기 거절', s1.j === 1 && s2.j === -1, `${s1.j} / ${s2.j}`);
const bRead = await call('/rest/v1/sky_saves?select=user_id,bundle', { tok: B.tok });
ok('B 는 A 의 저장을 볼 수 없음 (RLS)', Array.isArray(bRead.j) && bRead.j.every((r: any) => r.user_id === B.id), `${bRead.j?.length ?? bRead.s}행`);
const anonSave = await call('/rest/v1/sky_saves?select=user_id');
ok('비로그인은 저장 표를 못 읽음', !(Array.isArray(anonSave.j) && anonSave.j.length > 0), `${anonSave.s}`);
const forge = await call('/rest/v1/sky_scores', { method: 'POST', tok: A.tok, body: JSON.stringify({ user_id: A.id, session_id: crypto.randomUUID(), nickname: 'x', mode: 'hunt', board: 'hunt:1:normal', stage: 1, diff: 'normal', fam: 'mom', score: 99999999, verified: true }) });
ok('점수 표에 직접 쓰기 차단', forge.s >= 400, `${forge.s}`);
// 위조(너무 빠름) → 거절 · 같은 세션 재제출 → 중복 거절
const ses1 = await call('/functions/v1/start-play', { method: 'POST', tok: A.tok, body: JSON.stringify({ mode: 'hunt', stage: 1, diff: 'normal', fam: 'mom' }) });
const fake: StageReport = { stage: 1, time: 10, hits: 0, bombsUsed: 0, bombsLeft: 3, hp: 5, maxCombo: 70, partsBroken: 2, partsTotal: 2, stageScore: 60000, rank: 'S' };
const f1 = await call('/functions/v1/submit-score', { method: 'POST', tok: A.tok, body: JSON.stringify({ session: ses1.j?.session, stages: [fake], total: 999999 }) });
const f2 = await call('/functions/v1/submit-score', { method: 'POST', tok: A.tok, body: JSON.stringify({ session: ses1.j?.session, stages: [fake], total: 999999 }) });
ok('비정상 점수 거절 (verified=false · 사유)', f1.j?.verified === false, JSON.stringify(f1.j));
ok('같은 판 중복 제출 거절', f2.s === 409, `${f2.s}`);
// 정상 점수: 실제로 시간이 흘러야 통과 (서버 시계 확인)
const ses2 = await call('/functions/v1/start-play', { method: 'POST', tok: A.tok, body: JSON.stringify({ mode: 'hunt', stage: 1, diff: 'normal', fam: 'mom' }) });
const good: StageReport = { stage: 1, time: 92, hits: 1, bombsUsed: 1, bombsLeft: 2, hp: 4, maxCombo: 60, partsBroken: 1, partsTotal: 2, stageScore: 52000, rank: 'D' };
good.rank = evalRank(good, 'normal').rank;
const want = checkStage(good, 'normal');
console.log('정상 점수 확인을 위해 95초 기다려요…');
await new Promise((r) => setTimeout(r, 95_000));
const g = await call('/functions/v1/submit-score', { method: 'POST', tok: A.tok, body: JSON.stringify({ session: ses2.j?.session, stages: [good], total: want.ok ? want.total : 0 }) });
ok('정상 점수 통과 · 순위', g.j?.verified === true, JSON.stringify(g.j));
const lb = await call(`/rest/v1/sky_leaderboard?select=*&board=eq.hunt:1:normal&order=score.desc`);
const mine = (lb.j ?? []).filter((r: any) => r.user_id === A.id);
ok('비로그인 랭킹 읽기: 검증된 점수만 · 위조 점수 없음', mine.length === 1 && mine[0].score === (want.ok ? want.total : -1), `${mine.map((r: any) => r.score).join(',')}`);
const wk = await call(`/rest/v1/sky_leaderboard_weekly?select=*&board=eq.hunt:1:normal`);
const other = await call(`/rest/v1/sky_leaderboard?select=*&board=eq.hunt:2:normal`);
const daily = await call(`/rest/v1/sky_leaderboard?select=*&board=eq.daily:${new Date().toISOString().slice(0, 10)}`);
ok('주간 보드 반영 · 다른 스테이지/일일 보드와 분리', (wk.j ?? []).some((r: any) => r.user_id === A.id) && !(other.j ?? []).some((r: any) => r.user_id === A.id) && !(daily.j ?? []).some((r: any) => r.user_id === A.id));
for (const u of [A, B]) await call('/functions/v1/delete-account', { method: 'POST', tok: u.tok });
const again = await call('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: A.email, password: `Qa!${ts}x` }) });
ok('계정 삭제 → 다시 로그인 안 됨', again.s >= 400, `${again.s}`);
console.log(res.join('\n'));
