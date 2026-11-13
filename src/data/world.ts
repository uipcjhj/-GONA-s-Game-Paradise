import type { Point } from '../types';

/** 최종 확정 월드맵 이미지. 모든 좌표(섬 · 다리 · 고나)는 이 이미지의 픽셀 기준 → 화면 크기가 바뀌어도 자동 보정 */
export const WORLD = {
  image: './assets/gona-world-map.png',
  w: 1086,
  h: 1448,
  /** 이미지 가장자리 바다색 (여백 채움) */
  sea: '#1daefd',
} as const;

/** 중앙 광장 — 고나의 시작 위치 */
export const PLAZA: Point = { x: 545, y: 835 };
export const PLAZA_HIT = { x: 300, y: 600, w: 490, h: 350 };

/** 고나 스프라이트(27×34, Food Adventure 원본) 를 월드 좌표로 그릴 때의 배율 */
export const GONA = { w: 27, h: 34, scale: 4 };
