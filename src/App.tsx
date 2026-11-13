import { useCallback, useEffect, useRef, useState } from 'react';
import { ISLANDS } from './data/islands';
import { VIEW, WORLD } from './data/world';
import BottomNav, { type Tab } from './components/BottomNav';
import IslandPanel from './components/IslandPanel';
import { ProfileView, RankingView } from './components/InfoViews';
import WorldMap from './components/WorldMap';
import PixelLeaf from './components/PixelLeaf';
import Title from './components/Title';
import SkyGame from './sky/SkyGame';

/** 슈팅게임은 개발판 전용: 정식 배포 화면에서는 입장 버튼이 열리지 않음 (개발 서버 · ?dev · #sky 에서만) */
/** 미리보기 전용 빌드(VITE_SKY_PREVIEW=1): 열자마자 슈팅게임이 시작 */
const SKY_PREVIEW = import.meta.env.VITE_SKY_PREVIEW === '1';
const SKY_DEV = SKY_PREVIEW || import.meta.env.DEV || /[?&]dev(=|&|$)/.test(location.search) || location.hash === '#sky';

const HEADER_PX = 48;
const NAV_PX = 66; // 떠 있는 내비게이션이 차지하는 아래쪽 자리(안전 영역 제외)
const MAX_FRAME = 600;
const POPUP_PX = 80; // 팝업 높이(대략)

export default function App() {
  const [screen, setScreen] = useState<'title' | 'map' | 'sky'>(() => (SKY_PREVIEW || location.hash === '#sky' ? 'sky' : 'title'));
  const [tab, setTab] = useState<Tab>('map');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [area, setArea] = useState({ w: 0, h: 0 });
  const mapBox = useRef<HTMLDivElement>(null);
  const found = ISLANDS.find((i) => i.id === selectedId) ?? null;
  const selected =
    found && found.id === 'sky-battle' && SKY_DEV
      ? { ...found, status: 'open' as const, gameTitle: "GONA's Sky Adventure", tagline: '건버드 스타일 세로 슈팅 · 개발판(테스트)' }
      : found;
  const exitSky = () => {
    history.replaceState(null, '', location.pathname + location.search);
    setScreen('map');
  };

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
  const frameW = Math.max(240, Math.min(vp.w, MAX_FRAME, Math.round((areaH * VIEW.w) / VIEW.h) + 16));

  useEffect(() => {
    const el = mapBox.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setArea({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setArea({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [tab, frameW, screen]);

  // 지도는 항상 '보여 줄 영역(VIEW)'을 화면에 최대한 크게 맞춤. 팝업 자리를 미리 비워 두지 않음.
  // 남는 세로 여백이 팝업 높이 이상이면 그 여백에 팝업이 앉고, 모자라면 지도 맨 아래(빈 바다·구름 쪽)에 겹쳐 앉음.
  const k = area.w && area.h ? Math.min(area.w / VIEW.w, area.h / VIEW.h) : 0;
  const mapW = VIEW.w * k;
  const mapH = VIEW.h * k;
  const slack = Math.max(0, area.h - mapH);
  const mapTop = Math.max(0, Math.min(slack * 0.35, slack - POPUP_PX));

  const onArrive = useCallback((id: string | null) => setSelectedId(id), []);

  if (screen === 'sky') return <SkyGame onExit={exitSky} />;
  if (screen === 'title') return <Title onStart={() => setScreen('map')} />;

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
                <div className="world" style={{ width: WORLD.w, height: WORLD.h, transform: `translate(${-VIEW.x * k}px, ${-VIEW.y * k}px) scale(${k})` }}>
                  <WorldMap islands={ISLANDS} onArrive={onArrive} />
                </div>
              </div>
            )}
            {selected && <IslandPanel island={selected} onClose={() => setSelectedId(null)} onEnter={selected.id === 'sky-battle' && SKY_DEV ? () => setScreen('sky') : undefined} />}
          </div>
        )}
        {tab === 'profile' && <ProfileView />}
        {tab === 'ranking' && <RankingView />}
      </main>

      <BottomNav tab={tab} onTab={setTab} />
    </div>
  );
}
