/**
 * 간식 받아라 '스킨 슬롯' — 겉모습만. 판정(바구니 폭·낙하 위치)은 logic.ts 가 가지며 슬롯은 입력을 받지 않음.
 * 좌표는 View 가 월드 단위 → 화면 px 로 바꿔 배치하고, 슬롯은 주어진 상자를 채우기만 함.
 */
import type { ComponentType } from 'react';
import type { ItemKind } from './logic';

export interface CatchSlots {
  /** 배경(하늘·바닥) */
  Backdrop: ComponentType;
  /** 고나 + 바구니. mood: 받음/실수 순간 표정 */
  Catcher: ComponentType<{ mood: 'idle' | 'happy' | 'oops' }>;
  /** 떨어지는 물건 한 개 (부모 상자를 채움) */
  Item: ComponentType<{ kind: ItemKind }>;
  /** 상단 정보: 받은 수/목표 · 실수 */
  Meter: ComponentType<{ caught: number; goal: number; miss: number; maxMiss: number }>;
  /** 받거나 놓친 자리에 뜨는 짧은 글자(+100, 매워!) */
  Pop: ComponentType<{ kind: 'good' | 'bad' | 'star'; text: string }>;
}
export const CATCH_SLOT_KEYS: (keyof CatchSlots)[] = ['Backdrop', 'Catcher', 'Item', 'Meter', 'Pop'];
