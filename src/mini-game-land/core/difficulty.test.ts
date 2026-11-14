import { describe, expect, it } from 'vitest';
import { challengeLevel, challengeTimeScale, clampLevel, effectiveLimitMs, overflowTimeScale } from './difficulty';

describe('difficulty', () => {
  it('챌린지 레벨은 2라운드마다 +1', () => {
    expect([1, 2, 3, 4, 5, 6].map(challengeLevel)).toEqual([1, 1, 2, 2, 3, 3]);
  });
  it('시간 배율은 단조 감소, 최소 0.6', () => {
    let prev = 2;
    for (let r = 1; r <= 40; r++) {
      const s = challengeTimeScale(r);
      expect(s).toBeLessThanOrEqual(prev);
      expect(s).toBeGreaterThanOrEqual(0.6);
      prev = s;
    }
    expect(challengeTimeScale(1)).toBe(1);
  });
  it('maxLevel 초과분은 시간만 압축(최소 0.5)', () => {
    expect(overflowTimeScale(10, 10)).toBe(1);
    expect(overflowTimeScale(12, 10)).toBeCloseTo(0.9);
    expect(overflowTimeScale(99, 10)).toBe(0.5);
  });
  it('제한시간: null 은 무제한, 최소 5초', () => {
    expect(effectiveLimitMs(null, 0.5)).toBeNull();
    expect(effectiveLimitMs(20, 0.5)).toBe(10000);
    expect(effectiveLimitMs(6, 0.5)).toBe(5000);
  });
  it('clampLevel', () => {
    expect(clampLevel(0, 10)).toBe(1);
    expect(clampLevel(55, 10)).toBe(10);
  });
});
