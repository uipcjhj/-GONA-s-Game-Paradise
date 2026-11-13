import { useEffect, useState } from 'react';

/** 고나(27×34 원본 스프라이트)는 정수 배율로만 확대 → 도트가 뭉개지지 않음 */
function useGonaScale(): number {
  const calc = () => (Math.min(window.innerWidth, 560) >= 430 ? 5 : 4);
  const [s, setS] = useState(calc);
  useEffect(() => {
    const on = () => setS(calc());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return s;
}

/**
 * 타이틀 화면 (정적). 배경 · 로고 · 고나는 각각 독립된 레이어.
 *  - 배경: public/assets/title/title-bg.png (생성 원본 그대로, cover)
 *  - 로고: public/assets/title/gona-gone-wild-logo.png (투명 PNG)
 *  - 고나: public/assets/gona.png (승인된 원본 스프라이트)
 */
export default function Title({ onStart }: { onStart: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const s = useGonaScale();

  const start = () => {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(onStart, 200);
  };

  return (
    <div className={`title${leaving ? ' leaving' : ''}`} onClick={start} role="button" tabIndex={0} aria-label="화면을 터치하면 시작합니다" onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && start()}>
      <div className="t-stage">
        <img className="t-bg" src="./assets/title/title-bg.png" alt="" draggable={false} />
        <div className="t-head">
          <img className="t-logo" src="./assets/title/gona-gone-wild-logo.png" alt="GONA GONE WILD!" draggable={false} />
          <p className="t-sub">고나가 떴고나!</p>
        </div>
        <img className="t-gona" src="./assets/gona.png" alt="고나" draggable={false} style={{ width: 27 * s, height: 34 * s }} />
        <p className="t-tap">TAP ANYWHERE TO START</p>
      </div>
    </div>
  );
}
