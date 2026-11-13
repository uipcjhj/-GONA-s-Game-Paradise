import { useEffect, useState } from 'react';

/**
 * 타이틀 화면 (정적). 배경 · 로고 · 고나는 서로 독립된 레이어지만 '같은 도트 격자'를 씁니다.
 *  - 기준: 고나 원본 스프라이트(27×34) 1도트 = s CSS px (s = 4, 넓은 화면 5)
 *  - 배경(110×245 도트)·로고(86×51 도트)도 같은 s 배율 → 도트 크기 동일, 모든 위치는 s 의 배수로 맞춤(격자 어긋남 없음)
 *  - 배경: public/assets/title/title-bg-px.png / 로고: logo-px.png (투명) — 둘 다 원본(art-src/title)을 고나 도트 밀도로 재작업한 것
 */
const BG_W = 110;
const BG_H = 245;
const LOGO_W = 86;
const LOGO_H = 51;
const GONA_W = 27;
const GONA_H = 34;
/** 배경 도트 좌표에서 고나가 서는 곳 (모래섬 위 · 발끝 기준) */
const GONA_FEET = { x: 55, y: 198 };

interface Layout {
  s: number;
  bgLeft: number;
  bgTop: number;
  logoLeft: number;
  logoTop: number;
  subTop: number;
  gonaLeft: number;
  gonaTop: number;
}

function layout(): Layout {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const s = Math.min(vw, 560) >= 480 ? 5 : 4;
  const snap = (v: number) => Math.round(v / s) * s;
  const sceneW = BG_W * s;
  const sceneH = BG_H * s;
  const bgLeft = snap((vw - sceneW) / 2);
  const overflow = sceneH - vh;
  // 키가 모자라면 위쪽을 더 많이 자르고(72%), 남으면 아래에 붙여 빈틈 없이 덮음
  const bgTop = overflow > 0 ? -snap(overflow * 0.72) : Math.floor((vh - sceneH) / s) * s;
  const logoTop = snap(vh * 0.075);
  return {
    s,
    bgLeft,
    bgTop,
    logoLeft: snap((vw - LOGO_W * s) / 2),
    logoTop,
    subTop: logoTop + (LOGO_H + 2) * s,
    gonaLeft: bgLeft + (GONA_FEET.x - Math.floor(GONA_W / 2)) * s,
    gonaTop: bgTop + (GONA_FEET.y - GONA_H) * s,
  };
}

function useLayout(): Layout {
  const [l, setL] = useState(layout);
  useEffect(() => {
    const on = () => setL(layout());
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('orientationchange', on);
    };
  }, []);
  return l;
}

export default function Title({ onStart }: { onStart: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const L = useLayout();

  const start = () => {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(onStart, 200);
  };
  const px = (n: number) => `${n}px`;

  return (
    <div className={`title${leaving ? ' leaving' : ''}`} onClick={start} role="button" tabIndex={0} aria-label="화면을 터치하면 시작합니다" onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && start()} style={{ ['--u' as string]: px(L.s) }}>
      <img className="t-bg" src="./assets/title/title-bg-px.png" alt="" draggable={false} style={{ left: L.bgLeft, top: L.bgTop, width: BG_W * L.s, height: BG_H * L.s }} />
      <img className="t-logo" src="./assets/title/logo-px.png" alt="GONA GONE WILD!" draggable={false} style={{ left: L.logoLeft, top: L.logoTop, width: LOGO_W * L.s, height: LOGO_H * L.s }} />
      <p className="t-sub" style={{ top: L.subTop }}>
        고나가 떴고나!
      </p>
      <img className="t-gona" src="./assets/gona.png" alt="고나" draggable={false} style={{ left: L.gonaLeft, top: L.gonaTop, width: GONA_W * L.s, height: GONA_H * L.s }} />
      <p className="t-tap">TAP ANYWHERE TO START</p>
    </div>
  );
}
