import PixelIcon from './PixelIcon';

export type Tab = 'map' | 'profile' | 'ranking';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'map', label: '월드맵', icon: 'map' },
  { id: 'profile', label: '프로필', icon: 'user' },
  { id: 'ranking', label: '랭킹', icon: 'trophy' },
];

export default function BottomNav({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <nav className="nav" aria-label="메뉴">
      {TABS.map((t) => (
        <button key={t.id} type="button" className={`nav-btn${tab === t.id ? ' on' : ''}`} aria-current={tab === t.id ? 'page' : undefined} onClick={() => onTab(t.id)}>
          <PixelIcon name={t.icon} size={2} />
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
