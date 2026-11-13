import { describe, expect, it } from 'vitest';
import { MAX_LEVEL, createState, difficulty, status, step, tap, timeLimitSec } from './logic';

describe('tap-test 임시 게임', () => {
  it('난이도는 레벨에 따라 단조롭게 어려워짐', () => {
    for (let l = 2; l <= MAX_LEVEL; l++) {
      const a = difficulty(l - 1), b = difficulty(l);
      expect(b.goal).toBeGreaterThanOrEqual(a.goal);
      expect(b.showMs).toBeLessThanOrEqual(a.showMs);
      expect(b.spawnMs).toBeLessThanOrEqual(a.spawnMs);
      expect(b.decoyRate).toBeGreaterThanOrEqual(a.decoyRate);
    }
    expect(difficulty(999)).toEqual(difficulty(MAX_LEVEL));
  });
  it('레벨 1~2 에는 가짜 상자 없음', () => {
    expect(difficulty(1).decoyRate).toBe(0);
    expect(difficulty(2).decoyRate).toBe(0);
  });
  it('제한시간은 목표를 채울 수 있도록 충분', () => {
    for (let l = 1; l <= MAX_LEVEL; l++) {
      const p = difficulty(l);
      expect(timeLimitSec(l) * 1000).toBeGreaterThan(p.goal * p.spawnMs);
    }
  });
  it('같은 시드 → 같은 출제', () => {
    const run = (seed: number) => {
      const s = createState(difficulty(5), seed);
      const log: string[] = [];
      for (let i = 0; i < 200; i++) {
        step(s, 50);
        log.push(s.cells.map((c) => (c ? c.kind[0] : '.')).join(''));
      }
      return log;
    };
    expect(run(11)).toEqual(run(11));
    expect(run(11)).not.toEqual(run(12));
  });
  it('고나를 누르면 +콤보, 가짜는 실수 + 콤보 리셋, 빈 칸은 무시', () => {
    const s = createState(difficulty(1), 1);
    s.cells[0] = { kind: 'gona', ttl: 1000 };
    s.cells[1] = { kind: 'decoy', ttl: 1000 };
    expect(tap(s, 4)).toBe('empty');
    expect(tap(s, 0)).toBe('hit');
    expect(s).toMatchObject({ hits: 1, combo: 1, mistakes: 0 });
    expect(tap(s, 1)).toBe('decoy');
    expect(s).toMatchObject({ hits: 1, combo: 0, mistakes: 1 });
    expect(s.cells[0]).toBeNull();
  });
  it('승리·실패 판정', () => {
    const s = createState(difficulty(1), 1);
    expect(status(s)).toBe('playing');
    s.hits = s.params.goal;
    expect(status(s)).toBe('clear');
    s.hits = 0;
    s.mistakes = s.params.maxMistakes;
    expect(status(s)).toBe('fail');
  });
  it('놓친 고나는 사라지고 콤보만 끊김(실수 아님)', () => {
    const s = createState(difficulty(1), 1);
    s.combo = 4;
    s.cells[2] = { kind: 'gona', ttl: 100 };
    s.spawnIn = 99999;
    step(s, 150);
    expect(s.cells[2]).toBeNull();
    expect(s).toMatchObject({ combo: 0, mistakes: 0 });
  });
  it('동시 표시 수 상한 유지', () => {
    const s = createState(difficulty(1), 3);
    for (let i = 0; i < 400; i++) {
      step(s, 20);
      expect(s.cells.filter(Boolean).length).toBeLessThanOrEqual(s.params.maxVisible);
    }
  });
});
