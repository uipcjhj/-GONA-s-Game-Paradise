import { useEffect } from 'react';
import { getGame } from '../platform/games';
import { usePlayer } from '../platform/PlayerContext';
import type { Island } from '../types';
import { fmtDate } from '../screens/Profile';

/** 작은 안내 팝업 — 지도 아래쪽 여백에 놓여 섬과 고나를 가리지 않음. PLAY 는 기록 연동 상태에 따라 세션을 만들어 같은 탭에서 연다 */
export default function IslandPanel({ island, onClose, onEnter }: { island: Island; onClose: () => void; onEnter?: () => void }) {
  const { player, launch, visit, prepareLaunch, beginInApp } = usePlayer();
  const open = island.status === 'open';
  const ready = open && !!island.url;
  const enter = open && !!onEnter; // 같은 앱 안에서 실행하는 게임(Sky Adventure)
  const g = getGame(island.id);
  const rec = player?.gameRecords[island.id];
  useEffect(() => {
    visit('islands', island.id);
    if (g?.link === 'live' && (ready || enter)) prepareLaunch(island.id); // 온라인 연결 시 서버 세션을 미리 발급
  }, [island.id]); // eslint-disable-line react-hooks/exhaustive-deps
  // 입장 링크는 그대로 <a href> 를 유지(접근성·새 탭 열기). 클릭 시 실행 기록을 남기고, 기록 연동이 live 면 세션 주소(?gp=)로 이동
  const play = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!island.url) return;
    const { url, linked } = launch(island.id, island.url);
    if (linked) {
      e.preventDefault();
      window.location.href = url;
    }
  };
  return (
    <section className="popup" aria-live="polite">
      <button type="button" className="popup-close" onClick={onClose} aria-label="닫기">×</button>
      <div className="popup-info">
        <span className={`chip ${open ? 'chip-open' : 'chip-soon'}`}>{open ? '플레이 가능' : 'COMING SOON'}</span>
        <h2>{island.gameTitle}</h2>
        <p>{island.tagline}</p>
        {open && (
          <p className="popup-rec">
            {rec ? `내 최고 ${rec.bestScore.toLocaleString('ko-KR')} · ${rec.plays}회 · 클리어 ${rec.clears}회 · ${fmtDate(rec.lastPlayedAt).slice(5)}` : g?.link === 'pending' ? '🔌 기록 연동 준비 중' : '아직 기록이 없어요'}
          </p>
        )}
      </div>
      {enter ? (
        <button type="button" className="btn btn-go" onClick={() => { beginInApp(island.id); onEnter?.(); }}>입장</button>
      ) : ready ? (
        <a className="btn btn-go" href={island.url} onClick={play}>입장</a>
      ) : (
        <button type="button" className="btn btn-off" disabled>{open ? '준비 중' : '곧 열려요'}</button>
      )}
    </section>
  );
}
