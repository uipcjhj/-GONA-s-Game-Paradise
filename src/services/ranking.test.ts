import { describe, expect, it } from 'vitest';
import { HttpRankingProvider } from './rankingHttp';
import { MockRankingServer } from './rankingMock';
import { NullRankingProvider } from './ranking';

let now = Date.parse('2026-11-13T03:00:00Z');
const mkServer = () => new MockRankingServer(() => now);
const fetchFor = (s: MockRankingServer): typeof fetch => (async (input: RequestInfo | URL, init?: RequestInit) => s.handle(new Request(String(input), init))) as typeof fetch;
const call = async (s: MockRankingServer, method: string, path: string, token?: string, body?: unknown) => {
  const r = await s.handle(new Request(`https://x.test${path}`, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined }));
  return { status: r.status, json: (await r.json()) as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
};
async function player(s: MockRankingServer, nick: string) {
  const r = await call(s, 'POST', '/v1/players', undefined, { nickname: nick, avatarId: 'mom' });
  return { id: r.json.playerId as string, token: r.json.token as string };
}
async function submit(s: MockRankingServer, token: string, score: number, o: { duration?: number; resultId?: string; wait?: number } = {}) {
  const sess = await call(s, 'POST', '/v1/sessions', token, { gameId: 'food-island' });
  now += (o.wait ?? 100) * 1000; // 서버가 재는 경과 시간
  return call(s, 'POST', `/v1/sessions/${sess.json.sessionId}/finish`, token, { resultId: o.resultId ?? `rid-${Math.random().toString(16).slice(2)}`, score, stage: 2, outcome: 'failed', durationMs: (o.duration ?? o.wait ?? 100) * 1000 });
}

describe('모의 랭킹 서버 (API 계약 기준 구현)', () => {
  it('익명 등록 → 토큰 필요 → 잘못된 토큰 401', async () => {
    const s = mkServer();
    const a = await player(s, '고나짱');
    expect(a.token).toBeTruthy();
    expect((await call(s, 'POST', '/v1/sessions', 'bad-token', { gameId: 'food-island' })).status).toBe(401);
    expect((await call(s, 'POST', '/v1/players', undefined, { nickname: '!' })).status).toBe(422);
  });
  it('점수 제출 · 순위 계산 · 동점은 먼저 달성한 기록 우선', async () => {
    const s = mkServer();
    const [a, b, c] = [await player(s, '가나'), await player(s, '다라'), await player(s, '마바')];
    await submit(s, a.token, 5000);
    await submit(s, b.token, 8000);
    await submit(s, c.token, 5000); // a 와 동점 → a 가 먼저
    const r = await call(s, 'GET', '/v1/rankings?gameId=food-island&period=all');
    expect(r.json.entries.map((e: { nickname: string }) => e.nickname)).toEqual(['다라', '가나', '마바']);
    expect(r.json.entries.map((e: { rank: number }) => e.rank)).toEqual([1, 2, 3]);
  });
  it('서버가 잰 시간보다 긴 플레이 시간 주장은 거부 · 비현실적 점수는 랭킹에서 숨김', async () => {
    const s = mkServer();
    const a = await player(s, '가나');
    expect((await submit(s, a.token, 100, { wait: 10, duration: 3000 })).status).toBe(422);
    const hi = await submit(s, a.token, 1_900_000, { wait: 20, duration: 20 });
    expect(hi.json.flagged).toBe(true);
    expect((await call(s, 'GET', '/v1/rankings?gameId=food-island&period=all')).json.entries).toHaveLength(0);
  });
  it('같은 resultId 재전송은 멱등(같은 응답, 중복 기록 없음)', async () => {
    const s = mkServer();
    const a = await player(s, '가나');
    const sess = await call(s, 'POST', '/v1/sessions', a.token, { gameId: 'food-island' });
    now += 60000;
    const body = { resultId: 'rid-same-0001', score: 3000, outcome: 'failed', durationMs: 60000 };
    const r1 = await call(s, 'POST', `/v1/sessions/${sess.json.sessionId}/finish`, a.token, body);
    const r2 = await call(s, 'POST', `/v1/sessions/${sess.json.sessionId}/finish`, a.token, body);
    expect(r2.json).toEqual(r1.json);
    expect(s.entries).toHaveLength(1);
    expect((await call(s, 'POST', `/v1/sessions/${sess.json.sessionId}/finish`, a.token, { ...body, score: 9999 })).status).toBe(409);
  });
  it('다른 사람의 세션으로 제출 불가(403) · 속도 제한(429)', async () => {
    const s = mkServer();
    const a = await player(s, '가나');
    const b = await player(s, '다라');
    const sess = await call(s, 'POST', '/v1/sessions', a.token, { gameId: 'food-island' });
    now += 60000;
    expect((await call(s, 'POST', `/v1/sessions/${sess.json.sessionId}/finish`, b.token, { resultId: 'rid-x-00001', score: 1, outcome: 'failed', durationMs: 1000 })).status).toBe(403);
    let last = 0;
    for (let i = 0; i < 12; i++) last = (await submit(s, a.token, 100 + i, { wait: 1 })).status;
    expect(last).toBe(429);
  });
  it('주간 랭킹은 한국 월요일 00:00 에 새로 시작, 역대는 유지', async () => {
    const s = mkServer();
    const a = await player(s, '가나');
    now = Date.parse('2026-11-15T14:00:00Z'); // 일 23:00 KST
    await submit(s, a.token, 4000, { wait: 30 });
    expect((await call(s, 'GET', '/v1/rankings?gameId=food-island&period=weekly')).json.entries).toHaveLength(1);
    now = Date.parse('2026-11-15T15:30:00Z'); // 월 00:30 KST
    expect((await call(s, 'GET', '/v1/rankings?gameId=food-island&period=weekly')).json.entries).toHaveLength(0);
    expect((await call(s, 'GET', '/v1/rankings?gameId=food-island&period=all')).json.entries).toHaveLength(1);
  });
  it('종합 랭킹: 출시된 게임이 1개뿐이거나 참가자 미달이면 비어 있음(원점수 합산·가짜 순위 없음)', async () => {
    const s = mkServer();
    const a = await player(s, '가나');
    await submit(s, a.token, 4000);
    expect((await call(s, 'GET', '/v1/rankings/overall?period=all')).json.entries).toEqual([]);
  });
  it('종합 랭킹 계산식: 백분위 + 수축, 참가자 미달 게임 제외, 2개 이상 게임 참여자만', () => {
    const s = new MockRankingServer(() => now, { ratePerMinute: 99, minParticipants: 3, shrinkM: 3 });
    const add = (pid: string, gameId: string, score: number, at: number) => {
      s.players.set(pid, { playerId: pid, tokenHash: '', nickname: pid, publicCode: 'AAAA', avatarId: 'gona' });
      s.entries.push({ playerId: pid, nickname: pid, publicCode: 'AAAA', avatarId: 'gona', score, at, weekId: '2026-11-09', gameId, flagged: false });
    };
    // food: 점수 규모가 큼(원점수 합산 금지), sky: 작음. 참가자 3명씩
    add('p1', 'food-island', 90000, 1); add('p2', 'food-island', 50000, 2); add('p3', 'food-island', 10000, 3);
    add('p1', 'sky-battle', 10, 1); add('p2', 'sky-battle', 30, 2); add('p3', 'sky-battle', 20, 3);
    add('p4', 'sky-battle', 5, 4); // 1개 게임만 → 종합 제외
    const o = s.overall('all', '2026-11-09', ['food-island', 'sky-battle']);
    expect(o.map((x) => x.playerId)).not.toContain('p4');
    // food: N=3 → p1 1.0·(3/6)=0.5, p2 (2/3)·0.5=0.333, p3 (1/3)·0.5=0.1667 / sky: N=4 → 점수 p2 30 > p3 20 > p1 10 > p4 5
    const f = (pid: string) => o.find((x) => x.playerId === pid)!.score;
    expect(f('p2')).toBeGreaterThan(f('p3')); // 원점수 합산이면 p1 이 1위였겠지만 정규화로 p2 가 1위
    expect(o[0].playerId).toBe('p2');
    // 참가자 미달 게임(N<minParticipants)은 종합에서 제외
    const s2 = new MockRankingServer(() => now, { ratePerMinute: 99, minParticipants: 5, shrinkM: 3 });
    expect(s2.overall('all', '2026-11-09', ['food-island'])).toEqual([]);
  });
});

