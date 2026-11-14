/** 장난감방 — 난이도 파라미터 · 점수 규칙(순수 함수) */
import type { Mode } from '../../core/types';
import { TOY_LEVELS, type ToyLevel } from './tuning';

export const MAX_LEVEL = 10;

export interface ToyParams extends ToyLevel {
  level: number;
}

export function difficulty(level: number): ToyParams {
  const l = Math.min(Math.max(1, Math.floor(level)), MAX_LEVEL);
  return { level: l, ...TOY_LEVELS[l - 1] };
}

/** 시작 상태에서 남는 빈 칸 수(0 이하면 놓을 자리가 없음) */
export const freeSlots = (p: ToyLevel) => p.shelves * p.capacity - p.locked - 3 * p.sets;

/** 제한시간(초): 자유 플레이는 무제한, 챌린지는 세트당 7초 + 25초 */
export function timeLimitSec(level: number, mode: Mode): number | null {
  if (mode === 'free') return null;
  return Math.round(25 + 7 * difficulty(level).sets);
}

// ── 점수 (기본 점수 → ctx.addScore 가 콤보 배수 적용)
export const SET_POINTS = 100;
export const CLEAR_BONUS = 300;
export const MOVE_BONUS = 20;

/** 한 번의 이동 안에서 n 번째로 정리된 세트의 배수: 1 → 1.0, 2 → 1.5(연쇄), 3 → 2.0, 4+ → 2.5 */
export const chainMultiplier = (order: number) => Math.min(2.5, 1 + 0.5 * (Math.max(1, order) - 1));
export const setPoints = (order: number) => Math.round(SET_POINTS * chainMultiplier(order));
/** 이번 이동의 기본 점수(콤보 적용 전) */
export const movePoints = (setsCleared: number) => Array.from({ length: setsCleared }, (_, i) => setPoints(i + 1)).reduce((a, b) => a + b, 0);

/** 남은 이동 수 보너스 */
export const leftoverBonus = (movesLeft: number) => Math.max(0, movesLeft) * MOVE_BONUS;

/** 별: 정답 풀이 길이(par) 이하 3개, par+slack/2 이하 2개, 나머지 1개 */
export function stars(used: number, par: number, slack: number): 1 | 2 | 3 {
  if (used <= par) return 3;
  return used <= par + Math.ceil(slack / 2) ? 2 : 1;
}
