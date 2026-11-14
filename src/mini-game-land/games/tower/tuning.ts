/**
 * 아슬아슬 탑 — 난이도 설정값(튜닝 테이블).
 * 숫자는 헤드리스 봇 측정(docs/mini-game-land/M3-TOWER.md)으로 잡은 '출발값'이며 최종값이 아닙니다.
 * 실제 플레이 테스트 후 이 파일의 표만 고치면 됩니다(코드·물리는 건드리지 않음).
 */
import type { PieceKind } from './pieces';

export interface LevelTuning {
  /** 목표 높이(월드 단위) */
  goalH: number;
  /** 접시 폭 */
  plateW: number;
  /** 사용할 수 있는 조각 수 */
  budget: number;
  /** 이만큼 떨어뜨리면 실패 */
  maxFalls: number;
  /** 등장 간식 */
  pool: PieceKind[];
  /** 간식별 등장 비율(기본 1). 새 간식을 서서히 늘릴 때 사용 */
  weights?: Partial<Record<PieceKind, number>>;
  /** 다음 조각과 교환 횟수 */
  swaps: number;
  /** 미리 보기 개수 */
  preview: number;
  /** 낙하 안내선 · 무게중심 표시 */
  guide: boolean;
  showCom: boolean;
  /** 조각이 무작위 방향으로 나옴 */
  randomAngle: boolean;
  /** 마찰 배율(미끄러움 < 1) */
  frictionMul: number;
  /** 바람 세기 배율(0 = 없음, 1 = 기준 바람) */
  wind: number;
}

const P1: PieceKind[] = ['toast', 'macaron', 'pudding'];
const P2: PieceKind[] = [...P1, 'cake'];
const P3: PieceKind[] = [...P2, 'banana'];
const P4: PieceKind[] = [...P3, 'cone'];
const P5: PieceKind[] = [...P4, 'donut'];
const P6: PieceKind[] = [...P5, 'slice'];

const base = { swaps: 3, preview: 2, guide: true, showCom: true, randomAngle: false, frictionMul: 1, wind: 0, maxFalls: 4 };

/**
 * 곡선 설계 의도
 *  L1~4  배우기: 평평한 간식 → 무거운 것 → 얇은 것 → 뾰족한 것(+방향 무작위). 도움 장치 풀가동.
 *  L5~8  중간: 도넛 → 쐐기(가중치로 서서히) → 무게중심 표시 끔 → 안내선 끔. 기회는 L7까지 4번.
 *  L9~10 도전: 바람(떨어지는 조각만) · 미끄러움 · 교환 1번 · 기회 3번.
 */
export const TOWER_LEVELS: LevelTuning[] = [
  { ...base, goalH: 70, plateW: 124, budget: 10, pool: P1 },
  { ...base, goalH: 82, plateW: 121, budget: 11, pool: P2 },
  { ...base, goalH: 94, plateW: 118, budget: 12, pool: P3 },
  { ...base, goalH: 106, plateW: 115, budget: 13, pool: P4, randomAngle: true },
  { ...base, goalH: 116, plateW: 112, budget: 13, pool: P5, randomAngle: true, guide: false, preview: 1, swaps: 2 },
  { ...base, goalH: 126, plateW: 110, budget: 15, pool: P6, weights: { slice: 0.35 }, randomAngle: true, guide: false, preview: 1, swaps: 2 },
  { ...base, goalH: 136, plateW: 107, budget: 15, pool: P6, weights: { slice: 0.65 }, randomAngle: true, guide: false, showCom: false, preview: 1, swaps: 2 },
  { ...base, goalH: 142, plateW: 104, budget: 16, pool: P6, weights: { slice: 0.85 }, randomAngle: true, guide: false, showCom: false, preview: 1, swaps: 2 },
  { ...base, goalH: 156, plateW: 101, budget: 16, pool: P6, randomAngle: true, guide: false, showCom: false, preview: 1, swaps: 1, maxFalls: 3, wind: 1, frictionMul: 0.92 },
  { ...base, goalH: 170, plateW: 98, budget: 17, pool: P6, randomAngle: true, guide: false, showCom: false, preview: 1, swaps: 1, maxFalls: 3, wind: 1.6, frictionMul: 0.88 },
];
