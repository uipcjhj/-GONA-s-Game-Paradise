import PixelIcon from './PixelIcon';

export type Tab = 'map' | 'profile' | 'ranking' | 'more';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'map', label: 'WORLD', icon: 'map' },
  { id: 'profile', label: 'PROFILE', icon: 'user' },
  { id: 'ranking', label: 'RANKING', icon: 'trophy' },
  { id: 'more', label: 'MORE', icon: 'more' },
];

export default function BottomNav({ tab, onTab, badges = {} }: { tab: Tab; onTab: (t: Tab) => void; badges?: Partial<Record<Tab, boolean>> }) {
  return (
    <nav className="nav" aria-label="메뉴">
      {TABS.map((t) => (
        <button key={t.id} type="button" className={`nav-btn${tab === t.id ? ' on' : ''}`} data-testid={`nav-${t.id}`} aria-current={tab === t.id ? 'page' : undefined} onClick={() => onTab(t.id)}>
          <PixelIcon name={t.icon} size={2} />
          <span>{t.label}</span>
          {badges[t.id] && <i className="nav-dot" aria-label="새 소식" />}
        </button>
      ))}
    </nav>
  );
}
