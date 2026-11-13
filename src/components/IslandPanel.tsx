import type { Island } from '../types';

/** 작은 안내 팝업 — 지도 아래쪽 여백에 놓여 섬과 고나를 가리지 않음 */
export default function IslandPanel({ island, onClose, onEnter }: { island: Island; onClose: () => void; onEnter?: () => void }) {
  const open = island.status === 'open';
  const ready = open && !!island.url;
  const enter = open && !!onEnter;
  return (
    <section className="popup" aria-live="polite">
      <button type="button" className="popup-close" onClick={onClose} aria-label="닫기">
        ×
      </button>
      <div className="popup-info">
        <span className={`chip ${open ? 'chip-open' : 'chip-soon'}`}>{open ? '플레이 가능' : 'COMING SOON'}</span>
        <h2>{island.gameTitle}</h2>
        <p>{island.tagline}</p>
      </div>
      {enter ? (
        <button type="button" className="btn btn-go" onClick={onEnter}>
          입장
        </button>
      ) : ready ? (
        <a className="btn btn-go" href={island.url}>
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
