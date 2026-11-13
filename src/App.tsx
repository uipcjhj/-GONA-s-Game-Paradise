import { useEffect, useState } from 'react';
import { ISLANDS } from './data/islands';
import { WORLD_W } from './data/layout';
import BottomNav, { type Tab } from './components/BottomNav';
import IslandPanel from './components/IslandPanel';
import { ProfileView, RankingView } from './components/InfoViews';
import WorldMap from './components/WorldMap';

const HEADER_PX = 58;
const NAV_PX = 66;

/** 정수 배율: 도트가 항상 또렷하고, 가로 스크롤이 생기지 않게 월드 폭(120도트)이 화면 안에 들어오는 값 */
function useLayout() {
  const calc = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const byW = Math.floor(Math.min(vw, 600) / WORLD_W);
    const mapH = vh - HEADER_PX - NAV_PX;
    // 데스크톱은 세로도 고려해 한 화면에 들어오게, 폰은 폭 기준
    const scale = vw >= 700 ? Math.min(byW, Math.max(3, Math.floor(mapH / 226))) : byW;
    const s = Math.max(2, Math.min(5, scale));
    return { scale: s, minH: Math.ceil(mapH / s) };
  };
  const [v, setV] = useState(calc);
  useEffect(() => {
    const on = () => setV(calc());
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('orientationchange', on);
    };
  }, []);
  return v;
}

export default function App() {
  const [tab, setTab] = useState<Tab>('map');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { scale, minH } = useLayout();
  const selected = ISLANDS.find((i) => i.id === selectedId) ?? null;

  return (
    <div className="frame" style={{ width: WORLD_W * scale, ['--s' as string]: `${scale}px` }}>
      <header className="top">
        <span className="top-en">GONA's Game Paradise</span>
        <h1>고나 게임천국</h1>
      </header>

      <main className="stage">
        {tab === 'map' && (
          <>
            <WorldMap islands={ISLANDS} selectedId={selectedId} onSelect={setSelectedId} scale={scale} minH={minH} panelOpen={!!selected} />
            {selected && <IslandPanel island={selected} onClose={() => setSelectedId(null)} />}
          </>
        )}
        {tab === 'profile' && <ProfileView />}
        {tab === 'ranking' && <RankingView />}
      </main>

      <BottomNav tab={tab} onTab={setTab} />
    </div>
  );
}
