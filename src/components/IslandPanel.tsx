import type { Island } from '../types';
import PixelIcon from './PixelIcon';

export default function IslandPanel({ island, onClose }: { island: Island; onClose: () => void }) {
  const open = island.status === 'open';
  const ready = open && !!island.url;
  return (
    <section className="panel" aria-live="polite">
      <button type="button" className="panel-close" onClick={onClose} aria-label="닫기">
        ×
      </button>
      <div className={`chip ${open ? 'chip-open' : 'chip-soon'}`}>{open ? '플레이 가능' : 'COMING SOON'}</div>
      <h2 className="panel-title">{island.gameTitle}</h2>
      <p className="panel-tag">{island.tagline}</p>
      {ready ? (
        <a className="btn btn-go" href={island.url}>
          <PixelIcon name="star" size={2} /> 입장하기
        </a>
      ) : (
        <button type="button" className="btn btn-off" disabled>
          <PixelIcon name="lock" size={2} /> {open ? '입구를 준비하고 있어요' : '곧 열려요'}
        </button>
      )}
    </section>
  );
}
