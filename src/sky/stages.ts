/**
 * GONA's Sky Adventure — 스테이지 · 적 · 보스 · 난이도 데이터
 * 엔진(engine.ts)은 이 데이터를 읽어 실행만 함. 편대·패턴 조정은 이 파일에서.
 *
 * ※ 스테이지 2~6 의 배경·적·보스 그림은 [임시 에셋](스테이지 1 승인 에셋 색변환본, public/assets/sky/v2/temp/)
 *    정식 원화 요청서: docs/sky-art/asset-requests.md
 */
import type { BgmName } from './audio';

export type Difficulty = 'easy' | 'normal' | 'hard';
export interface DiffDef {
  name: string;
  /** 적 탄 속도 · 탄 수 · 발사 간격 · 적 체력 · 보스 체력 배율 */
  bspd: number;
  dens: number;
  cd: number;
  ehp: number;
  bhp: number;
  bombs: number;
  desc: string;
}
export const DIFF: Record<Difficulty, DiffDef> = {
  easy: { name: 'EASY', bspd: 0.7, dens: 0.6, cd: 1.45, ehp: 0.75, bhp: 0.7, bombs: 4, desc: '슈팅게임 입문용 · 느린 탄, 적은 탄막' },
  normal: { name: 'NORMAL', bspd: 0.9, dens: 0.85, cd: 1.1, ehp: 1, bhp: 1, bombs: 3, desc: '연습하면 클리어 · 기본 난이도' },
  hard: { name: 'HARD', bspd: 1.06, dens: 1.15, cd: 0.88, ehp: 1.15, bhp: 1.2, bombs: 2, desc: '패턴 숙지 필수 · 빽빽한 탄막' },
};

// ───────── 적 ─────────
export type ArtName =
  | 'bg-backdrop' | 'island-castle' | 'island-ruins' | 'island-small' | 'island-tower' | 'clocktower' | 'airship' | 'cloud-big' | 'cloud-small'
  | 'enemy-drone' | 'enemy-fighter' | 'enemy-orb' | 'enemy-wyvern' | 'enemy-gunship' | 'boss';
export const ART_NAMES: ArtName[] = ['bg-backdrop', 'island-castle', 'island-ruins', 'island-small', 'island-tower', 'clocktower', 'airship', 'cloud-big', 'cloud-small', 'enemy-drone', 'enemy-fighter', 'enemy-orb', 'enemy-wyvern', 'enemy-gunship', 'boss'];

export type EnemyName = 'drone' | 'fighter' | 'wyvern' | 'orb' | 'gunship';
export type Move = 'sine' | 'strafe' | 'swarm' | 'dive' | 'turret' | 'heavy' | 'hold' | 'zig' | 'loop' | 'snake';
export type Fire = 'aim1' | 'aim3' | 'needle2' | 'fireball' | 'ring' | 'gun' | 'spread5' | 'snipe' | 'curtain' | 'spiralMini' | 'none';
export interface EnemyDef { art: ArtName; hp: number; hr: number; score: number; fire: Fire; cd: [number, number] }
export const ENEMIES: Record<EnemyName, EnemyDef> = {
  drone: { art: 'enemy-drone', hp: 4, hr: 9, score: 100, fire: 'aim3', cd: [1.8, 2.8] },
  fighter: { art: 'enemy-fighter', hp: 3, hr: 9, score: 120, fire: 'needle2', cd: [1.3, 2.0] },
  wyvern: { art: 'enemy-wyvern', hp: 6, hr: 10, score: 150, fire: 'fireball', cd: [0.6, 0.9] },
  orb: { art: 'enemy-orb', hp: 16, hr: 11, score: 400, fire: 'ring', cd: [1.5, 1.7] },
  gunship: { art: 'enemy-gunship', hp: 46, hr: 17, score: 1200, fire: 'gun', cd: [1.4, 1.6] },
};

export interface Wave {
  e: EnemyName;
  n: number;
  move: Move;
  gap?: number;
  x0?: number;
  x1?: number;
  dir?: number;
  y?: number;
  fire?: Fire;
  /** 이 편대의 마지막 기체가 떨어뜨릴 아이템 */
  drop?: 'star' | 'banana' | 'strawberry' | 'cookie';
}
export type Step =
  | { wait: number }
  | { wave: Wave }
  | { midboss: true }
  | { warning: true }
  | { boss: true }
  | { item: 'star' | 'banana' | 'strawberry'; x: number }
  | { banner: string; sub?: string };

// ───────── 보스 ─────────
export type Attack =
  | 'fan' | 'aimBurst' | 'ringPulse' | 'ring' | 'spiral2' | 'spiral3' | 'spiral4' | 'crossSpiral' | 'dash' | 'rain' | 'flower' | 'flowerFast'
  | 'wallGap' | 'laserAim' | 'laserSweep' | 'laserCross' | 'homing' | 'curtain' | 'snipeRain' | 'gatling' | 'bubbleRings' | 'waveCurtain' | 'sporeRain';
