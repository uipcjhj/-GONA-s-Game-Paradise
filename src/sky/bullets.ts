/**
 * 적 탄막·이펙트용 도트 탄 (코드로 미리 한 번 그려 캐시) — 2배 격자 기준으로 그리고 게임에서 0.5배로 표시
 * 모든 적 탄 공통 규칙: 어두운 외곽선 → 진한 색 테두리 → 밝은 색 → 흰 코어  (배경·이펙트 위에서도 식별)
 */
export type BulletLook = 'orbPurple' | 'orbGreen' | 'orbCyan' | 'orbViolet' | 'needle' | 'heart' | 'fireball';

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  return [c, g];
}

function disc(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, col: string): void {
  g.fillStyle = col;
  for (let y = -r; y <= r; y++) {
    const w = Math.floor(Math.sqrt(r * r - y * y) + 0.5);
    g.fillRect(cx - w, cy + y, w * 2 + 1, 1);
  }
}

function orb(r: number, rim: string, mid: string, core = '#ffffff'): HTMLCanvasElement {
  const s = r * 2 + 5;
  const [c, g] = canvas(s, s);
  const m = Math.floor(s / 2);
  disc(g, m, m, r + 1, '#1a0a1e');
  disc(g, m, m, r, rim);
  disc(g, m, m, Math.max(1, r - 2), mid);
  disc(g, m - 1, m - 1, Math.max(1, Math.floor(r / 2) - 1), core);
  return c;
}

function heart(): HTMLCanvasElement {
  const rows = ['..XXX...XXX..', '.XRRRX.XRRRX.', 'XRPPPRXRPPPRX', 'XRPWWPRPPPPRX', 'XRPWWPPPPPPRX', 'XRPPPPPPPPPRX', '.XRPPPPPPPRX.', '..XRPPPPPRX..', '...XRPPPRX...', '....XRPRX....', '.....XRX.....', '......X......'];
  const col: Record<string, string> = { X: '#2a0a1e', R: '#e0205a', P: '#ff6aa8', W: '#ffffff' };
  const [c, g] = canvas(13, 12);
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (col[ch]) { g.fillStyle = col[ch]; g.fillRect(x, y, 1, 1); } }));
  return c;
}

function needle(): HTMLCanvasElement {
  const [c, g] = canvas(7, 16);
  g.fillStyle = '#2a0a06'; g.fillRect(1, 0, 5, 16);
  g.fillStyle = '#e04a10'; g.fillRect(2, 1, 3, 14);
  g.fillStyle = '#ffb030'; g.fillRect(2, 3, 3, 10);
  g.fillStyle = '#fff6c8'; g.fillRect(3, 4, 1, 8);
  return c;
}

let cache: Record<BulletLook, HTMLCanvasElement> | null = null;
export function bulletLooks(): Record<BulletLook, HTMLCanvasElement> {
  cache ??= {
    orbPurple: orb(4, '#b0208a', '#ff5ad0'),
    orbGreen: orb(6, '#3a8a10', '#a6f040'),
    orbCyan: orb(4, '#1060c0', '#40d8ff'),
    orbViolet: orb(3, '#7020c0', '#c080ff'),
    needle: needle(),
    heart: heart(),
    fireball: orb(5, '#c02008', '#ff9020', '#fff6c0'),
  };
  return cache;
}
