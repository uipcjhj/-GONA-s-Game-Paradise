import { describe, expect, it } from 'vitest';
import { comboMultiplier, roundMultiplier, roundScore, timeBonus } from './scoring';

describe('scoring', () => {
  it('콤보 배수: 1+0.1×연속, 상한 ×2', () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(5)).toBeCloseTo(1.5);
    expect(comboMultiplier(10)).toBe(2);
    expect(comboMultiplier(99)).toBe(2);
    expect(comboMultiplier(-3)).toBe(1);
  });
  it('라운드 배율: 1+0.05×(라운드−1), 상한 ×2', () => {
    expect(roundMultiplier(1)).toBe(1);
    expect(roundMultiplier(5)).toBeCloseTo(1.2);
    expect(roundMultiplier(100)).toBe(2);
  });
  it('시간 보너스: 남은 초×10, 무제한은 0', () => {
    expect(timeBonus(7400)).toBe(70);
    expect(timeBonus(null)).toBe(0);
    expect(timeBonus(-5)).toBe(0);
  });
  it('챌린지: 실패 라운드는 0점, 클리어는 (점수+보너스)×라운드배율', () => {
    expect(roundScore({ mode: 'challenge', outcome: 'fail', raw: 500, remainingMs: 3000, round: 3 }).total).toBe(0);
    const r = roundScore({ mode: 'challenge', outcome: 'clear', raw: 500, remainingMs: 4000, round: 5 });
    expect(r).toEqual({ raw: 500, timeBonus: 40, multiplier: 1.2, total: 648 });
  });
  it('자유 플레이: 실패해도 쌓은 점수 인정(보너스·배율 없음)', () => {
    expect(roundScore({ mode: 'free', outcome: 'fail', raw: 300, remainingMs: 9000 })).toEqual({ raw: 300, timeBonus: 0, multiplier: 1, total: 300 });
    expect(roundScore({ mode: 'free', outcome: 'clear', raw: 300, remainingMs: 2000 }).total).toBe(320);
  });
});
