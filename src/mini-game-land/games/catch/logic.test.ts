import { describe, expect, it } from 'vitest';
import { BASKET_W, CATCH_Y, MAX_LEVEL, botTarget, createState, difficulty, setBasket, status, step, timeLimitSec, TUNING, WORLD_W } from './logic';

function run(level: number, seed: number, bot: 'perfect' | 'lazy' | 'sloppy') {
  const s = createState(difficulty(level), seed);
  const limit = timeLimitSec(level) * 1000;
  let t = 0;
  while (status(s) === 'playing' && t < limit) {
    if (bot === 'perfect') setBasket(s, botTarget(s));
    else if (bot === 'sloppy') {
      // 사람처럼: 반응 0.25초 지연 + 손 이동 속도 제한(초당 260단위)
      if (Math.floor(t / 250) !== Math.floor((t - 16) / 250)) (s as unknown as { goal: number }).goal = botTarget(s);
      const g = (s as unknown as { goal?: number }).goal ?? s.basketX;
      setBasket(s, s.basketX + Math.max(-260 * 0.016, Math.min(260 * 0.016, g - s.basketX)));
    }
    step(s, 16);
    s.events = [];
    t += 16;
  }
  return { s, t, st: status(s) === 'playing' ? 'timeout' : status(s) };
}

describe('간식 받아라: 규칙', () => {
  it('바구니 위를 지나는 간식은 받고, 놓치면 실수, 고추는 받으면 실수', () => {
    const s = createState({ ...difficulty(1), spawnMs: 99999 }, 1);
    s.items.push({ id: 1, kind: 'berry', x: 90, y: CATCH_Y - 2, vy: 100, sway: 0, phase: 0, done: false });
    s.items.push({ id: 2, kind: 'cookie', x: 10, y: CATCH_Y - 2, vy: 100, sway: 0, phase: 0, done: false });
    s.items.push({ id: 3, kind: 'pepper', x: 92, y: CATCH_Y - 1, vy: 100, sway: 0, phase: 0, done: false });
    setBasket(s, 90);
    step(s, 50);
    expect(s.caught).toBe(1);
    expect(s.miss).toBe(1); // 고추
    for (let i = 0; i < 100; i++) step(s, 16);
    expect(s.miss).toBe(2); // 바닥에 떨어진 쿠키
    expect(s.combo).toBe(0);
  });
  it('아주 빠른 낙하(한 프레임에 크게 이동)도 판정이 빠지지 않음', () => {
    const s = createState({ ...difficulty(1), spawnMs: 99999 }, 2);
    s.items.push({ id: 1, kind: 'star', x: 90, y: CATCH_Y - 30, vy: 3000, sway: 0, phase: 0, done: false });
    setBasket(s, 90);
    step(s, 16);
    expect(s.caught).toBe(1);
  });
  it('바구니는 화면 밖으로 나가지 않음', () => {
    const s = createState(difficulty(1), 3);
    setBasket(s, -50);
    expect(s.basketX).toBe(BASKET_W / 2);
    setBasket(s, 999);
    expect(s.basketX).toBe(WORLD_W - BASKET_W / 2);
  });
  it('난이도 표: 목표·속도·간격·고추 비율이 레벨마다 단조, L1 은 고추 없음', () => {
    expect(TUNING).toHaveLength(MAX_LEVEL);
    expect(TUNING[0].pepper).toBe(0);
    for (let i = 1; i < MAX_LEVEL; i++) {
      expect(TUNING[i].goal).toBeGreaterThanOrEqual(TUNING[i - 1].goal);
      expect(TUNING[i].speed[0]).toBeGreaterThanOrEqual(TUNING[i - 1].speed[0]);
      expect(TUNING[i].spawnMs).toBeLessThanOrEqual(TUNING[i - 1].spawnMs);
      expect(TUNING[i].pepper).toBeGreaterThanOrEqual(TUNING[i - 1].pepper);
    }
  });
  it('한 판 제한시간 20~60초', () => {
    for (let l = 1; l <= MAX_LEVEL; l++) expect(timeLimitSec(l)).toBeGreaterThanOrEqual(20), expect(timeLimitSec(l)).toBeLessThanOrEqual(60);
  });
});

describe('간식 받아라: 플레이 가능성(봇)', () => {
  it('반응이 완벽한 봇은 모든 레벨에서 거의 항상 클리어(풀 수 있는 난이도, 레벨당 20판 중 18판↑)', () => {
    for (let l = 1; l <= MAX_LEVEL; l++) {
      let ok = 0;
      for (let seed = 1; seed <= 20; seed++) if (run(l, seed, 'perfect').st === 'clear') ok++;
      expect(ok, `L${l}`).toBeGreaterThanOrEqual(18);
    }
  });
  it('아무것도 안 하면 실패(가만히 있어도 깨지는 게임이 아님)', () => {
    for (let l = 1; l <= MAX_LEVEL; l++) expect(run(l, 7, 'lazy').st, `L${l}`).not.toBe('clear');
  });
  it('사람처럼 느린 봇: 초반은 대부분 성공, 후반은 어려워짐(난이도 곡선)', () => {
    const rate = (l: number) => { let ok = 0; for (let seed = 1; seed <= 20; seed++) if (run(l, seed, 'sloppy').st === 'clear') ok++; return ok / 20; };
    const r1 = rate(1), r5 = rate(5), r10 = rate(10);
    expect(r1).toBeGreaterThanOrEqual(0.8);
    expect(r10).toBeLessThan(r1);
    console.log('사람형 봇 성공률', { L1: r1, L5: r5, L10: r10 });
  });
  it('한 판 길이(완벽한 봇 기준) 대략 15~45초', () => {
    for (const l of [1, 5, 10]) {
      const { t } = run(l, 5, 'perfect');
      expect(t / 1000, `L${l}`).toBeGreaterThan(10);
      expect(t / 1000, `L${l}`).toBeLessThan(50);
    }
  });
});
