import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ISLAND_H, ISLAND_W, WORLD_W, placeIslands, worldHeight, type PlacedIsland } from '../data/layout';
import type { Island } from '../types';
import { airshipCanvas, cloudCanvas, getIslandArt } from '../art/painters';
import SeaCanvas from './SeaCanvas';

const GONA_W = 27;
const GONA_H = 34;

function CanvasImg({ source, scale, className, style }: { source: HTMLCanvasElement; scale: number; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    cv.width = source.width;
    cv.height = source.height;
    cv.getContext('2d')!.drawImage(source, 0, 0);
  }, [source]);
  return <canvas ref={ref} className={className} style={{ width: source.width * scale, height: source.height * scale, ...style }} aria-hidden />;
}

interface Props {
  islands: Island[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  scale: number;
  /** 화면을 꽉 채우기 위한 최소 월드 높이(도트) */
  minH: number;
  /** 하단 패널이 열려 지도 영역이 줄어들 때 섬이 보이도록 다시 스크롤하기 위한 값 */
  panelOpen: boolean;
}

export default function WorldMap({ islands, selectedId, onSelect, scale, minH, panelOpen }: Props) {
  const H = worldHeight(islands.length, minH);
  const placed = useMemo(() => placeIslands(islands, H), [islands, H]);
  const scroller = useRef<HTMLDivElement>(null);
  const [burst, setBurst] = useState(0);
  const [gonaId, setGonaId] = useState(islands[0]?.id);
  const [hopping, setHopping] = useState(false);
  const [facing, setFacing] = useState<1 | -1>(1);

  const clouds = useMemo(
    () => [
      { c: cloudCanvas(14, 3), y: 0.12, dur: 95, delay: -20 },
      { c: cloudCanvas(10, 8), y: 0.33, dur: 130, delay: -90 },
      { c: cloudCanvas(16, 21), y: 0.55, dur: 110, delay: -50 },
      { c: cloudCanvas(9, 5), y: 0.78, dur: 150, delay: -10 },
    ],
    [],
  );
  const airship = useMemo(() => airshipCanvas(), []);
  const skyIsland = placed.find((p) => p.island.floating);

  // 처음엔 맨 아래(고나의 집 = 첫 섬)가 보이게
  useEffect(() => {
    const el = scroller.current!;
    el.scrollTop = el.scrollHeight;
  }, [H, scale]);

  const select = (p: PlacedIsland) => {
    if (p.island.id !== gonaId) {
      const from = placed.find((q) => q.island.id === gonaId);
      if (from) setFacing(p.x + ISLAND_W / 2 >= from.x + ISLAND_W / 2 ? 1 : -1);
      setGonaId(p.island.id);
      setHopping(true);
      window.setTimeout(() => setHopping(false), 750);
    }
    setBurst((n) => n + 1);
    onSelect(p.island.id);
    // 선택한 섬이 지도 영역 가운데 위쪽에 오도록 부드럽게 스크롤
    const el = scroller.current!;
    const top = (p.y + ISLAND_H / 2) * scale - el.clientHeight * 0.38;
    el.scrollTo({ top: Math.max(0, top), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  // 패널이 닫힐 때 지도 높이가 바뀌어도 어긋나지 않게
  useEffect(() => {
    const el = scroller.current!;
    el.scrollTop = Math.min(el.scrollTop, el.scrollHeight - el.clientHeight);
  }, [panelOpen]);

  const gona = placed.find((p) => p.island.id === gonaId) ?? placed[0];
  const gonaArt = gona ? getIslandArt(gona.island.theme, 1) : null;

  return (
    <div className="map" ref={scroller}>
      <div className="world" style={{ width: WORLD_W * scale, height: H * scale }} onClick={() => onSelect(null)}>
        <SeaCanvas w={WORLD_W} h={H} scale={scale} placed={placed} />

        {clouds.map((c, i) => (
          <div key={i} className="cloud" style={{ top: c.y * H * scale, animationDuration: `${c.dur}s`, animationDelay: `${c.delay}s` }}>
            <CanvasImg source={c.c} scale={scale} />
          </div>
        ))}

        {skyIsland && (
          <div className="airship" style={{ top: (skyIsland.y + 4) * scale }}>
            <CanvasImg source={airship} scale={scale} />
          </div>
        )}

        {placed.map((p) => {
          const art = getIslandArt(p.island.theme, 1);
          const sel = selectedId === p.island.id;
          return (
            <div key={p.island.id} className="spot" style={{ left: p.x * scale, top: p.y * scale, width: ISLAND_W * scale, height: ISLAND_H * scale }}>
              {p.island.floating && <div className="shadow" />}
              <button
                type="button"
                className={`island${sel ? ' selected' : ''}${p.island.floating ? ' floaty' : ''}`}
                                aria-label={`${p.island.name} — ${p.island.status === 'open' ? '입장 가능' : '곧 만나요'}`}
                aria-pressed={sel}
                onClick={(e) => {
                  e.stopPropagation();
                  select(p);
                }}
              >
                <CanvasImg source={art.canvas} scale={scale} className="art" />
                <span className="sign">
                  {p.island.name}
                  {p.island.status === 'soon' && <em>COMING SOON</em>}
                </span>
              </button>
              {sel && (
                <div className="burst" key={burst} aria-hidden>
                  {Array.from({ length: 8 }, (_, i) => (
                    <i key={i} style={{ '--a': `${i * 45}deg` } as CSSProperties} />
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {gona && gonaArt && (
          <div
            className={`gona${gona.island.floating ? ' floaty' : ''}`}
            style={{
              left: (gona.x + gonaArt.stand.x - GONA_W / 2) * scale,
              top: (gona.y + gonaArt.stand.y - GONA_H) * scale,
              width: GONA_W * scale,
              height: GONA_H * scale,
            }}
          >
            <div className={`gona-hop${hopping ? ' go' : ''}`}>
              <img src="./assets/gona.png" alt="고나" draggable={false} style={{ transform: `scaleX(${facing})` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
