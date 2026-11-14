/**
 * 장난감방의 '스킨 슬롯' — 겉모습만 담당합니다. 규칙·입력·선택·애니메이션 타이밍은 View/game 이 맡습니다.
 * 슬롯은 부모 크기를 100% 채우고 입력을 받지 않습니다(pointer-events 없음).
 */
import type { ComponentType } from 'react';

export interface ToyView {
  /** 종류 0..5 (별 장난감은 -1) */
  type: number;
  wild: boolean;
  /** 고정(집을 수 없음) */
  fixed: boolean;
}

export interface ToyRoomSlots {
  /** 방 배경 */
  Backdrop: ComponentType;
  /** 선반 한 줄의 틀. capacity=칸 수, locked=아직 잠긴 칸 수(오른쪽 끝부터). 칸 격자는 기반이 위에 얹음 */
  ShelfFrame: ComponentType<{ index: number; capacity: number; locked: number; state: 'idle' | 'source' | 'target' | 'blocked' }>;
  /** 장난감 한 개 */
  ToyArt: ComponentType<{ toy: ToyView; state: 'idle' | 'lifted' | 'pop' }>;
  /** 상단 정보: 남은 이동·정리한 세트·되돌리기 */
  Meter: ComponentType<{ movesLeft: number; limit: number; par: number; sets: number; total: number; undoLeft: number }>;
  /** 알림(정리·연쇄·잠김·고정 등) */
  Feedback: ComponentType<{ kind: 'set' | 'chain' | 'info' | 'warn'; text: string; sub?: string }>;
}

export const TOYROOM_SLOT_KEYS: (keyof ToyRoomSlots)[] = ['Backdrop', 'ShelfFrame', 'ToyArt', 'Meter', 'Feedback'];
