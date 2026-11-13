import { describe, expect, it } from 'vitest';
import { finishConsume, planConsume } from './inbox';
import { INBOX_PREFIX, REJECTED_PREFIX, SESSION_PREFIX } from './keys';
import { buildLaunchUrl } from './launch';
import { validateEnvelope, type GpResultEnvelope } from './result';
import { createSession, getSession, inboxKey } from './session';
import { createMemoryStorage, createPlayer, savePlayer, loadPlayer, resetPlatformData } from './store';
import { KEYS } from './keys';

const T0 = Date.parse('2026-11-13T03:00:00Z');
const player = () => {
  const r = createPlayer('고나짱', 'gona', new Date(T0 - 3600000));
  if (!r.ok) throw new Error('x');
  return r.player;
};
const setup = () => {
  const kv = createMemoryStorage();
  const p = player();
  savePlayer(kv, p);
  const s = createSession(kv, 'food-island', p, 'https://example.test/paradise/', T0 - 600000);
  return { kv, p, s };
};
let n = 0;
const env = (sid: string, o: Record<string, unknown> = {}): GpResultEnvelope => {
  n += 1;
  return {
    kind: 'gp-result', v: 1, sdk: 'test',
    result: { resultId: `rid-${String(n).padStart(8, '0')}`, sessionId: sid, gameId: 'food-island', gameVersion: '1.0.0', scoreSchemaVersion: 1, outcome: 'failed', score: 2500, stage: 2, startedAt: new Date(T0 - 300000).toISOString(), endedAt: new Date(T0 - 60000).toISOString(), durationMs: 240000, extra: { snacks: 30 }, ...o },
  } as GpResultEnvelope;
};
const put = (kv: ReturnType<typeof createMemoryStorage>, e: GpResultEnvelope) => kv.setItem(inboxKey(e.result.resultId), JSON.stringify(e));

describe('검증 (validateEnvelope)', () => {
  const { kv, p, s } = setup();
  const v = (e: unknown) => validateEnvelope(e, { now: T0, playerId: p.playerId, getSession: (id) => getSession(kv, id) });
  it('정상', () => expect(v(env(s.sessionId)).ok).toBe(true));
  it('형식 오류', () => {
    expect(v(null)).toMatchObject({ ok: false, reason: 'format' });
    expect(v({ kind: 'x' })).toMatchObject({ ok: false, reason: 'format' });
    expect(v({ ...env(s.sessionId), v: 'a' })).toMatchObject({ ok: false });
    const bad = env(s.sessionId);
    (bad.result as unknown as Record<string, unknown>).score = '999';
    expect(v(bad)).toMatchObject({ ok: false, reason: 'score' });
  });
  it('음수·소수·과대 점수', () => {
    expect(v(env(s.sessionId, { score: -1 }))).toMatchObject({ ok: false, reason: 'score' });
    expect(v(env(s.sessionId, { score: 1.5 }))).toMatchObject({ ok: false, reason: 'score' });
    expect(v(env(s.sessionId, { score: 99999999 }))).toMatchObject({ ok: false, reason: 'score' });
  });
  it('시간 이상: 미래 · 시작>종료 · 세션 이전 · 너무 오래됨', () => {
    expect(v(env(s.sessionId, { endedAt: new Date(T0 + 3600000).toISOString() }))).toMatchObject({ ok: false, reason: 'time' });
    expect(v(env(s.sessionId, { startedAt: new Date(T0).toISOString(), endedAt: new Date(T0 - 1000).toISOString() }))).toMatchObject({ ok: false, reason: 'time' });
    expect(v(env(s.sessionId, { startedAt: new Date(T0 - 9e8).toISOString(), endedAt: new Date(T0 - 8e8).toISOString(), durationMs: 1000 }))).toMatchObject({ ok: false });
    expect(v(env(s.sessionId, { durationMs: 999999999 }))).toMatchObject({ ok: false, reason: 'duration' });
  });
  it('세션 없음 · 다른 게임 · 다른 플레이어', () => {
    expect(v(env('sess-unknown0'))).toMatchObject({ ok: false, reason: 'session' });
    expect(v(env(s.sessionId, { gameId: 'sky-battle' }))).toMatchObject({ ok: false, reason: 'session' });
    const other = createMemoryStorage();
    const p2 = createPlayer('다른이', 'mom');
    if (!p2.ok) throw new Error('x');
    const s2 = createSession(other, 'food-island', p2.player, 'x', T0 - 600000);
    expect(validateEnvelope(env(s2.sessionId), { now: T0, playerId: p.playerId, getSession: (id) => getSession(other, id) })).toMatchObject({ ok: false, reason: 'player' });
  });
  it('미지원 게임 · 단계 범위 · 클리어 불가 게임', () => {
    expect(v(env(s.sessionId, { gameId: 'nope' }))).toMatchObject({ ok: false, reason: 'unknown-game' });
    expect(v(env(s.sessionId, { stage: 9 }))).toMatchObject({ ok: false, reason: 'stage' });
  });
  it('더 새로운 봉투/점수 규칙 버전은 보류(hold)', () => {
    expect(v({ ...env(s.sessionId), v: 2 })).toMatchObject({ ok: false, hold: true });
    expect(v(env(s.sessionId, { scoreSchemaVersion: 2 }))).toMatchObject({ ok: false, hold: true });
    expect(v(env(s.sessionId, { scoreSchemaVersion: 0 }))).toMatchObject({ ok: false, reason: 'format' });
  });
  it('extra 정리(잘못된 키/값 제거)', () => {
    const r = v(env(s.sessionId, { extra: { snacks: 5, 'bad key': 1, obj: { a: 1 } } }));
    expect(r.ok && r.result.extra).toEqual({ snacks: 5 });
  });
});

