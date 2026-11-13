import { ISLAND_H, ISLAND_W } from '../data/layout';
import { C, Pix, rng } from './pixel';

/** 섬 그림 한 장 + 고나가 서는 자리(발 위치, 도트 좌표) */
export interface IslandArt {
  canvas: HTMLCanvasElement;
  stand: { x: number; y: number };
}
export type Painter = (seed: number) => IslandArt;

interface BaseOpts {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  depth: number;
  taper?: boolean;
  /** d: 가운데 0 → 가장자리 1, (u,v): -1..1 방향 */
  surface: (d: number, u: number, v: number, x: number, y: number, r: () => number) => string;
  cliff: (x: number, t: number, depth: number) => string;
}

/** 섬 몸통(윗면 + 절벽)을 그림 */
function base(p: Pix, o: BaseOpts, seed: number): void {
  const r = rng(seed);
  const s1 = r() * 6;
  const s2 = r() * 6;
  const inside = (x: number, y: number): number => {
    const u = (x + 0.5 - o.cx) / o.rx;
    const v = (y + 0.5 - o.cy) / o.ry;
    const a = Math.atan2(v, u);
    const wob = 1 + 0.045 * Math.sin(3 * a + s1) + 0.035 * Math.sin(5 * a + s2);
    return Math.hypot(u, v) / wob;
  };
  // 절벽
  for (let x = 0; x < p.w; x++) {
    let bottom = -1;
    for (let y = 0; y < p.h; y++) if (inside(x, y) <= 1) bottom = y;
    if (bottom < 0) continue;
    const dxn = Math.abs(x + 0.5 - o.cx) / o.rx;
    const dep = o.taper ? Math.max(2, Math.round(o.depth * (1 - Math.pow(dxn, 1.4)))) : o.depth;
    for (let t = 1; t <= dep; t++) p.set(x, bottom + t, o.cliff(x, t, dep));
  }
  // 윗면
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const d = inside(x, y);
      if (d > 1) continue;
      p.set(x, y, o.surface(d, (x + 0.5 - o.cx) / o.rx, (y + 0.5 - o.cy) / o.ry, x, y, r));
    }
}

function finish(p: Pix, foam = true): void {
  p.outline(C.line);
  if (foam) p.halo(2, C.foam, 22);
}

const grassSurface: BaseOpts['surface'] = (d, u, v, x, y, r) => {
  if (d > 0.86) return d > 0.93 && (x + y) % 2 === 0 ? C.sandD : C.sand;
  const light = u * 0.5 + v * 0.8;
  let c: string = C.grass;
  if (light < -0.42) c = C.grassL;
  else if (light < -0.15 && (x + y) % 2 === 0) c = C.grassL;
  else if (light > 0.45) c = C.grassD;
  else if (light > 0.2 && (x + y) % 2 === 0) c = C.grassD;
  if (r() < 0.035) c = C.grassD;
  else if (r() < 0.02) c = C.grassL;
  return c;
};

const dirtCliff: BaseOpts['cliff'] = (x, t, dep) => {
  if (t === dep) return C.dirtD;
  if ((x + t) % 6 === 0 && t > 1) return C.dirtD;
  return t < dep * 0.45 ? C.dirtL : C.dirt;
};

/* ───────────── 스프라이트 지도 ───────────── */
const PAL: Record<string, string> = {
  k: C.line,
  r: C.red,
  R: C.redD,
  w: C.white,
  c: '#fbe9c0',
  C: '#e2c08a',
  g: C.grass,
  G: C.grassD,
  l: C.grassL,
  y: C.yellow,
  Y: C.yellowD,
  b: C.dirtL,
  B: C.dirt,
  p: C.pink,
  P: C.pinkD,
  u: C.blue,
  U: C.blueD,
  v: C.purple,
  V: C.purpleD,
  o: C.orange,
  e: C.stone,
  E: C.stoneD,
};

