/** 로고 양옆의 작은 도트 별 (월드맵의 반짝이 별과 같은 색) */
const MAP = [
  '...y...',
  '...y...',
  '..yhy..',
  'yyhhhyy',
  '.yhhhy.',
  '.yy.yy.',
  '.y...y.',
];
const COL: Record<string, string> = { y: '#ffd84a', h: '#fff7a8' };

export default function PixelLeaf({ flip = false }: { flip?: boolean }) {
  return (
    <svg className="leaf" width="17" height="17" viewBox="0 0 7 7" shapeRendering="crispEdges" style={flip ? { transform: 'scaleX(-1)' } : undefined} aria-hidden>
      {MAP.flatMap((row, j) => [...row].map((ch, i) => (COL[ch] ? <rect key={`${i}-${j}`} x={i} y={j} width="1" height="1" fill={COL[ch]} /> : null)))}
    </svg>
  );
}
