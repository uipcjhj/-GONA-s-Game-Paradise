import type { ReactNode } from 'react';

export default function SubBar({ title, onBack, right }: { title: string; onBack: () => void; right?: ReactNode }) {
  return (
    <div className="p-bar">
      <button type="button" className="p-back" onClick={onBack} aria-label="뒤로">
        ‹
      </button>
      <h2>{title}</h2>
      {right !== undefined && <span className="p-bar-right">{right}</span>}
    </div>
  );
}
