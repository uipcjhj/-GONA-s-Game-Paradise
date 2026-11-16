/** 줄넘기 스킨 슬롯 — 겉모습만. 판정·박자·입력은 logic/View 소유, 슬롯은 입력을 받지 않음 */
import type { ComponentType } from 'react';

export interface JumpSlots {
  Backdrop: ComponentType;
  /** 줄 돌리는 친구(왼쪽·오른쪽). 부모 상자를 채움 */
  Turner: ComponentType<{ side: 'left' | 'right'; phase: number }>;
  /** 줄 한 가닥: View 가 그린 경로(SVG path d, 월드 좌표)를 받아 선 모양만 정함 */
  Rope: ComponentType<{ d: string; front: boolean; warn: boolean }>;
  /** 점프하는 고나. lift 0~1(높이), mood */
  Jumper: ComponentType<{ lift: number; mood: 'idle' | 'happy' | 'oops' }>;
  Meter: ComponentType<{ ok: number; goal: number; miss: number; maxMiss: number; perfect: number }>;
  /** PERFECT / GOOD / MISS 판정 글자, 박자 예고(빨라져요·느려져요·두 번!) */
  Pop: ComponentType<{ kind: 'perfect' | 'good' | 'miss' | 'cue'; text: string }>;
}
export const JUMP_SLOT_KEYS: (keyof JumpSlots)[] = ['Backdrop', 'Turner', 'Rope', 'Jumper', 'Meter', 'Pop'];
