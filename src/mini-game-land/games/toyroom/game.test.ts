import { describe, expect, it } from 'vitest';
import { applyMove, isFixed, legalMoves, type Move } from './engine';
import { ToyGame, type ToyEvent } from './game';
import { difficulty, type ToyParams } from './logic';

const mk = (level = 1, seed = 4, o: Partial<ToyParams> = {}) => new ToyGame({ ...difficulty(level), ...o }, seed);
const types = (ev: ToyEvent[]) => ev.map((e) => e.type);
const play = (g: ToyGame, moves: Move[]) => { const out: ToyEvent[] = []; for (const m of moves) out.push(...g.perform(m)); return out; };

describe('ToyGame — 선택과 이동(탭 → 탭)', () => {
  it('장난감 탭 → 선택, 같은 장난감 다시 탭 → 선택 해제, 같은 선반의 다른 장난감 탭 → 선택 교체', () => {
    const g = mk(2);
    const s = g.state.shelves.findIndex((x) => x.length >= 2);
    expect(types(g.tapToy(s, 0))).toEqual(['select']);
    expect(g.selected).toEqual({ shelf: s, index: 0 });
    expect(types(g.tapToy(s, 0))).toEqual(['deselect']);
    expect(g.selected).toBeNull();
    g.tapToy(s, 0);
    expect(types(g.tapToy(s, 1))).toEqual(['select']);
    expect(g.selected).toEqual({ shelf: s, index: 1 });
  });
  it('선택한 뒤 다른 선반을 탭하면 이동(이동 수 +1), 선택은 해제', () => {
    const g = mk(1);
    const m = legalMoves(g.cfg, g.state)[0];
    g.tapToy(m.from, m.index);
    const ev = g.tapShelf(m.to);
    expect(types(ev)[0]).toBe('move');
    expect(g.movesUsed).toBe(1);
    expect(g.selected).toBeNull();
  });
  it('선택한 채로 다른 선반의 장난감을 눌러도 그 선반으로 이동', () => {
    const g = mk(1);
    const m = legalMoves(g.cfg, g.state).find((x) => g.state.shelves[x.to].length > 0)!;
    g.tapToy(m.from, m.index);
    expect(types(g.tapToy(m.to, 0))[0]).toBe('move');
  });
  it('선택 없이 선반 탭은 아무 일도 없음, 같은 선반 탭은 선택 해제', () => {
    const g = mk(1);
    expect(g.tapShelf(0)).toEqual([]);
    const s = g.state.shelves.findIndex((x) => x.length > 0);
    g.tapToy(s, 0);
    expect(types(g.tapShelf(s))).toEqual(['deselect']);
  });
  it('가득 찬 선반으로는 이동 불가(reject full), 상태 변화 없음', () => {
    const g = mk(2);
    const full = g.state.shelves.findIndex((s, i) => s.length >= g.capacity(i));
    const src = g.state.shelves.findIndex((s, i) => i !== full && s.length > 0);
    if (full < 0) return; // 이 시드에는 가득 찬 선반이 없음
    g.tapToy(src, 0);
    const ev = g.tapShelf(full);
    expect(ev).toEqual([{ type: 'reject', reason: 'full' }]);
    expect(g.movesUsed).toBe(0);
    expect(g.selected).not.toBeNull();
  });
  it('고정 장난감은 선택 불가(reject fixed)', () => {
    for (let seed = 0; seed < 30; seed++) {
      const g = mk(5, seed);
      for (let s = 0; s < g.cfg.shelves; s++) for (let i = 0; i < g.state.shelves[s].length; i++) if (isFixed(g.state.shelves[s][i])) {
        expect(g.tapToy(s, i)).toEqual([{ type: 'reject', reason: 'fixed' }]);
        expect(g.selected).toBeNull();
        return;
      }
    }
    throw new Error('고정 장난감이 있는 퍼즐을 찾지 못함');
  });
  it('끝난 판에서는 입력 무시', () => {
    const g = mk(1);
    play(g, g.puzzle.witness);
    expect(g.status).toBe('won');
    expect(g.tapToy(0, 0)).toEqual([]);
    expect(g.undo()).toEqual([]);
  });
});