export interface PartDef { art: ArtName; dx: number; dy: number; hp: number; hr: number; k: number; fire: 'aim' | 'ring' | 'needle' | 'homing'; cd: number }
export interface BossDef {
  name: string;
  art: ArtName;
  /** 그림 배율 (2배 격자 기준 0.5 = 원래 크기) */
  k: number;
  /** 2프레임 시트(정상 · 파손)인지 */
  frames: 1 | 2;
  hp: number;
  hr: number;
  restY: number;
  weak?: { dx: number; dy: number; r: number };
  parts: PartDef[];
  /** 부품이 모두 파괴되기 전에는 본체가 받는 피해 배율 */
  shielded?: number;
  phases: Attack[][];
  move: 'sway' | 'figure8' | 'center' | 'drift';
  /** 탄 모양 (보스별 개성) */
  bullet: 'heart' | 'flask' | 'smell' | 'wave' | 'ring' | 'needle' | 'fire';
  /** 파츠 위 덮어 그릴 핵 (최종 보스) */
  core?: { art: ArtName; k: number; dy: number };
  mid?: boolean;
  intro: string;
}

export interface StageDef {
  id: number;
  name: string;
  sub: string;
  art: 'stage1' | 's2' | 's3' | 's4' | 's5' | 's6';
  temp: boolean;
  bgm: BgmName;
  bossBgm: BgmName;
  fx: 'none' | 'spores' | 'steam' | 'bubbles' | 'embers' | 'storm';
  props: [number, ArtName, number, number, number][];
  midboss: BossDef;
  boss: BossDef;
  script: Step[];
  story: string;
}

// ───────── 스크립트 도우미 ─────────
function build(f: (w: (s: number) => void, v: (e: EnemyName, n: number, move: Move, o?: Partial<Wave>) => void, s: Step[]) => void): Step[] {
  const s: Step[] = [];
  f((t) => s.push({ wait: t }), (e, n, move, o = {}) => s.push({ wave: { e, n, move, ...o } }), s);
  return s;
}

const PROPS_SKY: StageDef['props'] = [
  [0, 'island-castle', 1, 0.08, 0], [2, 'cloud-small', 0, 0.78, 0], [5, 'island-small', 0, 0.88, 0], [8, 'cloud-big', 2, 0.15, 0],
  [11, 'island-ruins', 1, 0.95, 0], [16, 'clocktower', 1, 0.06, 0], [19, 'cloud-small', 0, 0.25, 0], [23, 'airship', 1, 1.05, -7],
  [28, 'island-tower', 1, -0.02, 0], [31, 'cloud-big', 2, 0.88, 0], [35, 'island-small', 0, 0.15, 0], [39, 'island-castle', 1, 1.0, 0],
  [44, 'cloud-big', 2, 0.3, 0], [48, 'clocktower', 1, 0.98, 0], [52, 'cloud-small', 0, 0.6, 0], [56, 'island-ruins', 1, 0.02, 0],
];
const PROPS_FOREST: StageDef['props'] = [
  [0, 'island-ruins', 1, 0.05, 0], [3, 'island-small', 0, 0.85, 0], [6, 'cloud-big', 2, 0.8, 0], [9, 'island-tower', 1, 0.92, 0],
  [14, 'island-small', 0, 0.2, 0], [18, 'island-ruins', 1, 0.0, 0], [24, 'cloud-small', 2, 0.4, 0], [27, 'island-small', 0, 0.7, 0],
  [32, 'island-tower', 1, 0.04, 0], [38, 'island-ruins', 1, 0.97, 0], [44, 'cloud-big', 2, 0.15, 0], [50, 'island-small', 0, 0.5, 0],
];
const PROPS_MACHINE: StageDef['props'] = [
  [0, 'clocktower', 1, 0.06, 0], [4, 'airship', 1, 1.05, -9], [8, 'clocktower', 1, 0.95, 0], [12, 'cloud-small', 0, 0.4, 0],
  [17, 'airship', 1, -0.05, 8], [21, 'island-tower', 1, 0.0, 0], [26, 'clocktower', 1, 0.97, 0], [31, 'cloud-big', 2, 0.6, 0],
  [36, 'airship', 1, 1.05, -6], [41, 'clocktower', 1, 0.04, 0], [47, 'island-castle', 1, 0.95, 0], [53, 'airship', 1, -0.05, 7],
];
const PROPS_SEA: StageDef['props'] = [
  [0, 'island-ruins', 1, 0.95, 0], [5, 'cloud-small', 0, 0.3, 0], [10, 'island-small', 0, 0.1, 0], [15, 'island-ruins', 1, 0.0, 0],
  [21, 'cloud-small', 0, 0.75, 0], [26, 'island-tower', 1, 0.96, 0], [33, 'island-small', 0, 0.5, 0], [39, 'island-ruins', 1, 0.06, 0],
  [46, 'cloud-small', 0, 0.2, 0], [52, 'island-tower', 1, 0.0, 0],
];
const PROPS_MOON: StageDef['props'] = [
  [0, 'island-castle', 1, 0.95, 0], [5, 'cloud-big', 2, 0.2, 0], [9, 'island-ruins', 1, 0.04, 0], [14, 'clocktower', 1, 0.96, 0],
  [20, 'cloud-big', 2, 0.75, 0], [25, 'island-ruins', 1, 0.98, 0], [30, 'island-tower', 1, 0.02, 0], [36, 'cloud-small', 0, 0.5, 0],
  [42, 'island-castle', 1, 0.05, 0], [49, 'cloud-big', 2, 0.85, 0],
];
const PROPS_CASTLE: StageDef['props'] = [
  [0, 'island-castle', 1, 0.05, 0], [6, 'island-castle', 1, 0.95, 0], [11, 'cloud-big', 2, 0.5, 0], [16, 'clocktower', 1, 0.03, 0],
  [22, 'island-tower', 1, 0.97, 0], [27, 'cloud-big', 2, 0.2, 0], [33, 'island-castle', 1, 0.98, 0], [39, 'airship', 1, -0.05, 9],
  [45, 'island-ruins', 1, 0.02, 0], [51, 'cloud-big', 2, 0.8, 0],
];

