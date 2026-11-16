/** 가짜 친구 찾기 스킨 슬롯 — 겉모습만. 칸(버튼)·판정은 기반 소유 */
import type { ComponentType } from 'react';
import type { Friend } from './logic';

export interface SpotSlots {
  Backdrop: ComponentType;
  /** 친구 한 명(칸을 채움). mirror 면 좌우 반전된 모습 */
  Friend: ComponentType<{ friend: Friend }>;
  Meter: ComponentType<{ found: number; goal: number; miss: number; maxMiss: number }>;
  Pop: ComponentType<{ kind: 'good' | 'quick' | 'bad'; text: string }>;
}
export const SPOT_SLOT_KEYS: (keyof SpotSlots)[] = ['Backdrop', 'Friend', 'Meter', 'Pop'];
