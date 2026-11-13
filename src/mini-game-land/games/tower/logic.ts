/** 아슬아슬 탑 — 난이도 · 점수 규칙(순수 함수). 물리는 physics.ts, 진행은 game.ts */
import type { PieceKind } from './pieces';

export const MAX_LEVEL = 10;

export interface TowerParams {
  level: number;
  /** 목표 높이(월드 단위): 이 깃발에 닿고 holdMs 동안 버티면 성공 */
  goalH: number;
  /** 접시 폭 — 레벨이 오를수록 좁아짐 */
  plateW: number;
  /** 등장 가능한 간식 */
  pool: PieceKind[];
  /** 쓸 수 있는 조각 수(전부 쓰면 실패) — 낭비하지 말고 전략적으로 */
  budget: number;
  /** 이만큼 떨어뜨리면 실패 */
  maxFalls: number;
  /** 미리 보여 주는 다음 조각 수 */
  preview: number;
  /** 낙하 안내선(조각 아래 그림자 기둥) */
  guide: boolean;
  /** 탑의 무게중심(CoM) 표시 */
  showCom: boolean;
  /** 조각이 무작위 방향으로 나옴(돌려서 맞춰야 함) */
  randomAngle: boolean;
  frictionMul: number;
  /** 바람 세기(떨어지는 조각만 옆으로 날림). 0 = 없음 */
  wind: number;
  /** 다음 조각과 맞바꿀 수 있는 횟수 */
  swaps: number;
  windPeriodMs: number;
  /** 목표 높이 도달 후 버텨야 하는 시간 */
  holdMs: number;
}

/** 레벨별 등장 간식 — 한 레벨에 하나씩 새로운 모양이 늘어남 */
const POOLS: PieceKind[][] = [
  ['toast', 'macaron', 'pudding'],
  ['toast', 'macaron', 'pudding', 'cake'],
  ['toast', 'macaron', 'pudding', 'cake', 'banana'],
  ['toast', 'macaron', 'pudding', 'cake', 'banana', 'cone'],
  ['toast', 'macaron', 'pudding', 'cake', 'banana', 'cone', 'donut'],
  ['toast', 'macaron', 'pudding', 'cake', 'banana', 'cone', 'donut', 'slice'],
];

/** 바람 기준 세기(8레벨): 한 번 떨어지는 동안 최대 약 6 월드 단위 옆으로 휨(세기에 비례, 측정값) */
export const WIND_BASE = 0.00009;
/** 바람 세기 → 휨(월드 단위) 환산(물리 측정: 0.00008 ≈ 5.3) */
export const WIND_TO_DRIFT = 5.3 / 0.00008;

export function difficulty(level: number): TowerParams {
  const l = Math.min(Math.max(1, Math.floor(level)), MAX_LEVEL);
  const goalH = 70 + 12 * (l - 1);
  return {
    level: l,
    goalH,
    plateW: 124 - 3 * (l - 1),
    pool: POOLS[Math.min(POOLS.length - 1, l - 1)],
    budget: Math.ceil(goalH / 15) + 5,
    maxFalls: l <= 6 ? 4 : 3,
    preview: l <= 4 ? 2 : 1,
    guide: l <= 4,
    showCom: l <= 7,
    randomAngle: l >= 4,
    frictionMul: l >= 9 ? 0.8 : 1,
    wind: l < 8 ? 0 : l === 8 ? WIND_BASE : l === 9 ? WIND_BASE * 1.6 : WIND_BASE * 2.4,
    swaps: l <= 4 ? 3 : l <= 7 ? 2 : 1,
    windPeriodMs: 6000,
    holdMs: 1200,
  };
}

/** 제한시간(초): 조각당 3.2초 + 14초. 두 모드 공통 */
export function timeLimitSec(level: number): number {
  return Math.round(difficulty(level).budget * 3.2) + 14;
}

// ── 점수 (기본 점수 → ctx.addScore 가 콤보 배수 적용)
export const PLACE_STABLE = 100;
export const PLACE_PERFECT_BONUS = 50;
export const PLACE_SHAKY = 50;
export const CLEAR_BONUS = 300;
/** '완벽' 기준: 아래 조각 중심과의 차이(월드 단위) */
export const PERFECT_OFFSET = 5;
export const PERFECT_TILT = 0.1; // rad
/** 다른 조각이 이만큼 이상 움직이면 '흔들림' */
export const SHAKE_LIMIT = 4;

export interface Placement {
  /** 이번 조각 때문에 떨어진 조각이 있나 */
  fell: boolean;
  /** 다른 조각이 움직인 최대 거리 */
  shake: number;
  /** 아래 조각 중심과의 x 차이 */
  offset: number;
  /** 수평에서 기울어진 정도(rad) */
  tilt: number;
}
export type Quality = 'perfect' | 'stable' | 'shaky' | 'fell';

export function classify(p: Placement): Quality {
  if (p.fell) return 'fell';
  if (p.shake > SHAKE_LIMIT) return 'shaky';
  if (p.offset <= PERFECT_OFFSET && p.tilt <= PERFECT_TILT) return 'perfect';
  return 'stable';
}

/** 기본 점수(콤보 적용 전). 안정/완벽만 콤보가 이어짐 */
export function placementPoints(q: Quality): number {
  return q === 'perfect' ? PLACE_STABLE + PLACE_PERFECT_BONUS : q === 'stable' ? PLACE_STABLE : q === 'shaky' ? PLACE_SHAKY : 0;
}
export const keepsCombo = (q: Quality) => q === 'perfect' || q === 'stable';

/** 수평 기준 기울기: 가장 가까운 90° 배수와의 차이 */
export function tiltOf(angle: number): number {
  const q = Math.PI / 2;
  const r = ((angle % q) + q) % q;
  return Math.min(r, q - r);
}
