import { describe, expect, it } from 'vitest';
import {
  SET_SIZE, WILD, applyMove, capacityOf, codeOf, findRun, isFixed, isLegal, isStuck, isWon, isWild, legalMoves, lockedRemaining,
  stateKey, toyCount, typeOf, validState, type Move, type RoomConfig, type RoomState,
} from './engine';

const cfg = (o: Partial<RoomConfig> = {}): RoomConfig => ({ shelves: 3, capacity: 4, lockOrder: [], unlockEvery: 1, ...o });
const st = (shelves: string[], cleared = 0): RoomState => ({ shelves, cleared });

describe('장난감 코드', () => {
  it('일반 · 고정 · 별', () => {
    expect(typeOf('a')).toBe(0); expect(typeOf('f')).toBe(5); expect(typeOf('C')).toBe(2); expect(typeOf(WILD)).toBe(-1);
    expect(isFixed('A')).toBe(true); expect(isFixed('a')).toBe(false); expect(isFixed(WILD)).toBe(false); expect(isWild(WILD)).toBe(true);
    expect(codeOf(2)).toBe('c'); expect(codeOf(2, true)).toBe('C');
  });
});

describe('세트 판정(findRun)', () => {
  it('같은 종류 3개가 이어지면 세트, 2개나 떨어져 있으면 아님', () => {
    expect(findRun('aaa')).toEqual({ start: 0, len: 3 });
    expect(findRun('baaa')).toEqual({ start: 1, len: 3 });
    expect(findRun('aa')).toBeNull();
    expect(findRun('aaba')).toBeNull();
    expect(findRun('')).toBeNull();
  });
  it('4개 이상 이어져도 구간 전체로 인식(정리는 왼쪽 3개)', () => {
    expect(findRun('aaaa')).toEqual({ start: 0, len: 4 });
  });
  it('별은 아무 종류로 쓰임 · 별만 있는 3개는 세트 아님', () => {
    expect(findRun('a*a')).toEqual({ start: 0, len: 3 });
    expect(findRun('*aa')).toEqual({ start: 0, len: 3 });
    expect(findRun('aa*')).toEqual({ start: 0, len: 3 });
    expect(findRun('***')).toBeNull();
    expect(findRun('a*b')).toBeNull();   // 별 하나가 두 종류를 이을 수는 없음
    expect(findRun('ab*b')?.start).toBe(1);
  });
  it('고정 장난감도 세트에 포함됨', () => {
    expect(findRun('Aaa')).toEqual({ start: 0, len: 3 });
    expect(findRun('aAa')).toEqual({ start: 0, len: 3 });
  });
});

