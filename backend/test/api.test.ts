import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/app.ts';
import { createSqliteD1 } from '../src/node-sqlite-d1.ts';
import { kstWeekEnd, kstWeekId } from '../src/util.ts';
import { SERVER_GAMES } from '../src/games.ts';
import { getGame } from '../../src/platform/games';
import { BALANCE } from '../../src/platform/balance';

const MIG = fileURLToPath(new URL('../migrations', import.meta.url));
const T0 = Date.parse('2026-11-13T03:00:00Z'); // 금 12:00 KST

function makeServer(opts: { test?: boolean; min?: string } = {}) {
  const clock = { t: T0 };
  const db = createSqliteD1(MIG);
  const app = createApp({ DB: db, TOKEN_PEPPER: 'test-pepper', ALLOWED_ORIGINS: 'https://allowed.test', ALLOW_TEST_GAMES: opts.test ? '1' : '0', MIN_PARTICIPANTS: opts.min ?? '20', NOW: () => clock.t });
  let ipSeq = 0;
  const call = async (method: string, path: string, token?: string | null, body?: unknown, headers: Record<string, string> = {}) => {
    const r = await app(new Request(`https://api.test${path}`, { method, headers: { 'content-type': 'application/json', 'x-forwarded-for': headers['x-forwarded-for'] ?? `10.0.0.${(ipSeq++ % 250) + 1}`, ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }));
    const text = await r.text();
    return { status: r.status, headers: r.headers, json: text ? (JSON.parse(text) as Record<string, any>) : {} }; // eslint-disable-line @typescript-eslint/no-explicit-any
  };
  return { clock, db, call };
}
type S = ReturnType<typeof makeServer>;
let rid = 0;
const nextRid = () => `result-${String(++rid).padStart(8, '0')}`;
async function reg(s: S, nick: string, avatar = 'gona') {
  const r = await s.call('POST', '/v1/players', null, { nickname: nick, avatarId: avatar });
  expect(r.status).toBe(201);
  return { id: r.json.playerId as string, token: r.json.token as string, code: r.json.publicCode as string };
}
/** 정상 제출: 세션을 만들고 waitSec 만큼 지난 뒤 점수 제출 */
async function play(s: S, token: string, score: number, o: { wait?: number; dur?: number; outcome?: string; game?: string; sub?: string; resultId?: string; stage?: number } = {}) {
  const ses = await s.call('POST', '/v1/sessions', token, { gameId: o.game ?? 'food-island' });
  expect(ses.status).toBe(201);
  s.clock.t += (o.wait ?? 100) * 1000;
  const r = await s.call('POST', `/v1/sessions/${ses.json.sessionId}/finish`, token, { resultId: o.resultId ?? nextRid(), outcome: o.outcome ?? 'failed', score, stage: o.stage ?? 2, durationMs: (o.dur ?? o.wait ?? 100) * 1000, gameVersion: '1.0.0', scoreSchemaVersion: 1, ...(o.sub ? { subGameId: o.sub } : {}) });
  return { ses: ses.json.sessionId as string, ...r };
}
const board = async (s: S, q: string, token?: string) => (await s.call('GET', `/v1/rankings?${q}`, token)).json;

describe('익명 인증 · 플레이어', () => {
  it('등록: 서버가 토큰·playerId·공개 식별코드 발급, DB 에는 토큰 해시만', async () => {
    const s = makeServer();
    const p = await reg(s, '고나짱', 'mom');
    expect(p.token.length).toBeGreaterThanOrEqual(40);
    expect(p.code).toMatch(/^[A-Z2-9]{4}$/);
    const row = s.db.raw.prepare('SELECT * FROM players').get() as Record<string, string>;
    expect(row.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(row)).not.toContain(p.token); // 토큰 원문 미저장
    expect(row.token_hash).not.toBe(p.token);
    expect(p.token).not.toBe(p.id); // 공개 ID/코드와 인증 토큰은 별개
  });
  it('닉네임 규칙(2~10자·한영숫자·금지어) · 중복 닉네임 허용', async () => {
    const s = makeServer();
    expect((await s.call('POST', '/v1/players', null, { nickname: '고' })).status).toBe(422);
    expect((await s.call('POST', '/v1/players', null, { nickname: '고 나' })).status).toBe(422);
    expect((await s.call('POST', '/v1/players', null, { nickname: 'fuckyou' })).status).toBe(422);
    expect((await s.call('POST', '/v1/players', null, { nickname: '운영자' })).status).toBe(422);
    expect((await s.call('POST', '/v1/players', null, { nickname: '고나짱', avatarId: 'witch' })).status).toBe(422);
    const a = await reg(s, '같은이름');
    const b = await reg(s, '같은이름');
    expect(a.id).not.toBe(b.id);
    expect((s.db.raw.prepare('SELECT COUNT(*) c FROM players').get() as { c: number }).c).toBe(2);
  });
  it('토큰 없음/틀림 401 · playerId 만으로는 인증 불가', async () => {
    const s = makeServer();
    const a = await reg(s, '가나다');
    expect((await s.call('POST', '/v1/sessions', null, { gameId: 'food-island' })).status).toBe(401);
    expect((await s.call('POST', '/v1/sessions', 'x'.repeat(43), { gameId: 'food-island' })).status).toBe(401);
    expect((await s.call('POST', '/v1/sessions', a.id, { gameId: 'food-island' })).status).toBe(401); // playerId 를 토큰처럼 써도 안 됨
    expect((await s.call('PATCH', '/v1/players/me', a.id, { nickname: '해킹' })).status).toBe(401);
  });
  it('프로필 변경(닉네임·아바타·칭호) — 본인 토큰만, 기록 유지', async () => {
    const s = makeServer();
    const a = await reg(s, '가나다');
    await play(s, a.token, 3000);
    expect((await s.call('PATCH', '/v1/players/me', a.token, { nickname: '새이름', avatarId: 'dad', titleId: 't_cleared' })).status).toBe(200);
    const bd = await board(s, 'gameId=food-island&period=all');
    expect(bd.entries[0]).toMatchObject({ nickname: '새이름', avatarId: 'dad', titleId: 't_cleared', score: 3000, playerId: a.id });
    expect((await s.call('PATCH', '/v1/players/me', a.token, { nickname: '!' })).status).toBe(422);
  });
  it('다른 플레이어의 세션/기록을 수정할 수 없음(403)', async () => {
    const s = makeServer();
    const a = await reg(s, '가나다');
    const b = await reg(s, '다라마');
    const ses = await s.call('POST', '/v1/sessions', a.token, { gameId: 'food-island' });
    s.clock.t += 60000;
    const r = await s.call('POST', `/v1/sessions/${ses.json.sessionId}/finish`, b.token, { resultId: nextRid(), outcome: 'failed', score: 5, durationMs: 1000, gameVersion: '1', scoreSchemaVersion: 1 });
    expect(r.status).toBe(403);
    expect(await board(s, 'gameId=food-island&period=all')).toMatchObject({ total: 0 });
  });
});

describe('점수 제출 · 검증', () => {
  it('정상 제출 → 최고 점수·순위 응답', async () => {
    const s = makeServer();
    const a = await reg(s, '가나다');
    const r = await play(s, a.token, 4200);
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ accepted: true, flagged: false, bestAll: 4200, bestWeek: 4200, rankAll: 1, rankWeek: 1, weekId: '2026-11-09' });
  });
  it('같은 resultId 재전송은 멱등(중복 기록 없음), 내용이 다르면 409', async () => {
    const s = makeServer();
    const a = await reg(s, '가나다');
    const id = nextRid();
    const r1 = await play(s, a.token, 3000, { resultId: id });
    const body = { resultId: id, outcome: 'failed', score: 3000, stage: 2, durationMs: 100000, gameVersion: '1.0.0', scoreSchemaVersion: 1 };
    const r2 = await s.call('POST', `/v1/sessions/${r1.ses}/finish`, a.token, body);
    expect(r2.status).toBe(200);
    expect(r2.json.duplicate).toBe(true);
    expect((s.db.raw.prepare('SELECT COUNT(*) c FROM scores').get() as { c: number }).c).toBe(1);
    expect((await s.call('POST', `/v1/sessions/${r1.ses}/finish`, a.token, { ...body, score: 99999 })).status).toBe(409);
  });
  it('서버가 잰 경과 시간보다 긴 플레이 시간 주장은 거부(클라이언트 시계 무시)', async () => {
    const s = makeServer();
    const a = await reg(s, '가나다');
    expect((await play(s, a.token, 100, { wait: 10, dur: 3600 })).status).toBe(422);
  });
  it('비현실적 점수는 저장되지만 랭킹에서 숨김(flagged), 사용자에게 사유 비공개', async () => {
    const s = makeServer();
    const a = await reg(s, '가나다');
    const r = await play(s, a.token, 1_900_000, { wait: 20, dur: 20 });
    expect(r.status).toBe(200);
    expect(r.json.flagged).toBe(true);
    expect(r.json.reason).toBeUndefined();
    expect((s.db.raw.prepare('SELECT flagged, reason FROM scores').get() as Record<string, unknown>)).toEqual({ flagged: 1, reason: 'implausible-score' });
    expect((await board(s, 'gameId=food-island&period=all')).entries).toEqual([]);
  });
  it('입력 검증: 음수·소수·문자열 점수, 클리어 불가 게임, 잘못된 단계/버전, 큰 본문', async () => {
    const s = makeServer({ test: true });
    const a = await reg(s, '가나다');
    for (const score of [-1, 1.5, '100', null]) expect((await play(s, a.token, score as number)).status).toBe(422);
    expect((await play(s, a.token, 10, { stage: 9 })).status).toBe(422);
    expect((await play(s, a.token, 10, { game: 'minigame-paradise', outcome: 'cleared' })).status).toBe(422);
    const ses = await s.call('POST', '/v1/sessions', a.token, { gameId: 'food-island' });
    s.clock.t += 5000;
    expect((await s.call('POST', `/v1/sessions/${ses.json.sessionId}/finish`, a.token, { resultId: nextRid(), outcome: 'failed', score: 1, durationMs: 1000, gameVersion: '1', scoreSchemaVersion: 7 })).status).toBe(422);
    expect((await s.call('POST', `/v1/sessions/${ses.json.sessionId}/finish`, a.token, { x: 'y'.repeat(5000) })).status).toBe(413);
    expect((await s.call('POST', `/v1/sessions/${ses.json.sessionId}/finish`, a.token, undefined)).status).toBe(400);
  });
  it('세션 만료(12시간) · 출시 전 게임은 서버가 거부(테스트 허용 전)', async () => {
    const s = makeServer();
    const a = await reg(s, '가나다');
    expect((await s.call('POST', '/v1/sessions', a.token, { gameId: 'sky-battle' })).status).toBe(422);
    const ses = await s.call('POST', '/v1/sessions', a.token, { gameId: 'food-island' });
    s.clock.t += 13 * 3600 * 1000;
    expect((await s.call('POST', `/v1/sessions/${ses.json.sessionId}/finish`, a.token, { resultId: nextRid(), outcome: 'failed', score: 1, durationMs: 1000, gameVersion: '1', scoreSchemaVersion: 1 })).status).toBe(422);
  });
  it('요청 횟수 제한: 제출 분당 12회 · 등록은 같은 IP 시간당 20회', async () => {
    const s = makeServer();
    const a = await reg(s, '가나다');
    let last = 0;
    for (let i = 0; i < 14; i++) last = (await play(s, a.token, 100 + i, { wait: 1 })).status;
    expect(last).toBe(429);
    const s2 = makeServer();
    let st = 0;
    for (let i = 0; i < 22; i++) st = (await s2.call('POST', '/v1/players', null, { nickname: `닉${i + 10}` }, { 'x-forwarded-for': '9.9.9.9' })).status;
    expect(st).toBe(429);
    // 시간이 지나면 풀림
    s2.clock.t += 3600_000;
    expect((await s2.call('POST', '/v1/players', null, { nickname: '새닉네임' }, { 'x-forwarded-for': '9.9.9.9' })).status).toBe(201);
  });
});