describe('inbox 수신 (planConsume / finishConsume)', () => {
  it('결과를 반영하고, 저장 성공 후 inbox 삭제', () => {
    const { kv, p, s } = setup();
    const e = env(s.sessionId);
    put(kv, e);
    const plan = planConsume(kv, p, T0);
    expect(plan.summaries).toHaveLength(1);
    expect(plan.player.gameRecords['food-island'].bestScore).toBe(2500);
    expect(kv.getItem(inboxKey(e.result.resultId))).not.toBeNull(); // 아직 지우지 않음
    savePlayer(kv, plan.player);
    finishConsume(kv, plan, T0);
    expect(kv.getItem(inboxKey(e.result.resultId))).toBeNull();
    expect(loadPlayer(kv).player!.gameRecords['food-island'].plays).toBe(1);
  });
  it('저장 성공 후 삭제 전 종료(크래시) → 다음 실행은 원장으로 건너뛰고 inbox 만 정리', () => {
    const { kv, p, s } = setup();
    const e = env(s.sessionId);
    put(kv, e);
    const plan = planConsume(kv, p, T0);
    savePlayer(kv, plan.player); // finishConsume 호출 전에 앱이 꺼짐
    const saved = loadPlayer(kv).player!;
    const plan2 = planConsume(kv, saved, T0 + 1000);
    expect(plan2.summaries).toHaveLength(0);
    expect(plan2.changed).toBe(false);
    expect(plan2.deleteKeys).toHaveLength(1);
    finishConsume(kv, plan2, T0 + 1000);
    expect(kv.getItem(inboxKey(e.result.resultId))).toBeNull();
    expect(saved.gameRecords['food-island'].plays).toBe(1); // 한 번만
  });
  it('저장 실패 시 finishConsume 을 호출하지 않으면 inbox 가 남아 재시도됨', () => {
    const { kv, p, s } = setup();
    const e = env(s.sessionId);
    put(kv, e);
    planConsume(kv, p, T0); // 저장 실패 가정: finish 없이 종료
    const retry = planConsume(kv, p, T0 + 5000);
    expect(retry.summaries).toHaveLength(1);
  });
  it('여러 결과를 시간순으로 한 번에 반영', () => {
    const { kv, p, s } = setup();
    put(kv, env(s.sessionId, { score: 1000, endedAt: new Date(T0 - 200000).toISOString(), durationMs: 60000 }));
    put(kv, env(s.sessionId, { score: 8000, endedAt: new Date(T0 - 100000).toISOString(), outcome: 'cleared', stage: 4, durationMs: 100000 }));
    const plan = planConsume(kv, p, T0);
    expect(plan.summaries).toHaveLength(2);
    expect(plan.player.gameRecords['food-island']).toMatchObject({ plays: 2, clears: 1, bestScore: 8000 });
  });
  it('같은 resultId 가 이미 처리됨 → 무시', () => {
    const { kv, p, s } = setup();
    const e = env(s.sessionId);
    put(kv, e);
    const plan = planConsume(kv, p, T0);
    savePlayer(kv, plan.player);
    finishConsume(kv, plan, T0);
    put(kv, e); // 같은 판이 다시 들어옴
    const again = planConsume(kv, plan.player, T0 + 1000);
    expect(again.summaries).toHaveLength(0);
    finishConsume(kv, again, T0 + 1000);
    expect(kv.getItem(inboxKey(e.result.resultId))).toBeNull();
    expect(again.player.gameRecords['food-island'].plays).toBe(1);
  });
  it('잘못된 데이터: 깨진 JSON·너무 큼·키/내용 불일치·이상 점수 → 반영 안 함, 거부 보관', () => {
    const { kv, p, s } = setup();
    kv.setItem(INBOX_PREFIX + 'broken-json-1', '{oops');
    kv.setItem(INBOX_PREFIX + 'huge-record-1', 'x'.repeat(5000));
    const e = env(s.sessionId);
    kv.setItem(INBOX_PREFIX + 'mismatch-key-1', JSON.stringify(e));
    put(kv, env(s.sessionId, { score: 99999999 }));
    const plan = planConsume(kv, p, T0);
    expect(plan.summaries).toHaveLength(0);
    expect(plan.changed).toBe(false);
    expect(plan.deleteKeys).toHaveLength(4);
    finishConsume(kv, plan, T0);
    expect((kv.keys?.() ?? []).filter((k) => k.startsWith(INBOX_PREFIX))).toHaveLength(0);
    expect((kv.keys?.() ?? []).filter((k) => k.startsWith(REJECTED_PREFIX)).length).toBeGreaterThan(0);
  });
  it('다른 플레이어의 세션 결과는 반영하지 않음', () => {
    const { kv, s } = setup();
    const other = createPlayer('새플레이어', 'dad');
    if (!other.ok) throw new Error('x');
    put(kv, env(s.sessionId));
    const plan = planConsume(kv, other.player, T0);
    expect(plan.summaries).toHaveLength(0);
    expect(plan.rejected[0].reason).toBe('player');
  });
  it('더 새로운 버전 결과는 삭제하지 않고 보류', () => {
    const { kv, p, s } = setup();
    const e = { ...env(s.sessionId), v: 2 };
    kv.setItem(inboxKey(e.result.resultId), JSON.stringify(e));
    const plan = planConsume(kv, p, T0);
    expect(plan.held).toBe(1);
    expect(plan.deleteKeys).toHaveLength(0);
  });
  it('무관한 키(기존 gona.* · Food 키)는 건드리지 않음', () => {
    const { kv, p, s } = setup();
    kv.setItem('dino-snack-adventure.best', '777');
    kv.setItem('gona.mute', '1');
    put(kv, env(s.sessionId));
    const plan = planConsume(kv, p, T0);
    savePlayer(kv, plan.player);
    finishConsume(kv, plan, T0);
    expect(kv.getItem('dino-snack-adventure.best')).toBe('777');
    expect(kv.getItem('gona.mute')).toBe('1');
  });
});