describe('이동 규칙', () => {
  it('집은 장난감은 대상 선반의 맨 오른쪽에 놓임', () => {
    const r = applyMove(cfg(), st(['ab', 'c', '']), { from: 0, index: 0, to: 1 });
    expect(r.state.shelves).toEqual(['b', 'ca', '']);
    expect(r.setsCleared).toBe(0);
    expect(r.steps.map((s) => s.kind)).toEqual(['lift', 'place']);
  });
  it('맨 끝에 놓아 세트 완성 → 정리, 정리 수 증가', () => {
    const r = applyMove(cfg(), st(['a', 'aab', '']), { from: 0, index: 0, to: 1 });
    // 'aab' 맨 끝은 b 라서 완성되지 않음
    expect(r.setsCleared).toBe(0);
    const r2 = applyMove(cfg(), st(['a', 'baa', '']), { from: 0, index: 0, to: 1 });
    expect(r2.setsCleared).toBe(1);
    expect(r2.state.shelves).toEqual(['', 'b', '']);
    expect(r2.state.cleared).toBe(1);
    expect(r2.steps.map((s) => s.kind)).toEqual(['lift', 'place', 'pop', 'clear']);
    expect(r2.clears[0]).toMatchObject({ shelf: 1, toys: 'aaa', order: 1 });
  });
  it('가운데 장난감을 빼면 양옆이 붙어 세트 완성(압축) — 원래 선반에서 정리', () => {
    const r = applyMove(cfg(), st(['aaba'.replace('aaba', 'aba' + 'a'), 'c', '']), { from: 0, index: 1, to: 1 });
    // 'abaa' 에서 b 를 빼면 'aaa' → 정리
    expect(r.state.shelves[0]).toBe('');
    expect(r.state.shelves[1]).toBe('cb');
    expect(r.setsCleared).toBe(1);
    expect(r.steps[0].kind).toBe('lift');
    expect(r.steps.map((s) => s.kind)).toEqual(['lift', 'pop', 'clear', 'place']);
  });
  it('한 번의 이동으로 두 곳이 정리되면 연쇄(chain=2), 정리 순서 번호가 이어짐', () => {
    // 0번: a a b a → b 를 빼면 aaa 정리 / 1번: b b → b 를 놓으면 bbb 정리
    const r = applyMove(cfg({ capacity: 4 }), st(['aaba', 'bb', '']), { from: 0, index: 2, to: 1 });
    expect(r.chain).toBe(2);
    expect(r.clears.map((c) => [c.shelf, c.order])).toEqual([[0, 1], [1, 2]]);
    expect(r.state.shelves).toEqual(['', '', '']);
    expect(isWon(r.state)).toBe(true);
  });
  it('같은 선반 안의 연쇄: 정리로 양옆이 다시 붙어 또 정리(캐스케이드)', () => {
    // u a a x a u u : x 를 빼면 aaa 정리 → uuu 정리 (칸 7개 필요)
    const r = applyMove(cfg({ capacity: 7 }), st(['uaaxauu', '', '']), { from: 0, index: 3, to: 1 });
    expect(r.chain).toBe(2);
    expect(r.state.shelves).toEqual(['', 'x', '']);
  });
  it('4개가 이어지면 왼쪽 3개만 정리하고 1개 남음(종류별 개수가 3의 배수로 유지)', () => {
    // 'aabaa' 에서 b 를 빼면 'aaaa' → 3개 정리, 1개 남음
    const r = applyMove(cfg({ capacity: 5 }), st(['aabaa', '', '']), { from: 0, index: 2, to: 1 });
    expect(r.state.shelves).toEqual(['a', 'b', '']);
    expect(r.setsCleared).toBe(1);
    // 올바른 상태에서 한 개를 빼서 이어지는 구간은 최대 2+2=4개 → 한 번에 왼쪽 3개만 정리
  });
  it('별 장난감은 어떤 종류의 세트에도 쓰임', () => {
    const r = applyMove(cfg(), st(['*', 'bb', '']), { from: 0, index: 0, to: 1 });
    expect(r.setsCleared).toBe(1);
    expect(r.state.shelves[1]).toBe('');
  });
  it('입력 상태는 바뀌지 않음(불변)', () => {
    const s = st(['ab', 'c', '']);
    applyMove(cfg(), s, { from: 0, index: 0, to: 1 });
    expect(s).toEqual(st(['ab', 'c', '']));
  });
});

