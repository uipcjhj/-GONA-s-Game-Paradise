import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { playOpeningSfx, playStartSfx, stopAllSfx, unlockAudio } from '../sfx';

/**
 * 타이틀 화면 + 오프닝(2.4초). 배경 · 로고 · 부제 · 고나는 승인된 이미지 그대로이며 서로 독립된 레이어입니다.
 *  - 기준: 고나 원본 스프라이트(27×34) 1도트 = s CSS px (s = 4, 넓은 화면 5). 모든 위치는 s 의 배수(격자 어긋남 없음)
 *  - 오프닝 전용 레이어만 추가: 발자국 · 날아가는 고나 실루엣 · 별 (public/assets/opening/, tools/build-opening-assets.py)
 *  - 오프닝은 transform/opacity 애니메이션만 사용 → iPhone Safari 에서도 부드럽게
 * 흐름: 첫 방문 = 오프닝 자동 재생 → 타이틀 대기 / 재방문 = 타이틀부터 / 오프닝 중 터치 = 건너뛰고 타이틀 / 타이틀에서 터치 = 월드맵
 */
const BG_W = 110;
const BG_H = 245;
const LOGO_W = 86; // 도트 단위 환산 폭 (86 × 4px = 344px)
const LOGO_PX_H = 228; // 344 × 0.6623
const SUB_PX_W = 300;
const SUB_PX_H = 64; // 300 × 0.2137
const GONA_W = 27;
const GONA_H = 34;
const FLY_W = 80; // 날아가는 실루엣(도트)
const FLY_H = 44;
const FP_W = 15;
const FP_H = 16;
const SPARK = 5;
/** 배경 도트 좌표에서 고나가 서는 곳 (모래섬 위 · 발끝 기준) */
const GONA_FEET = { x: 55, y: 198 };
/** 발자국: 모래섬 위, 왼쪽에서 오른쪽으로 통통통 (배경 도트 좌표, 발자국 가운데 아래 기준) */
const FOOTPRINTS = [
  { x: 24, y: 212, d: 0, r: -8 },
  { x: 42, y: 206, d: 150, r: 6 },
  { x: 60, y: 213, d: 300, r: -6 },
  { x: 78, y: 206, d: 450, r: 8 },
];
const OPENING_MS = 2400;
const SEEN_KEY = 'gona.openingSeen';

function seenBefore(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}
function markSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* 사생활 보호 모드 등: 매번 오프닝이 나와도 괜찮음 */
  }
}

interface Layout {
  s: number;
  vw: number;
  bgLeft: number;
  bgTop: number;
  logoLeft: number;
  logoTop: number;
  subLeft: number;
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
    vw,
    bgLeft,
    bgTop,
    logoLeft: snap((vw - LOGO_W * s) / 2),
    logoTop,
    subLeft: Math.round((vw - SUB_PX_W) / 2),
    subTop: logoTop + LOGO_PX_H + s,
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
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const seek = params.has('seek') ? Number(params.get('seek')) : null; // 검수용: 오프닝 특정 시각(ms)에서 정지
  const reduce = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const [play, setPlay] = useState(() => !reduce && (params.has('opening') || seek !== null || !seenBefore()));
  const [run, setRun] = useState(0); // 다시 보기마다 증가 → 레이어를 새로 마운트해 애니메이션 재시작
  const [leaving, setLeaving] = useState(false);
  const L = useLayout();
  const timer = useRef(0);
  const lastSkip = useRef(0);

  const finish = useCallback(() => {
    window.clearTimeout(timer.current);
    stopAllSfx();
    markSeen();
    setPlay(false);
  }, []);

  useEffect(() => {
    if (!play || seek !== null) return;
    playOpeningSfx();
    timer.current = window.setTimeout(finish, OPENING_MS);
    return () => {
      window.clearTimeout(timer.current);
      stopAllSfx();
    };
  }, [play, run, seek, finish]);