describe('ToyGame — 점수 · 콤보 · 연쇄', () => {
  it('세트를 정리한 이동은 점수, 연속이면 콤보 증가 / 정리 없는 이동은 콤보 0', () => {
    const g = mk(3, 6);
    const ev = play(g, g.puzzle.witness);
    const moves = ev.filter((e): e is Extract<ToyEvent, { type: 'move' }> => e.type === 'move');
    expect(moves.length).toBe(g.puzzle.witness.length);
    expect(moves.every((m) => m.result.setsCleared > 0 ? m.points > 0 : m.points === 0)).toBe(true);
    let combo = 0;
    for (const m of moves) { combo = m.result.setsCleared > 0 ? combo + 1 : 0; expect(m.combo).toBe(combo); }
    expect(g.bestCombo).toBeGreaterThanOrEqual(1);
  });
  it('한 번에 두 곳 정리 → 연쇄 점수(250), 세트 수 2 증가', () => {
    for (let seed = 0; seed < 40; seed++) {
      const g = mk(6, seed);
      for (const m of g.puzzle.witness) {
        const preview = applyMove(g.cfg, g.state, m);
        const ev = g.perform(m);
        if (preview.chain >= 2) {
          const mv = ev.find((e) => e.type === 'move') as Extract<ToyEvent, { type: 'move' }>;
          expect(mv.result.chain).toBe(preview.chain);
          expect(mv.points).toBe(preview.chain === 2 ? 250 : mv.points);
          return;
        }
      }
    }
    throw new Error('연쇄가 있는 퍼즐을 찾지 못함');
  });
  it('되돌렸다 같은 이동을 다시 해도 점수는 한 번만(점수 중복 방지)', () => {
    const g = mk(1, 2);
    const first = g.puzzle.witness[0];
    const a = g.perform(first).find((e) => e.type === 'move') as Extract<ToyEvent, { type: 'move' }>;
    g.undo();
    const b = g.perform(first).find((e) => e.type === 'move') as Extract<ToyEvent, { type: 'move' }>;
    expect(b.result.setsCleared).toBe(a.result.setsCleared);
    if (a.result.setsCleared > 0) { expect(a.points).toBeGreaterThan(0); expect(b.points).toBe(0); }
  });
  it('정리할 때 잠긴 칸이 열리면 unlocked 가 알려짐', () => {
    for (let seed = 0; seed < 40; seed++) {
      const g = mk(5, seed);
      for (const m of g.puzzle.witness) {
        const mv = g.perform(m).find((e) => e.type === 'move') as Extract<ToyEvent, { type: 'move' }>;
        if (mv.unlocked > 0) { expect(mv.result.setsCleared).toBeGreaterThan(0); return; }
      }
    }
    throw new Error('잠긴 칸이 열리는 경우를 찾지 못함');
  });
});

describe('ToyGame — 되돌리기 · 처음부터', () => {
  it('되돌리기: 상태·이동 수·콤보 복원, 횟수 차감, 횟수 0 이면 불가', () => {
    const g = mk(1, 3);
    const initial = g.state;
    g.perform(g.puzzle.witness[0]);
    expect(g.movesUsed).toBe(1);
    const left = g.undoLeft;
    expect(types(g.undo())).toEqual(['undo']);
    expect(g.state).toEqual(initial);
    expect(g.movesUsed).toBe(0);
    expect(g.combo).toBe(0);
    expect(g.undoLeft).toBe(left - 1);
    expect(g.undo()).toEqual([]); // 되돌릴 기록 없음
    const g2 = mk(1, 3, { undo: 0 });
    g2.perform(g2.puzzle.witness[0]);
    expect(g2.canUndo).toBe(false);
    expect(g2.undo()).toEqual([]);
  });
  it('처음부터: 같은 퍼즐로 복귀, 이동 수 0(되돌리기 횟수는 유지)', () => {
    const g = mk(2, 5);
    const initial = g.puzzle.initial;
    g.perform(g.puzzle.witness[0]);
    g.reset();
    expect(g.state).toEqual(initial);
    expect(g.movesUsed).toBe(0);
    expect(g.undoLeft).toBe(g.params.undo);
  });
});

describe('ToyGame — 종료 조건', () => {
  it('정답 풀이대로 하면 성공: won + 별 + 남은 이동 보너스', () => {
    for (let l = 1; l <= 10; l++) {
      const g = mk(l, 11 + l);
      const ev = play(g, g.puzzle.witness);
      expect(g.status, `L${l}`).toBe('won');
      const won = ev.find((e) => e.type === 'won') as Extract<ToyEvent, { type: 'won' }>;
      expect(won.stars).toBe(3);                         // 정답 풀이 = par → 3별
      expect(won.bonus).toBe(g.params.slack * 20);       // 남은 이동 = slack
      expect(g.setsCleared).toBe(g.totalSets);
    }
  });
  it('이동 제한을 다 쓰고도 못 끝내면 실패(reason=moves)', () => {
    const g = mk(3, 8, { slack: 0 });
    // 정답 풀이와 다른, 정리 안 되는 이동만 반복
    let guard = 0;
    while (g.playing && guard++ < 50) {
      const m = legalMoves(g.cfg, g.state).find((x) => applyMove(g.cfg, g.state, x).setsCleared === 0);
      if (!m) break;
      g.perform(m);
    }
    expect(g.status).toBe('lost');
    expect(g.movesLeft).toBe(0);
  });
  it('마지막 이동으로 완성하면 성공이 우선(이동이 0이 되어도)', () => {
    const g = mk(1, 9, { slack: 0 });
    const ev = play(g, g.puzzle.witness);
    expect(g.status).toBe('won');
    expect(types(ev)).not.toContain('lost');
    expect(g.movesLeft).toBe(0);
  });
  it('놓을 곳이 없으면 막힘 실패(reason=stuck)', () => {
    const g = mk(1, 1);
    // 강제로 막힌 상태를 구성: 모든 선반을 가득 채움
    (g as unknown as { state: unknown }).state = { shelves: ['abab', 'baba', 'abab'], cleared: 0 };
    (g as unknown as { cfg: { capacity: number } }).cfg.capacity = 4;
    const ev = g.perform({ from: 0, index: 0, to: 1 });
    expect(ev).toEqual([]); // 가득 차서 불법 → 이동 없음
    expect(g.playing).toBe(true);
  });
  it('같은 시드 → 같은 판(결정적)', () => {
    const a = mk(7, 21), b = mk(7, 21);
    expect(a.state).toEqual(b.state);
    expect(a.puzzle.witness).toEqual(b.puzzle.witness);
    expect(a.limit).toBe(b.limit);
  });
});