describe('HttpRankingProvider ↔ 모의 서버 연결 테스트', () => {
  it('정상 조회', async () => {
    const s = mkServer();
    const a = await player(s, '가나');
    await submit(s, a.token, 4200);
    const p = new HttpRankingProvider('https://x.test', a.token, fetchFor(s));
    const r = await p.getRanking({ gameId: 'food-island', period: 'all-time' });
    expect(r.status).toBe('ok');
    if (r.status === 'ok') {
      expect(r.entries[0]).toMatchObject({ rank: 1, nickname: '가나', score: 4200 });
      expect(r.me?.score).toBe(4200);
    }
  });
  it('네트워크 오류/서버 오류/한도 초과는 error/unavailable 로만 표시(로컬 기록 영향 없음)', async () => {
    const down = new HttpRankingProvider('https://x.test', null, (async () => { throw new Error('offline'); }) as typeof fetch);
    expect((await down.getRanking({ gameId: 'food-island', period: 'weekly' })).status).toBe('error');
    const e500 = new HttpRankingProvider('https://x.test', null, (async () => new Response('x', { status: 500 })) as typeof fetch);
    expect(await e500.getRanking({ gameId: 'food-island', period: 'weekly' })).toMatchObject({ status: 'error' });
    const e503 = new HttpRankingProvider('https://x.test', null, (async () => new Response('x', { status: 503 })) as typeof fetch);
    expect(await e503.getRanking({ gameId: 'food-island', period: 'weekly' })).toEqual({ status: 'unavailable' });
    const bad = new HttpRankingProvider('https://x.test', null, (async () => new Response('{"a":1}', { status: 200 })) as typeof fetch);
    expect((await bad.getRanking({ gameId: 'food-island', period: 'weekly' })).status).toBe('error');
  });
  it('앱 기본값은 미연결(NullRankingProvider): 다른 플레이어 순위를 만들지 않음', async () => {
    expect(NullRankingProvider.connected).toBe(false);
    expect(await NullRankingProvider.getRanking({ gameId: 'food-island', period: 'weekly' })).toEqual({ status: 'unavailable' });
  });
});