  const onTap = () => {
    unlockAudio();
    if (leaving || seek !== null) return;
    if (play) {
      lastSkip.current = Date.now();
      finish(); // 오프닝 중 터치 → 연출을 건너뛰고 타이틀로 (월드맵으로는 가지 않음)
      return;
    }
    if (Date.now() - lastSkip.current < 450) return; // 건너뛰기 직후의 연타(중복 터치)는 무시
    playStartSfx();
    setLeaving(true);
    window.setTimeout(onStart, 220);
  };

  const replay = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (leaving || play) return;
    unlockAudio();
    setRun((n) => n + 1);
    setPlay(true);
  };

  const px = (n: number) => `${n}px`;
  const cls = `title${play ? ' playing' : ''}${seek !== null ? ' seeking' : ''}${leaving ? ' leaving' : ''}`;
  const rootStyle = { ['--u' as string]: px(L.s), ['--vw' as string]: px(L.vw), ['--fw' as string]: px(FLY_W * L.s), ['--seek' as string]: seek !== null ? `${seek}ms` : '0ms' };
  const logoRight = L.logoLeft + LOGO_W * L.s;
  const sparks = [
    { x: L.logoLeft - L.s * 3, y: L.logoTop + L.s * 6 },
    { x: logoRight - L.s * 2, y: L.logoTop + L.s * 12 },
    { x: L.logoLeft + L.s * 8, y: L.logoTop + LOGO_PX_H - L.s * 4 },
    { x: logoRight - L.s * 14, y: L.logoTop + LOGO_PX_H - L.s * 2 },
  ];

  return (
    <div className={cls} onClick={onTap} role="button" tabIndex={0} aria-label="화면을 터치하면 시작합니다" onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onTap()} style={rootStyle}>
      <img className="t-bg" src="./assets/title/title-bg-px.png" alt="" draggable={false} style={{ left: L.bgLeft, top: L.bgTop, width: BG_W * L.s, height: BG_H * L.s }} />
      <Fragment key={run}>
        {FOOTPRINTS.map((f, i) => (
          <img
            key={i}
            className="t-fp"
            src="./assets/opening/footprint.png"
            alt=""
            draggable={false}
            style={{ left: L.bgLeft + (f.x - Math.floor(FP_W / 2)) * L.s, top: L.bgTop + (f.y - FP_H) * L.s, width: FP_W * L.s, height: FP_H * L.s, ['--d' as string]: `${f.d}ms`, ['--r' as string]: `${f.r}deg` }}
          />
        ))}
        <img className="t-fly" src="./assets/opening/gona-fly.png" alt="" draggable={false} style={{ top: L.logoTop + L.s * 4, width: FLY_W * L.s, height: FLY_H * L.s }} />
        <img className="t-logo" src="./assets/title/logo-px.png" alt="GONA GONE WILD!" draggable={false} style={{ left: L.logoLeft, top: L.logoTop, width: LOGO_W * L.s, height: LOGO_PX_H }} />
        <img className="t-subimg" src="./assets/title/subtitle-px.png" alt="고나가 떴고나!" draggable={false} style={{ left: L.subLeft, top: L.subTop, width: SUB_PX_W, height: SUB_PX_H }} />
        <div className="t-gonawrap" style={{ left: L.gonaLeft, top: L.gonaTop, width: GONA_W * L.s, height: GONA_H * L.s }}>
          <img className="t-gona" src="./assets/gona.png" alt="고나" draggable={false} />
        </div>
        {sparks.map((p, i) => (
          <img key={i} className="t-spark" src="./assets/opening/spark.png" alt="" draggable={false} style={{ left: p.x, top: p.y, width: SPARK * L.s, height: SPARK * L.s, ['--k' as string]: i }} />
        ))}
        <p className="t-tap">TAP ANYWHERE TO START</p>
      </Fragment>
      {!play && !leaving && (
        <button type="button" className="t-replay" onClick={replay} aria-label="오프닝 다시 보기">
          ↻ 오프닝 다시 보기
        </button>
      )}
    </div>
  );
}
