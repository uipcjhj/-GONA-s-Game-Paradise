/**
 * 고나의 간식 받아라! (catch) — 규칙·진행(순수 함수, React 무관, 헤드리스 테스트).
 * 손가락을 좌우로 움직이면 고나(바구니)가 따라감 → 떨어지는 간식은 받고, 매운 고추는 피함.
 * 놓친 간식·받은 고추 = 실수. 실수 한도에 닿으면 실패, 목표 개수를 받으면 성공.
 * 좌표: 폭 WORLD_W(180) · 높이 WORLD_H(300) 월드 단위. 화면 배율은 View 가 정함.
 */
import { mulberry32 } from '../../core/rng';

export const WORLD_W = 180;
export const WORLD_H = 300;
export const CATCH_Y = 262; // 바구니 윗면
export const BASKET_W = 34;
export const ITEM_R = 8;
export const MAX_LEVEL = 10;

export type ItemKind = 'berry' | 'cookie' | 'candy' | 'star' | 'pepper';
export interface Item {
  id: number;
  kind: ItemKind;
  x: number;
  y: number;
  vy: number;
  /** 좌우 흔들림(진폭, L7~) */
  sway: number;
  phase: number;
  done: boolean;
}
export interface CatchParams {
  goal: number;
  maxMiss: number;
  /** 떨어지는 속도(단위/초) 최소·최대 */
  speed: [number, number];
  /** 생성 간격(ms) */
  spawnMs: number;
  /** 고추 비율 0~1 */
  pepper: number;
  /** 별(보너스) 비율 */
  star: number;
  /** 두 개 동시 낙하 확률 */
  double: number;
  sway: number;
}

/** 난이도 표(임시 설계값 — 실제 플레이로 조정 필요). L1 은 규칙 익히기(고추 없음, 느림) */
export const TUNING: CatchParams[] = [
  { goal: 18, maxMiss: 4, speed: [70, 85], spawnMs: 1050, pepper: 0, star: 0.05, double: 0, sway: 0 },
  { goal: 20, maxMiss: 4, speed: [80, 95], spawnMs: 980, pepper: 0.12, star: 0.06, double: 0, sway: 0 },
  { goal: 22, maxMiss: 4, speed: [90, 110], spawnMs: 920, pepper: 0.16, star: 0.06, double: 0.05, sway: 0 },
  { goal: 24, maxMiss: 3, speed: [95, 120], spawnMs: 860, pepper: 0.2, star: 0.07, double: 0.1, sway: 0 },
  { goal: 26, maxMiss: 3, speed: [105, 130], spawnMs: 800, pepper: 0.22, star: 0.07, double: 0.15, sway: 0 },
  { goal: 28, maxMiss: 3, speed: [115, 140], spawnMs: 750, pepper: 0.24, star: 0.08, double: 0.18, sway: 0 },
  { goal: 30, maxMiss: 3, speed: [120, 150], spawnMs: 700, pepper: 0.26, star: 0.08, double: 0.2, sway: 10 },
  { goal: 32, maxMiss: 3, speed: [130, 160], spawnMs: 660, pepper: 0.28, star: 0.08, double: 0.22, sway: 14 },
  { goal: 34, maxMiss: 3, speed: [140, 172], spawnMs: 620, pepper: 0.3, star: 0.09, double: 0.25, sway: 18 },
  { goal: 36, maxMiss: 3, speed: [150, 185], spawnMs: 580, pepper: 0.32, star: 0.1, double: 0.28, sway: 22 },
];
export const difficulty = (level: number): CatchParams => ({ ...TUNING[Math.min(MAX_LEVEL, Math.max(1, level)) - 1] });
/** 제한시간: 목표를 받는 데 필요한 시간 + 여유(두 모드 공통) — 한 판 20~45초 */
export function timeLimitSec(level: number): number {
  const p = difficulty(level);
  const goodRate = (1 - p.pepper) * (1 + p.double); // 생성 1번당 간식 수(기대값)
  return Math.round(((p.goal / goodRate) * p.spawnMs) / 1000 + 10);
}

export const POINTS: Record<Exclude<ItemKind, 'pepper'>, number> = { berry: 100, cookie: 100, candy: 120, star: 300 };

export interface CatchState {
  params: CatchParams;
  rand: () => number;
  items: Item[];
  nextId: number;
  spawnIn: number;
  basketX: number;
  caught: number;
  miss: number;
  combo: number;
  bestCombo: number;
  /** 마지막 사건(화면 연출용) */
  events: CatchEvent[];
  elapsed: number;
}
export type CatchEvent = { type: 'catch'; kind: ItemKind; x: number; points: number } | { type: 'miss'; reason: 'drop' | 'pepper'; x: number };

export function createState(params: CatchParams, seed: number): CatchState {
  return { params, rand: mulberry32(seed), items: [], nextId: 1, spawnIn: 500, basketX: WORLD_W / 2, caught: 0, miss: 0, combo: 0, bestCombo: 0, events: [], elapsed: 0 };
}

