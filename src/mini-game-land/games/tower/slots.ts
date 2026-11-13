/**
 * 아슬아슬 탑의 '스킨 슬롯' — 겉모습만 담당합니다. 물리·입력·카메라·점수는 View/game 이 맡습니다.
 * 좌표 계약: 월드 단위(폭 180). 조각은 무게중심이 원점인 좌표계로 주어지고, 위치·회전은 기반이 적용합니다.
 */
import type { ComponentType } from 'react';
import type { PieceKind, Pt } from './pieces';

export interface TowerPieceView {
  kind: PieceKind;
  label: string;
  /** 무게중심 기준 볼록 다각형(충돌 모양과 같음) */
  points: readonly Pt[];
  /** 무게중심 기준 경계 상자 */
  bbox: { x0: number; y0: number; x1: number; y1: number };
  /** 1~3 무게 눈금 */
  weight: 1 | 2 | 3;
}

export interface TowerSlots {
  /** 하늘 배경(입력 없음). 카메라가 오르면 CSS 변수 --tw-climb(월드 단위)가 커짐 → 시차 이동에 사용 */
  Backdrop: ComponentType;
  /** 조각 겉모습. 원점 = 무게중심. 부모가 위치·회전(·확대)을 적용하므로 월드 단위로만 그리면 됨 */
  PieceArt: ComponentType<{ piece: TowerPieceView; ghost?: boolean }>;
  /** 접시(탁자). 윗면 y = 0, 가운데 x = 90, 폭 = width. 아래로 늘어난 다리 등은 자유 */
  PlateArt: ComponentType<{ width: number }>;
  /** 상단 정보: 높이 진행·남은 조각·떨어뜨린 수·교환 횟수 */
  Meter: ComponentType<{ height: number; goal: number; piecesLeft: number; budget: number; falls: number; maxFalls: number; swaps: number }>;
  /** 다음 조각 미리보기 */
  NextQueue: ComponentType<{ next: TowerPieceView[] }>;
  /** 놓기 평가 알림 */
  Feedback: ComponentType<{ kind: 'perfect' | 'stable' | 'shaky' | 'fell'; text: string; sub?: string }>;
  /** 바람 안내 (wind: -1(왼쪽) ~ 1(오른쪽)) */
  Notice: ComponentType<{ wind: number }>;
}

export const TOWER_SLOT_KEYS: (keyof TowerSlots)[] = ['Backdrop', 'PieceArt', 'PlateArt', 'Meter', 'NextQueue', 'Feedback', 'Notice'];
