import PixelIcon from '../components/PixelIcon';

export type MoreItem = 'achievements' | 'codex' | 'missions' | 'shop' | 'settings';
export const MORE_ITEMS: { id: MoreItem; label: string; icon: string; soon: boolean; desc: string }[] = [
  { id: 'achievements', label: '업적', icon: 'star', soon: true, desc: '게임을 하면서 달성한 업적과 칭호를 모아 볼 수 있어요.' },
  { id: 'codex', label: '도감', icon: 'book', soon: true, desc: '캐릭터·괴물·간식을 만나면 도감에 기록돼요.' },
  { id: 'missions', label: '미션', icon: 'list', soon: true, desc: '매일 새로운 미션을 하고 고나 코인을 받아요.' },
  { id: 'shop', label: '상점', icon: 'shop', soon: true, desc: '고나 코인으로 꾸미기 아이템을 얻을 수 있어요. (무료 게임 코인 전용)' },
  { id: 'settings', label: '설정', icon: 'gear', soon: false, desc: '' },
];

export default function More({ onOpen }: { onOpen: (id: MoreItem) => void }) {
  return (
    <div className="p-screen">
      <div className="p-scroll">
        <div className="p-ribbon">MORE</div>
        <div className="p-menu">
          {MORE_ITEMS.map((m) => (
            <button key={m.id} type="button" onClick={() => onOpen(m.id)}>
              <PixelIcon name={m.icon} size={3} />
              {m.label}
              <span className="sp" />
              {m.soon && <span className="p-chip soon">준비 중</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
