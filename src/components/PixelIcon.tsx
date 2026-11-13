const ICONS: Record<string, string[]> = {
  map: [
    '..........',
    '.kkkkkkkk.',
    '.kggkbbyk.',
    '.kgggkbbk.',
    '.kkgkkbkk.',
    '.kbbkkgggk',
    '.kbbbkggk.',
    '.kkkkkkkk.',
    '..........',
  ],
  user: [
    '...kkkk...',
    '..kppppk..',
    '..kpkpkk..',
    '..kppppk..',
    '...kkkk...',
    '.kkgggggk.',
    '.kgggggggk',
    '.kkkkkkkk.',
  ],
  trophy: [
    '.kkkkkkkk.',
    'kykyyyyYky',
    'kykyyyyYky',
    '.kkyyyYkk.',
    '...kyYk...',
    '....kk....',
    '...kyyk...',
    '..kkkkkk..',
  ],
  lock: [
    '...kkkk...',
    '..k....k..',
    '..k....k..',
    '.kkkkkkkk.',
    '.kyyyyyyk.',
    '.kyykkyyk.',
    '.kyyykyyk.',
    '.kkkkkkkk.',
  ],
  star: [
    '....kk....',
    '...kyyk...',
    '.kkkyykkk.',
    'kyyyyyyyyk',
    '.kyyyyyyk.',
    '..kyyyyk..',
    '.kyykkyyk.',
    '.kkk..kkk.',
  ],
  more: ['..........', '..........', '.kk.kk.kk.', '.kk.kk.kk.', '..........'],
  gear: ['..k.kk.k..', '.kkkkkkkk.', 'kkyyyyyykk', '.kyykkyyk.', '.kyykkyyk.', 'kkyyyyyykk', '.kkkkkkkk.', '..k.kk.k..'],
  book: ['.kkkkkkkk.', 'kbbbkbbbk.', 'kbbbkbbbk.', 'kbbbkbbbk.', 'kbbbkbbbk.', 'kkkkkkkkk.'],
  list: ['.kkkkkkkk.', 'kyyyyyyyyk', 'kygykkkkyk', 'kyyyyyyyyk', 'kygykkkkyk', 'kyyyyyyyyk', 'kygykkkkyk', '.kkkkkkkk.'],
  shop: ['...kkkk...', '..k....k..', '.kkkkkkkk.', 'kpppppppk.', 'kpppyypppk', 'kpppyypppk', 'kpppppppk.', '.kkkkkkkk.'],
  coin: ['..kkkk..', '.kyyyyk.', 'kyyYkyyk', 'kyyYkyyk', 'kyyYkyyk', 'kyyyyyyk', '.kyyyyk.', '..kkkk..'],
};
const COL: Record<string, string> = {
  k: '#2f7fb8',
  g: '#78c64c',
  b: '#5aa9ff',
  y: '#ffd84a',
  Y: '#e8a92c',
  p: '#ffcfa8',
};

export default function PixelIcon({ name, size = 3 }: { name: keyof typeof ICONS | string; size?: number }) {
  const map = ICONS[name] ?? ICONS.star;
  const w = Math.max(...map.map((r) => r.length));
  return (
    <svg width={w * size} height={map.length * size} viewBox={`0 0 ${w} ${map.length}`} shapeRendering="crispEdges" aria-hidden>
      {map.flatMap((row, j) =>
        [...row].map((ch, i) => (COL[ch] ? <rect key={`${i}-${j}`} x={i} y={j} width="1" height="1" fill={COL[ch]} /> : null)),
      )}
    </svg>
  );
}
