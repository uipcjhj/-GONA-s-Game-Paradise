import { describe, expect, it } from 'vitest';
import { CLEAR_BONUS, MAX_LEVEL, MOVE_BONUS, SET_POINTS, chainMultiplier, difficulty, freeSlots, leftoverBonus, movePoints, setPoints, stars, timeLimitSec } from './logic';
import { TOY_LEVELS } from './tuning';

describe('설정 테이블(tuning.ts) — 코드가 아니라 값으로 난이도를 조정', () => {
  it('10레벨분이 있고 difficulty 가 표를 그대로 씀', () => {
    expect(TOY_LEVELS).toHaveLength(MAX_LEVEL);
    for (let l = 1; l <= MAX_LEVEL; l++) expect(difficulty(l)).toEqual({ level: l, ...TOY_LEVELS[l - 1] });
    expect(difficulty(0)).toEqual(difficulty(1));
    expect(difficulty(99)).toEqual(difficulty(MAX_LEVEL));
  });
  it('시작 상태에 놓을 자리가 있음(선반×칸 − 잠긴 칸 − 3×세트 ≥ 1)', () => {
    for (const t of TOY_LEVELS) expect(freeSlots(t)).toBeGreaterThanOrEqual(1);
  });
  it('값의 유효성', () => {
    for (const t of TOY_LEVELS) {
      expect(t.shelves).toBeGreaterThanOrEqual(3); expect(t.shelves).toBeLessThanOrEqual(6);
      expect(t.capacity).toBeGreaterThanOrEqual(4); expect(t.capacity).toBeLessThanOrEqual(7);
      expect(t.types).toBeGreaterThanOrEqual(2); expect(t.types).toBeLessThanOrEqual(6);
      expect(t.wilds + t.fixed).toBeLessThanOrEqual(t.sets);
      expect(t.locked).toBeLessThan(t.shelves * t.capacity);
      expect(t.unlockEvery).toBeGreaterThanOrEqual(1);
      expect(t.slack).toBeGreaterThanOrEqual(0);
      expect(t.undo).toBeGreaterThanOrEqual(0);
      expect(t.mix.single + t.mix.source + t.mix.double + t.mix.cascade).toBeGreaterThan(0);
    }
  });
  it('레벨이 오르면: 세트·종류 늘고, 이동 여유(slack)·되돌리기는 줄어듦(단조)', () => {
    for (let i = 1; i < TOY_LEVELS.length; i++) {
      const a = TOY_LEVELS[i - 1], b = TOY_LEVELS[i];
      expect(b.sets).toBeGreaterThanOrEqual(a.sets);
      expect(b.types).toBeGreaterThanOrEqual(a.types);
      expect(b.slack).toBeLessThanOrEqual(a.slack);
      expect(b.undo).toBeLessThanOrEqual(a.undo);
      expect(b.shelves).toBeGreaterThanOrEqual(a.shelves);
    }
    expect(TOY_LEVELS[0].wilds + TOY_LEVELS[0].fixed + TOY_LEVELS[0].locked).toBe(0); // 첫 레벨은 특수 요소 없음
  });
  it('특수 요소는 단계적으로 도입: 별 L3, 잠긴 칸 L4, 고정 L5', () => {
    const first = (f: (t: (typeof TOY_LEVELS)[number]) => number) => TOY_LEVELS.findIndex((t) => f(t) > 0) + 1;
    expect(first((t) => t.wilds)).toBe(3);
    expect(first((t) => t.locked)).toBe(4);
    expect(first((t) => t.fixed)).toBe(5);
  });
  it('제한시간: 자유 플레이는 무제한, 챌린지는 세트 수에 비례', () => {
    expect(timeLimitSec(5, 'free')).toBeNull();
    expect(timeLimitSec(1, 'challenge')).toBe(39);
    for (let l = 2; l <= MAX_LEVEL; l++) expect(timeLimitSec(l, 'challenge')!).toBeGreaterThanOrEqual(timeLimitSec(l - 1, 'challenge')!);
    for (let l = 1; l <= MAX_LEVEL; l++) expect(timeLimitSec(l, 'challenge')! / difficulty(l).sets).toBeGreaterThanOrEqual(8);
  });
});

describe('점수 · 연쇄 · 별', () => {
  it('연쇄 배수: 1.0 → 1.5 → 2.0 → 2.5(상한)', () => {
    expect([1, 2, 3, 4, 9].map(chainMultiplier)).toEqual([1, 1.5, 2, 2.5, 2.5]);
    expect(setPoints(1)).toBe(SET_POINTS);
    expect(setPoints(2)).toBe(150);
  });
  it('이동 점수 = 정리된 세트들의 점수 합(연쇄일수록 가산)', () => {
    expect(movePoints(0)).toBe(0);
    expect(movePoints(1)).toBe(100);
    expect(movePoints(2)).toBe(250);
    expect(movePoints(3)).toBe(450);
  });
  it('남은 이동 보너스 · 클리어 보너스', () => {
    expect(leftoverBonus(5)).toBe(5 * MOVE_BONUS);
    expect(leftoverBonus(-2)).toBe(0);
    expect(CLEAR_BONUS).toBe(300);
  });
  it('별: par 이하 3개, par+slack/2 이하 2개, 그 외 1개', () => {
    expect(stars(5, 5, 4)).toBe(3);
    expect(stars(6, 5, 4)).toBe(2);
    expect(stars(7, 5, 4)).toBe(2);
    expect(stars(8, 5, 4)).toBe(1);
    expect(stars(2, 5, 4)).toBe(3);
  });
});
