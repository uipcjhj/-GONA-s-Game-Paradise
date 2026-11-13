import type { ReactNode } from 'react';
import { useBackLayer } from '../platform/useBackLayer';

/** 한 번에 하나의 모달. 배경 터치·뒤로가기 = 취소(onClose) */
export default function PixelModal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useBackLayer(true, onClose);
  return (
    <div className="p-scrim" onClick={onClose} role="presentation">
      <div className="p-modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}
