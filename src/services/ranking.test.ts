import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { createApp } from '../../backend/src/app';
import { createSqliteD1 } from '../../backend/src/node-sqlite-d1';
import { buildBackup } from '../platform/backup';
import { ONLINE_KEYS } from '../platform/keys';
import { createMemoryStorage, createPlayer, resetPlatformData } from '../platform/store';
import { NullRankingProvider } from './ranking';
import { OnlineClient } from './online';
import { HttpRankingProvider } from './rankingHttp';

const MIG = fileURLToPath(new URL('../../backend/migrations', import.meta.url));
const BASE = 'https://api.test';
const clock = { t: Date.parse('2026-11-13T03:00:00Z') };

function server(o: { test?: boolean } = {}) {
  const db = createSqliteD1(MIG);
  const app = createApp({ DB: db, TOKEN_PEPPER: 'pepper', ALLOWED_ORIGINS: '*', ALLOW_TEST_GAMES: o.test ? '1' : '0', NOW: () => clock.t });
  let ip = 0;
  const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    headers.set('x-forwarded-for', `10.1.0.${(ip++ % 200) + 1}`);
    return app(new Request(String(input), { ...init, headers }));
  }) as typeof fetch;
  return { db, app, f };
}
const mkPlayer = (nick = '고나짱') => {
  const r = createPlayer(nick, 'gona', new Date(clock.t));
  if (!r.ok) throw new Error('x');
  return r.player;
};
const body = (rid: string, score: number, durSec: number) => ({ resultId: rid, outcome: 'failed', score, stage: 2, durationMs: durSec * 1000, gameVersion: '1.0.0', scoreSchemaVersion: 1 });

describe('온라인 클라이언트 ↔ 실제 서버 코드(SQLite)', () => {
  it('최초 연결: 익명 등록 → 토큰은 이 기기 저장소에만, 재호출은 재등록 안 함', async () => {
    const s = server();
    const kv = createMemoryStorage();
    const c = new OnlineClient(kv, BASE, s.f, () => clock.t);
    const id = await c.ensureRegistered(mkPlayer());
    expect(id).toMatchObject({ apiBase: BASE });
    expect(id!.token.length).toBeGreaterThan(40);
    expect((await c.ensureRegistered(mkPlayer()))!.playerId).toBe(id!.playerId);
    expect((s.db.raw.prepare('SELECT COUNT(*) c FROM players').get() as { c: number }).c).toBe(1);
    expect(c.status).toBe('online');
  });
  it('토큰은 백업 파일·공개 식별코드에 포함되지 않고, 데이터 초기화 때 삭제', async () => {
    const s = server();
    const kv = createMemoryStorage();
    const c = new OnlineClient(kv, BASE, s.f, () => clock.t);
    const p = mkPlayer();
    const id = (await c.ensureRegistered(p))!;
    expect(buildBackup(p).text).not.toContain(id.token);
    expect(kv.getItem(ONLINE_KEYS.identity)).toContain(id.token);
    resetPlatformData(kv);
    expect(kv.getItem(ONLINE_KEYS.identity)).toBeNull();
    expect(kv.getItem(ONLINE_KEYS.outbox)).toBeNull();
  });
  it('세션 → 결과 제출(outbox) → 랭킹 반영 · 내 순위', async () => {
    const s = server();
    const kv = createMemoryStorage();
    const c = new OnlineClient(kv, BASE, s.f, () => clock.t);
    const id = (await c.ensureRegistered(mkPlayer()))!;
    const sid = await c.createSession('food-island');
    expect(sid).toBeTruthy();
    clock.t += 90_000;
    c.enqueue({ resultId: 'rid-client-0001', serverSessionId: sid!, body: body('rid-client-0001', 4200, 90) });
    expect(await c.flush()).toEqual({ sent: 1, dropped: 0, pending: 0 });
    const prov = new HttpRankingProvider(BASE, id.token, s.f);
    const r = await prov.getRanking({ gameId: 'food-island', period: 'all-time' });
    expect(r.status).toBe('ok');
    if (r.status === 'ok') {
      expect(r.entries[0]).toMatchObject({ rank: 1, nickname: '고나짱', score: 4200 });
      expect(r.me).toMatchObject({ rank: 1, score: 4200 });
      expect(r.total).toBe(1);
    }
  });
  it('서버 중단 → 대기열 보관 → 복구 후 안전 동기화(중복 없음)', async () => {
    const s = server();
    const kv = createMemoryStorage();
    let down = false;
    const flaky = (async (...a: Parameters<typeof fetch>) => (down ? Promise.reject(new Error('offline')) : s.f(...a))) as typeof fetch;
    const c = new OnlineClient(kv, BASE, flaky, () => clock.t);
    await c.ensureRegistered(mkPlayer());
    const sid = (await c.createSession('food-island'))!;
    clock.t += 60_000;
    c.enqueue({ resultId: 'rid-client-0002', serverSessionId: sid, body: body('rid-client-0002', 3000, 60) });
    down = true;
    const r1 = await c.flush();
    expect(r1).toMatchObject({ sent: 0, pending: 1 });
    expect(c.status).toBe('offline');
    expect(c.outbox()[0].tries).toBe(1);
    // 백오프 시간 전에는 재시도하지 않음
    expect((await c.flush()).pending).toBe(1);
    down = false;
    clock.t += 5 * 60_000;
    expect(await c.flush()).toMatchObject({ sent: 1, pending: 0 });
    expect(c.status).toBe('online');
    expect((s.db.raw.prepare('SELECT COUNT(*) c FROM scores').get() as { c: number }).c).toBe(1);
  });
  it('서버는 처리했는데 응답이 유실된 경우 재전송해도 한 번만 기록(멱등)', async () => {
    const s = server();
    const kv = createMemoryStorage();
    let lose = false;
    const lossy = (async (...a: Parameters<typeof fetch>) => {
      const r = await s.f(...a);
      if (lose && String(a[0]).includes('/finish')) throw new Error('response lost');
      return r;
    }) as typeof fetch;
    const c = new OnlineClient(kv, BASE, lossy, () => clock.t);
    await c.ensureRegistered(mkPlayer());
    const sid = (await c.createSession('food-island'))!;
    clock.t += 60_000;
    c.enqueue({ resultId: 'rid-client-0003', serverSessionId: sid, body: body('rid-client-0003', 7000, 60) });
    lose = true;
    expect((await c.flush()).pending).toBe(1); // 서버엔 이미 저장됨
    lose = false;
    clock.t += 5 * 60_000;
    expect(await c.flush()).toMatchObject({ sent: 1, pending: 0 });
    expect((s.db.raw.prepare('SELECT COUNT(*) c FROM scores').get() as { c: number }).c).toBe(1);
  });
  it('영구 거부(검증 실패)는 대기열에서 제거 · 서버 오류(5xx)·제한(429)은 유지', async () => {
    const s = server();
    const kv = createMemoryStorage();
    const c = new OnlineClient(kv, BASE, s.f, () => clock.t);
    await c.ensureRegistered(mkPlayer());
    const sid = (await c.createSession('food-island'))!;
    clock.t += 10_000;
    c.enqueue({ resultId: 'rid-client-0004', serverSessionId: sid, body: body('rid-client-0004', 100, 9999) }); // 서버가 잰 시간보다 긴 플레이 시간 → 422
    expect(await c.flush()).toMatchObject({ sent: 0, dropped: 1, pending: 0 });
    const c2 = new OnlineClient(createMemoryStorage(), BASE, (async () => new Response('x', { status: 500 })) as typeof fetch, () => clock.t);
    c2.enqueue({ resultId: 'rid-client-0005', serverSessionId: 'sess-xxxxxxxx', body: {} });
    expect(await c2.flush()).toMatchObject({ dropped: 0, pending: 1 });
  });
  it('프로필 동기화: 닉네임 변경 → 서버 반영(같은 playerId 로 기록 유지)', async () => {
    const s = server();
    const kv = createMemoryStorage();
    const c = new OnlineClient(kv, BASE, s.f, () => clock.t);
    const p = mkPlayer('처음이름');
    const id = (await c.ensureRegistered(p))!;
    await c.syncProfile({ ...p, nickname: '바뀐이름' });
    expect((s.db.raw.prepare('SELECT nickname FROM players WHERE player_id = ?').get(id.playerId) as { nickname: string }).nickname).toBe('바뀐이름');
    expect(c.identity()!.synced).toContain('바뀐이름');
  });
  it('서버가 꺼져 있으면(등록 실패) 아무 일도 없이 로컬 모드 유지', async () => {
    const c = new OnlineClient(createMemoryStorage(), BASE, (async () => { throw new Error('down'); }) as typeof fetch, () => clock.t);
    expect(await c.ensureRegistered(mkPlayer())).toBeNull();
    expect(c.status).toBe('offline');
    expect(await c.createSession('food-island')).toBeNull();
  });
  it('다른 서버 주소의 저장된 신원은 사용하지 않음', async () => {
    const s = server();
    const kv = createMemoryStorage();
    const a = new OnlineClient(kv, BASE, s.f, () => clock.t);
    await a.ensureRegistered(mkPlayer());
    expect(new OnlineClient(kv, 'https://other.test', s.f, () => clock.t).identity()).toBeNull();
  });
});