const MUSHROOM_BIG = [
  '...kkkkkk...',
  '..krrwwrrrk.',
  '.krrwwrrrwrk',
  'krrrrrrwrrrk',
  'krwrrrrrrRRk',
  'kRRrrrRRRRRk',
  '.kkkkkkkkkk.',
  '...kccccck..',
  '...kcCCCck..',
  '...kccccck..',
  '....kkkkk...',
];
const MUSHROOM_SMALL = [
  '..kkkk..',
  '.kvvwvk.',
  'kvwvvvvk',
  'kVVvvVVk',
  '.kkkkkk.',
  '..kcck..',
  '..kcck..',
  '...kk...',
];
const STRAWBERRY = [
  '..lGGl..',
  '.kGlGGk.',
  '.kkkkkk.',
  'krrrrrrk',
  'krYrrrrk',
  'krrrrYrk',
  'krrYrrrk',
  '.krrrrk.',
  '..krrk..',
  '...kk...',
];
const BANANA_TREE = [
  '...kkk....kkk...',
  '.kkgGgkkkkgGgkk.',
  'kgGggGgkkgGggGgk',
  'kGgkkgGggGgkkgGk',
  '.kk.kkgGgkk..kk.',
  '....kyyYkyYk....',
  '...kyYYkkyYYk...',
  '....kkkbBkkk....',
  '......kbBk......',
  '......kbBk......',
  '.....kbBBk......',
  '.....kbBk.......',
  '....kbBBk.......',
  '....kkkkk.......',
];
const BANANA_BUNCH = [
  '.kkk.',
  'kyyYk',
  'kyYYk',
  '.kkk.',
];

function food(seed: number): IslandArt {
  const p = new Pix(ISLAND_W, ISLAND_H);
  base(p, { cx: 36, cy: 25, rx: 31, ry: 16, depth: 10, surface: grassSurface, cliff: dirtCliff }, seed);
  finish(p);
  p.sprite(BANANA_TREE, 52, 7, PAL);
  p.sprite(MUSHROOM_BIG, 9, 11, PAL);
  p.sprite(MUSHROOM_SMALL, 22, 14, PAL);
  p.sprite(MUSHROOM_SMALL, 8, 27, PAL);
  p.sprite(STRAWBERRY, 55, 27, PAL);
  p.sprite(STRAWBERRY, 14, 33, PAL);
  p.sprite(BANANA_BUNCH, 46, 31, PAL);
  return { canvas: p.toCanvas(), stand: { x: 35, y: 34 } };
}

/* ───────────── 퍼즐 아일랜드 ───────────── */
function block(p: Pix, x: number, y: number, s: number, main: string, light: string, dark: string): void {
  p.rect(x, y, s, s, main);
  p.rect(x, y, s, 1, light);
  p.rect(x, y, 1, s, light);
  p.rect(x, y + s - 1, s, 1, dark);
  p.rect(x + s - 1, y, 1, s, dark);
  // 윤곽
  p.rect(x - 1, y - 1, s + 2, 1, C.line);
  p.rect(x - 1, y + s, s + 2, 1, C.line);
  p.rect(x - 1, y - 1, 1, s + 2, C.line);
  p.rect(x + s, y - 1, 1, s + 2, C.line);
}

function ferris(p: Pix, cx: number, cy: number, r: number): void {
  const cols = [C.red, C.yellow, C.blue, C.mint, C.pink, C.orange, C.purple, C.yellow];
  p.line(cx - 4, cy + r + 6, cx, cy, C.line);
  p.line(cx + 4, cy + r + 6, cx, cy, C.line);
  for (let a = 0; a < 16; a++) {
    const t = (a / 16) * Math.PI * 2;
    p.set(cx + Math.cos(t) * r, cy + Math.sin(t) * r, C.stoneDD);
  }
  for (let a = 0; a < 8; a++) {
    const t = (a / 8) * Math.PI * 2;
    p.line(cx, cy, cx + Math.cos(t) * r, cy + Math.sin(t) * r, C.stoneD);
  }
  for (let a = 0; a < 8; a++) {
    const t = (a / 8) * Math.PI * 2;
    const gx = Math.round(cx + Math.cos(t) * r);
    const gy = Math.round(cy + Math.sin(t) * r);
    p.rect(gx - 1, gy, 3, 3, cols[a]);
    p.set(gx - 1, gy + 2, C.line);
    p.set(gx + 1, gy + 2, C.line);
  }
  p.disc(cx, cy, 1, C.redD);
}