describe('합법성 · 칸 · 잠금', () => {
  it('고정 장난감은 집을 수 없음, 가득 찬 선반·같은 선반·범위 밖은 불가', () => {
    const c = cfg(); const s = st(['Ab', 'abab', '']);
    expect(isLegal(c, s, { from: 0, index: 0, to: 2 })).toBe(false);
    expect(isLegal(c, s, { from: 0, index: 1, to: 2 })).toBe(true);
    expect(isLegal(c, s, { from: 0, index: 1, to: 1 })).toBe(false); // 가득 참
    expect(isLegal(c, s, { from: 0, index: 1, to: 0 })).toBe(false); // 같은 선반
    expect(isLegal(c, s, { from: 0, index: 5, to: 2 })).toBe(false);
    expect(isLegal(c, s, { from: 3, index: 0, to: 2 })).toBe(false);
    expect(() => applyMove(c, s, { from: 0, index: 0, to: 2 })).toThrow();
  });
  it('잠긴 칸은 세트를 정리할수록 순서대로 열림', () => {
    const c = cfg({ lockOrder: [1, 1], unlockEvery: 1 });
    expect(capacityOf(c, st(['', '', '']), 1)).toBe(2);
    expect(capacityOf(c, st(['', '', ''], 1), 1)).toBe(3);
    expect(capacityOf(c, st(['', '', ''], 2), 1)).toBe(4);
    expect(lockedRemaining(c, 0, 0)).toBe(0);
    // 잠긴 칸 때문에 못 놓음
    expect(isLegal(c, st(['a', 'bcb', '']), { from: 0, index: 0, to: 1 })).toBe(false);
    // unlockEvery 2
    expect(capacityOf(cfg({ lockOrder: [0], unlockEvery: 2 }), st(['', '', ''], 1), 0)).toBe(3);
    expect(capacityOf(cfg({ lockOrder: [0], unlockEvery: 2 }), st(['', '', ''], 2), 0)).toBe(4);
  });
  it('세트 정리로 칸이 열리면 상태의 정리 수에 반영', () => {
    const c = cfg({ lockOrder: [2], unlockEvery: 1 });
    const r = applyMove(c, st(['a', 'baa', 'c']), { from: 0, index: 0, to: 1 });
    expect(r.state.cleared).toBe(1);
    expect(capacityOf(c, r.state, 2)).toBe(4);
  });
  it('이동 목록: 고정 제외, dedupe 는 같은 종류 연속에서 하나만', () => {
    const c = cfg(); const s = st(['aab', 'A', '']);
    const all = legalMoves(c, s);
    expect(all.some((m) => m.from === 1)).toBe(false);
    const dd = legalMoves(c, s, true);
    expect(dd.length).toBeLessThan(all.length);
    expect(new Set(dd.filter((m) => m.from === 0 && m.to === 2).map((m) => m.index)).size).toBe(2); // a(0), b(2)
  });
  it('막힘: 놓을 곳이 전혀 없으면 true', () => {
    const c = cfg({ shelves: 2, capacity: 2 });
    expect(isStuck(c, st(['ab', 'cd']))).toBe(true);
    expect(isStuck(c, st(['ab', 'c']))).toBe(false);
    expect(isStuck(c, st(['', '']))).toBe(false); // 이미 완성
  });
  it('올바른 시작 상태: 칸 초과·이미 완성된 구간 금지', () => {
    const c = cfg();
    expect(validState(c, st(['aab', 'bba', '']))).toBe(true);
    expect(validState(c, st(['aaab', '', '']))).toBe(false);
    expect(validState(c, st(['ababa', '', '']))).toBe(false);
    expect(validState(cfg({ lockOrder: [0] }), st(['abab', '', '']))).toBe(false);
  });
  it('상태 키·장난감 수', () => {
    expect(stateKey(st(['a', 'b'], 2))).toBe('2:a|b');
    expect(toyCount(st(['ab', 'c', '']))).toBe(3);
    expect(SET_SIZE).toBe(3);
  });
});

describe('이동 결과 단계(애니메이션용)', () => {
  it('lift → (pop → clear)* → place → (pop → clear)* 순서이고 마지막 단계 = 최종 상태', () => {
    const m: Move = { from: 0, index: 2, to: 1 };
    const r = applyMove(cfg(), st(['aaba', 'bb', '']), m);
    expect(r.steps.map((s) => s.kind)).toEqual(['lift', 'pop', 'clear', 'place', 'pop', 'clear']);
    expect(r.steps[r.steps.length - 1].shelves).toEqual(r.state.shelves);
    expect(r.steps[1].shelves).toEqual(r.steps[0].shelves); // pop 은 제거 직전 상태 그대로
    expect(r.steps[1].clear?.toys).toBe('aaa');
  });
});
