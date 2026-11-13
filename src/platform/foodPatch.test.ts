import { describe, expect, it } from 'vitest';
import { initParadise, type ParadiseDeps } from '../../docs/platform/food-patch/paradise';
import { finishConsume, planConsume } from './inbox';
import { INBOX_PREFIX } from './keys';
import { createSession } from './session';
import { createMemoryStorage, createPlayer, savePlayer } from './store';

const EV = { start: 'start', pause: 'pause', resume: 'resume', gameOver: 'gameOver', endingStart: 'endingStart', restart: 'restart', endingTheEnd: 'endingTheEnd' };
const mkBus = () => {
  const h: Record<string, ((...a: unknown[]) => void)[]> = {};
  return { on: (e: string, f: (...a: unknown[]) => void) => void (h[e] ??= []).push(f), emit: (e: string, ...a: unknown[]) => (h[e] ?? []).forEach((f) => f(...a)), count: () => Object.values(h).reduce((s, x) => s + x.length, 0) };
};
const ORIGIN = 'https://uipcjhj.github.io';
const RET = `${ORIGIN}/-GONA-s-Game-Paradise/`;
let t = Date.parse('2026-11-13T03:00:00Z');
const clock = () => t;
let n = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

function setup(over: Partial<ParadiseDeps> = {}, sess: { gameId?: string; ret?: string } = {}) {
  const kv = createMemoryStorage();
  const pl = createPlayer('고나짱', 'gona', new Date(t - 3600000));
  if (!pl.ok) throw new Error('x');
  savePlayer(kv, pl.player);
  const s = createSession(kv, sess.gameId ?? 'food-island', pl.player, sess.ret ?? RET, t - 60000);
  const bus = mkBus();
  const sdk = initParadise({ bus, EV, storage: kv, search: `?gp=${s.sessionId}`, origin: ORIGIN, now: clock, uuid, ...over });
  return { kv, bus, sdk, s, player: pl.player };
}
const inboxKeys = (kv: ReturnType<typeof createMemoryStorage>) => kv.keys!().filter((k) => k.startsWith(INBOX_PREFIX));
const info = { score: 4200, growthLevel: 2, growthName: '기어 다니는 고나', snacks: 90 };

