import type { Island } from '../types';

/** 월드는 가로 120 '도트' 고정. 화면에서는 정수 배율(scale)로 확대해 도트가 항상 선명합니다. */
export const WORLD_W = 120;
export const ISLAND_W = 72;
export const ISLAND_H = 56;
const PITCH = 74; // 섬 사이 세로 간격
const BOTTOM = 26; // 맨 아래 섬 아래 여백(표지판 자리)
const TOP = 30;

export interface PlacedIsland {
  island: Island;
  /** 섬 그림의 왼쪽 위 (도트 좌표) */
  x: number;
  y: number;
}

/** 월드 높이(도트). minH = 화면에 꽉 채우기 위한 최소 높이 */
export function worldHeight(count: number, minH: number): number {
  return Math.max(minH, count * PITCH + BOTTOM + TOP);
}

/** 아래 → 위로 좌우 지그재그 배치. island.pos 가 있으면 그 값(섬 중심)을 사용 */
export function placeIslands(islands: Island[], worldH: number): PlacedIsland[] {
  return islands.map((island, i) => {
    if (island.pos) {
      return { island, x: Math.round(island.pos.x - ISLAND_W / 2), y: Math.round(island.pos.y - ISLAND_H / 2) };
    }
    const cx = i % 2 === 0 ? 38 : 82;
    return { island, x: cx - ISLAND_W / 2, y: worldH - BOTTOM - ISLAND_H - i * PITCH };
  });
}
