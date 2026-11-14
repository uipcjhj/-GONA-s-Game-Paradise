/**
 * 간식 조각 카탈로그. 충돌 모양(볼록 다각형)·무게(밀도)·마찰은 물리의 일부라 스킨이 바꾸지 않습니다.
 * 스킨은 kind 별로 겉모습(PieceArt)만 그립니다. 단위: 월드 단위(폭 180 기준).
 */
export type PieceKind = 'toast' | 'macaron' | 'pudding' | 'cake' | 'banana' | 'cone' | 'slice' | 'donut';

export type Pt = readonly [number, number];

export interface PieceDef {
  kind: PieceKind;
  label: string;
  /** 무게 중심이 원점이 되도록 정리된 볼록 다각형(시계 방향, 월드 단위) */
  points: Pt[];
  /** 상대 밀도(1 = 기준). 클수록 무거움 */
  density: number;
  friction: number;
  /** 경계 상자(회전 전) */
  w: number;
  h: number;
  /** 1~3: 화면에 표시할 무게 눈금 */
  weight: 1 | 2 | 3;
}

function centroid(pts: Pt[]): [number, number] {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    const f = x0 * y1 - x1 * y0;
    a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f;
  }
  a *= 0.5;
  return [cx / (6 * a), cy / (6 * a)];
}

export const polygonArea = (pts: readonly Pt[]) => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const [x0, y0] = pts[i]; const [x1, y1] = pts[(i + 1) % pts.length]; a += x0 * y1 - x1 * y0; }
  return Math.abs(a) / 2;
};

function make(kind: PieceKind, label: string, raw: Pt[], density: number, friction: number, weight: 1 | 2 | 3): PieceDef {
  const [cx, cy] = centroid(raw);
  const points = raw.map(([x, y]) => [x - cx, y - cy] as Pt);
  const xs = points.map((p) => p[0]); const ys = points.map((p) => p[1]);
  return { kind, label, points, density, friction, w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), weight };
}

const rect = (w: number, h: number): Pt[] => [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];

export const PIECES: Record<PieceKind, PieceDef> = {
  toast: make('toast', '식빵', rect(46, 15), 1.0, 0.85, 2),
  macaron: make('macaron', '마카롱', rect(38, 11), 0.8, 0.85, 1),
  pudding: make('pudding', '푸딩', [[-20, 10], [-14, -10], [14, -10], [20, 10]], 1.1, 0.85, 2),
  cake: make('cake', '케이크', rect(30, 24), 2.2, 0.9, 3),
  banana: make('banana', '바나나', [[-26, 3], [-20, -5], [20, -5], [26, 3], [18, 7], [-18, 7]], 0.9, 0.7, 1),
  cone: make('cone', '콘', [[-16, 17], [-7, -17], [7, -17], [16, 17]], 1.0, 0.85, 2),
  slice: make('slice', '케이크 조각', [[-22, 11], [-22, 1], [22, -11], [22, 11]], 1.3, 0.9, 2),
  donut: make('donut', '도넛', [[-20, -3], [-12, -9], [12, -9], [20, -3], [20, 3], [12, 9], [-12, 9], [-20, 3]], 1.0, 0.9, 2),
};

export const ALL_KINDS = Object.keys(PIECES) as PieceKind[];
