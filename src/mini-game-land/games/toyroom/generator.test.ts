import { describe, expect, it } from 'vitest';
import { applyMove, findRun, isFixed, isLegal, isWild, isWon, legalMoves, toyCount, validState, typeOf } from './engine';
import { generatePuzzle } from './generator';
import { MAX_LEVEL, difficulty } from './logic';

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 31 + 7);

describe('퍼즐 생성기 — 항상 풀 수 있는 퍼즐(풀이를 실제 엔진으로 재생해 검증)', () => {
  it('모든 레벨 · 시드에서 정답 풀이가 끝까지 합법이고 전부 정리됨', () => {
    for (let l = 1; l <= MAX_LEVEL; l++) {
      const p = difficulty(l);
      for (const seed of SEEDS) {
        const pz = generatePuzzle(p, seed);
        let st = pz.initial;
        for (const m of pz.witness) { expect(isLegal(pz.cfg, st, m), `L${l} seed ${seed}`).toBe(true); st = applyMove(pz.cfg, st, m).state; }
        expect(isWon(st), `L${l} seed ${seed}`).toBe(true);
        expect(st.cleared).toBe(pz.sets);
      }
    }
  });
  it('이동 제한 = 풀이 길이 + slack, 풀이는 제한 안', () => {
    for (let l = 1; l <= MAX_LEVEL; l++) {
      const p = difficulty(l);
      for (const seed of SEEDS.slice(0, 15)) { const pz = generatePuzzle(p, seed); expect(pz.par).toBe(pz.witness.length); expect(pz.limit).toBe(pz.par + p.slack); expect(pz.par).toBeLessThanOrEqual(pz.limit); }
    }
  });
  it('시작 상태가 올바름: 칸 수 초과 없음 · 이미 완성된 세트 없음 · 정리 수 0', () => {
    for (let l = 1; l <= MAX_LEVEL; l++)
      for (const seed of SEEDS.slice(0, 20)) {
        const pz = generatePuzzle(difficulty(l), seed);
        expect(validState(pz.cfg, pz.initial)).toBe(true);
        expect(pz.initial.cleared).toBe(0);
        pz.initial.shelves.forEach((s) => expect(findRun(s)).toBeNull());
        expect(pz.initial.shelves).toHaveLength(pz.cfg.shelves);
      }
  });
  it('장난감 수 = 3 × 세트, 종류 수·별·고정 개수가 설정과 일치', () => {
    for (let l = 1; l <= MAX_LEVEL; l++) {
      const p = difficulty(l);
      for (const seed of SEEDS.slice(0, 15)) {
        const pz = generatePuzzle(p, seed);
        const all = pz.initial.shelves.join('');
        expect(toyCount(pz.initial)).toBe(3 * p.sets);
        expect([...all].filter(isWild)).toHaveLength(p.wilds);
        expect([...all].filter(isFixed)).toHaveLength(p.fixed);
        const types = new Set([...all].filter((c) => !isWild(c)).map(typeOf));
        expect(types.size).toBeLessThanOrEqual(p.types);
        expect(Math.max(...types)).toBeLessThan(p.types);
        expect(pz.cfg.lockOrder).toHaveLength(p.locked);
      }
    }
  });
  it('종류별 장난감 수는 별을 포함하면 3의 배수(세트로 정리 가능)', () => {
    for (let l = 3; l <= MAX_LEVEL; l++)
      for (const seed of SEEDS.slice(0, 10)) {
        const pz = generatePuzzle(difficulty(l), seed);
        const all = [...pz.initial.shelves.join('')];
        const wilds = all.filter(isWild).length;
        const counts = new Map<number, number>();
        all.filter((c) => !isWild(c)).forEach((c) => counts.set(typeOf(c), (counts.get(typeOf(c)) ?? 0) + 1));
        // 별이 채워 줄 수 있는 빈자리: 각 종류에서 3의 배수에 모자란 개수의 합 = 별 개수
        let missing = 0; counts.forEach((n) => (missing += (3 - (n % 3)) % 3));
        expect(missing).toBe(wilds);
      }
  });
  it('같은 시드 → 같은 퍼즐, 다른 시드 → 대체로 다른 퍼즐', () => {
    const p = difficulty(6);
    expect(generatePuzzle(p, 5)).toEqual(generatePuzzle(p, 5));
    const keys = new Set(SEEDS.slice(0, 20).map((s) => generatePuzzle(p, s).initial.shelves.join('|')));
    expect(keys.size).toBeGreaterThan(15);
  });
  it('쉬운 레벨의 퍼즐도 즉시 완성 상태가 아니고 이동이 필요함', () => {
    for (let l = 1; l <= MAX_LEVEL; l++) for (const seed of SEEDS.slice(0, 15)) { const pz = generatePuzzle(difficulty(l), seed); expect(isWon(pz.initial)).toBe(false); expect(pz.par).toBeGreaterThanOrEqual(2); expect(legalMoves(pz.cfg, pz.initial).length).toBeGreaterThan(0); }
  });
  it('한 번에 두 곳 정리(연쇄)가 L3 이상에서 정답 풀이에 실제로 등장', () => {
    let chains = 0, total = 0;
    for (const seed of SEEDS) {
      const pz = generatePuzzle(difficulty(7), seed);
      let st = pz.initial;
      for (const m of pz.witness) { const r = applyMove(pz.cfg, st, m); total++; if (r.chain >= 2) chains++; st = r.state; }
    }
    expect(chains / total).toBeGreaterThan(0.1);
    expect(chains).toBeGreaterThan(10);
  });
  it('잠긴 칸이 있는 레벨은 풀이 도중 실제로 열림(정리 수에 따라)', () => {
    const pz = generatePuzzle(difficulty(8), 3);
    expect(pz.cfg.lockOrder.length).toBeGreaterThan(0);
    const cap = (s: typeof pz.initial) => pz.initial.shelves.map((_, i) => pz.cfg.capacity - pz.cfg.lockOrder.filter((sh, k) => sh === i && s.cleared < (k + 1) * pz.cfg.unlockEvery).length);
    let st = pz.initial;
    const before = cap(st).reduce((a, b) => a + b, 0);
    for (const m of pz.witness) st = applyMove(pz.cfg, st, m).state;
    expect(cap(st).reduce((a, b) => a + b, 0)).toBeGreaterThan(before);
  });
  it('생성이 충분히 빠름(평균 20ms 이하 — 라운드 시작 시 즉시 생성)', () => {
    for (const l of [1, 5, 10]) {
      const t0 = performance.now();
      for (let i = 0; i < 30; i++) generatePuzzle(difficulty(l), 900 + i);
      expect((performance.now() - t0) / 30).toBeLessThan(20);
    }
  });
});