// ═══════════ STAGE 1 — 황혼의 부유왕국 ═══════════
const S1 = build((w, v, s) => {
  s.push({ banner: 'STAGE 1', sub: '황혼의 부유왕국' });
  w(2.5);
  v('drone', 5, 'sine', { gap: 0.3, x0: 30, x1: 150 }); w(3.2);
  v('fighter', 4, 'strafe', { gap: 0.45, dir: 1, y: 40 }); w(3);
  v('fighter', 4, 'strafe', { gap: 0.45, dir: -1, y: 56, drop: 'star' }); w(3.5);
  v('orb', 1, 'turret', { x0: 40, x1: 40 }); v('orb', 1, 'turret', { x0: 140, x1: 140 }); w(5);
  v('drone', 6, 'zig', { gap: 0.35, x0: 25, x1: 155 }); w(4);
  v('gunship', 1, 'heavy', { x0: 90, x1: 90, drop: 'star' }); w(4);
  v('wyvern', 6, 'dive', { gap: 0.45, x0: 30, x1: 150 }); w(4.5);
  v('drone', 8, 'swarm', { gap: 0.2, x0: 20, x1: 160 }); w(3.5);
  v('fighter', 5, 'loop', { gap: 0.35, dir: 1 }); w(3);
  v('fighter', 5, 'loop', { gap: 0.35, dir: -1, drop: 'banana' }); w(4);
  // 패턴 변화: 양쪽 고리 비행 + 포탑 사이 돌파
  v('wyvern', 4, 'loop', { gap: 0.4, dir: 1 }); v('wyvern', 4, 'loop', { gap: 0.4, dir: -1 }); w(4);
  v('orb', 2, 'turret', { gap: 0.3, x0: 30, x1: 150, fire: 'ring' }); v('drone', 6, 'zig', { gap: 0.3, x0: 40, x1: 140 }); w(5);
  v('fighter', 6, 'snake', { gap: 0.25, dir: -1, y: 44 }); w(3);
  v('drone', 8, 'hold', { gap: 0.12, x0: 20, x1: 160, y: 56, fire: 'aim1', drop: 'star' }); w(5.5);
  v('gunship', 1, 'heavy', { x0: 90, x1: 90 }); v('fighter', 4, 'strafe', { gap: 0.4, dir: 1, y: 30 }); w(6);
  s.push({ midboss: true });
  w(2);
  s.push({ item: 'strawberry', x: 90 });
  v('drone', 7, 'sine', { gap: 0.26, x0: 20, x1: 160 }); w(2.5);
  v('orb', 1, 'turret', { x0: 90, x1: 90, fire: 'spiralMini' }); w(3);
  v('fighter', 4, 'strafe', { gap: 0.4, dir: 1, y: 34 }); v('fighter', 4, 'strafe', { gap: 0.4, dir: -1, y: 70 }); w(4.5);
  v('gunship', 1, 'heavy', { x0: 50, x1: 50 }); v('gunship', 1, 'heavy', { x0: 130, x1: 130, dir: -1, drop: 'star' }); w(6);
  v('wyvern', 5, 'dive', { gap: 0.45, x0: 20, x1: 160 }); w(3);
  v('drone', 9, 'swarm', { gap: 0.2, x0: 15, x1: 165 }); w(3);
  v('drone', 10, 'swarm', { gap: 0.16, x0: 12, x1: 168 }); w(3);
  v('orb', 3, 'turret', { gap: 0.5, x0: 30, x1: 150, fire: 'spiralMini' }); w(4);
  v('wyvern', 6, 'dive', { gap: 0.35, x0: 20, x1: 160, drop: 'banana' }); w(4);
  v('gunship', 2, 'heavy', { gap: 1, x0: 45, x1: 135 }); w(7);
  v('fighter', 6, 'snake', { gap: 0.25, dir: 1, y: 50 }); w(5);
  s.push({ warning: true }, { boss: true });
});

