/**
 * 임시 테스트 게임 "고나 콕콕" 로직 (순수 함수 — 렌더링과 분리).
 * 목적: 공통 시스템(타이머·점수·목숨·난이도·일시정지·두 모드 공유) 검증용. 출시 게임 아님.
 */
import { mulberry32, type Rng } from '../../core/rng';

export interface TapParams {
  cols: number;
  rows: number;
  goal: number;
  maxMistakes: number;
  /** 고나가 머무는 시간 */
  showMs: number;
  /** 새 목표 등장 간격 */
  spawnMs: number;
  /** 가짜(누르면 안 되는) 목표 비율 */
  decoyRate: number;
  maxVisible: number;
}

export const MAX_LEVEL = 10;

export function difficulty(level: number): TapParams {
  const l = Math.min(Math.max(1, Math.floor(level)), MAX_LEVEL);
  return {
    cols: 3,
    rows: l < 4 ? 3 : 4,
    goal: Math.min(24, 6 + 2 * l),
    maxMistakes: 3,
    showMs: Math.max(600, 1500 - 100 * (l - 1)),
    spawnMs: Math.max(350, 800 - 50 * (l - 1)),
    decoyRate: l < 3 ? 0 : Math.min(0.4, 0.1 * (l - 2)),
    maxVisible: l < 5 ? 2 : 3,
  };
}

export function timeLimitSec(level: number): number {
  const p = difficulty(level);
  return Math.ceil(p.goal * (p.spawnMs / 1000) * 1.7 + 4);
}

export interface Cell {
  kind: 'gona' | 'decoy';
  ttl: number;
}

export interface TapState {
  params: TapParams;
  rng: Rng;
  cells: (Cell | null)[];
  hits: number;
  mistakes: number;
  combo: number;
  spawnIn: number;
}

export function createState(params: TapParams, seed: number): TapState {
  return {
    params,
    rng: mulberry32(seed),
    cells: Array.from({ length: params.cols * params.rows }, () => null),
    hits: 0,
    mistakes: 0,
    combo: 0,
    spawnIn: 400,
  };
}

/** 시간 경과. 상태가 바뀌었으면 true */
export function step(s: TapState, dtMs: number): boolean {
  let changed = false;
  for (let i = 0; i < s.cells.length; i++) {
    const c = s.cells[i];
    if (!c) continue;
    c.ttl -= dtMs;
    if (c.ttl <= 0) {
      if (c.kind === 'gona') s.combo = 0; // 놓친 고나: 콤보만 끊김(실수 아님)
      s.cells[i] = null;
      changed = true;
    }
  }
  s.spawnIn -= dtMs;
  if (s.spawnIn <= 0) {
    s.spawnIn += s.params.spawnMs;
    const empty = s.cells.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0);
    const visible = s.cells.length - empty.length;
    if (empty.length > 0 && visible < s.params.maxVisible) {
      const idx = empty[Math.floor(s.rng() * empty.length)];
      s.cells[idx] = { kind: s.rng() < s.params.decoyRate ? 'decoy' : 'gona', ttl: s.params.showMs };
      changed = true;
    }
  }
  return changed;
}

export type TapEvent = 'hit' | 'decoy' | 'empty';

export function tap(s: TapState, index: number): TapEvent {
  const c = s.cells[index];
  if (!c) return 'empty'; // 빈 칸 오터치는 관대하게 무시
  s.cells[index] = null;
  if (c.kind === 'gona') {
    s.hits++;
    s.combo++;
    return 'hit';
  }
  s.mistakes++;
  s.combo = 0;
  return 'decoy';
}

export const status = (s: TapState): 'clear' | 'fail' | 'playing' =>
  s.hits >= s.params.goal ? 'clear' : s.mistakes >= s.params.maxMistakes ? 'fail' : 'playing';

export const BASE_POINTS = 100;
