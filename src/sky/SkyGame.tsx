import { useCallback, useEffect, useRef, useState } from 'react';
import { loadAssets, isMuted, setMuted, type Assets } from './assets';
import { SkyEngine, type EndInfo, type FamilyId } from './engine';
import { CHARACTERS } from './data/characters';
import './sky.css';

const BASE = `${import.meta.env.BASE_URL}assets/sky/`;
const FAMILY: FamilyId[] = ['mom', 'dad', 'imo', 'halmeoni', 'halabeoji', 'samchon'];
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
export default function SkyGame({ onExit, onResult }: { onExit: () => void; onResult?: (r: EndInfo) => void }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [assets, setAssets] = useState<Assets | null>(null);
  const [fam, setFam] = useState<FamilyId>(() => {
    try {
      return (localStorage.getItem('gona.sky.fam') as FamilyId | null) ?? 'mom';
    } catch {
      return 'mom';
    }
  });
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
  // 세로 여백이 충분하면(예: 390×844) 조작 버튼을 전투 화면 밖 하단 바로 → 화면을 가리지 않음
  const CTRL = 66;
  const [box, setBox] = useState({ w: 360, h: 640, bar: false });
  useEffect(() => {
    const on = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const bar = vh - Math.min(vw, 540) * (16 / 9) >= CTRL;
      const w = Math.floor(Math.min(vw, ((bar ? vh - CTRL : vh) * 9) / 16, 540));
      setBox({ w, h: Math.floor((w * 16) / 9), bar });
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
        onResult?.(r); // 게임천국 결과 수신 경로로 한 판 결과 전달(점수·클리어·시간)
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
    const c = CHARACTERS[fam];
    const idx = FAMILY.indexOf(fam);
    const step = (d: number) => setFam(FAMILY[(idx + d + FAMILY.length) % FAMILY.length]);
    return (
      <div className="sky sel">
        <div className="sel-pattern" aria-hidden />
        <header className="sel-head">
          <span className="sel-stage">STAGE 1 · 황혼의 부유왕국</span>
          <h1>SELECT WINGMATE</h1>
          <span className="sel-sub">고나와 함께 날아갈 가족을 고르세요</span>
        </header>
        <div className="sel-main">
          <button type="button" className="sel-arrow" onClick={() => step(-1)} aria-label="이전">◀</button>
          <div className="sel-art" key={fam}>
            <img className="sel-illust" src={`${BASE}v2/chars/${fam}/illust.png`} alt={c.name} />
            <div className="sel-plate">
              <b>{c.name}</b>
              <span>{c.job}</span>
            </div>
          </div>
          <button type="button" className="sel-arrow" onClick={() => step(1)} aria-label="다음">▶</button>
        </div>
        <div className="sel-info">
          <div className="sel-preview" aria-hidden>
            <div className="sel-spr sel-spr-gona" />
            <div className="sel-spr sel-spr-fam" style={{ backgroundImage: `url(${BASE}v2/chars/${fam}/fly.png)` }} />
          </div>
          <dl>
            <dt>일반</dt><dd>{c.attack}</dd>
            <dt>차지</dt><dd>{c.charge}</dd>
            <dt>필살기</dt><dd>{c.special}</dd>
          </dl>
        </div>
        <p className="sel-line">“{c.sortieLine}”</p>
        <ul className="sel-roster">
          {FAMILY.map((f) => (
            <li key={f}>
              <button type="button" className={f === fam ? 'on' : ''} onClick={() => setFam(f)} aria-label={CHARACTERS[f].name} style={{ backgroundImage: `url(${BASE}v2/chars/${f}/illust.png)` }}>
                {f === fam && <i>1P</i>}
              </button>
            </li>
          ))}
        </ul>
        <div className="sel-btns">
          <button type="button" className="sky-btn sky-btn-go" onClick={() => start(fam)}>출격!</button>
          <button type="button" className="sky-btn" onClick={onExit}>월드맵</button>
        </div>
        {best > 0 && <p className="sky-best">BEST {String(best).padStart(8, '0')}</p>}
      </div>
    );
  }

  return (
    <div className="sky sky-play" ref={boxRef}>
      <div className="sky-stage" style={{ width: box.w, height: box.h, marginBottom: box.bar ? CTRL : 0 }}>
        <canvas ref={canvasRef} className="sky-canvas" style={{ width: box.w, height: box.h }} />
        {phase === 'play' && (
          <>
            <button type="button" className="sky-pause" onPointerDown={(e) => { e.stopPropagation(); togglePause(true); }} aria-label="일시정지">II</button>
            <button
              type="button"
              className={`sky-act sky-charge${box.bar ? ' in-bar' : ''}`}
              onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); engine.current?.holdCharge(true); }}
              onPointerUp={() => engine.current?.holdCharge(false)}
              onPointerCancel={() => engine.current?.holdCharge(false)}
              onLostPointerCapture={() => engine.current?.holdCharge(false)}
              onContextMenu={(e) => e.preventDefault()}
            >
              차지
            </button>
            <button type="button" className={`sky-act sky-bomb${box.bar ? ' in-bar' : ''}`} onPointerDown={() => engine.current?.useBomb()} onContextMenu={(e) => e.preventDefault()}>
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
