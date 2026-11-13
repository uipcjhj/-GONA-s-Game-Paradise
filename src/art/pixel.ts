/** 코드로 그리는 도트 그림용 작은 도구 모음 (색 격자 → 캔버스) */

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Pix {
  readonly grid: (string | null)[];
  constructor(readonly w: number, readonly h: number) {
    this.grid = new Array(w * h).fill(null);
  }
  set(x: number, y: number, c: string | null): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.grid[y * this.w + x] = c;
  }
  get(x: number, y: number): string | null {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.grid[y * this.w + x];
  }
  rect(x: number, y: number, w: number, h: number, c: string): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  /** 문자 지도로 스프라이트 찍기. '.' 과 ' ' 는 투명 */
  sprite(map: string[], ox: number, oy: number, pal: Record<string, string>): void {
    map.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (ch === '.' || ch === ' ') continue;
        const c = pal[ch];
        if (c) this.set(ox + i, oy + j, c);
      }
    });
  }
  /** 채워진 칸 바깥 1칸에 윤곽선 */
  outline(color: string): void {
    const add: number[] = [];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y)) continue;
        if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) add.push(y * this.w + x);
      }
    add.forEach((i) => (this.grid[i] = color));
  }
  /** 채워진 칸 주변 r칸 안의 빈 칸을 칠함 (바닷물 거품 띠) */
  halo(r: number, color: string, onlyBelowY = -1): void {
    const add: number[] = [];
    for (let y = 0; y < this.h; y++) {
      if (y < onlyBelowY) continue;
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y)) continue;
        let hit = false;
        for (let j = -r; j <= r && !hit; j++)
          for (let i = -r; i <= r; i++) {
            if (i * i + j * j <= r * r + 1 && this.get(x + i, y + j)) {
              hit = true;
              break;
            }
          }
        if (hit) add.push(y * this.w + x);
      }
    }
    add.forEach((i) => (this.grid[i] = color));
  }
  disc(cx: number, cy: number, r: number, c: string): void {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) this.set(cx + x, cy + y, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: string): void {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.set(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c);
  }
  toCanvas(): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = this.w;
    cv.height = this.h;
    const ctx = cv.getContext('2d')!;
    const img = ctx.createImageData(this.w, this.h);
    this.grid.forEach((c, i) => {
      if (!c) return;
      const n = parseInt(c.slice(1), 16);
      img.data[i * 4] = (n >> 16) & 255;
      img.data[i * 4 + 1] = (n >> 8) & 255;
      img.data[i * 4 + 2] = n & 255;
      img.data[i * 4 + 3] = 255;
    });
    ctx.putImageData(img, 0, 0);
    return cv;
  }
}

/** 공용 색 (따뜻한 16비트 팔레트) */
export const C = {
  line: '#3b2a3f',
  foam: '#f2fcff',
  sand: '#f6e2a0',
  sandD: '#e4c777',
  grassL: '#a4de62',
  grass: '#78c64c',
  grassD: '#55a842',
  dirtL: '#b57b4e',
  dirt: '#8f5c3a',
  dirtD: '#6b4330',
  white: '#fffaf0',
  red: '#ec5048',
  redD: '#b83a47',
  yellow: '#ffd84a',
  yellowD: '#e8a92c',
  pink: '#ff8fb1',
  pinkD: '#e0608e',
  blue: '#5aa9ff',
  blueD: '#3b78d8',
  mint: '#7de3c0',
  purple: '#a47be0',
  purpleD: '#7650b8',
  orange: '#ff9a3c',
  stone: '#c9d3e6',
  stoneD: '#8c97b5',
  stoneDD: '#6a7497',
} as const;