// ═══════════ STAGE 2 — 마법의 버섯숲 ═══════════
const S2 = build((w, v, s) => {
  s.push({ banner: 'STAGE 2', sub: '마법의 버섯숲' });
  w(2.5);
  v('drone', 6, 'zig', { gap: 0.32, x0: 20, x1: 160, fire: 'aim1' }); w(3);
  v('orb', 1, 'turret', { x0: 50, x1: 50, fire: 'spiralMini' }); v('orb', 1, 'turret', { x0: 130, x1: 130, fire: 'spiralMini' }); w(4.5);
  v('wyvern', 5, 'loop', { gap: 0.4, dir: 1 }); w(3);
  v('wyvern', 5, 'loop', { gap: 0.4, dir: -1, drop: 'star' }); w(4);
  v('drone', 10, 'swarm', { gap: 0.16, x0: 15, x1: 165, fire: 'aim1' }); w(3.5);
  v('gunship', 1, 'heavy', { x0: 90, x1: 90, fire: 'spread5' }); w(3);
  v('fighter', 6, 'hold', { gap: 0.2, x0: 25, x1: 155, y: 60, fire: 'aim3' }); w(5);
  // 패턴 변화: 포자 드론 지그재그 + 마법꽃 포탑
  v('drone', 8, 'zig', { gap: 0.25, x0: 20, x1: 160, fire: 'aim3' }); v('orb', 1, 'turret', { x0: 90, x1: 90, fire: 'spiralMini' }); w(5);
  v('wyvern', 7, 'dive', { gap: 0.35, x0: 15, x1: 165 }); w(3.5);
  v('fighter', 5, 'loop', { gap: 0.35, dir: 1 }); v('drone', 6, 'sine', { gap: 0.3, x0: 30, x1: 150, drop: 'star' }); w(5);
  v('gunship', 1, 'heavy', { x0: 60, x1: 60, fire: 'spread5' }); v('orb', 2, 'turret', { gap: 0.3, x0: 120, x1: 160, fire: 'ring' }); w(7);
  v('orb', 3, 'turret', { gap: 0.6, x0: 30, x1: 150, fire: 'ring', drop: 'banana' }); w(5);
  s.push({ midboss: true });
  w(2);
  s.push({ item: 'strawberry', x: 90 });
  v('wyvern', 8, 'dive', { gap: 0.35, x0: 15, x1: 165 }); w(3.5);
  v('drone', 7, 'snake', { gap: 0.24, dir: -1, y: 44, fire: 'aim3' }); w(3);
  v('orb', 2, 'turret', { gap: 0.4, x0: 45, x1: 135, fire: 'spiralMini', drop: 'star' }); w(4);
  v('fighter', 6, 'loop', { gap: 0.3, dir: 1 }); v('fighter', 6, 'loop', { gap: 0.3, dir: -1 }); w(5);
  v('gunship', 1, 'heavy', { x0: 45, x1: 45, fire: 'spread5' }); v('gunship', 1, 'heavy', { x0: 135, x1: 135, dir: -1 }); w(6);
  v('orb', 4, 'turret', { gap: 0.4, x0: 25, x1: 155, fire: 'spiralMini' }); w(5);
  v('wyvern', 5, 'loop', { gap: 0.35, dir: -1 }); v('fighter', 6, 'hold', { gap: 0.2, x0: 30, x1: 150, y: 50, fire: 'aim3' }); w(6);
  v('drone', 9, 'zig', { gap: 0.2, x0: 15, x1: 165, fire: 'aim1', drop: 'banana' }); w(4);
  v('drone', 12, 'swarm', { gap: 0.15, x0: 10, x1: 170, fire: 'aim1' }); w(4);
  s.push({ warning: true }, { boss: true });
});

// ═══════════ STAGE 3 — 기계도시의 역습 ═══════════
const S3 = build((w, v, s) => {
  s.push({ banner: 'STAGE 3', sub: '기계도시의 역습' });
  w(2.5);
  v('fighter', 7, 'snake', { gap: 0.22, dir: 1, y: 40, fire: 'aim1' }); w(3.5);
  v('fighter', 7, 'snake', { gap: 0.22, dir: -1, y: 70, fire: 'aim1' }); w(4);
  v('orb', 3, 'turret', { gap: 0.4, x0: 35, x1: 145, fire: 'curtain' }); w(6);
  v('gunship', 1, 'heavy', { x0: 60, x1: 60 }); v('gunship', 1, 'heavy', { x0: 120, x1: 120, dir: -1, drop: 'star' }); w(5);
  v('drone', 8, 'hold', { gap: 0.15, x0: 20, x1: 160, y: 50, fire: 'snipe' }); w(5);
  v('wyvern', 6, 'dive', { gap: 0.35, x0: 20, x1: 160 }); w(3);
  // 패턴 변화: 공장 생산 라인 — 줄지은 포탑 + 뱀 편대
  v('orb', 2, 'turret', { gap: 0.3, x0: 40, x1: 140, fire: 'curtain' }); v('fighter', 6, 'snake', { gap: 0.24, dir: 1, y: 76, fire: 'aim1' }); w(5);
  v('gunship', 1, 'heavy', { x0: 90, x1: 90, fire: 'spread5', drop: 'star' }); w(4);
  v('drone', 8, 'zig', { gap: 0.22, x0: 20, x1: 160, fire: 'aim1' }); v('wyvern', 4, 'loop', { gap: 0.4, dir: -1 }); w(5);
  v('fighter', 6, 'loop', { gap: 0.3, dir: 1, fire: 'needle2' }); w(5);
  v('fighter', 6, 'strafe', { gap: 0.3, dir: 1, y: 36, fire: 'needle2' }); v('fighter', 6, 'strafe', { gap: 0.3, dir: -1, y: 64, fire: 'needle2', drop: 'banana' }); w(5);
  s.push({ midboss: true });
  w(2);
  s.push({ item: 'strawberry', x: 90 });
  v('gunship', 1, 'heavy', { x0: 90, x1: 90, fire: 'spread5' }); w(3);
  v('orb', 2, 'turret', { gap: 0.3, x0: 30, x1: 150, fire: 'curtain' }); w(4);
  v('drone', 10, 'zig', { gap: 0.2, x0: 15, x1: 165, fire: 'aim3' }); w(4);
  v('fighter', 8, 'loop', { gap: 0.22, dir: 1, drop: 'star' }); w(3.5);
  v('gunship', 3, 'heavy', { gap: 1.2, x0: 35, x1: 145 }); w(8);
  v('orb', 3, 'turret', { gap: 0.4, x0: 30, x1: 150, fire: 'spiralMini' }); v('fighter', 5, 'strafe', { gap: 0.3, dir: -1, y: 40 }); w(6);
  v('wyvern', 7, 'dive', { gap: 0.3, x0: 15, x1: 165, drop: 'banana' }); w(4);
  v('drone', 8, 'hold', { gap: 0.15, x0: 20, x1: 160, y: 46, fire: 'snipe' }); w(5);
  s.push({ warning: true }, { boss: true });
});