describe('랭킹', () => {
  it('게임별 순위 · TOP3 · 동점은 먼저 달성한 기록 우선', async () => {
    const s = makeServer();
    const [a, b, c, d] = [await reg(s, '가나'), await reg(s, '다라'), await reg(s, '마바'), await reg(s, '사아')];
    await play(s, a.token, 5000);
    await play(s, b.token, 9000);
    await play(s, c.token, 5000); // a 와 동점 → a 가 먼저
    await play(s, d.token, 1000);
    const r = await board(s, 'gameId=food-island&period=all');
    expect(r.entries.map((e: { nickname: string }) => e.nickname)).toEqual(['다라', '가나', '마바', '사아']);
    expect(r.entries.map((e: { rank: number }) => e.rank)).toEqual([1, 2, 3, 4]);
    expect(r.total).toBe(4);
  });
  it('내 순위(me) 포함 · 최고만 갱신(낮은 점수는 무시)', async () => {
    const s = makeServer();
    const [a, b] = [await reg(s, '가나'), await reg(s, '다라')];
    await play(s, a.token, 5000);
    await play(s, b.token, 7000);
    await play(s, a.token, 100); // 낮은 점수 — 최고 유지
    const mine = await board(s, 'gameId=food-island&period=all', a.token);
    expect(mine.me).toMatchObject({ rank: 2, score: 5000, nickname: '가나' });
    expect((await board(s, 'gameId=food-island&period=all', null as unknown as string)).me).toBeUndefined();
  });
  it('주간 랭킹은 한국 시간 월요일 00:00 에 새로 시작, 역대는 유지', async () => {
    const s = makeServer();
    const a = await reg(s, '가나');
    s.clock.t = Date.parse('2026-11-15T14:00:00Z'); // 일 23:00 KST
    await play(s, a.token, 4000, { wait: 30 });
    expect((await board(s, 'gameId=food-island&period=weekly')).entries).toHaveLength(1);
    s.clock.t = Date.parse('2026-11-15T15:00:01Z'); // 월 00:00:01 KST
    expect((await board(s, 'gameId=food-island&period=weekly')).entries).toHaveLength(0);
    expect((await board(s, 'gameId=food-island&period=all')).entries).toHaveLength(1);
    expect(kstWeekId(Date.parse('2026-11-15T14:59:59Z'))).toBe('2026-11-09');
    expect(kstWeekId(Date.parse('2026-11-15T15:00:00Z'))).toBe('2026-11-16');
    const wk = await board(s, 'gameId=food-island&period=weekly');
    expect(wk.weekId).toBe('2026-11-16');
    expect(Date.parse(wk.weekEndsAt)).toBe(kstWeekEnd(s.clock.t));
  });
  it('주간 최고는 그 주 안에서만 갱신', async () => {
    const s = makeServer();
    const a = await reg(s, '가나');
    await play(s, a.token, 9000);
    s.clock.t = Date.parse('2026-11-16T01:00:00Z'); // 다음 주
    await play(s, a.token, 2000);
    expect((await board(s, 'gameId=food-island&period=weekly')).entries[0].score).toBe(2000);
    expect((await board(s, 'gameId=food-island&period=all')).entries[0].score).toBe(9000);
  });
  it('subGameId: 미니게임별 랭킹 분리 + 게임 전체 최고도 갱신', async () => {
    const s = makeServer({ test: true });
    const [a, b] = [await reg(s, '가나'), await reg(s, '다라')];
    await play(s, a.token, 300, { game: 'minigame-paradise', sub: 'cat-jump' });
    await play(s, b.token, 500, { game: 'minigame-paradise', sub: 'cat-jump' });
    await play(s, a.token, 900, { game: 'minigame-paradise', sub: 'fish-catch' });
    expect((await board(s, 'gameId=minigame-paradise&subGameId=cat-jump&period=all')).entries.map((e: { nickname: string }) => e.nickname)).toEqual(['다라', '가나']);
    expect((await board(s, 'gameId=minigame-paradise&subGameId=fish-catch&period=all')).entries).toHaveLength(1);
    expect((await board(s, 'gameId=minigame-paradise&period=all')).entries[0]).toMatchObject({ nickname: '가나', score: 900 });
  });
  it('조회 입력 검증 · 알 수 없는 게임 422', async () => {
    const s = makeServer();
    expect((await s.call('GET', '/v1/rankings?gameId=nope')).status).toBe(422);
    expect((await s.call('GET', '/v1/rankings?gameId=food-island&subGameId=' + encodeURIComponent('a b'))).status).toBe(422);
    expect((await s.call('GET', '/v1/rankings?gameId=sky-battle')).status).toBe(422); // 출시 전
  });
  it('종합 랭킹: 정규화(백분위+수축), 참가자 미달 게임 제외, 2개 이상 게임 참여자만', async () => {
    const s = makeServer({ test: true, min: '3' });
    const ps = [];
    for (const n of ['가가', '나나', '다다', '라라']) ps.push(await reg(s, n));
    // food: p0 90000 > p1 50000 > p2 10000 / sky(점수 규모 다름): p1 30 > p2 20 > p0 10 / p3 는 sky 만
    await play(s, ps[0].token, 90000, { wait: 1000, dur: 1000 });
    await play(s, ps[1].token, 50000, { wait: 1000, dur: 1000 });
    await play(s, ps[2].token, 10000, { wait: 1000, dur: 1000 });
    await play(s, ps[0].token, 10, { game: 'sky-battle', wait: 20, stage: 1 });
    await play(s, ps[1].token, 30, { game: 'sky-battle', wait: 20, stage: 1 });
    await play(s, ps[2].token, 20, { game: 'sky-battle', wait: 20, stage: 1 });
    await play(s, ps[3].token, 5, { game: 'sky-battle', wait: 20, stage: 1 });
    const o = (await s.call('GET', '/v1/rankings/overall?period=all', ps[1].token)).json;
    expect(o.gamesUsed.sort()).toEqual(['food-island', 'sky-battle']);
    expect(o.entries.map((e: { nickname: string }) => e.nickname)).not.toContain('라라'); // 1개 게임만
    expect(o.entries[0].nickname).toBe('나나'); // 원점수 합산이면 가가가 1위였겠지만 정규화로 나나
    expect(o.me).toMatchObject({ rank: 1 });
    // 참가자 미달이면 비어 있음(가짜 순위 없음)
    const s2 = makeServer({ test: true });
    const a = await reg(s2, '가나');
    await play(s2, a.token, 1000);
    expect((await s2.call('GET', '/v1/rankings/overall?period=all')).json.entries).toEqual([]);
  });
});