function puzzle(seed: number): IslandArt {
  const p = new Pix(ISLAND_W, ISLAND_H);
  const tiles = ['#ffd2e1', '#fff0a8', '#bfe3ff', '#c8f5df'];
  base(
    p,
    {
      cx: 36,
      cy: 25,
      rx: 31,
      ry: 16,
      depth: 10,
      surface: (d, _u, _v, x, y) => {
        if (d > 0.9) return '#fffaf0';
        return tiles[((x >> 2) + (y >> 2)) % 4];
      },
      cliff: (x, t, dep) => {
        if (t === dep) return '#b9578a';
        return (x >> 2) % 2 === 0 ? '#e87fae' : '#f6a3c6';
      },
    },
    seed,
  );
  finish(p);
  ferris(p, 53, 17, 8);
  p.rect(48, 31, 11, 1, C.line);
  // 쌓기 블록
  block(p, 10, 25, 7, C.red, '#ff8a80', C.redD);
  block(p, 19, 28, 7, C.blue, '#8cc4ff', C.blueD);
  block(p, 13, 17, 7, C.yellow, '#fff08a', C.yellowD);
  block(p, 57, 30, 6, C.mint, '#b9f5df', '#3fae8a');
  // 블록 위 작은 동그라미(스터드)
  p.rect(12, 15, 3, 1, C.yellowD);
  return { canvas: p.toCanvas(), stand: { x: 37, y: 34 } };
}

/* ───────────── 스카이 아일랜드 ───────────── */
function cloudPuff(p: Pix, cx: number, cy: number, w: number): void {
  const h = Math.round(w * 0.42);
  for (let y = -h; y <= 0; y++)
    for (let x = -w; x <= w; x++) {
      const u = x / w;
      const bump = 0.55 + 0.45 * Math.abs(Math.sin(u * 4.2 + w));
      if ((u * u) / 1 + (y / h) * (y / h) / bump <= 1) p.set(cx + x, cy + y, y > -2 ? '#cfe6ff' : '#ffffff');
    }
}

function tower(p: Pix, x: number, y: number, w: number, h: number): void {
  p.rect(x, y, w, h, '#f4efe6');
  p.rect(x + w - 2, y, 2, h, '#d8cfc0');
  p.rect(x - 1, y - 1, w + 2, 1, C.line);
  p.rect(x - 1, y, 1, h + 1, C.line);
  p.rect(x + w, y, 1, h + 1, C.line);
  p.rect(x - 1, y + h, w + 2, 1, C.line);
}
function roof(p: Pix, cx: number, y: number, w: number, h: number): void {
  for (let r = 0; r < h; r++) {
    const rw = Math.max(1, Math.round((w * (r + 1)) / h));
    const x0 = Math.round(cx - rw / 2);
    p.rect(x0, y + r, rw, 1, r % 3 === 2 ? C.pinkD : C.pink);
    p.set(x0 - 1, y + r, C.line);
    p.set(x0 + rw, y + r, C.line);
  }
  p.rect(cx - Math.round(w / 2) - 1, y + h, w + 2, 1, C.line);
}

const PINE = [
  '..kk..',
  '.kGGk.',
  '.kggGk',
  'kGggGk',
  'kgglgk',
  '.kkbk.',
  '...bk.',
];

function sky(seed: number): IslandArt {
  const p = new Pix(ISLAND_W, ISLAND_H);
  base(
    p,
    {
      cx: 36,
      cy: 19,
      rx: 30,
      ry: 12,
      depth: 20,
      taper: true,
      surface: (d, u, v, x, y, r) => {
        if (d > 0.9) return C.grassD;
        const c = grassSurface(d + 0.0, u, v, x, y, r);
        return c === C.sand || c === C.sandD ? C.grass : c;
      },
      cliff: (x, t, dep) => {
        if (t === dep) return C.stoneDD;
        if ((x + t * 2) % 7 === 0) return C.stoneDD;
        return t < dep * 0.35 ? C.dirtL : t < dep * 0.7 ? C.stoneD : C.stoneDD;
      },
    },
    seed,
  );
  p.outline(C.line);
  // 구름 솜털(섬 밑 양옆)
  const cloud = new Pix(ISLAND_W, ISLAND_H);
  cloudPuff(cloud, 12, 41, 11);
  cloudPuff(cloud, 60, 43, 11);
  cloudPuff(cloud, 36, 53, 14);
  cloud.outline('#9fbde0');
  cloud.grid.forEach((c, i) => {
    if (c && !p.grid[i]) p.grid[i] = c;
  });
  // 작은 성 (왼쪽 뒤편 — 오른쪽 앞은 고나가 서는 자리)
  tower(p, 16, 7, 5, 14);
  tower(p, 33, 7, 5, 14);
  tower(p, 20, 12, 14, 9);
  roof(p, 18, 3, 6, 4);
  roof(p, 35, 3, 6, 4);
  p.rect(24, 16, 4, 5, C.line); // 문
  p.rect(25, 15, 2, 1, C.line);
  p.rect(29, 14, 2, 2, C.blue);
  p.rect(21, 14, 2, 2, C.blue);
  p.rect(17, 10, 2, 2, C.blue);
  p.rect(34, 10, 2, 2, C.blue);
  // 깃발
  p.rect(27, 4, 1, 8, C.line);
  p.rect(28, 4, 4, 3, C.red);
  p.set(31, 5, C.redD);
  p.sprite(PINE, 5, 14, PAL);
  p.sprite(PINE, 40, 17, PAL);
  return { canvas: p.toCanvas(), stand: { x: 52, y: 29 } };
}

