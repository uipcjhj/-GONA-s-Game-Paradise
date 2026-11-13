import PixelIcon from '../components/PixelIcon';
import { AVATARS, isAvatarUnlocked } from '../platform/avatars';
import type { PlayerData } from '../platform/types';

type P = Pick<PlayerData, 'achievements' | 'playerLevel' | 'unlockedAvatarIds'>;

/**
 * 카드형 그리드 — 선택 카드는 금색 + ▶ 커서.
 * 정식 에셋이 없는 아바타('pending')는 그림 없이 잠금 카드(이름 + "제작 중")로만 보이고, 에셋은 있지만 해금 전인 아바타는 잠금 + 해금 조건을 보인다.
 */
export default function AvatarSelector({ value, onChange, player, showLocked = false }: { value: string; onChange: (id: string) => void; player?: P; showLocked?: boolean }) {
  const p: P = player ?? { achievements: {}, playerLevel: 1, unlockedAvatarIds: [] };
  return (
    <div className="p-cards" role="radiogroup" aria-label="아바타 선택">
      {AVATARS.map((a) => {
        const unlocked = isAvatarUnlocked(a, p);
        const usable = a.asset === 'ready' && unlocked;
        if (!usable && !showLocked) return null;
        if (!usable) {
          return (
            <button key={a.id} type="button" role="radio" aria-checked={false} aria-disabled="true" disabled className="p-card lock" title={a.hint}>
              <span className="lockbox"><PixelIcon name="lock" size={3} /></span>
              {a.name}
              <small>{a.asset === 'pending' ? '제작 중' : '잠금'}</small>
            </button>
          );
        }
        return (
          <button key={a.id} type="button" role="radio" aria-checked={value === a.id} className={`p-card${value === a.id ? ' on' : ''}`} onClick={() => onChange(a.id)}>
            {value === a.id && <em aria-hidden>▶</em>}
            <img src={a.src} alt="" draggable={false} />
            {a.name}
          </button>
        );
      })}
    </div>
  );
}
