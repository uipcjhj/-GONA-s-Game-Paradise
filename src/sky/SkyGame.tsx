import { useCallback, useEffect, useRef, useState } from 'react';
import { loadAssets, isMuted, setMuted, type Assets } from './assets';
import { SkyEngine, FAMILY_INFO, type EndInfo, type FamilyId } from './engine';
import './sky.css';

const BASE = `${import.meta.env.BASE_URL}assets/sky/`;
const FAMILY: FamilyId[] = ['mom', 'dad', 'imo', 'halmeoni', 'halabeoji'];
const BEST_KEY = 'gona.sky.best';

function bestScore(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

type Phase = 'loading' | 'select' | 'play' | 'result';

/** GONA's Sky Adventure 화면 전체 (동료 선택 → 플레이 → 결과). 월드맵과는 onExit 한 줄로만 연결됨 */
export default function SkyGame({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [assets, setAssets] = useState<Assets | null>(null);
  const [fam, setFam] = useState<FamilyId>(() => (localStorage.getItem('gona.sky.fam') as FamilyId | null) ?? 'mom');
  const [run, setRun] = useState(0);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<EndInfo | null>(null);
  const [best, setBest] = useState(bestScore);
  const [mute, setMute] = useState(isMuted);
  const [err, setErr] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const engine = useRef<SkyEngine | null>(null);

  useEffect(() => {
    loadAssets().then((a) => {
      setAssets(a);
      setPhase('select');
    }).catch((e: unknown) => setErr(String(e)));
  }, []);

  // 캔버스 크기: 9:16 을 화면에 최대한 크게 (폰은 가로폭 · 큰 화면은 세로 높이 기준)
  const [box, setBox] = useState({ w: 360, h: 640 });
  useEffect(() => {
    const on = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const w = Math.floor(Math.min(vw, (vh * 9) / 16, 540));
      setBox({ w, h: Math.floor((w * 16) / 9) });
    };
    on();
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('orientationchange', on);
    };
  }, []);

  useEffect(() => {
    if (!(phase === 'play' || phase === 'result') || !assets || !canvasRef.current) return;
    setPaused(false);
    const eng = new SkyEngine(
      canvasRef.current,
      assets,
      fam,
      (r) => {
        setResult(r);
        setBest((b) => {
          const nb = Math.max(b, r.score);
          try {
            localStorage.setItem(BEST_KEY, String(nb));
          } catch {
            /* 무시 */
          }
          return nb;
        });
        setPhase('result');
      },
      (h) => setPaused(h.paused),
    );
    engine.current = eng;
    if (location.search.includes('skytest')) (window as unknown as { __sky: SkyEngine }).__sky = eng;
    return () => {
      eng.destroy();
      engine.current = null;
    };
  }, [phase === 'select' || phase === 'loading', run, assets, fam]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    engine.current?.resize();
  }, [box, phase]);

  // 플레이 중에는 화면 끌림·확대·복사 메뉴를 막음 (iPhone Safari)
  useEffect(() => {
    if (phase !== 'play') return;
    const stop = (e: Event) => e.preventDefault();
    const el = boxRef.current;
    el?.addEventListener('touchmove', stop, { passive: false });
    document.addEventListener('gesturestart', stop);
    return () => {
      el?.removeEventListener('touchmove', stop);
      document.removeEventListener('gesturestart', stop);
    };
  }, [phase]);

  const start = useCallback((f: FamilyId) => {
    setFam(f);
    try {
      localStorage.setItem('gona.sky.fam', f);
    } catch {
      /* 무시 */
    }
    setResult(null);
    setRun((n) => n + 1);
    setPhase('play');
  }, []);

  const togglePause = (p: boolean) => {
    engine.current?.setPaused(p);
    setPaused(p);
  };

  if (err) return <div className="sky"><div className="sky-panel">{err}<button className="sky-btn" onClick={onExit}>월드맵으로</button></div></div>;

  if (phase === 'loading') return <div className="sky"><div className="sky-loading">LOADING...</div></div>;

  if (phase === 'select') {
    return (
      <div className="sky sky-select">
        <div className="sky-clouds" aria-hidden />
        <header className="sky-head">
          <h1>GONA's<br />SKY ADVENTURE</h1>
          <span className="sky-tag">DEV BUILD · 1차 개발판</span>
        </header>
        <div className="sky-hero" aria-hidden>
          <div className="sky-wing sky-wing-l" />
          <div className="sky-wing sky-wing-r" />
          <div className="sky-body" />
        </div>
        <p className="sky-pick">함께 날아갈 가족을 골라요!</p>
        <ul className="sky-cards">
          {FAMILY.map((f) => (
            <li key={f}>
              <button type="button" className={`sky-card ${fam === f ? 'on' : ''}`} onClick={() => setFam(f)} aria-pressed={fam === f}>
                <img src={`${BASE}family-${f}.png`} alt="" />
                <b>{FAMILY_INFO[f].name}</b>
                <span>{FAMILY_INFO[f].skill}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="sky-desc">{FAMILY_INFO[fam].name}: {FAMILY_INFO[fam].desc}</p>
        <div className="sky-row">
          <button type="button" className="sky-btn sky-btn-go" onClick={() => start(fam)}>출발!</button>
          <button type="button" className="sky-btn" onClick={onExit}>월드맵</button>
        </div>
        <p className="sky-help">손가락으로 끌어 이동 · 자동 공격<br />차지 버튼 꾹 → 떼면 발사 · 폭탄은 3개</p>
        {best > 0 && <p className="sky-best">BEST {String(best).padStart(8, '0')}</p>}
      </div>
    );
  }

  return (
    <div className="sky sky-play" ref={boxRef}>
      <div className="sky-stage" style={{ width: box.w, height: box.h }}>
        <canvas ref={canvasRef} className="sky-canvas" style={{ width: box.w, height: box.h }} />
        {phase === 'play' && (
          <>
            <button type="button" className="sky-pause" onPointerDown={(e) => { e.stopPropagation(); togglePause(true); }} aria-label="일시정지">II</button>
            <button
              type="button"
              className="sky-act sky-charge"
              onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); engine.current?.holdCharge(true); }}
              onPointerUp={() => engine.current?.holdCharge(false)}
              onPointerCancel={() => engine.current?.holdCharge(false)}
              onContextMenu={(e) => e.preventDefault()}
            >
              차지
            </button>
            <button type="button" className="sky-act sky-bomb" onPointerDown={() => engine.current?.useBomb()} onContextMenu={(e) => e.preventDefault()}>
              폭탄
            </button>
          </>
        )}
        {paused && (
          <div className="sky-overlay">
            <div className="sky-panel">
              <h2>일시정지</h2>
              <button type="button" className="sky-btn sky-btn-go" onClick={() => togglePause(false)}>계속하기</button>
              <button type="button" className="sky-btn" onClick={() => { setRun((n) => n + 1); setPaused(false); }}>처음부터</button>
              <button type="button" className="sky-btn" onClick={() => { setMuted(!mute); setMute(!mute); }}>소리 {mute ? '꺼짐' : '켜짐'}</button>
              <button type="button" className="sky-btn" onClick={() => setPhase('select')}>동료 바꾸기</button>
              <button type="button" className="sky-btn" onClick={onExit}>월드맵으로</button>
            </div>
          </div>
        )}
        {phase === 'result' && result && (
          <div className="sky-overlay">
            <div className="sky-panel">
              <h2>{result.won ? 'STAGE CLEAR!' : 'GAME OVER'}</h2>
              <dl>
                <dt>SCORE</dt><dd>{String(result.score).padStart(8, '0')}</dd>
                <dt>BEST</dt><dd>{String(best).padStart(8, '0')}</dd>
                <dt>시간</dt><dd>{Math.floor(result.time / 60)}:{String(Math.floor(result.time % 60)).padStart(2, '0')}</dd>
                <dt>최대 콤보</dt><dd>{result.maxCombo}</dd>
              </dl>
              <button type="button" className="sky-btn sky-btn-go" onClick={() => start(fam)}>다시 도전!</button>
              <button type="button" className="sky-btn" onClick={() => setPhase('select')}>동료 바꾸기</button>
              <button type="button" className="sky-btn" onClick={onExit}>월드맵으로</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
