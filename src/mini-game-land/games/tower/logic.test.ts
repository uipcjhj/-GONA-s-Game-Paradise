import { describe, expect, it } from 'vitest';
import {
  CLEAR_BONUS, MAX_LEVEL, PERFECT_OFFSET, PERFECT_TILT, PLACE_PERFECT_BONUS, PLACE_SHAKY, PLACE_STABLE, SHAKE_LIMIT, WIND_BASE,
  classify, difficulty, keepsCombo, placementPoints, tiltOf, timeLimitSec, type Placement,
} from './logic';
import { ALL_KINDS } from './pieces';
import { TOWER_LEVELS } from './tuning';

describe('난이도 설계', () => {
  const L = Array.from({ length: MAX_LEVEL }, (_, i) => difficulty(i + 1));
  it('목표 높이는 늘고 접시는 좁아짐, 조각 예산은 늘어남', () => {
    for (let i = 1; i < L.length; i++) {
      expect(L[i].goalH).toBeGreaterThan(L[i - 1].goalH);
      expect(L[i].plateW).toBeLessThan(L[i - 1].plateW);
      expect(L[i].budget).toBeGreaterThanOrEqual(L[i - 1].budget);
    }
    expect(L[0].goalH).toBe(70);
  });
  it('간식 종류는 레벨마다 최대 하나씩 늘고 유효한 종류만', () => {
    for (let i = 0; i < L.length; i++) {
      for (const k of L[i].pool) expect(ALL_KINDS).toContain(k);
      if (i > 0) expect(L[i].pool.length - L[i - 1].pool.length).toBeLessThanOrEqual(1);
      if (i > 0) for (const k of L[i - 1].pool) expect(L[i].pool).toContain(k); // 한번 나온 종류는 계속 나옴
    }
    expect(L[0].pool).toEqual(['toast', 'macaron', 'pudding']); // 첫 레벨은 평평하고 안정적인 것만
  });
  it('도움 장치는 레벨이 오르면 사라짐(안내선 → 무게중심 표시 → 없음)', () => {
    expect(L[0].guide && L[0].showCom).toBe(true);
    expect(L[9].guide || L[9].showCom).toBe(false);
    for (let i = 1; i < L.length; i++) {
      if (!L[i - 1].guide) expect(L[i].guide).toBe(false);
      if (!L[i - 1].showCom) expect(L[i].showCom).toBe(false);
      expect(L[i].swaps).toBeLessThanOrEqual(L[i - 1].swaps);
      expect(L[i].preview).toBeLessThanOrEqual(L[i - 1].preview);
    }
  });
  it('조각 방향 무작위 L4+, 바람은 L9+(도전 구간)에서 점점 세짐, 미끄러움 L9+', () => {
    expect(L.map((p) => p.randomAngle)).toEqual([false, false, false, true, true, true, true, true, true, true]);
    expect(L.map((p) => p.wind > 0)).toEqual([false, false, false, false, false, false, false, false, true, true]);
    expect(L[9].wind).toBeGreaterThan(L[8].wind);
    expect(L[8].wind).toBe(WIND_BASE);
    expect(L[8].frictionMul).toBeLessThan(1);
    expect(L[9].frictionMul).toBeLessThanOrEqual(L[8].frictionMul);
  });
  it('기회는 L1~8 은 4번, 도전 구간(L9~10)은 3번', () => {
    expect(L.map((p) => p.maxFalls)).toEqual([4, 4, 4, 4, 4, 4, 4, 4, 3, 3]);
  });
  it('쐐기는 L6 에서 낮은 비율로 시작해 서서히 늘어남(난이도 절벽 방지)', () => {
    const w = (i: number) => L[i].weights.slice ?? 1;
    expect(L[4].pool).not.toContain('slice');
    expect(L[5].pool).toContain('slice');
    expect(w(5)).toBeLessThan(w(6));
    expect(w(6)).toBeLessThan(w(7));
    expect(w(7)).toBeLessThanOrEqual(w(8));
  });
  it('범위 밖 레벨은 클램프', () => {
    expect(difficulty(0)).toEqual(difficulty(1));
    expect(difficulty(99)).toEqual(difficulty(MAX_LEVEL));
  });
  it('제한시간은 조각당 3초 이상(여유)', () => {
    for (let l = 1; l <= MAX_LEVEL; l++) expect(timeLimitSec(l) / difficulty(l).budget).toBeGreaterThanOrEqual(3);
  });
});