describe('세션 · 실행', () => {
  it('연동 pending 이면 세션 없이 기존 주소로 열림(기록 연동 표시 없음)', () => {
    const { kv, p } = setup();
    const out = buildLaunchUrl(kv, 'food-island', 'https://uipcjhj.github.io/GoNa/', p, 'https://x/', T0);
    expect(out).toEqual({ url: 'https://uipcjhj.github.io/GoNa/', linked: false });
    expect((kv.keys?.() ?? []).filter((k) => k.startsWith(SESSION_PREFIX)).length).toBe(1); // setup 이 만든 1개뿐
  });
  it('세션은 최대 10개 유지, 오래된 세션 정리', () => {
    const { kv, p } = setup();
    for (let i = 0; i < 14; i++) createSession(kv, 'food-island', p, 'x', T0 + i * 1000);
    expect((kv.keys?.() ?? []).filter((k) => k.startsWith(SESSION_PREFIX)).length).toBeLessThanOrEqual(10);
    const old = createSession(kv, 'food-island', p, 'x', T0 - 3 * 86400000);
    createSession(kv, 'food-island', p, 'x', T0);
    expect(getSession(kv, old.sessionId)).toBeNull();
  });
});

describe('초기화 · 연동 키', () => {
  it('초기화는 gp.v1 의 player/세션/inbox/rejected 만 삭제', () => {
    const { kv, p, s } = setup();
    put(kv, env(s.sessionId));
    kv.setItem(REJECTED_PREFIX + 'x', '{"at":1}');
    kv.setItem('gona.openingSeen', '1');
    kv.setItem('dino-snack-adventure.best', '5');
    kv.setItem('gona.checkpoint', '{}');
    resetPlatformData(kv);
    expect(kv.keys!().sort()).toEqual(['dino-snack-adventure.best', 'gona.checkpoint', 'gona.openingSeen']);
    expect(loadPlayer(kv).status).toBe('none');
    void p;
    void KEYS;
  });
});
