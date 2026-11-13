import { AVATARS, isAvatarAvailable } from '../platform/avatars';

/** 카드형 그리드 — 선택 카드는 금색 + ▶ 커서 */
export default function AvatarSelector({ value, onChange, unlocked = [] }: { value: string; onChange: (id: string) => void; unlocked?: readonly string[] }) {
  return (
    <div className="p-cards" role="radiogroup" aria-label="아바타 선택">
      {AVATARS.filter((a) => isAvatarAvailable(a, unlocked)).map((a) => (
        <button key={a.id} type="button" role="radio" aria-checked={value === a.id} className={`p-card${value === a.id ? ' on' : ''}`} onClick={() => onChange(a.id)}>
          {value === a.id && <em aria-hidden>▶</em>}
          <img src={a.src} alt="" draggable={false} />
          {a.name}
        </button>
      ))}
    </div>
  );
}
