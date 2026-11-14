/**
 * 아슬아슬 탑 간식 도트(코드로 그린 오리지널). 충돌 모양(piece.points)은 물리 소유 — 여기서는 그 다각형으로 잘라(clip) 겉모습만 그림.
 * 좌표 = 월드 단위(1단위 = 1도트). 화면 배율 k 는 기반이 정수로 맞추므로 도트가 선명함.
 */
import type { TowerPieceView } from '../../games/tower/slots';

type R = [number, number, number, number, string]; // x, y, w, h (bbox 왼쪽 위 기준), 색
const INK = '#3b2419';

/** bbox 크기(w,h)를 받아 kind 별 도트 사각형 목록 */
const ART: Record<string, (w: number, h: number) => R[]> = {
  toast: (w, h) => {
    const r: R[] = [[0, 0, w, h, '#f6dca4'], [0, 0, w, 3, '#b9763a'], [0, 3, w, 1, '#d99a5b'], [0, h - 2, w, 2, '#c9844a'], [0, 0, 2, h, '#c9844a'], [w - 2, 0, 2, h, '#c9844a'], [3, 4, 10, 1, '#fff4d6']];
    for (const [x, y] of [[8, 7], [16, 9], [24, 6], [32, 9], [38, 7], [12, 11], [28, 11]]) if (x < w - 3) r.push([x, y, 2, 1, '#e3bc7a']);
    return r;
  },
  macaron: (w, h) => [
    [0, 0, w, h, '#ff9fb8'], [0, 0, w, 1, '#ffd0dc'], [2, 1, 8, 1, '#ffe4ea'],
    [0, 4, w, 1, '#d96a8a'], [0, 5, w, 2, '#fff4d6'], [0, 7, w, 1, '#d96a8a'],
    ...Array.from({ length: Math.floor(w / 3) }, (_, i) => [i * 3, 3, 1, 1, '#e98aa6'] as R),
    [0, h - 1, w, 1, '#d96a8a'],
  ],
  pudding: (w, h) => [
    [0, 0, w, h, '#f9e49a'], [0, 0, w, 5, '#a8562a'], [0, 5, w, 1, '#c8844a'], [8, 5, 2, 2, '#c8844a'], [24, 5, 2, 3, '#c8844a'],
    [5, 8, 2, 8, '#fff4b0'], [0, h - 2, w, 2, '#e0b85a'], [14, 1, 6, 1, '#d98a4a'],
  ],
  cake: (w, h) => [
    [0, 0, w, h, '#ffe2a8'], [0, 0, w, 5, '#fff8ee'], [0, 5, w, 1, '#f3dfc0'],
    [0, 11, w, 3, '#ff9fb8'], [0, 14, w, 1, '#e98aa6'], [0, 19, w, 2, '#fff8ee'], [0, h - 1, w, 1, '#d9a85a'],
    [Math.floor(w / 2) - 3, 0, 6, 3, '#e8402f'], [Math.floor(w / 2) - 2, 0, 1, 1, '#ffb4a2'], [Math.floor(w / 2) - 1, -1, 2, 1, '#58a842'],
    [3, 2, 2, 1, '#ff6f91'], [w - 6, 2, 2, 1, '#4aa3f0'],
  ],
  banana: (w, h) => [
    [0, 0, w, h, '#ffd84a'], [0, 0, w, 2, '#fff0a0'], [0, h - 3, w, 3, '#e0a92a'],
    [0, 0, 4, h, '#7a5a10'], [w - 4, 0, 4, h, '#a8841a'], [w - 2, 0, 2, 3, '#58a842'],
    [14, 5, 1, 1, '#b8901a'], [30, 6, 1, 1, '#b8901a'],
  ],
  cone: (w, h) => {
    const r: R[] = [[0, 0, w, h, '#e7b56a']];
    for (let y = 9; y < h; y += 5) r.push([0, y, w, 1, '#b57b4e']);
    for (let x = 1; x < w; x += 5) r.push([x, 9, 1, h - 9, '#c99050']);
    r.push([0, 0, w, 8, '#9fe6c8'], [0, 6, w, 2, '#6fcfa8'], [Math.floor(w / 2) - 1, 1, 3, 2, '#e8402f'], [Math.floor(w / 2) - 4, 3, 2, 1, '#fff8ee']);
    return r;
  },
  slice: (w, h) => {
    const r: R[] = [[0, 0, w, h, '#ffe2a8'], [0, h - 2, w, 2, '#d9a85a']];
    for (const y of [h - 8, h - 14]) r.push([0, y, w, 2, '#ff9fb8']);
    // 비스듬한 윗면을 따라 흰 크림(다각형 clip 이 경사를 만듦)
    for (let x = 0; x < w; x += 2) r.push([x, Math.round(10 - (x / w) * 21) , 2, 4, '#fff8ee']);
    r.push([3, 9, 3, 2, '#e8402f']);
    return r;
  },
  donut: (w, h) => {
    const r: R[] = [[0, 0, w, h, '#c9844a'], [0, 0, w, 9, '#ff9fb8'], [2, 9, 4, 2, '#ff9fb8'], [14, 9, 3, 2, '#ff9fb8'], [30, 9, 5, 2, '#ff9fb8'], [0, 0, w, 1, '#ffd0dc']];
    const cx = Math.floor(w / 2);
    r.push([cx - 4, 7, 8, 4, '#7a4a24'], [cx - 3, 8, 6, 2, '#3b2419']);
    for (const [x, y, c] of [[6, 3, '#4aa3f0'], [12, 5, '#ffd84a'], [26, 2, '#8fd96a'], [31, 5, '#fff8ee'], [9, 6, '#fff8ee'], [21, 3, '#4aa3f0']] as [number, number, string][]) r.push([x, y, 2, 1, c]);
    r.push([0, h - 2, w, 2, '#a86b35']);
    return r;
  },
};

export function SnackArt({ piece, ghost }: { piece: TowerPieceView; ghost?: boolean }) {
  const { x0, y0, x1, y1 } = piece.bbox;
  const w = x1 - x0, h = y1 - y0;
  const pts = piece.points.map(([x, y]) => `${x},${y}`).join(' ');
  const id = `snk-${piece.kind}${ghost ? '-g' : ''}`;
  const rects = (ART[piece.kind] ?? ART.toast)(Math.round(w), Math.round(h));
  return (
    <svg className={`tw-art px-piece${ghost ? ' ghost' : ''}`} width={w} height={h} viewBox={`${x0} ${y0} ${w} ${h}`} style={{ left: x0, top: y0 }} aria-label={piece.label} data-kind={piece.kind} shapeRendering="crispEdges">
      <defs>
        <clipPath id={id}>
          <polygon points={pts} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${id})`}>
        {rects.map(([x, y, rw, rh, c], i) => (
          <rect key={i} x={x0 + x} y={y0 + y} width={rw} height={rh} fill={c} />
        ))}
      </g>
      <polygon points={pts} fill="none" stroke={INK} strokeWidth={1.5} strokeLinejoin="miter" />
      {Array.from({ length: piece.weight }, (_, i) => (
        <rect key={i} x={-((piece.weight * 4 - 1) / 2) + i * 4} y={-1} width={3} height={3} fill={INK} opacity={0.35} />
      ))}
    </svg>
  );
}
