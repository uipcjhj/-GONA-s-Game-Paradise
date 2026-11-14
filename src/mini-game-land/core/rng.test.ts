import { describe, expect, it } from 'vitest';
import { mixSeed, mulberry32, shuffle } from './rng';

describe('rng', () => {
  it('같은 시드 → 같은 수열, 다른 시드 → 다른 수열', () => {
    const a = mulberry32(42), b = mulberry32(42), c = mulberry32(43);
    const sa = [a(), a(), a()], sb = [b(), b(), b()], sc = [c(), c(), c()];
    expect(sa).toEqual(sb);
    expect(sa).not.toEqual(sc);
    sa.forEach((x) => { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); });
  });
  it('shuffle 은 원본을 바꾸지 않고 순열을 반환', () => {
    const src = [1, 2, 3, 4, 5, 6];
    const out = shuffle(src, mulberry32(7));
    expect(src).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...out].sort()).toEqual(src);
  });
  it('mixSeed 는 결정적', () => {
    expect(mixSeed(1, 2)).toBe(mixSeed(1, 2));
    expect(mixSeed(1, 2)).not.toBe(mixSeed(2, 1));
  });
});
