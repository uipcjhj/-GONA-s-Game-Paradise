import { useCallback, useEffect, useRef, useState } from 'react';
import { ISLANDS } from './data/islands';
import { VIEW, WORLD } from './data/world';
import BottomNav, { type Tab } from './components/BottomNav';
import IslandPanel from './components/IslandPanel';
import WorldMap from './components/WorldMap';
import Title from './components/Title';
import { usePlayer } from './platform/PlayerContext';
import { useBackLayer } from './platform/useBackLayer';
import Achievements from './screens/Achievements';
import Attendance from './screens/Attendance';
import Codex from './screens/Codex';
import Missions from './screens/Missions';
import Result from './screens/Result';
import Shop from './screens/Shop';
import NoticeHost from './ui/NoticeHost';
import More, { type MoreItem } from './screens/More';
import Profile from './screens/Profile';
import Ranking from './screens/Ranking';
import Recover from './screens/Recover';
import Register from './screens/Register';
import Settings from './screens/Settings';
import CoinChip from './ui/CoinChip';
import PlayerButton from './ui/PlayerButton';
import Toast from './ui/Toast';
import SkyGame from './sky/SkyGame';
import { SKY_DEV } from './platform/games';

const HEADER_PX = 48;
const NAV_PX = 66; // 떠 있는 내비게이션이 차지하는 아래쪽 자리(안전 영역 제외)
const MAX_FRAME = 600;
const POPUP_PX = 80; // 팝업 높이(대략)

export default function App() {
  const { player, loadStatus, touch, checkIn, result, dismissResult, launch, reportInApp } = usePlayer();
  const [screen, setScreen] = useState<'title' | 'register' | 'recover' | 'map' | 'sky'>('title');
  const [tab, setTab] = useState<Tab>('map');
  const [more, setMore] = useState<MoreItem | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number>(0);
  const noticed = useRef(false);
  const notify = useCallback((t: string) => {
    setToast(t);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1800);
  }, []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [area, setArea] = useState({ w: 0, h: 0 });
  const mapBox = useRef<HTMLDivElement>(null);
  const found = ISLANDS.find((i) => i.id === selectedId) ?? null;
  // Sky Adventure: 개발판(SKY_DEV)에서만 입장 가능. 정식 배포 화면은 COMING SOON
  const selected = found && found.id === 'sky-battle' && SKY_DEV ? { ...found, status: 'open' as const, gameTitle: "GONA's Sky Adventure", tagline: '건버드 스타일 세로 슈팅 · 개발판(테스트)' } : found;
  const exitSky = () => setScreen('map');

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

  // 열린 하위 화면·팝업은 브라우저 뒤로가기로 하나씩 닫힘
  useBackLayer(screen === 'map' && tab === 'more' && more !== null, () => setMore(null));
  useBackLayer(screen === 'map' && tab === 'map' && selectedId !== null, () => setSelectedId(null));

  // 앱을 다시 열었을 때(탭 복귀·날짜 변경) 출석/일일 상태 갱신 — 같은 한국 날짜에는 1번만(엔진이 중복 차단)
  useEffect(() => {
    if (screen !== 'map' || !player) return;
    const on = () => document.visibilityState === 'visible' && checkIn();
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, [screen, !!player, checkIn]); // eslint-disable-line react-hooks/exhaustive-deps

  // 게임에서 돌아와 결과가 도착하면 타이틀을 건너뛰고 바로 결과 화면으로
  useBackLayer(screen === 'map' && result !== null, dismissResult);
  useEffect(() => {
    if (result && player && screen === 'title') {
      touch();
      checkIn();
      setScreen('map');
    }
  }, [result]); // eslint-disable-line react-hooks/exhaustive-deps

  // 타이틀 터치: 등록된 플레이어 → 월드맵 / 처음 → 등록 / 저장 손상 → 복구 안내
  const enter = () => {
    if (player) {
      touch();
      checkIn(); // 하루 첫 접속 출석 (한국 날짜 기준, 중복 지급 없음)
      setScreen('map');
      if (loadStatus === 'recovered' && !noticed.current) {
        noticed.current = true;
        notify('손상된 기록을 이전 저장본으로 복구했어요');
      }
    } else setScreen(loadStatus === 'corrupt' || loadStatus === 'newer' ? 'recover' : 'register');
  };
  const openMore = (id: MoreItem) => {
    setSelectedId(null);
    setTab('more');
    setMore(id);
  };
  const toMap = () => {
    setTab('map');
    setMore(null);
    setScreen('map');
  };
  const goTab = (t: Tab) => {
    setToast(null);
    setTab(t);
    setMore(null);
    if (t !== 'map') setSelectedId(null);
  };

  if (screen === 'sky' && player) return <SkyGame onExit={exitSky} onResult={(r) => reportInApp('sky-battle', { outcome: r.won ? 'cleared' : 'failed', score: r.score, stage: 1, stageLabel: '스테이지 1', durationMs: Math.round(r.time * 1000), extra: { maxCombo: r.maxCombo } })} />;
  if (screen === 'title') return <Title onStart={enter} />;
  if (screen === 'register' || screen === 'recover' || !player) {
    return (
      <div className="frame" style={{ width: frameW }}>
        {screen === 'recover' ? <Recover newer={loadStatus === 'newer'} onDone={() => setScreen(player ? 'map' : 'register')} /> : <Register onEnter={toMap} />}
      </div>
    );
  }

  return (
    <div className="frame" style={{ width: frameW }}>
      <header className="top hud">
        <PlayerButton player={player} onClick={() => goTab('profile')} />
        <div className="logo">
          <h1>GONA GONE WILD!</h1>
          <span className="logo-ko">고나가 떴고나!</span>
        </div>
        <CoinChip value={player.coinBalance} />
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
        {tab === 'profile' && <Profile onToast={notify} onOpenMore={openMore} />}
        {tab === 'ranking' && <Ranking />}
        {tab === 'more' && (more === null ? <More onOpen={setMore} /> : more === 'settings' ? <Settings onBack={() => setMore(null)} onToast={notify} onReset={() => { setTab('map'); setMore(null); setScreen('register'); }} /> : more === 'achievements' ? <Achievements onBack={() => setMore(null)} /> : more === 'codex' ? <Codex onBack={() => setMore(null)} /> : more === 'missions' ? <Missions onBack={() => setMore(null)} /> : more === 'attendance' ? <Attendance onBack={() => setMore(null)} /> : <Shop onBack={() => setMore(null)} onToast={notify} />)}
      </main>

      {result ? (
        <div className="p-reg" style={{ top: 48, zIndex: 40 }}>
          <Result view={result} onRetry={(gid, url) => { if (gid === 'sky-battle') { dismissResult(); setScreen('sky'); return; } window.location.href = launch(gid, url).url; /* 화면을 닫지 않고 이동: 닫으면 뒤로가기 레이어가 history.back() 을 호출해 이동이 취소됨 */ }} onMap={() => { dismissResult(); goTab('map'); }} onRanking={() => { dismissResult(); goTab('ranking'); }} />
        </div>
      ) : null}
      <BottomNav tab={tab} onTab={goTab} />
      <Toast text={toast} />
      <NoticeHost />
    </div>
  );
}
