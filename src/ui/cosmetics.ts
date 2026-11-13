import type { CSSProperties } from 'react';
import { getItem } from '../platform/shop';
import type { PlayerData } from '../platform/types';

/** 장착한 테두리·배경을 프로필 초상화 스타일로(임시 CSS — 최종 픽셀 에셋으로 교체 예정) */
export function portraitStyle(p: PlayerData): CSSProperties {
  const frame = getItem(p.inventory.equipped.frame ?? 'frame-gold');
  const bg = getItem(p.inventory.equipped.background ?? 'bg-sky');
  const style: Record<string, string> = {};
  if (frame?.color) style['--frame'] = frame.color;
  if (bg?.color) {
    style['--bg1'] = bg.color;
    style['--bg2'] = bg.color2 ?? bg.color;
  }
  return style as CSSProperties;
}
export const titleName = (p: PlayerData): string | null => (p.inventory.equipped.title ? (getItem(p.inventory.equipped.title)?.name ?? null) : null);