describe('HttpRankingProvider · 앱 기본값', () => {
  it('오류 분류: 네트워크/500 → error, 503/429 → unavailable, 형식 오류 → error', async () => {
    const mk = (f: typeof fetch) => new HttpRankingProvider(BASE, null, f);
    expect((await mk((async () => { throw new Error('offline'); }) as typeof fetch).getRanking({ gameId: 'food-island', period: 'weekly' })).status).toBe('error');
    expect(await mk((async () => new Response('x', { status: 500 })) as typeof fetch).getRanking({ gameId: 'food-island', period: 'weekly' })).toMatchObject({ status: 'error' });
    expect(await mk((async () => new Response('x', { status: 503 })) as typeof fetch).getRanking({ gameId: 'food-island', period: 'weekly' })).toEqual({ status: 'unavailable' });
    expect(await mk((async () => new Response('x', { status: 429 })) as typeof fetch).getRanking({ gameId: 'food-island', period: 'weekly' })).toEqual({ status: 'unavailable' });
    expect((await mk((async () => new Response('{"a":1}', { status: 200 })) as typeof fetch).getRanking({ gameId: 'food-island', period: 'weekly' })).status).toBe('error');
  });
  it('서버가 없으면(기본) NullRankingProvider: 다른 플레이어 순위를 만들지 않음', async () => {
    expect(NullRankingProvider.connected).toBe(false);
    expect(await NullRankingProvider.getRanking({ gameId: 'food-island', period: 'weekly' })).toEqual({ status: 'unavailable' });
  });
  it('종합/미니게임 조회 파라미터 전달', async () => {
    const s = server({ test: true });
    const prov = new HttpRankingProvider(BASE, null, s.f);
    expect((await prov.getRanking({ gameId: 'overall', period: 'all-time' })).status).toBe('ok');
    expect((await prov.getRanking({ gameId: 'minigame-paradise', subGameId: 'cat-jump', period: 'weekly' })).status).toBe('ok');
  });
});
