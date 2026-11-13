import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { playOpeningSfx, playStartSfx, unlockAudio } from '../sfx';

const SEEN_KEY = 'gona.openingSeen';
const OPENING_MS = 2400;

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

/** 정수 배율 — 장면(150×340 도트)의 도트가 항상 같은 크기로 또렷하게 */
function useScale(): number {
  const calc = () => Math.max(2, Math.min(4, Math.floor(Math.min(window.innerWidth, 560) / 118)));
  const [s, setS] = useState(calc);
  useEffect(() => {
    const on = () => setS(calc());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return s;
}

const FOOTPRINTS = [
  { x: 20, y: 292, d: 0 },
  { x: 44, y: 284, d: 130 },
  { x: 68, y: 292, d: 260 },
  { x: 92, y: 284, d: 390 },
];
const SPARKS = [
  { x: 14, y: 156, a: 'l' },
  { x: 124, y: 154, a: 'r' },
  { x: 28, y: 214, a: 'l' },
  { x: 112, y: 212, a: 'r' },
];

export default function Title({ onStart }: { onStart: () => void }) {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const seek = params.has('seek') ? Number(params.get('seek')) : null; // 검수용: 오프닝의 특정 시각(ms)에서 정지
  const [play, setPlay] = useState(() => params.has('opening') || seek !== null || !seenBefore());
  const [run, setRun] = useState(0); // 다시 보기마다 증가 → 장면을 새로 시작
  const [leaving, setLeaving] = useState(false);
  const s = useScale();
  const stopSfx = useRef<() => void>(() => undefined);
  const timer = useRef(0);

  const finish = useCallback(() => {
    window.clearTimeout(timer.current);
    stopSfx.current();
    setPlay(false);
    markSeen();
  }, []);

  useEffect(() => {
    if (!play || seek !== null) return;
    stopSfx.current = playOpeningSfx();
    timer.current = window.setTimeout(finish, OPENING_MS);
    return () => {
      window.clearTimeout(timer.current);
      stopSfx.current();
    };
  }, [play, run, seek, finish]);

  const onTap = () => {
    unlockAudio();
    if (play && seek === null) {
      finish(); // 오프닝 중 터치 → 연출 건너뛰고 타이틀로
      return;
    }
    if (leaving || seek !== null) return;
    playStartSfx();
    setLeaving(true);
    window.setTimeout(onStart, 220);
  };

  const replay = (e: React.MouseEvent) => {
    e.stopPropagation();
    unlockAudio();
    window.clearTimeout(timer.current);
    setRun((n) => n + 1);
    setPlay(true);
  };

  const cls = `title${play ? ' playing' : ''}${seek !== null ? ' seeking' : ''}${leaving ? ' leaving' : ''}`;
  return (
    <div className={cls} onClick={onTap} role="button" tabIndex={0} aria-label="화면을 터치하면 시작합니다" onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onTap()}>
      <div
        key={run}
        className="scene"
        style={{ ['--u' as string]: `${s}px`, ['--seek' as string]: seek !== null ? `${seek}ms` : '0ms', width: 150 * s, height: 340 * s }}
      >
        <img className="px bg" src="./assets/opening/title-bg.png" alt="" draggable={false} />
        {FOOTPRINTS.map((f, i) => (
          <img key={i} className="px fp" src="./assets/opening/footprint.png" alt="" draggable={false} style={{ left: `calc(var(--u) * ${f.x})`, top: `calc(var(--u) * ${f.y})`, ['--d' as string]: `${f.d}ms`, transform: i % 2 ? 'rotate(8deg)' : 'rotate(-8deg)' }} />
        ))}
        <img className="px fly" src="./assets/opening/gona-fly.png" alt="" draggable={false} />
        <img className="px logo" src="./assets/opening/title-logo.png" alt="GONA GONE WILD!" draggable={false} />
        <img className="px sub" src="./assets/opening/title-sub.png" alt="고나가 떴고나!" draggable={false} />
        {SPARKS.map((p, i) => (
          <img key={i} className={`px spark ${p.a}`} src="./assets/opening/spark.png" alt="" draggable={false} style={{ left: `calc(var(--u) * ${p.x})`, top: `calc(var(--u) * ${p.y})`, ['--k' as string]: i }} />
        ))}
        <div className="gona-title">
          <img className="px" src="./assets/gona.png" alt="고나" draggable={false} />
        </div>
      </div>
      <p className="tap">TAP ANYWHERE TO START</p>
      {!play && (
        <button type="button" className="replay" onClick={replay}>
          ↻ 오프닝 다시 보기
        </button>
      )}
    </div>
  );
}