// ═══════════ STAGE 4 — 별빛의 심해 ═══════════
const S4 = build((w, v, s) => {
  s.push({ banner: 'STAGE 4', sub: '별빛의 심해' });
  w(2.5);
  v('orb', 3, 'turret', { gap: 0.8, x0: 40, x1: 140, fire: 'ring' }); w(4);
  v('wyvern', 6, 'loop', { gap: 0.45, dir: -1, fire: 'aim1' }); w(4);
  v('drone', 8, 'sine', { gap: 0.3, x0: 20, x1: 160, fire: 'aim3' }); w(3.5);
  v('wyvern', 6, 'loop', { gap: 0.45, dir: 1, fire: 'aim1', drop: 'star' }); w(4);
  v('gunship', 1, 'heavy', { x0: 90, x1: 90, fire: 'spread5' }); w(3);
  v('orb', 4, 'turret', { gap: 0.5, x0: 25, x1: 155, fire: 'spiralMini' }); w(6);
  // 패턴 변화: 해파리 포탑 사이를 헤엄치는 심해 비룡 떼
  v('orb', 2, 'turret', { gap: 0.4, x0: 50, x1: 130, fire: 'spiralMini' }); v('wyvern', 6, 'loop', { gap: 0.4, dir: 1 }); w(6);
  v('fighter', 6, 'snake', { gap: 0.25, dir: -1, y: 48, fire: 'aim1', drop: 'star' }); w(4);
  v('drone', 8, 'hold', { gap: 0.14, x0: 20, x1: 160, y: 52, fire: 'aim3' }); w(5);
  v('gunship', 1, 'heavy', { x0: 90, x1: 90, fire: 'gun' }); v('wyvern', 4, 'dive', { gap: 0.5, x0: 30, x1: 150 }); w(6);
  v('drone', 10, 'zig', { gap: 0.22, x0: 15, x1: 165, fire: 'aim1', drop: 'banana' }); w(4);
  s.push({ midboss: true });
  w(2);
  s.push({ item: 'strawberry', x: 90 });
  v('wyvern', 9, 'dive', { gap: 0.32, x0: 15, x1: 165 }); w(3.5);
  v('orb', 2, 'turret', { gap: 0.4, x0: 55, x1: 125, fire: 'ring' }); w(2);
  v('fighter', 7, 'snake', { gap: 0.22, dir: 1, y: 54, fire: 'needle2' }); w(4.5);
  v('gunship', 2, 'heavy', { gap: 1.5, x0: 50, x1: 130, fire: 'spread5', drop: 'star' }); w(7);
  v('wyvern', 6, 'loop', { gap: 0.35, dir: 1 }); v('wyvern', 6, 'loop', { gap: 0.35, dir: -1 }); w(5);
  v('orb', 4, 'turret', { gap: 0.5, x0: 25, x1: 155, fire: 'ring' }); w(5);
  v('fighter', 6, 'loop', { gap: 0.3, dir: -1, fire: 'aim1', drop: 'banana' }); v('drone', 6, 'zig', { gap: 0.3, x0: 30, x1: 150 }); w(5);
  v('drone', 12, 'swarm', { gap: 0.14, x0: 10, x1: 170, fire: 'aim3' }); w(4);
  s.push({ warning: true }, { boss: true });
});