function pickKind(s: CatchState): ItemKind {
  const r = s.rand();
  if (r < s.params.pepper) return 'pepper';
  if (r < s.params.pepper + s.params.star) return 'star';
  const k = s.rand();
  return k < 0.4 ? 'berry' : k < 0.75 ? 'cookie' : 'candy';
}
function spawn(s: CatchState, x?: number, lag = 0): void {
  const [a, b] = s.params.speed;
  const kind = pickKind(s);
  // 고추는 바로 앞에서 손쓸 수 없게 바구니 정위에만 떨어지지 않도록(공정성) 살짝 비켜 생성
  let px = x ?? ITEM_R + 4 + s.rand() * (WORLD_W - 2 * (ITEM_R + 4));
  if (kind === 'pepper' && Math.abs(px - s.basketX) < BASKET_W * 0.6 && s.items.length === 0) px = px < WORLD_W / 2 ? px + 40 : px - 40;
  s.items.push({ id: s.nextId++, kind, x: px, y: -ITEM_R - lag, vy: a + s.rand() * (b - a), sway: s.params.sway * (s.rand() < 0.5 ? -1 : 1), phase: s.rand() * Math.PI * 2, done: false });
}

export const setBasket = (s: CatchState, x: number) => {
  s.basketX = Math.max(BASKET_W / 2, Math.min(WORLD_W - BASKET_W / 2, x));
};

/** dt(ms) 진행. 사건은 s.events 에 쌓임(호출 측이 비움) */
export function step(s: CatchState, dtMs: number): void {
  const dt = dtMs / 1000;
  s.elapsed += dtMs;
  s.spawnIn -= dtMs;
  if (s.spawnIn <= 0) {
    spawn(s);
    if (s.rand() < s.params.double) {
      const other = s.items[s.items.length - 1].x < WORLD_W / 2 ? WORLD_W * 0.75 : WORLD_W * 0.25;
      spawn(s, other, 75); // 두 번째는 조금 늦게(동시에 바닥에 닿아 둘 다 못 받는 불공정 방지)
    }
    s.spawnIn += s.params.spawnMs;
  }
  for (const it of s.items) {
    if (it.done) continue;
    const prevY = it.y;
    it.y += it.vy * dt;
    if (it.sway) it.x = Math.max(ITEM_R, Math.min(WORLD_W - ITEM_R, it.x + Math.sin(s.elapsed / 300 + it.phase) * it.sway * dt));
    // 바구니 윗면을 지나는 순간 판정(빠른 낙하에도 빠짐 없음)
    if (prevY < CATCH_Y && it.y >= CATCH_Y && Math.abs(it.x - s.basketX) <= BASKET_W / 2 + ITEM_R * 0.6) {
      it.done = true;
      if (it.kind === 'pepper') {
        s.miss++;
        s.combo = 0;
        s.events.push({ type: 'miss', reason: 'pepper', x: it.x });
      } else {
        s.caught++;
        s.combo++;
        s.bestCombo = Math.max(s.bestCombo, s.combo);
        s.events.push({ type: 'catch', kind: it.kind, x: it.x, points: POINTS[it.kind] });
      }
    } else if (it.y > WORLD_H + ITEM_R) {
      it.done = true;
      if (it.kind !== 'pepper') {
        s.miss++;
        s.combo = 0;
        s.events.push({ type: 'miss', reason: 'drop', x: it.x });
      }
    }
  }
  s.items = s.items.filter((i) => !i.done);
}
export type CatchStatus = 'playing' | 'clear' | 'fail';
export const status = (s: CatchState): CatchStatus => (s.miss >= s.params.maxMiss ? 'fail' : s.caught >= s.params.goal ? 'clear' : 'playing');

/** 테스트·지표용 봇: 가장 먼저 닿을 간식 아래로 가되, 곧 닿을 고추는 바구니 판정 폭 밖으로 피함 */
export function botTarget(s: CatchState): number {
  const tol = BASKET_W / 2 + ITEM_R * 0.6;
  const eta = (i: Item) => (CATCH_Y - i.y) / i.vy;
  const goods = s.items.filter((i) => i.kind !== 'pepper' && i.y < CATCH_Y).sort((a, b) => eta(a) - eta(b));
  const danger = s.items.filter((i) => i.kind === 'pepper' && i.y < CATCH_Y && eta(i) < 0.35);
  const safe = (x: number) => danger.every((p) => Math.abs(p.x - x) > tol + 1);
  const t = goods[0];
  if (!t) return safe(s.basketX) ? s.basketX : danger[0].x < WORLD_W / 2 ? WORLD_W - BASKET_W : BASKET_W;
  for (const dx of [0, -tol + 2, tol - 2, -tol / 2, tol / 2]) if (safe(t.x + dx)) return t.x + dx;
  for (const x of [BASKET_W, WORLD_W / 2, WORLD_W - BASKET_W]) if (safe(x)) return x;
  return t.x;
}
