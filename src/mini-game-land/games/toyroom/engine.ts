/**
 * 장난감방 규칙 엔진 — 순수 함수(React·DOM 무관). 생성기·솔버·게임·테스트가 모두 이 규칙을 '단일 진실'로 씁니다.
 *
 * 선반은 가로 한 줄(왼쪽→오른쪽 문자열). 아무 장난감이나 집어(index) 다른 선반 '맨 오른쪽'에 놓음 = 이동 1회.
 *  · 집으면 오른쪽 장난감이 왼쪽으로 당겨져(압축) 양옆이 붙을 수 있음 → 세트가 생기면 정리
 *  · 같은 종류가 3개 이상 이어지면 가장 왼쪽 3개가 정리(= 세트 1개). 정리 뒤에도 압축·재검사 → 연쇄 반응
 *  · 세트를 정리할 때마다 잠긴 칸이 순서대로 열림
 */

/** 장난감 코드: 일반 'a'..'f'(종류 0..5), 고정 'A'..'F'(집을 수 없음), 별 '*'(아무 종류) */
export const WILD = '*';
export const SET_SIZE = 3;
export const isWild = (c: string) => c === WILD;
export const isFixed = (c: string) => c >= 'A' && c <= 'F';
/** 종류 번호(별은 -1) */
export const typeOf = (c: string) => (isWild(c) ? -1 : c.toLowerCase().charCodeAt(0) - 97);
export const codeOf = (type: number, fixed = false) => String.fromCharCode((fixed ? 65 : 97) + type);

export interface RoomConfig {
  shelves: number;
  /** 선반 하나의 칸 수 */
  capacity: number;
  /** k 번째로 열리는 잠긴 칸이 속한 선반 번호(길이 = 잠긴 칸 수) */
  lockOrder: number[];
  /** 세트 몇 개를 정리할 때마다 잠긴 칸 하나가 열리나 */
  unlockEvery: number;
}

export interface RoomState {
  shelves: string[];
  /** 지금까지 정리한 세트 수 */
  cleared: number;
}

export interface Move { from: number; index: number; to: number }

/** 아직 잠겨 있는 칸 수 */
export function lockedRemaining(cfg: RoomConfig, cleared: number, shelf: number): number {
  let n = 0;
  for (let k = 0; k < cfg.lockOrder.length; k++) if (cfg.lockOrder[k] === shelf && cleared < (k + 1) * cfg.unlockEvery) n++;
  return n;
}
/** 지금 쓸 수 있는 칸 수 */
export const capacityOf = (cfg: RoomConfig, state: RoomState, shelf: number) => cfg.capacity - lockedRemaining(cfg, state.cleared, shelf);

export interface Run { start: number; len: number }

/** 정리할 수 있는 이어진 구간(별은 아무 종류). 가장 왼쪽 시작부터, 최소 한 개는 일반/고정 장난감이어야 함 */
export function findRun(shelf: string): Run | null {
  const n = shelf.length;
  for (let s = 0; s + SET_SIZE <= n; s++) {
    let base = -2, hasReal = false, j = s;
    for (; j < n; j++) {
      const c = shelf[j];
      if (isWild(c)) continue;
      const t = typeOf(c);
      if (base === -2) { base = t; hasReal = true; } else if (t !== base) break;
    }
    if (hasReal && j - s >= SET_SIZE) return { start: s, len: j - s };
  }
  return null;
}

export interface ClearInfo { shelf: number; start: number; toys: string; /** 이번 이동에서 몇 번째 정리인지(1부터) */ order: number }

/** 한 선반의 정리를 끝까지 반복(연쇄). 가장 왼쪽 3개씩 제거 */
function resolveShelf(shelf: string, shelfIdx: number, orderStart: number, onClear: (info: ClearInfo, after: string) => void): { shelf: string; sets: number } {
  let sets = 0, cur = shelf;
  for (;;) {
    const run = findRun(cur);
    if (!run) break;
    const toys = cur.slice(run.start, run.start + SET_SIZE);
    const after = cur.slice(0, run.start) + cur.slice(run.start + SET_SIZE);
    sets++;
    onClear({ shelf: shelfIdx, start: run.start, toys, order: orderStart + sets }, after);
    cur = after;
  }
  return { shelf: cur, sets };
}