/** 등록되지 않은 theme 에 쓰는 기본 섬 */
function plain(seed: number): IslandArt {
  const p = new Pix(ISLAND_W, ISLAND_H);
  base(p, { cx: 36, cy: 25, rx: 31, ry: 16, depth: 10, surface: grassSurface, cliff: dirtCliff }, seed);
  finish(p);
  p.sprite(STRAWBERRY, 54, 24, PAL);
  p.sprite(MUSHROOM_SMALL, 12, 22, PAL);
  return { canvas: p.toCanvas(), stand: { x: 35, y: 34 } };
}

/** 새 섬 그림은 여기에 등록 */
export const PAINTERS: Record<string, Painter> = { food, puzzle, sky };

const cache = new Map<string, IslandArt>();
export function getIslandArt(theme: string, seed: number): IslandArt {
  const key = `${theme}:${seed}`;
  let art = cache.get(key);
  if (!art) {
    art = (PAINTERS[theme] ?? plain)(seed);
    cache.set(key, art);
  }
  return art;
}

/* ───────────── 비행선 · 구름 (장식) ───────────── */
export function airshipCanvas(): HTMLCanvasElement {
  const p = new Pix(30, 20);
  for (let y = 0; y < 12; y++)
    for (let x = 0; x < 28; x++) {
      const u = (x - 14) / 14;
      const v = (y - 6) / 6.2;
      if (u * u + v * v <= 1) p.set(x + 1, y, Math.floor((x + 1) / 4) % 2 === 0 ? C.red : '#fff3dc');
    }
  p.rect(7, 4, 18, 1, '#ff8a80');
  p.outline(C.line);
  p.rect(10, 14, 10, 4, C.dirtL);
  p.rect(10, 17, 10, 1, C.dirtD);
  p.rect(9, 13, 12, 1, C.line);
  p.rect(9, 18, 12, 1, C.line);
  p.rect(9, 14, 1, 4, C.line);
  p.rect(20, 14, 1, 4, C.line);
  p.set(12, 12, C.line);
  p.set(17, 12, C.line);
  p.rect(12, 15, 2, 2, '#bfe3ff');
  p.rect(16, 15, 2, 2, '#bfe3ff');
  // 꼬리 날개
  p.rect(0, 4, 3, 4, C.blue);
  p.outline(C.line);
  return p.toCanvas();
}

export function cloudCanvas(w: number, seed: number): HTMLCanvasElement {
  const p = new Pix(w * 2 + 4, Math.round(w * 0.9) + 2);
  const r = rng(seed);
  const bottom = p.h - 2;
  const bumps = 3 + Math.floor(w / 9);
  for (let i = 0; i < bumps; i++) {
    const cx = 5 + (i / (bumps - 1)) * (p.w - 10);
    const rad = Math.max(3, Math.round(w * (0.28 + r() * 0.2) * (1 - Math.abs(i / (bumps - 1) - 0.5) * 0.9)));
    for (let y = -rad; y <= 0; y++)
      for (let x = -rad; x <= rad; x++) if (x * x + y * y <= rad * rad) p.set(cx + x, bottom + y, y > -2 ? '#d3e8ff' : '#ffffff');
  }
  p.rect(2, bottom, p.w - 4, 1, '#d3e8ff');
  return p.toCanvas();
}
