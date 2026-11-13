/**
 * 편가르기 게임의 '스킨 슬롯' — 겉모습만 담당합니다. 판정·터치·애니메이션 타이밍은 View.tsx(기반)가 맡습니다.
 * 슬롯 컴포넌트는 부모 크기를 100% 채우고, 사용자 입력은 받지 않습니다(pointer-events 없음).
 */
import type { ComponentType } from 'react';
import type { Card, Rule } from './logic';

export interface SortSlots {
  /** 친구 캐릭터. 카드 크기는 스킨 토큰 --sc-card-w / --sc-card-h 로 정함 */
  Friend: ComponentType<{ card: Card }>;
  /** 규칙판(상단): 규칙 설명 + 조건 칩 + 심판 고나 */
  RulePanel: ComponentType<{ rule: Rule; reversed: boolean; hint: string; mood: 'idle' | 'oops' | 'happy' }>;
  /** 게임판(카드가 놀이는 영역) 배경 장식 — 입력 없음 */
  StageFrame: ComponentType<{ locked: boolean; reversed: boolean }>;
  /** 분류함 하나의 겉모습. 버튼(터치 영역·접근성)은 기반이 렌더 */
  BinFace: ComponentType<{ index: number; bins: number; label: string; locked: boolean }>;
  /** 진행(카드 n/N) · 실수 · 조작 안내 */
  InfoBar: ComponentType<{ index: number; goal: number; mistakes: number; maxMistakes: number; bins: number }>;
  /** 정답/오답 알림 */
  Feedback: ComponentType<{ kind: 'correct' | 'wrong'; text: string; sub?: string }>;
  /** 규칙 반전 예고 */
  Announce: ComponentType<{ title: string; sub: string }>;
}

export const SORT_SLOT_KEYS: (keyof SortSlots)[] = ['Friend', 'RulePanel', 'StageFrame', 'BinFace', 'InfoBar', 'Feedback', 'Announce'];