describe('놓기 평가 · 점수 규칙', () => {
  const ok: Placement = { fell: false, shake: 0, offset: 0, tilt: 0 };
  it('분류: 떨어짐 > 흔들림 > 완벽 > 안정', () => {
    expect(classify({ ...ok, fell: true, shake: 99 })).toBe('fell');
    expect(classify({ ...ok, shake: SHAKE_LIMIT + 0.1 })).toBe('shaky');
    expect(classify(ok)).toBe('perfect');
    expect(classify({ ...ok, offset: PERFECT_OFFSET })).toBe('perfect');
    expect(classify({ ...ok, offset: PERFECT_OFFSET + 0.1 })).toBe('stable');
    expect(classify({ ...ok, tilt: PERFECT_TILT + 0.01 })).toBe('stable');
  });
  it('점수: 완벽 150 · 안정 100 · 흔들림 50 · 떨어짐 0', () => {
    expect(placementPoints('perfect')).toBe(PLACE_STABLE + PLACE_PERFECT_BONUS);
    expect(placementPoints('stable')).toBe(PLACE_STABLE);
    expect(placementPoints('shaky')).toBe(PLACE_SHAKY);
    expect(placementPoints('fell')).toBe(0);
    expect(CLEAR_BONUS).toBe(300);
  });
  it('콤보는 안정·완벽만 이어짐', () => {
    expect(keepsCombo('perfect') && keepsCombo('stable')).toBe(true);
    expect(keepsCombo('shaky') || keepsCombo('fell')).toBe(false);
  });
  it('기울기: 90° 배수와의 차이', () => {
    expect(tiltOf(0)).toBeCloseTo(0);
    expect(tiltOf(Math.PI / 2)).toBeCloseTo(0);
    expect(tiltOf(Math.PI / 2 + 0.2)).toBeCloseTo(0.2);
    expect(tiltOf(-0.3)).toBeCloseTo(0.3);
    expect(tiltOf(Math.PI / 4)).toBeCloseTo(Math.PI / 4);
  });
});

describe('설정 테이블(tuning.ts) — 코드가 아니라 값으로 난이도를 조정', () => {
  it('10레벨분이 있고 difficulty 가 표의 값을 그대로 씀', () => {
    expect(TOWER_LEVELS).toHaveLength(MAX_LEVEL);
    for (let l = 1; l <= MAX_LEVEL; l++) {
      const t = TOWER_LEVELS[l - 1], p = difficulty(l);
      expect([p.goalH, p.plateW, p.budget, p.maxFalls, p.swaps, p.preview, p.guide, p.showCom, p.randomAngle, p.frictionMul]).toEqual([t.goalH, t.plateW, t.budget, t.maxFalls, t.swaps, t.preview, t.guide, t.showCom, t.randomAngle, t.frictionMul]);
      expect(p.wind).toBeCloseTo(t.wind * WIND_BASE, 12);
      expect(p.pool).toEqual(t.pool);
    }
  });
  it('값의 유효성: 가중치는 등장 간식에 대해서만 · 양수, 값 범위 정상', () => {
    for (const t of TOWER_LEVELS) {
      for (const [k, w] of Object.entries(t.weights ?? {})) { expect(t.pool).toContain(k); expect(w).toBeGreaterThan(0); }
      expect(t.goalH).toBeGreaterThan(30); expect(t.plateW).toBeGreaterThan(60); expect(t.plateW).toBeLessThanOrEqual(150);
      expect(t.budget).toBeGreaterThanOrEqual(6); expect(t.maxFalls).toBeGreaterThanOrEqual(2);
      expect(t.frictionMul).toBeGreaterThan(0.5); expect(t.wind).toBeGreaterThanOrEqual(0);
      expect(t.swaps).toBeGreaterThanOrEqual(0);
    }
  });
});