export type StepKind = 'lift' | 'pop' | 'clear' | 'place';
export interface Step {
  kind: StepKind;
  /** 이 단계 '직후'의 선반들(pop 은 제거 직전 상태 그대로) */
  shelves: string[];
  clear?: ClearInfo;
}

export interface MoveResult {
  state: RoomState;
  steps: Step[];
  setsCleared: number;
  /** 한 번의 이동에서 연달아 정리된 세트 수(2 이상이면 연쇄 반응) */
  chain: number;
  toy: string;
  clears: ClearInfo[];
}

export function isLegal(cfg: RoomConfig, state: RoomState, m: Move): boolean {
  const { from, to, index } = m;
  if (from === to || from < 0 || to < 0 || from >= cfg.shelves || to >= cfg.shelves) return false;
  const src = state.shelves[from];
  if (index < 0 || index >= src.length) return false;
  if (isFixed(src[index])) return false;
  return state.shelves[to].length < capacityOf(cfg, state, to);
}

export function applyMove(cfg: RoomConfig, state: RoomState, m: Move): MoveResult {
  if (!isLegal(cfg, state, m)) throw new Error(`불가능한 이동: ${JSON.stringify(m)}`);
  const shelves = state.shelves.slice();
  const steps: Step[] = [];
  const clears: ClearInfo[] = [];
  let cleared = state.cleared;
  const toy = shelves[m.from][m.index];
  shelves[m.from] = shelves[m.from].slice(0, m.index) + shelves[m.from].slice(m.index + 1);
  steps.push({ kind: 'lift', shelves: shelves.slice() });

  const settle = (idx: number) => {
    const r = resolveShelf(shelves[idx], idx, clears.length, (info, after) => {
      steps.push({ kind: 'pop', shelves: shelves.slice(), clear: info });
      clears.push(info);
      cleared++;
      shelves[idx] = after;
      steps.push({ kind: 'clear', shelves: shelves.slice(), clear: info });
    });
    shelves[idx] = r.shelf;
  };
  settle(m.from);
  shelves[m.to] = shelves[m.to] + toy;
  steps.push({ kind: 'place', shelves: shelves.slice() });
  settle(m.to);

  return { state: { shelves, cleared }, steps, setsCleared: clears.length, chain: clears.length, toy, clears };
}

export const isWon = (state: RoomState) => state.shelves.every((s) => s.length === 0);
export const toyCount = (state: RoomState) => state.shelves.reduce((a, s) => a + s.length, 0);

/** 가능한 모든 이동. dedupe: 같은 종류가 이어진 구간에서는 첫 번째만(결과가 같음) */
export function legalMoves(cfg: RoomConfig, state: RoomState, dedupe = false): Move[] {
  const out: Move[] = [];
  for (let from = 0; from < cfg.shelves; from++) {
    const src = state.shelves[from];
    for (let i = 0; i < src.length; i++) {
      if (isFixed(src[i])) continue;
      if (dedupe && i > 0 && src[i] === src[i - 1]) continue;
      for (let to = 0; to < cfg.shelves; to++) {
        const m = { from, index: i, to };
        if (isLegal(cfg, state, m)) out.push(m);
      }
    }
  }
  return out;
}

/** 놓을 수 있는 이동이 하나도 없으면 막힘 */
export const isStuck = (cfg: RoomConfig, state: RoomState) => !isWon(state) && legalMoves(cfg, state, true).length === 0;

/** 상태 키(솔버·점수 중복 방지용) */
export const stateKey = (s: RoomState) => `${s.cleared}:${s.shelves.join('|')}`;

/** 시작 상태가 올바른지(칸 수 초과·이미 완성된 구간 없음) */
export function validState(cfg: RoomConfig, state: RoomState): boolean {
  for (let i = 0; i < cfg.shelves; i++) {
    if (state.shelves[i].length > capacityOf(cfg, state, i)) return false;
    if (findRun(state.shelves[i])) return false;
  }
  return true;
}
