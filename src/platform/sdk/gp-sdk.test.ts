import { describe, expect, it } from 'vitest';
import { inboxKey, sessionKey } from '../keys';
import { consumeInbox } from '../inbox';
import { createSession } from '../session';
import { createMemoryStorage, createPlayer, savePlayer } from '../store';
import { createGP } from './gp-sdk';

const T0 = new Date('2026-11-13T03:00:00.000Z').getTime();
function env() {
  const kv = createMemoryStorage();
  const r = createPlayer('고나', 'gona', new Date(T0 - 600_000));
  if (!r.ok) throw new Error();
  savePlayer(kv, r.player);
  const s = createSession(kv, r.player, 'food-island', 'https://x.test/', new Date(T0 - 300_000))!;
  let t = T0;
  const clock = { now: () => t, advance: (ms: number) => (t += ms) };
  return { kv, player: r.player, s, clock };
}
const mkGP = (e: ReturnType<typeof env>, search = `?gp=${e.s.sessionId}`, extra = {}) => createGP({ storage: e.kv, session: createMemoryStorage(), search, now: e.clock.now, ...extra });

describe('gp-sdk', () => {
  it('세션 없음/다른 게임/만료/잘못된 값이면 완전한 no-op', () => {
    const e = env();
    for (const search of ['', '?gp=zzzzzzzzzz', '?gp=bad id', '?x=1']) {
      const gp = mkGP(e, search);
      expect(gp.init('food-island')).toBe(false);
      gp.runStart();
      expect(gp.runEnd({ outcome: 'cleared', score: 5 })).toBe(false);
      expect(gp.returnUrl()).toBeNull();
    }
    expect(mkGP(e).init('sky-battle')).toBe(false);
    const old = createSession(e.kv, e.player, 'food-island', 'https://x.test/', new Date(T0 - 20 * 3600_000))!;
    expect(mkGP(e, `?gp=${old.sessionId}`).init('food-island')).toBe(false);
    expect(Object.keys(e.kv.dump()).filter((k) => k.startsWith('gp.v1.inbox.'))).toHaveLength(0);
  });
  it('활성: runEnd 는 run 당 1번만, inbox 키 하나만 씀, 일시정지 시간 제외', () => {
    const e = env();
    const gp = mkGP(e);
    const before = Object.keys(e.kv.dump());
    expect(gp.init('food-island')).toBe(true);
    expect(gp.returnUrl()).toBe('https://x.test/');
    gp.runStart();
    e.clock.advance(30_000);
    gp.runPause();
    e.clock.advance(100_000);
    gp.runResume();
    e.clock.advance(30_000);
    expect(gp.runEnd({ outcome: 'failed', score: 1234, stage: 2, stageLabel: '성장 단계' })).toBe(true);
    expect(gp.runEnd({ outcome: 'failed', score: 1234 })).toBe(false); // 중복 이벤트
    const added = Object.keys(e.kv.dump()).filter((k) => !before.includes(k));
    expect(added).toHaveLength(1);
    expect(added[0].startsWith('gp.v1.inbox.')).toBe(true);
    const env1 = JSON.parse(e.kv.getItem(added[0])!);
    expect(env1.result.durationMs).toBe(60_000);
    expect(env1.sdk).toBe('gp-sdk/0.1');
    expect(e.kv.getItem('gp.v1.player')).toBe(JSON.stringify(e.player)); // 플레이어 데이터는 그대로
    expect(e.kv.getItem(sessionKey(e.s.sessionId))).not.toBeNull();
  });
  it('SDK 가 만든 결과를 게임천국이 그대로 수신해 기록', () => {
    const e = env();
    const gp = mkGP(e);
    gp.init('food-island');
    gp.runStart();
    e.clock.advance(45_000);
    gp.runEnd({ outcome: 'cleared', score: 9000, stage: 4, stageLabel: '성장 단계', extra: { snacks: 31, resumed: false } });
    const rep = consumeInbox(e.kv, e.player, new Date(e.clock.now() + 1000));
    expect(rep.applied).toHaveLength(1);
    expect(rep.rejected).toHaveLength(0);
    expect(rep.player.gameRecords['food-island']).toMatchObject({ plays: 1, clears: 1, bestScore: 9000, bestStage: 4 });
  });
  it('report(하위 게임, 지정 시간): 미니게임 결과 수신', () => {
    const e = env();
    const s2 = createSession(e.kv, e.player, 'minigame-paradise', 'https://x.test/', new Date(T0 - 300_000))!;
    const gp = createGP({ storage: e.kv, session: createMemoryStorage(), search: `?gp=${s2.sessionId}`, now: e.clock.now });
    expect(gp.init('minigame-paradise')).toBe(true);
    expect(gp.report({ outcome: 'cleared', score: 640, stage: 3, stageLabel: '레벨', subGameId: 'sort', durationMs: 40_000 })).toBe(true);
    const rep = consumeInbox(e.kv, e.player, new Date(e.clock.now() + 1000));
    expect(rep.applied).toHaveLength(1);
    expect(rep.player.gameRecords['minigame-paradise'].subGames?.sort).toMatchObject({ plays: 1, clears: 1, bestScore: 640 });
  });
  it('저장 실패는 메모리에 보관했다가 재시도 시 기록', () => {
    const e = env();
    let fail = true;
    const flaky = { ...e.kv, getItem: e.kv.getItem, removeItem: e.kv.removeItem, setItem: (k: string, v: string) => { if (fail && k.startsWith('gp.v1.inbox.')) throw new Error('quota'); e.kv.setItem(k, v); } };
    const gp = createGP({ storage: flaky, session: createMemoryStorage(), search: `?gp=${e.s.sessionId}`, now: e.clock.now });
    gp.init('food-island');
    gp.runStart();
    e.clock.advance(20_000);
    expect(gp.runEnd({ outcome: 'failed', score: 10 })).toBe(true);
    expect(gp.pendingCount()).toBe(1);
    fail = false;
    gp.retry();
    expect(gp.pendingCount()).toBe(0);
    expect(Object.keys(e.kv.dump()).some((k) => k.startsWith('gp.v1.inbox.'))).toBe(true);
    expect(e.kv.getItem(inboxKey('x'))).toBeNull();
  });
  it('runStart 없이 runEnd 하면 기록하지 않음, 잘못된 점수 거부', () => {
    const e = env();
    const gp = mkGP(e);
    gp.init('food-island');
    expect(gp.runEnd({ outcome: 'failed', score: 5 })).toBe(false);
    gp.runStart();
    expect(gp.runEnd({ outcome: 'failed', score: -5 })).toBe(false);
  });
});
