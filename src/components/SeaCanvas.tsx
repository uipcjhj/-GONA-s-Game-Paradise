import { useEffect, useRef } from 'react';
import { ISLAND_H, ISLAND_W, type PlacedIsland } from '../data/layout';
import { rng } from '../art/pixel';

interface Props {
  w: number; // 도트
  h: number;
  scale: number;
  placed: PlacedIsland[];
}

const DEEP = '#2f86c9';
const MID = '#3b97d6';
const SHALLOW = '#58b4e6';
const SHALLOW2 = '#74c8f0';

/** 바다: 정적 바탕(얕은 물 · 물결 띠)을 한 번 그리고, 그 위에 물결 · 반짝임만 느리게(8fps) 움직임 */
export default function SeaCanvas({ w, h, scale, placed }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext('2d')!;
    const r = rng(7);

    // ── 정적 바탕
    const bg = document.createElement('canvas');
    bg.width = w;
    bg.height = h;
    const b = bg.getContext('2d')!;
    for (let y = 0; y < h; y++) {
      const band = Math.floor(y / 9) % 2;
      b.fillStyle = band ? MID : DEEP;
      b.fillRect(0, y, w, 1);
    }
    // 띠 경계 디더링
    b.fillStyle = MID;
    for (let y = 8; y < h; y += 18) for (let x = (y / 18) % 2; x < w; x += 2) b.fillRect(x, y, 1, 1);
    // 섬 주변 얕은 물
    placed.forEach(({ x, y }) => {
      const cx = x + ISLAND_W / 2;
      const cy = y + ISLAND_H * 0.62;
      for (let j = -26; j <= 26; j++)
        for (let i = -46; i <= 46; i++) {
          const d = (i / 44) ** 2 + (j / 24) ** 2;
          if (d <= 1) {
            const edge = d > 0.78;
            if (edge && (i + j) % 2 !== 0) continue;
            b.fillStyle = d < 0.55 ? SHALLOW2 : SHALLOW;
            b.fillRect(Math.round(cx + i), Math.round(cy + j), 1, 1);
          }
        }
    });

    // ── 움직이는 요소
    const waves = Array.from({ length: Math.round((w * h) / 230) }, () => ({
      x: Math.floor(r() * w),
      y: Math.floor(r() * h),
      len: 3 + Math.floor(r() * 4),
      ph: r() * 6.28,
      sp: 0.6 + r() * 0.8,
    }));
    const stars = Array.from({ length: Math.round((w * h) / 900) }, () => ({
      x: 2 + Math.floor(r() * (w - 4)),
      y: 2 + Math.floor(r() * (h - 4)),
      ph: r() * 6.28,
      sp: 0.8 + r() * 1.2,
    }));

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(bg, 0, 0);
      waves.forEach((o) => {
        const s = Math.sin(t * o.sp + o.ph);
        if (s < 0.1) return;
        const off = Math.round(Math.sin(t * 0.7 + o.ph) * 2);
        ctx.fillStyle = s > 0.7 ? 'rgba(255,255,255,0.85)' : 'rgba(190,235,255,0.7)';
        ctx.fillRect(o.x + off, o.y, o.len, 1);
        ctx.fillStyle = 'rgba(190,235,255,0.5)';
        ctx.fillRect(o.x + off + 1, o.y + 1, Math.max(1, o.len - 2), 1);
      });
      stars.forEach((o) => {
        const s = Math.sin(t * o.sp + o.ph);
        if (s < 0.82) return;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(o.x, o.y, 1, 1);
        if (s > 0.94) {
          ctx.fillRect(o.x - 1, o.y, 1, 1);
          ctx.fillRect(o.x + 1, o.y, 1, 1);
          ctx.fillRect(o.x, o.y - 1, 1, 1);
          ctx.fillRect(o.x, o.y + 1, 1, 1);
        }
      });
    };

    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    draw(1.3);
    if (still) return;
    const t0 = performance.now();
    const id = window.setInterval(() => {
      if (!document.hidden) draw((performance.now() - t0) / 1000);
    }, 125);
    return () => window.clearInterval(id);
  }, [w, h, placed]);

  return <canvas ref={ref} className="sea" width={w} height={h} style={{ width: w * scale, height: h * scale }} aria-hidden />;
}
