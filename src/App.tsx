import { useCallback, useEffect, useRef, useState } from 'react';
import { ISLANDS } from './data/islands';
import { WORLD } from './data/world';
import BottomNav, { type Tab } from './components/BottomNav';
import IslandPanel from './components/IslandPanel';
import { ProfileView, RankingView } from './components/InfoViews';
import WorldMap from './components/WorldMap';
import PixelLeaf from './components/PixelLeaf';

const HEADER_PX = 48;
const NAV_PX = 66; // 떠 있는 내비게이션이 차지하는 아래쪽 자리(안전 영역 제외)
const MAX_FRAME = 600;
const POPUP_PX = 108;

export default function App() {
  const [tab, setTab] = useState<Tab>('map');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [area, setArea] = useState({ w: 0, h: 0 });
  const mapBox = useRef<HTMLDivElement>(null);
  const selected = ISLANDS.find((i) => i.id === selectedId) ?? null;

  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('orientationchange', on);
    };
  }, []);

  // 프레임 폭: 폰은 화면 폭, PC 는 지도가 세로 한 화면에 들어가는 폭 (비율 유지 · 왜곡 없음)
  const areaH = vp.h - HEADER_PX - NAV_PX;
  const frameW = Math.max(240, Math.min(vp.w, MAX_FRAME, Math.round((areaH * WORLD.w) / WORLD.h) + 40));

  useEffect(() => {
    const el = mapBox.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setArea({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setArea({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [tab, frameW]);

  // 팝업이 들어갈 아래쪽 여백이 모자라면 지도를 조금 줄여 팝업 자리를 따로 확보 (섬·고나를 가리지 않음)
  const fitK = (h: number) => Math.min(area.w / WORLD.w, h / WORLD.h);
  const naturalSlack = area.h - WORLD.h * fitK(area.h);
  const reserve = naturalSlack >= POPUP_PX ? 0 : POPUP_PX;
  const k = area.w && area.h ? fitK(area.h - reserve) : 0;
  const mapW = WORLD.w * k;
  const mapH = WORLD.h * k;
  const mapTop = reserve ? 0 : Math.max(0, Math.min((area.h - mapH) * 0.5, area.h - mapH - POPUP_PX));

  const onArrive = useCallback((id: string | null) => setSelectedId(id), []);

  return (
    <div className="frame" style={{ width: frameW }}>
      <header className="top">
        <PixelLeaf />
        <div className="logo">
          <h1>GONA GONE WILD!</h1>
          <span className="logo-ko">고나가 떴고나!</span>
        </div>
        <PixelLeaf flip />
      </header>

      <main className="stage">
        {tab === 'map' && (
          <div className="mapbox" ref={mapBox}>
            {k > 0 && (
              <div className="fit" style={{ width: mapW, height: mapH, left: (area.w - mapW) / 2, top: mapTop }}>
                <div className="world" style={{ width: WORLD.w, height: WORLD.h, transform: `scale(${k})` }}>
                  <WorldMap islands={ISLANDS} onArrive={onArrive} />
                </div>
              </div>
            )}
            {selected && <IslandPanel island={selected} onClose={() => setSelectedId(null)} />}
          </div>
        )}
        {tab === 'profile' && <ProfileView />}
        {tab === 'ranking' && <RankingView />}
      </main>

      <BottomNav tab={tab} onTab={setTab} />
    </div>
  );
}