describe('보안 · 오류 처리', () => {
  it('CORS: 허용 출처만, preflight 204', async () => {
    const s = makeServer();
    const ok = await s.call('GET', '/v1/health', null, undefined, { origin: 'https://allowed.test' });
    expect(ok.headers.get('access-control-allow-origin')).toBe('https://allowed.test');
    const no = await s.call('GET', '/v1/health', null, undefined, { origin: 'https://evil.test' });
    expect(no.headers.get('access-control-allow-origin')).toBeNull();
    expect((await s.call('OPTIONS', '/v1/sessions', null, undefined, { origin: 'https://allowed.test' })).status).toBe(204);
  });
  it('알 수 없는 경로 404 · 서버 오류는 500 JSON(내부 정보 비공개)', async () => {
    const s = makeServer();
    expect((await s.call('GET', '/v1/nothing')).status).toBe(401); // 인증 전엔 경로 존재 여부도 노출하지 않음
    const a = await reg(s, '가나다');
    expect((await s.call('GET', '/v1/nothing', a.token)).status).toBe(404);
    s.db.raw.exec('DROP TABLE best_all');
    const r = await s.call('GET', '/v1/rankings?gameId=food-island&period=all');
    expect(r.status).toBe(500);
    expect(r.json).toMatchObject({ error: 'internal' });
    expect(JSON.stringify(r.json)).not.toMatch(/best_all|SQL|sqlite/i);
  });
  it('SQL 주입 시도는 데이터에 영향 없음(바인딩)', async () => {
    const s = makeServer();
    await reg(s, '가나다');
    const r = await s.call('GET', "/v1/rankings?gameId=food-island&subGameId=a';DROP TABLE players;--&period=all");
    expect(r.status).toBe(422);
    expect((s.db.raw.prepare('SELECT COUNT(*) c FROM players').get() as { c: number }).c).toBe(1);
  });
});

describe('서버 ↔ 앱 규칙 일치', () => {
  it('서버 게임 규칙이 src/platform/games.ts 와 같음', () => {
    for (const sg of SERVER_GAMES) {
      const g = getGame(sg.gameId)!;
      expect(g, sg.gameId).toBeTruthy();
      expect({ maxScore: sg.maxScore, maxScorePerSec: sg.maxScorePerSec, hasClear: sg.hasClear, scoreSchemaVersion: sg.scoreSchemaVersion, weight: sg.weight, stageCount: sg.stageCount ?? null, carry: sg.carryAllowance }).toEqual({ maxScore: g.rules.maxScore, maxScorePerSec: g.rules.maxScorePerSec, hasClear: g.rules.hasClear, scoreSchemaVersion: g.rules.scoreSchemaVersion, weight: g.rules.weight, stageCount: g.rules.stageCount ?? null, carry: BALANCE.validation.carryAllowance });
    }
  });
});
