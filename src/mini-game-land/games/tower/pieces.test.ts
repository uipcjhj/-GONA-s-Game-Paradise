import { describe, expect, it } from 'vitest';
import { ALL_KINDS, PIECES, polygonArea, type Pt } from './pieces';

const cross = (a: Pt, b: Pt, c: Pt) => (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);

describe('간식 카탈로그', () => {
  it('8종, 라벨 고유', () => {
    expect(ALL_KINDS).toHaveLength(8);
    expect(new Set(ALL_KINDS.map((k) => PIECES[k].label)).size).toBe(8);
  });
  it('모두 볼록 다각형이고 넓이가 양수', () => {
    for (const k of ALL_KINDS) {
      const pts = PIECES[k].points;
      expect(pts.length).toBeGreaterThanOrEqual(3);
      const signs = pts.map((_, i) => Math.sign(cross(pts[i], pts[(i + 1) % pts.length], pts[(i + 2) % pts.length])));
      expect(signs.every((s) => s === signs[0] && s !== 0), k).toBe(true);
      expect(polygonArea(pts), k).toBeGreaterThan(100);
    }
  });
  it('무게중심이 원점(스킨 좌표 계약)', () => {
    for (const k of ALL_KINDS) {
      const pts = PIECES[k].points; let a = 0, cx = 0, cy = 0;
      for (let i = 0; i < pts.length; i++) { const [x0, y0] = pts[i]; const [x1, y1] = pts[(i + 1) % pts.length]; const f = x0 * y1 - x1 * y0; a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f; }
      a /= 2;
      expect(Math.abs(cx / (6 * a)), k).toBeLessThan(1e-6);
      expect(Math.abs(cy / (6 * a)), k).toBeLessThan(1e-6);
    }
  });
  it('크기가 월드(폭 180)에서 다룰 만함, bbox 일치', () => {
    for (const k of ALL_KINDS) {
      const d = PIECES[k];
      expect(d.w).toBeGreaterThanOrEqual(26); expect(d.w).toBeLessThanOrEqual(52);
      expect(d.h).toBeGreaterThanOrEqual(11); expect(d.h).toBeLessThanOrEqual(36);
      const xs = d.points.map((p) => p[0]);
      expect(d.w).toBeCloseTo(Math.max(...xs) - Math.min(...xs), 6);
    }
  });
  it('무게 눈금은 밀도와 일치: 케이크가 가장 무겁고 마카롱이 가장 가벼움', () => {
    const dens = ALL_KINDS.map((k) => PIECES[k].density);
    expect(PIECES.cake.density).toBe(Math.max(...dens));
    expect(PIECES.macaron.density).toBe(Math.min(...dens));
    expect(PIECES.cake.weight).toBe(3);
    expect(PIECES.macaron.weight).toBe(1);
  });
});
