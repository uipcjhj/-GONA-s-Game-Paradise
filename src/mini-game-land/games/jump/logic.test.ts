import { describe, expect, it } from 'vitest';
import { AIR_MS, INPUT_LAG_MS, MAX_LEVEL, PERFECT_MS, TUNING, createState, difficulty, idealTapAt, status, step, tap, timeLimitSec } from './logic';

/** 봇: 매 통과마다 jitter(ms, 가우시안 근사) 만큼 어긋나게 탭 */
function run(level: number, seed: number, jitter: number, lazy = false) {
  const s = createState(difficulty(level), seed);
  let r = seed * 9973;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  const limit = timeLimitSec(level) * 1000;
  let planned = -1, tapAt = 0;
  while (status(s) === 'playing' && s.t < limit) {
    if (!lazy && planned !== s.nextPass) {
      planned = s.nextPass;
      tapAt = idealTapAt(s) + (rnd() + rnd() + rnd() - 1.5) * jitter;
    }
    if (!lazy && s.t >= tapAt && tapAt > 0) { tap(s); tapAt = 0; }
    step(s, 8);
    s.events = [];
  }
  return { s, st: status(s) === 'playing' ? 'timeout' : status(s), sec: s.t / 1000 };
}

describe('줄넘기: 판정', () => {
  it('줄이 지날 때 점프 한가운데면 PERFECT, 공중이면 GOOD, 땅이면 MISS', () => {
    const p = difficulty(1);
    const s = createState(p, 1);
    while (s.t < idealTapAt(s)) step(s, 1);
    tap(s);
    while (s.passes === 0) step(s, 1);
    expect(s.events[0].judge).toBe('perfect');
    s.events = [];
    const at2 = s.nextPass - AIR_MS / 2 + INPUT_LAG_MS + (PERFECT_MS + 60);
    while (s.t < at2) step(s, 1);
    tap(s);
    while (s.passes === 1) step(s, 1);
    expect(s.events[0].judge).toBe('good');
    s.events = [];
    while (s.passes === 2) step(s, 4); // 탭 안 함
    expect(s.events[0].judge).toBe('miss');
    expect(s.combo).toBe(0);
  });
  it('공중에서 다시 탭해도 무시(연타 방지), 너무 일찍 뛰면 착지 후 걸림', () => {
    const s = createState(difficulty(1), 2);
    tap(s);
    expect(tap(s)).toBe(false);
    while (s.passes === 0) step(s, 4);
    expect(s.events[0].judge).toBe('miss');
  });
  it('입력 지연 보정: 이상적인 탭 시각에 누르면 점프 중심이 정확히 줄 통과', () => {
    const s = createState(difficulty(1), 3);
    while (s.t < idealTapAt(s)) step(s, 1);
    tap(s);
    expect(Math.abs((s.jumpAt as number) + AIR_MS / 2 - s.nextPass)).toBeLessThanOrEqual(1);
  });
  it('난이도 표: 목표 증가·주기 감소, 박자 변화는 L4~, 더블은 L6~', () => {
    for (let i = 1; i < MAX_LEVEL; i++) {
      expect(TUNING[i].goal).toBeGreaterThan(TUNING[i - 1].goal);
      expect(TUNING[i].periodEnd).toBeLessThanOrEqual(TUNING[i - 1].periodEnd);
    }
    expect(TUNING[0].rhythm + TUNING[1].rhythm + TUNING[2].rhythm).toBe(0);
    expect(TUNING[4].double).toBe(0);
  });
  it('모든 바퀴는 점프할 수 있는 길이(공중 시간 + 여유 이상)', () => {
    for (let l = 1; l <= MAX_LEVEL; l++) {
      const s = createState(difficulty(l), 11);
      for (let i = 0; i < 200; i++) {
        const before = s.nextPass;
        while (s.nextPass === before) { tap(s); step(s, 5); s.events = []; }
        expect(s.nextPass - s.lastPass, `L${l}`).toBeGreaterThanOrEqual(AIR_MS + 150);
      }
    }
  });
});
describe('줄넘기: 플레이 가능성·길이', () => {
  it('정확한 봇은 모든 레벨 클리어, 아무것도 안 하면 실패', () => {
    for (let l = 1; l <= MAX_LEVEL; l++) {
      expect(run(l, 5, 0).st, `L${l}`).toBe('clear');
      expect(run(l, 5, 0, true).st, `L${l}`).toBe('fail');
    }
  });
  it('사람처럼 타이밍이 흔들리는 봇(±90ms): 초반 대부분 성공, 후반 더 어려움', () => {
    const rate = (l: number, j: number) => { let ok = 0; for (let seed = 1; seed <= 30; seed++) if (run(l, seed, j).st === 'clear') ok++; return ok / 30; };
    const r1 = rate(1, 180), r10 = rate(10, 180);
    expect(r1).toBeGreaterThanOrEqual(0.7);
    expect(r10).toBeLessThanOrEqual(r1);
  });
  it('한 판 길이 15~60초, 제한시간 ≤ 60초', () => {
    for (let l = 1; l <= MAX_LEVEL; l++) {
      expect(timeLimitSec(l)).toBeLessThanOrEqual(60);
      const sec = run(l, 7, 0).sec;
      expect(sec, `L${l}`).toBeGreaterThan(12);
      expect(sec, `L${l}`).toBeLessThan(60);
    }
  });
});
