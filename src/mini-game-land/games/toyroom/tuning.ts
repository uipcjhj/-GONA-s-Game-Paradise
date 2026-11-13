/**
 * 장난감방 — 난이도 설정값(튜닝 테이블). 숫자는 설계 출발값이며 최종값이 아닙니다.
 * 실제 플레이 테스트 후 이 표만 고치면 됩니다(규칙·생성기 코드는 그대로).
 * 조건: 선반수×칸수 − 잠긴칸 − 3×세트수 ≥ 1 (시작 상태에 놓을 자리가 있어야 함 — logic.test 가 검사)
 */
export interface ToyLevel {
  shelves: number;
  /** 선반 하나의 칸 수 */
  capacity: number;
  /** 완성해야 하는 세트 수(장난감 = 3 × 세트) */
  sets: number;
  /** 장난감 종류 수(최대 6) */
  types: number;
  /** 별 장난감(아무 종류) 수 */
  wilds: number;
  /** 고정 장난감(집을 수 없음, 세트에만 쓰임) 수 */
  fixed: number;
  /** 시작할 때 잠겨 있는 칸 수 — 세트를 정리할수록 열림 */
  locked: number;
  /** 세트 몇 개마다 칸 하나가 열리나 */
  unlockEvery: number;
  /** 세트 정리와 무관한 '준비' 이동 수(정답 풀이에 포함 → 생각해야 풀림) */
  relocations: number;
  /** 정답 풀이 길이 + slack = 이동 제한(작을수록 어려움) */
  slack: number;
  /** 되돌리기 횟수 */
  undo: number;
  /** 정답 풀이를 만들 때 쓰는 패턴 비율: 단일(맨 끝에 놓아 완성) / 빼기(가운데를 빼서 완성) / 쌍(한 번에 두 곳 정리) / 연쇄(같은 선반 캐스케이드, 칸 7↑ 필요) */
  mix: { single: number; source: number; double: number; cascade: number };
}

const mix = (single: number, source: number, double: number, cascade = 0) => ({ single, source, double, cascade });

export const TOY_LEVELS: ToyLevel[] = [
  // L1~2 배우기: 같은 종류를 모아 세트 만들기
  { shelves: 3, capacity: 4, sets: 2, types: 2, wilds: 0, fixed: 0, locked: 0, unlockEvery: 1, relocations: 0, slack: 6, undo: 3, mix: mix(1, 0, 0) },
  { shelves: 3, capacity: 4, sets: 3, types: 3, wilds: 0, fixed: 0, locked: 0, unlockEvery: 1, relocations: 1, slack: 6, undo: 3, mix: mix(0.7, 0.3, 0) },
  // L3 별 장난감 · 가운데를 빼서 완성하기 · 한 번에 두 곳 정리
  { shelves: 4, capacity: 4, sets: 4, types: 3, wilds: 1, fixed: 0, locked: 0, unlockEvery: 1, relocations: 0, slack: 6, undo: 3, mix: mix(0.5, 0.3, 0.2) },
  // L4 잠긴 칸(세트를 정리하면 열림)
  { shelves: 5, capacity: 4, sets: 5, types: 4, wilds: 1, fixed: 0, locked: 2, unlockEvery: 1, relocations: 2, slack: 4, undo: 3, mix: mix(0.4, 0.35, 0.25) },
  // L5 고정 장난감
  { shelves: 5, capacity: 5, sets: 6, types: 4, wilds: 1, fixed: 1, locked: 2, unlockEvery: 1, relocations: 2, slack: 4, undo: 2, mix: mix(0.4, 0.3, 0.3) },
  // L6~8 중간: 종류·특수 장난감·잠긴 칸이 늘고 이동 여유가 줄어듦
  { shelves: 5, capacity: 6, sets: 7, types: 5, wilds: 1, fixed: 1, locked: 5, unlockEvery: 1, relocations: 2, slack: 4, undo: 2, mix: mix(0.35, 0.35, 0.3) },
  { shelves: 6, capacity: 5, sets: 8, types: 5, wilds: 2, fixed: 2, locked: 3, unlockEvery: 1, relocations: 3, slack: 4, undo: 2, mix: mix(0.3, 0.35, 0.35) },
  { shelves: 6, capacity: 6, sets: 9, types: 6, wilds: 2, fixed: 2, locked: 4, unlockEvery: 1, relocations: 4, slack: 3, undo: 2, mix: mix(0.3, 0.35, 0.35) },
  // L9~10 도전: 자리가 빠듯하고 이동 여유가 거의 없음
  { shelves: 6, capacity: 6, sets: 10, types: 6, wilds: 2, fixed: 3, locked: 3, unlockEvery: 1, relocations: 3, slack: 2, undo: 1, mix: mix(0.3, 0.35, 0.35) },
  { shelves: 6, capacity: 6, sets: 10, types: 6, wilds: 2, fixed: 3, locked: 2, unlockEvery: 1, relocations: 4, slack: 1, undo: 1, mix: mix(0.25, 0.35, 0.4) },
];
