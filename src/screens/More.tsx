import PixelIcon from '../components/PixelIcon';
import { missionsForDate } from '../platform/engine';
import { usePlayer } from '../platform/PlayerContext';
import { effectiveDate } from '../platform/engine';

export type MoreItem = 'achievements' | 'codex' | 'missions' | 'attendance' | 'shop' | 'settings';
export const MORE_ITEMS: { id: MoreItem; label: string; icon: string; desc: string }[] = [
  { id: 'achievements', label: '업적', icon: 'star', desc: '달성한 업적과 칭호' },
  { id: 'codex', label: '도감', icon: 'book', desc: '만난 캐릭터와 아이템' },
  { id: 'missions', label: '미션', icon: 'list', desc: '오늘의 일일 미션' },
  { id: 'attendance', label: '출석', icon: 'calendar', desc: '연속 출석 보상' },
  { id: 'shop', label: '상점', icon: 'shop', desc: '코인으로 꾸미기' },
  { id: 'settings', label: '설정', icon: 'gear', desc: '소리 · 백업 · 데이터' },
];

export default function More({ onOpen }: { onOpen: (id: MoreItem) => void }) {
  const { player } = usePlayer();
  const claimable = player ? missionsForDate(player.daily.dateKST).filter((d) => { const m = player.daily.missions[d.id]; return m && !m.claimed && m.progress >= d.target; }).length : 0;
  const notChecked = player ? player.attendance.lastDate !== effectiveDate(player, Date.now()) : false;
  const badge: Partial<Record<MoreItem, string>> = { missions: claimable ? `${claimable}` : '', attendance: notChecked ? 'N' : '' };
  return (
    <div className="p-screen">
      <div className="p-scroll">
        <div className="p-ribbon">MORE</div>
        <div className="p-menu">
          {MORE_ITEMS.map((m) => (
            <button key={m.id} type="button" onClick={() => onOpen(m.id)}>
              <PixelIcon name={m.icon} size={3} />
              <span>{m.label}<small style={{ display: 'block', fontSize: 10, fontWeight: 400, color: '#5d3f86' }}>{m.desc}</small></span>
              <span className="sp" />
              {badge[m.id] ? <span className="p-chip soon">{badge[m.id]}</span> : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
