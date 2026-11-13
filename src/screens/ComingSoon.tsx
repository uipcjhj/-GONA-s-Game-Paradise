import PixelIcon from '../components/PixelIcon';
import PixelPanel from '../ui/PixelPanel';
import { MORE_ITEMS, type MoreItem } from './More';

/** 아직 구현하지 않은 기능의 안내 화면 — 동작하는 것처럼 보이는 요소·가짜 데이터 없음 */
export default function ComingSoon({ id, onBack }: { id: MoreItem; onBack: () => void }) {
  const m = MORE_ITEMS.find((x) => x.id === id)!;
  return (
    <div className="p-screen">
      <div className="p-bar">
        <button type="button" className="p-back" onClick={onBack} aria-label="뒤로">
          ‹
        </button>
        <h2>{m.label}</h2>
      </div>
      <div className="p-scroll">
        <PixelPanel>
          <div className="p-empty">
            <PixelIcon name={m.icon} size={6} />
            <b>준비 중이에요</b>
            <p className="p-muted">{m.desc}</p>
            <span className="p-chip soon">COMING SOON</span>
          </div>
        </PixelPanel>
      </div>
    </div>
  );
}