// ═══════════ STAGE 5 — 악몽의 달 ═══════════
const S5 = build((w, v, s) => {
  s.push({ banner: 'STAGE 5', sub: '악몽의 달' });
  w(2.5);
  v('fighter', 6, 'strafe', { gap: 0.3, dir: 1, y: 36, fire: 'needle2' }); v('drone', 6, 'sine', { gap: 0.3, x0: 30, x1: 150, fire: 'aim3' }); w(4);
  v('orb', 2, 'turret', { gap: 0.3, x0: 40, x1: 140, fire: 'spiralMini' }); v('wyvern', 6, 'dive', { gap: 0.4, x0: 20, x1: 160 }); w(5);
  v('gunship', 1, 'heavy', { x0: 60, x1: 60, fire: 'spread5' }); v('gunship', 1, 'heavy', { x0: 120, x1: 120, dir: -1, drop: 'star' }); w(5);
  v('drone', 9, 'hold', { gap: 0.12, x0: 15, x1: 165, y: 48, fire: 'snipe' }); v('fighter', 6, 'loop', { gap: 0.3, dir: -1 }); w(5);
  // 패턴 변화: 악몽 편대 — 이전 스테이지 편대 동시 출현
  v('wyvern', 6, 'loop', { gap: 0.35, dir: 1 }); v('fighter', 6, 'snake', { gap: 0.25, dir: -1, y: 60, fire: 'aim1' }); w(5);
  v('orb', 2, 'turret', { gap: 0.3, x0: 40, x1: 140, fire: 'ring' }); v('drone', 8, 'zig', { gap: 0.2, x0: 20, x1: 160, drop: 'star' }); w(5);
  v('gunship', 1, 'heavy', { x0: 90, x1: 90, fire: 'gun' }); w(6);
  v('orb', 4, 'turret', { gap: 0.4, x0: 25, x1: 155, fire: 'curtain', drop: 'banana' }); w(6);
  s.push({ midboss: true });
  w(2);
  s.push({ item: 'strawberry', x: 90 });
  v('wyvern', 8, 'loop', { gap: 0.3, dir: 1, fire: 'aim1' }); v('drone', 10, 'swarm', { gap: 0.18, x0: 15, x1: 165, fire: 'aim1' }); w(5);
  v('gunship', 2, 'heavy', { gap: 1, x0: 45, x1: 135 }); v('orb', 1, 'turret', { x0: 90, x1: 90, fire: 'spiralMini', drop: 'star' }); w(7);
  v('fighter', 8, 'snake', { gap: 0.2, dir: 1, y: 40, fire: 'needle2' }); v('fighter', 8, 'snake', { gap: 0.2, dir: -1, y: 76, fire: 'needle2' }); w(5);
  v('orb', 3, 'turret', { gap: 0.4, x0: 30, x1: 150, fire: 'spiralMini' }); v('wyvern', 6, 'dive', { gap: 0.35, x0: 20, x1: 160 }); w(6);
  v('gunship', 2, 'heavy', { gap: 1, x0: 45, x1: 135, fire: 'spread5', drop: 'banana' }); w(7);
  v('drone', 9, 'hold', { gap: 0.12, x0: 15, x1: 165, y: 50, fire: 'snipe' }); w(5);
  s.push({ warning: true }, { boss: true });
});

// ═══════════ FINAL — 하늘 끝의 마왕성 ═══════════
const S6 = build((w, v, s) => {
  s.push({ banner: 'FINAL STAGE', sub: '하늘 끝의 마왕성' });
  w(2.5);
  v('drone', 8, 'zig', { gap: 0.2, x0: 15, x1: 165, fire: 'aim3' }); v('fighter', 6, 'strafe', { gap: 0.3, dir: 1, y: 40 }); w(4);
  v('orb', 3, 'turret', { gap: 0.4, x0: 30, x1: 150, fire: 'spiralMini' }); w(3);
  v('wyvern', 8, 'dive', { gap: 0.35, x0: 15, x1: 165, drop: 'star' }); w(4);
  v('gunship', 2, 'heavy', { gap: 0.8, x0: 50, x1: 130, fire: 'spread5' }); v('fighter', 8, 'snake', { gap: 0.2, dir: -1, y: 70, fire: 'needle2' }); w(7);
  // 패턴 변화: 마왕성 성벽 포대 + 근위 편대
  v('orb', 4, 'turret', { gap: 0.3, x0: 25, x1: 155, fire: 'spiralMini' }); w(4);
  v('fighter', 8, 'snake', { gap: 0.2, dir: 1, y: 44, fire: 'aim1' }); v('wyvern', 6, 'loop', { gap: 0.35, dir: -1 }); w(6);
  v('gunship', 2, 'heavy', { gap: 1, x0: 50, x1: 130, fire: 'gun', drop: 'star' }); w(7);
  v('drone', 10, 'hold', { gap: 0.1, x0: 12, x1: 168, y: 50, fire: 'snipe', drop: 'banana' }); w(5);
  s.push({ midboss: true });
  w(2);
  s.push({ item: 'strawberry', x: 60 }, { item: 'star', x: 120 });
  v('orb', 4, 'turret', { gap: 0.3, x0: 25, x1: 155, fire: 'curtain' }); v('wyvern', 6, 'loop', { gap: 0.3, dir: 1 }); w(6);
  v('gunship', 3, 'heavy', { gap: 0.9, x0: 35, x1: 145, fire: 'spread5' }); w(6);
  v('fighter', 8, 'loop', { gap: 0.2, dir: -1, fire: 'needle2' }); v('drone', 12, 'swarm', { gap: 0.14, x0: 10, x1: 170, fire: 'aim1' }); w(5);
  v('orb', 3, 'turret', { gap: 0.4, x0: 30, x1: 150, fire: 'ring' }); v('drone', 10, 'zig', { gap: 0.18, x0: 15, x1: 165, fire: 'aim1' }); w(6);
  v('wyvern', 8, 'dive', { gap: 0.3, x0: 15, x1: 165 }); v('fighter', 6, 'strafe', { gap: 0.3, dir: 1, y: 36, fire: 'needle2' }); w(6);
  s.push({ item: 'banana', x: 90 });
  w(2);
  s.push({ warning: true }, { boss: true });
});

