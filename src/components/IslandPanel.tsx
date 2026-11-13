import { usePlayer } from '../platform/PlayerContext';
import { getGame } from '../platform/registry';
import { fmtScore } from '../ui/format';
import type { Island } from '../types';

/** 작은 안내 팝업 — 지도 아래쪽 여백에 놓여 섬과 고나를 가리지 않음 */
export default function IslandPanel({ island, onClose }: { island: Island; onClose: () => void }) {
  const { player, launch } = usePlayer();
  const open = island.status === 'open';
  const ready = open && !!island.url;
  const rec = player?.gameRecords[island.id];
  const plays = rec?.plays ?? 0;
  const best = getGame(island.id)?.rule.scoreComparable ? rec?.bestScore ?? 0 : 0;
  let recLine = '';
  if (ready) {
    if (plays > 0) recLine = best > 0 ? `내 최고 ${fmtScore(best)} · ${plays}판` : `${plays}판 플레이`;
    else if (best > 0) recLine = `내 최고 ${fmtScore(best)} (가져옴)`;
    else recLine = island.sdk === 'pending' ? '기록 연동 준비 중 · 플레이는 가능해요' : '아직 기록이 없어요';
  }
  return (
    <section className="popup" aria-live="polite" data-testid="island-popup" data-island={island.id}>
      <button type="button" className="popup-close" onClick={onClose} aria-label="닫기">
        ×
      </button>
      <div className="popup-info">
        <span className={`chip ${open ? 'chip-open' : 'chip-soon'}`}>{open ? '플레이 가능' : 'COMING SOON'}</span>
        <h2>{island.gameTitle}</h2>
        <p>{island.tagline}</p>
        {recLine && (
          <p className="popup-rec" data-testid="island-record">
            {recLine}
          </p>
        )}
      </div>
      {ready ? (
        <a
          className="btn btn-go"
          href={island.url}
          data-testid="island-play"
          onClick={(e) => {
            if (!player) return; // 등록 전에는 원래 링크로
            e.preventDefault();
            window.location.href = launch(island.id, island.url!);
          }}
        >
          입장
        </a>
      ) : (
        <button type="button" className="btn btn-off" disabled>
          {open ? '준비 중' : '곧 열려요'}
        </button>
      )}
    </section>
  );
}
