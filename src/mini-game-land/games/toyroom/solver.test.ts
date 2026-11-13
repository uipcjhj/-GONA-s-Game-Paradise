import { describe, expect, it } from 'vitest';
import { applyMove, isLegal, isWon, type RoomState } from './engine';
import { generatePuzzle } from './generator';
import { difficulty } from './logic';
import { solve } from './solver';

describe('독립 솔버(너비 우선 탐색)로 생성기를 교차 검증', () => {
  const replay = (cfg: Parameters<typeof applyMove>[0], start: RoomState, moves: { from: number; index: number; to: number }[]) => {
    let st = start;
    for (const m of moves) { expect(isLegal(cfg, st, m)).toBe(true); st = applyMove(cfg, st, m).state; }
    return st;
  };
  it('L1~L3: 솔버가 최소 풀이를 찾고, 정답 풀이(par)보다 길지 않으며 제한 이내', () => {
    for (const l of [1, 2, 3]) {
      for (let seed = 0; seed < 25; seed++) {
        const pz = generatePuzzle(difficulty(l), seed * 13 + 1);
        const r = solve(pz.cfg, pz.initial, { maxDepth: pz.par, maxNodes: 200000 });
        expect(r.moves, `L${l} seed ${seed}`).not.toBeNull();
        expect(r.moves!.length).toBeLessThanOrEqual(pz.par);
        expect(r.moves!.length).toBeLessThanOrEqual(pz.limit);
        expect(isWon(replay(pz.cfg, pz.initial, r.moves!))).toBe(true);
      }
    }
  });
  it('최소 풀이보다 한 수 적은 한도에서는 풀이가 없음(이동 제한이 실제로 의미 있음)', () => {
    let checked = 0;
    for (let seed = 0; seed < 20; seed++) {
      const pz = generatePuzzle(difficulty(3), seed * 7 + 2);
      const best = solve(pz.cfg, pz.initial, { maxDepth: pz.par, maxNodes: 100000 });
      if (!best.moves || best.moves.length < 2) continue;
      const shorter = solve(pz.cfg, pz.initial, { maxDepth: best.moves.length - 1, maxNodes: 100000 });
      expect(shorter.moves).toBeNull();
      expect(shorter.capped).toBe(false); // 탐색 한도 때문이 아니라 정말 해가 없음
      checked++;
    }
    expect(checked).toBeGreaterThan(3);
  });
  it('L4: 솔버 탐색 범위 안에서 찾은 풀이는 항상 par 이하(대부분 해결)', () => {
    let solved = 0, n = 0;
    for (let seed = 0; seed < 12; seed++) {
      const pz = generatePuzzle(difficulty(4), seed * 5 + 3);
      const r = solve(pz.cfg, pz.initial, { maxDepth: pz.par, maxNodes: 150000 });
      n++;
      if (r.moves) { solved++; expect(r.moves.length).toBeLessThanOrEqual(pz.par); }
    }
    expect(solved).toBeGreaterThanOrEqual(Math.floor(n * 0.5));
  });
  it('이미 완성된 상태는 0 수, 풀 수 없는 상태는 null', () => {
    const cfg = { shelves: 2, capacity: 2, lockOrder: [], unlockEvery: 1 };
    expect(solve(cfg, { shelves: ['', ''], cleared: 0 }).moves).toEqual([]);
    expect(solve(cfg, { shelves: ['ab', 'ab'], cleared: 0 }, { maxDepth: 6 }).moves).toBeNull();
  });
});