// ───────── 보스 정의 ─────────
const LOVE: BossDef = {
  name: '러브 크러셔', art: 'boss', k: 0.5, frames: 2, hp: 950, hr: 30, restY: 88, weak: { dx: 0, dy: -4, r: 11 }, bullet: 'heart', move: 'sway',
  parts: [
    { art: 'enemy-orb', dx: -34, dy: 6, hp: 88, hr: 9, k: 0.4, fire: 'aim', cd: 2.08 },
    { art: 'enemy-orb', dx: 34, dy: 6, hp: 88, hr: 9, k: 0.4, fire: 'aim', cd: 2.08 },
  ],
  shielded: 0.8,
  phases: [['fan', 'aimBurst', 'ringPulse'], ['spiral2', 'dash', 'rain', 'fan'], ['crossSpiral', 'laserAim', 'ringPulse', 'dash']],
  intro: '뽀뽀 대포를 단 하트 요새!',
};

export const STAGES: StageDef[] = [
  {
    id: 1, name: '황혼의 부유왕국', sub: 'STAGE 1', art: 'stage1', temp: false, bgm: 'stage1', bossBgm: 'boss', fx: 'none', props: PROPS_SKY, script: S1,
    story: '부유왕국의 하늘에 정체불명의 하트 요새가 나타났다!',
    midboss: { name: '강철 포함', art: 'enemy-gunship', k: 0.95, frames: 1, hp: 280, hr: 26, restY: 74, bullet: 'smell', move: 'sway', parts: [], phases: [['ring', 'aimBurst'], ['spiral2', 'fan']], mid: true, intro: '' },
    boss: LOVE,
  },
  {
    id: 2, name: '마법의 버섯숲', sub: 'STAGE 2', art: 's2', temp: true, bgm: 'stage2', bossBgm: 'boss', fx: 'spores', props: PROPS_FOREST, script: S2,
    story: '하트 요새가 남긴 포자가 숲을 뒤덮었다. 숲의 수호자가 이성을 잃었다!',
    midboss: { name: '포자 비행정', art: 'enemy-gunship', k: 0.95, frames: 1, hp: 340, hr: 26, restY: 74, bullet: 'smell', move: 'drift', parts: [], phases: [['sporeRain', 'flower'], ['spiral3', 'aimBurst']], mid: true, intro: '' },
    boss: {
      name: '숲의 수호자', art: 'boss', k: 0.5, frames: 2, hp: 1150, hr: 30, restY: 86, weak: { dx: 0, dy: -4, r: 11 }, bullet: 'smell', move: 'drift',
      parts: [
        { art: 'enemy-orb', dx: -36, dy: -10, hp: 104, hr: 9, k: 0.42, fire: 'ring', cd: 3.12 },
        { art: 'enemy-orb', dx: 36, dy: -10, hp: 104, hr: 9, k: 0.42, fire: 'ring', cd: 3.12 },
      ],
      shielded: 0.8,
      phases: [['flower', 'aimBurst', 'sporeRain'], ['spiral3', 'wallGap', 'flower'], ['crossSpiral', 'homing', 'laserSweep', 'flowerFast']],
      intro: '포자에 홀린 숲의 수호자',
    },
  },
  {
    id: 3, name: '기계도시의 역습', sub: 'STAGE 3', art: 's3', temp: true, bgm: 'stage3', bossBgm: 'boss', fx: 'steam', props: PROPS_MACHINE, script: S3,
    story: '포자의 근원은 하늘의 기계도시. 톱니바퀴 공장이 전쟁 기계를 찍어 내고 있다!',
    midboss: { name: '전투 비행선', art: 'airship', k: 0.9, frames: 1, hp: 420, hr: 24, restY: 80, bullet: 'needle', move: 'sway', parts: [], phases: [['curtain', 'gatling'], ['laserAim', 'crossSpiral']], mid: true, intro: '' },
    boss: {
      name: '기가 톱니', art: 'boss', k: 0.5, frames: 2, hp: 1250, hr: 30, restY: 86, weak: { dx: 0, dy: -4, r: 11 }, bullet: 'needle', move: 'sway',
      parts: [
        { art: 'enemy-orb', dx: -38, dy: -14, hp: 88, hr: 9, k: 0.4, fire: 'needle', cd: 1.56 },
        { art: 'enemy-orb', dx: 38, dy: -14, hp: 88, hr: 9, k: 0.4, fire: 'needle', cd: 1.56 },
        { art: 'enemy-orb', dx: -26, dy: 30, hp: 88, hr: 9, k: 0.4, fire: 'aim', cd: 2.34 },
        { art: 'enemy-orb', dx: 26, dy: 30, hp: 88, hr: 9, k: 0.4, fire: 'aim', cd: 2.34 },
      ],
      shielded: 0.8,
      phases: [['curtain', 'aimBurst', 'laserSweep'], ['laserCross', 'gatling', 'ring'], ['crossSpiral', 'laserCross', 'gatling', 'wallGap']],
      intro: '기계도시가 만든 거대 기계병기',
    },
  },
  {
    id: 4, name: '별빛의 심해', sub: 'STAGE 4', art: 's4', temp: true, bgm: 'stage4', bossBgm: 'boss', fx: 'bubbles', props: PROPS_SEA, script: S4,
    story: '기계도시의 동력원은 하늘 바다 깊은 곳의 별빛 결정이었다.',
    midboss: { name: '심해 비룡', art: 'enemy-wyvern', k: 1.3, frames: 1, hp: 460, hr: 22, restY: 80, bullet: 'ring', move: 'figure8', parts: [], phases: [['bubbleRings', 'aimBurst'], ['waveCurtain', 'homing']], mid: true, intro: '' },
    boss: {
      name: '심해의 왕', art: 'boss', k: 0.5, frames: 2, hp: 1400, hr: 30, restY: 90, weak: { dx: 0, dy: -4, r: 11 }, bullet: 'ring', move: 'figure8',
      parts: [
        { art: 'enemy-wyvern', dx: -40, dy: 18, hp: 128, hr: 10, k: 0.45, fire: 'homing', cd: 3.9 },
        { art: 'enemy-wyvern', dx: 40, dy: 18, hp: 128, hr: 10, k: 0.45, fire: 'homing', cd: 3.9 },
      ],
      shielded: 0.8,
      phases: [['bubbleRings', 'homing', 'fan'], ['waveCurtain', 'spiral3', 'laserAim'], ['flowerFast', 'bubbleRings', 'crossSpiral', 'laserSweep']],
      intro: '별빛 결정을 삼킨 거대 심해 괴수',
    },
  },
  {
    id: 5, name: '악몽의 달', sub: 'STAGE 5', art: 's5', temp: true, bgm: 'stage5', bossBgm: 'boss', fx: 'embers', props: PROPS_MOON, script: S5,
    story: '별빛 결정이 붉은 달을 깨웠다. 지금까지의 적들이 악몽이 되어 되살아난다!',
    midboss: { name: '악몽 포함', art: 'enemy-gunship', k: 0.95, frames: 1, hp: 520, hr: 26, restY: 74, bullet: 'fire', move: 'sway', parts: [], phases: [['snipeRain', 'ring'], ['crossSpiral', 'laserAim']], mid: true, intro: '' },
    boss: {
      name: '악몽 수호자', art: 'boss', k: 0.5, frames: 2, hp: 1550, hr: 30, restY: 86, weak: { dx: 0, dy: -4, r: 11 }, bullet: 'fire', move: 'sway',
      parts: [
        { art: 'enemy-orb', dx: -36, dy: 0, hp: 136, hr: 9, k: 0.42, fire: 'aim', cd: 1.82 },
        { art: 'enemy-orb', dx: 36, dy: 0, hp: 136, hr: 9, k: 0.42, fire: 'aim', cd: 1.82 },
      ],
      shielded: 0.8,
      phases: [['ringPulse', 'snipeRain', 'spiral3'], ['laserCross', 'crossSpiral', 'wallGap'], ['crossSpiral', 'laserSweep', 'flowerFast', 'dash']],
      intro: '붉은 달을 지키는 악몽의 화신',
    },
  },
  {
    id: 6, name: '하늘 끝의 마왕성', sub: 'FINAL STAGE', art: 's6', temp: true, bgm: 'final', bossBgm: 'lastboss', fx: 'storm', props: PROPS_CASTLE, script: S6,
    story: '모든 사건의 배후, 하늘 끝 마왕성. 고나와 가족의 마지막 비행이 시작된다!',
    midboss: {
      name: '섀도 러브 크러셔', art: 'boss', k: 0.5, frames: 2, hp: 650, hr: 30, restY: 84, weak: { dx: 0, dy: -4, r: 11 }, bullet: 'heart', move: 'sway', parts: [],
      phases: [['fan', 'spiral3'], ['dash', 'crossSpiral']], mid: true, intro: '',
    },
    boss: {
      name: '마왕성 그림자 코어', art: 'island-castle', k: 0.95, frames: 1, hp: 1800, hr: 34, restY: 92, weak: { dx: 0, dy: 6, r: 13 }, bullet: 'wave', move: 'center',
      core: { art: 'boss', k: 0.32, dy: 6 },
      parts: [
        { art: 'enemy-orb', dx: -56, dy: -20, hp: 160, hr: 10, k: 0.45, fire: 'needle', cd: 1.69 },
        { art: 'enemy-orb', dx: 56, dy: -20, hp: 160, hr: 10, k: 0.45, fire: 'needle', cd: 1.69 },
        { art: 'enemy-orb', dx: -40, dy: 38, hp: 160, hr: 10, k: 0.45, fire: 'ring', cd: 3.38 },
        { art: 'enemy-orb', dx: 40, dy: 38, hp: 160, hr: 10, k: 0.45, fire: 'ring', cd: 3.38 },
      ],
      shielded: 0.55,
      phases: [['curtain', 'laserSweep', 'ring', 'aimBurst'], ['crossSpiral', 'laserCross', 'homing', 'wallGap'], ['flowerFast', 'laserAim', 'crossSpiral', 'snipeRain', 'laserCross']],
      intro: '하늘 끝 마왕성의 심장',
    },
  },
];
