/**
 * 고나의 가짜 친구 찾기 (spot) — 관찰형: 똑같은 친구들 사이에서 딱 한 곳이 다른 '가짜'를 찾아 탭.
 * 편가르기(규칙을 읽고 한 장씩 분류)와 달리 '여러 개를 훑어보고 차이를 찾는' 시각 탐색 게임.
 * 차이 축: 색(가장 쉬움) → 소품 → 표정 → 좌우 반전(가장 어려움). 레벨이 오를수록 친구 수 증가·어려운 축·섞기.
 */
import { mulberry32 } from '../../core/rng';

export const MAX_LEVEL = 10;
export type Axis = 'color' | 'feature' | 'face' | 'mirror';
export interface Friend { color: string; face: string; feature: string; mirror: boolean }
export const COLORS = ['red', 'blue', 'green', 'yellow'];
export const FACES = ['smile', 'cry', 'angry', 'sleepy'];
export const FEATURES = ['ribbon', 'hat', 'glasses', 'none'];

export interface SpotParams {
  goal: number;
  cols: number;
  rows: number;
  axes: Axis[];
  maxMiss: number;
  /** 0 이면 섞지 않음. ms 마다 자리 섞기(L8~) */
  shuffleMs: number;
  /** 한 판 판(board)당 기대 시간(제한시간 계산용) */
  secPerBoard: number;
}
/** 임시 설계값 — 실제 플레이로 조정 필요 */
export const TUNING: SpotParams[] = [
  { goal: 10, cols: 2, rows: 2, axes: ['color'], maxMiss: 3, shuffleMs: 0, secPerBoard: 2.2 },
  { goal: 10, cols: 3, rows: 3, axes: ['color', 'feature'], maxMiss: 3, shuffleMs: 0, secPerBoard: 2.6 },
  { goal: 11, cols: 3, rows: 3, axes: ['feature', 'face'], maxMiss: 3, shuffleMs: 0, secPerBoard: 2.8 },
  { goal: 11, cols: 3, rows: 4, axes: ['feature', 'face'], maxMiss: 3, shuffleMs: 0, secPerBoard: 3.0 },
  { goal: 12, cols: 4, rows: 4, axes: ['color', 'feature', 'face'], maxMiss: 3, shuffleMs: 0, secPerBoard: 3.2 },
  { goal: 12, cols: 4, rows: 4, axes: ['face', 'mirror'], maxMiss: 3, shuffleMs: 0, secPerBoard: 3.4 },
  { goal: 13, cols: 4, rows: 5, axes: ['feature', 'face', 'mirror'], maxMiss: 3, shuffleMs: 0, secPerBoard: 3.6 },
  { goal: 13, cols: 4, rows: 5, axes: ['face', 'mirror'], maxMiss: 3, shuffleMs: 4000, secPerBoard: 3.8 },
  { goal: 14, cols: 5, rows: 5, axes: ['feature', 'face', 'mirror'], maxMiss: 3, shuffleMs: 3500, secPerBoard: 4.0 },
  { goal: 14, cols: 5, rows: 6, axes: ['face', 'mirror'], maxMiss: 3, shuffleMs: 3000, secPerBoard: 4.2 },
];
export const difficulty = (level: number): SpotParams => ({ ...TUNING[Math.min(MAX_LEVEL, Math.max(1, level)) - 1] });
export const timeLimitSec = (level: number) => {
  const p = difficulty(level);
  return Math.min(60, Math.round(p.goal * p.secPerBoard + 8));
};

export interface Board { cells: Friend[]; fake: number; axis: Axis }
export interface SpotState {
  params: SpotParams;
  rand: () => number;
  board: Board;
  found: number;
  miss: number;
  combo: number;
  bestCombo: number;
  boardMs: number;
  shuffleIn: number;
  /** 화면에 보여 줄 마지막 오답 칸(잠깐 흔들기) */
  lastWrong: number | null;
  boards: number;
}
const pick = <T,>(r: () => number, a: readonly T[]): T => a[Math.floor(r() * a.length)];

export function makeBoard(p: SpotParams, r: () => number): Board {
  const n = p.cols * p.rows;
  const base: Friend = { color: pick(r, COLORS), face: pick(r, FACES), feature: pick(r, FEATURES), mirror: r() < 0.5 };
  const axis = pick(r, p.axes);
  const fake = { ...base };
  if (axis === 'mirror') {
    fake.mirror = !base.mirror;
    // 좌우 반전이 눈에 보이려면 한쪽에만 있는 소품이 필요 → 항상 리본(머리 오른쪽)을 달아 줌
    base.feature = fake.feature = 'ribbon';
  } else {
    const opts = (axis === 'color' ? COLORS : axis === 'face' ? FACES : FEATURES).filter((v) => v !== base[axis]);
    fake[axis] = pick(r, opts);
  }
  const at = Math.floor(r() * n);
  return { cells: Array.from({ length: n }, (_, i) => (i === at ? fake : { ...base })), fake: at, axis };
}
export function createState(params: SpotParams, seed: number): SpotState {
  const rand = mulberry32(seed);
  return { params, rand, board: makeBoard(params, rand), found: 0, miss: 0, combo: 0, bestCombo: 0, boardMs: 0, shuffleIn: params.shuffleMs, lastWrong: null, boards: 1 };
}
export type Answer = { kind: 'correct'; quick: boolean; ms: number } | { kind: 'wrong' } | { kind: 'ignored' };
/** 칸 탭. 정답이면 다음 판, 오답이면 실수(+콤보 끊김) */
export function answer(s: SpotState, index: number): Answer {
  if (index < 0 || index >= s.board.cells.length || status(s) !== 'playing') return { kind: 'ignored' };
  if (index === s.board.fake) {
    const ms = s.boardMs;
    s.found++;
    s.combo++;
    s.bestCombo = Math.max(s.bestCombo, s.combo);
    s.lastWrong = null;
    if (status(s) === 'playing') {
      s.board = makeBoard(s.params, s.rand);
      s.boards++;
      s.boardMs = 0;
      s.shuffleIn = s.params.shuffleMs;
    }
    return { kind: 'correct', quick: ms <= 1500, ms };
  }
  s.miss++;
  s.combo = 0;
  s.lastWrong = index;
  return { kind: 'wrong' };
}
/** 반환: 자리를 섞었는지(화면 갱신용) */
export function step(s: SpotState, dtMs: number): boolean {
  s.boardMs += dtMs;
  if (!s.params.shuffleMs) return false;
  s.shuffleIn -= dtMs;
  if (s.shuffleIn > 0) return false;
  s.shuffleIn += s.params.shuffleMs;
  const to = Math.floor(s.rand() * s.board.cells.length);
  const c = s.board.cells;
  [c[to], c[s.board.fake]] = [c[s.board.fake], c[to]];
  s.board.fake = to;
  s.lastWrong = null;
  return true;
}
export type SpotStatus = 'playing' | 'clear' | 'fail';
export const status = (s: SpotState): SpotStatus => (s.miss >= s.params.maxMiss ? 'fail' : s.found >= s.params.goal ? 'clear' : 'playing');
export const POINTS = { base: 100, quick: 50 };