describe('Food 패치(SDK) ↔ 게임천국 수신 계약', () => {
  it('실제 흐름: 시작 → 게임 오버 → inbox 1건 → 게임천국이 검증·반영', () => {
    const { kv, bus, player } = setup();
    bus.emit('start');
    t += 130000;
    bus.emit('gameOver', info);
    expect(inboxKeys(kv)).toHaveLength(1);
    const plan = planConsume(kv, player, t);
    expect(plan.summaries).toHaveLength(1);
    expect(plan.summaries[0]).toMatchObject({ score: 4200, stage: 2, outcome: 'failed', durationSec: 130, snacks: 90 });
    expect(plan.rejected).toEqual([]);
    savePlayer(kv, plan.player);
    finishConsume(kv, plan, t);
    expect(inboxKeys(kv)).toHaveLength(0);
  });
  it('엔딩 → cleared, 엔딩 다시보기(endingStart 재발행)는 중복 기록 안 함', () => {
    const { kv, bus, player } = setup();
    bus.emit('start');
    t += 400000;
    bus.emit('endingStart', { score: 21000, growthLevel: 4, growthName: '자이언트 곤룡 고나', snacks: 150, cleared: true });
    bus.emit('endingStart', { score: 21000, growthLevel: 4, growthName: '자이언트 곤룡 고나', snacks: 150, cleared: true }); // 다시보기
    bus.emit('endingTheEnd');
    expect(inboxKeys(kv)).toHaveLength(1);
    const plan = planConsume(kv, player, t);
    expect(plan.summaries[0]).toMatchObject({ outcome: 'cleared', stage: 4, score: 21000 });
  });
  it('다시하기/이어하기: start 가 다시 오면 새 판으로 각각 1건', () => {
    const { kv, bus, player } = setup();
    for (let i = 0; i < 3; i++) {
      bus.emit('start');
      t += 70000;
      bus.emit('gameOver', { ...info, score: 1000 * (i + 1) });
      t += 5000;
    }
    expect(inboxKeys(kv)).toHaveLength(3);
    const plan = planConsume(kv, player, t);
    expect(plan.summaries).toHaveLength(3);
    expect(plan.player.gameRecords['food-island'].plays).toBe(3);
  });
  it('일시정지 시간은 플레이 시간에서 제외', () => {
    const { kv, bus, player } = setup();
    bus.emit('start');
    t += 30000;
    bus.emit('pause');
    t += 600000; // 10분 멈춤
    bus.emit('resume');
    t += 30000;
    bus.emit('gameOver', info);
    const plan = planConsume(kv, player, t);
    expect(plan.summaries[0].durationSec).toBe(60);
  });
  it('시작 없이 끝 이벤트만 오면 기록하지 않음', () => {
    const { kv, bus } = setup();
    bus.emit('gameOver', info);
    expect(inboxKeys(kv)).toHaveLength(0);
  });
  it('게임천국 쪽에서 쓰는 키 외에는 inbox 만 쓴다(기존 키 불변)', () => {
    const writes: string[] = [];
    const base = createMemoryStorage({ 'dino-snack-adventure.best': '777', 'gona.checkpoint': '{}' });
    const pl = createPlayer('고나짱', 'gona', new Date(t));
    if (!pl.ok) throw new Error('x');
    const s = createSession(base, 'food-island', pl.player, RET, t - 1000);
    const spy = { getItem: (k: string) => base.getItem(k), setItem: (k: string, v: string) => { writes.push(k); base.setItem(k, v); } };
    const bus = mkBus();
    initParadise({ bus, EV, storage: spy, search: `?gp=${s.sessionId}`, origin: ORIGIN, now: clock, uuid });
    bus.emit('start');
    t += 20000;
    bus.emit('gameOver', info);
    expect(writes).toHaveLength(1);
    expect(writes[0].startsWith(INBOX_PREFIX)).toBe(true);
    expect(base.getItem('dino-snack-adventure.best')).toBe('777');
  });
  it('저장 실패 시 메모리에 보관했다가 재시도(visibility/다음 이벤트)', () => {
    const kv = createMemoryStorage();
    const pl = createPlayer('고나짱', 'gona', new Date(t));
    if (!pl.ok) throw new Error('x');
    const s = createSession(kv, 'food-island', pl.player, RET, t - 1000);
    let fail = true;
    const flaky = { getItem: (k: string) => kv.getItem(k), setItem: (k: string, v: string) => { if (fail && k.startsWith(INBOX_PREFIX)) throw new Error('quota'); kv.setItem(k, v); } };
    const bus = mkBus();
    initParadise({ bus, EV, storage: flaky, search: `?gp=${s.sessionId}`, origin: ORIGIN, now: clock, uuid });
    bus.emit('start');
    t += 20000;
    bus.emit('gameOver', info);
    expect(inboxKeys(kv)).toHaveLength(0);
    fail = false;
    bus.emit('start'); // 다음 판 시작 — 보관 중인 결과는 돌아가기 버튼/가시성 변경 시 flush (여기선 다음 판 종료 때 함께)
    t += 20000;
    bus.emit('gameOver', { ...info, score: 5000 });
    expect(inboxKeys(kv)).toHaveLength(2);
  });
});

describe('비활성(no-op) 조건 — 단독 플레이는 전혀 영향 없음', () => {
  const inactive = (o: Partial<ParadiseDeps>, sess?: { gameId?: string; ret?: string }) => {
    const { bus, sdk, kv } = setup(o, sess);
    return { bus, sdk, kv };
  };
  it('gp 파라미터 없음 → 구독 0개', () => {
    const bus = mkBus();
    const r = initParadise({ bus, EV, storage: createMemoryStorage(), search: '', origin: ORIGIN });
    expect(r.active).toBe(false);
    expect(bus.count()).toBe(0);
  });
  it('세션 없음 / 형식 오류 / 저장소 없음', () => {
    const bus = mkBus();
    expect(initParadise({ bus, EV, storage: createMemoryStorage(), search: '?gp=sess-doesnotexist', origin: ORIGIN }).active).toBe(false);
    expect(initParadise({ bus, EV, storage: createMemoryStorage(), search: '?gp=../../x', origin: ORIGIN }).active).toBe(false);
    expect(initParadise({ bus, EV, storage: null, search: '?gp=sess-abcdefgh', origin: ORIGIN }).active).toBe(false);
    expect(bus.count()).toBe(0);
  });
  it('다른 게임용 세션 · 만료 세션 · 다른 출처 returnUrl', () => {
    expect(inactive({}, { gameId: 'sky-battle' }).sdk.active).toBe(false);
    expect(inactive({}, { ret: 'https://evil.example/x' }).sdk.active).toBe(false);
    const kv = createMemoryStorage();
    const pl = createPlayer('고나짱', 'gona', new Date(t));
    if (!pl.ok) throw new Error('x');
    const s = createSession(kv, 'food-island', pl.player, RET, t - 13 * 3600 * 1000); // 12시간 세션이 만료
    expect(initParadise({ bus: mkBus(), EV, storage: kv, search: `?gp=${s.sessionId}`, origin: ORIGIN, now: clock }).active).toBe(false);
  });
});
