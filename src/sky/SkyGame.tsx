import { useCallback, useEffect, useRef, useState } from 'react';
import { loadAssets, type Assets } from './assets';
import { initAudio, preloadAudio, playBgm, stopBgm, sfx, isMuted, setMuted, audioUnlocked, audioState, audioTap, audioDiag, unlockAudio, reviveAudio, testBeep, forceHtmlAudio } from './audio';
import { SkyEngine, SPECIAL_NAME, type EndInfo, type FamilyId } from './engine';
import { CHARACTERS } from './data/characters';
import { settings, saveSettings, canVibrate } from './settings';
import './sky.css';

const BASE = `${import.meta.env.BASE_URL}assets/sky/`;
const FAMILY: FamilyId[] = ['mom', 'dad', 'imo', 'halmeoni', 'halabeoji', 'samchon'];
const BEST_KEY = 'gona.sky.best';
const SP_DESC: Record<FamilyId, string> = {
  mom: '거대한 하트 마법진 + 유도 하트 파상 공격',
  dad: '적 탄을 지우는 초고압 증기 레이저',
  imo: '별빛 유도탄 대량 발사',
  halmeoni: '체력 2 회복 + 5초 보호막',
  halabeoji: '광역 방패벽이 적 탄을 막고 창으로 반격',
  samchon: '거대 발명 메카의 미사일 연사 + 드릴 돌진',
};

function bestScore(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

type Phase = 'loading' | 'title' | 'select' | 'play' | 'result';

/** GONA's Sky Adventure 화면 전체 (타이틀 → 동료 선택 → 플레이 → 결과). 월드맵과는 onExit 한 줄로만 연결됨 */
export default function SkyGame({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [assets, setAssets] = useState<Assets | null>(null);
  const [fam, setFam] = useState<FamilyId>(() => {
    try {
      const f = localStorage.getItem('gona.sky.fam') as FamilyId | null;
      return f && FAMILY.includes(f) ? f : 'mom';
    } catch {
      return 'mom';
    }
  });
  const [run, setRun] = useState(0);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<EndInfo | null>(null);
  const [best, setBest] = useState(bestScore);
  const [mute, setMute] = useState(isMuted);
  const [gauge, setGauge] = useState(0);
  const [bombs, setBombs] = useState(3);
  const [opts, setOpts] = useState({ ...settings });
  const [leaving, setLeaving] = useState(false);
  const [soundOn, setSoundOn] = useState(audioUnlocked);
  const [err, setErr] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const engine = useRef<SkyEngine | null>(null);

  useEffect(() => {
    initAudio();
    if (location.search.includes('skytest')) Object.assign(window, { __skyAudio: audioState, __skyAudioTap: audioTap, __skyAudioDiag: audioDiag, __skyForceHtml: forceHtmlAudio });
    void preloadAudio('menu');
    // 글자 캐시가 대체 글꼴로 굳지 않도록 픽셀 글꼴을 먼저 불러 둠
    const fonts = document.fonts ? Promise.race([document.fonts.load('700 22px Galmuri11'), new Promise((r) => setTimeout(r, 2500))]) : Promise.resolve();
    Promise.all([loadAssets(), fonts])
      .then(([a]) => {
        setAssets(a);
        setPhase('title');
        void preloadAudio('game');
      })
      .catch((e: unknown) => setErr(String(e)));
  }, []);

  useEffect(() => () => stopBgm(0.3), []);

  // 화면별 BGM (첫 터치 전에는 예약만 → 잠금이 풀리는 순간 재생)
  useEffect(() => {
    if (phase === 'title') playBgm('title', 0.5);
    if (phase === 'select') playBgm('select', 0.4);
  }, [phase]);
  useEffect(() => {
    if (soundOn) return;
    const id = window.setInterval(() => audioUnlocked() && setSoundOn(true), 300);
    return () => window.clearInterval(id);
  }, [soundOn]);

  // 캔버스 크기: 9:16 을 화면에 최대한 크게. 세로 여백이 충분하면 조작 버튼을 전투 화면 밖 하단 바로
  const CTRL = 66;
  const [box, setBox] = useState({ w: 360, h: 640, bar: false });
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [diag, setDiag] = useState(audioDiag);
  useEffect(() => {
    const on = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      setVp({ w: vw, h: vh });
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
    setGauge(0);
    setBombs(3);
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
      (h) => {
        setPaused(h.paused);
        setGauge(h.gauge);
        setBombs(h.bombs);
      },
    );
    engine.current = eng;
    if (location.search.includes('skytest')) (window as unknown as { __sky: SkyEngine }).__sky = eng;
    return () => {
      eng.destroy();
      engine.current = null;
    };
  }, [phase === 'select' || phase === 'loading' || phase === 'title', run, assets, fam]); // eslint-disable-line react-hooks/exhaustive-deps

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

  useEffect(() => {
    if (!paused) return;
    setDiag(audioDiag());
    const id = window.setInterval(() => setDiag(audioDiag()), 500);
    return () => window.clearInterval(id);
  }, [paused]);

  const togglePause = (p: boolean) => {
    engine.current?.setPaused(p);
    setPaused(p);
    sfx(p ? 'menuMove' : 'menuOk');
  };
  const setOpt = (p: Partial<typeof settings>) => {
    saveSettings(p);
    setOpts({ ...settings });
    sfx('menuMove');
  };

  if (err) return <div className="sky"><div className="sky-panel">{err}<button className="sky-btn" onClick={onExit}>월드맵으로</button></div></div>;

  if (phase === 'loading') return <div className="sky sky-play"><div className="sky-loading">LOADING...</div></div>;

  if (phase === 'title') {
    const go = () => {
      unlockAudio(); // iOS: START 터치 안에서 직접 오디오 잠금 해제
      if (leaving) return;
      sfx('menuOk');
      setLeaving(true);
      window.setTimeout(() => {
        setLeaving(false);
        setPhase('select');
      }, 520);
    };
    // 타이틀 전용 구도: 로고(위) · 캐릭터 띠(가운데, 원화의 인물 영역 33%~100%를 통째로) · 메뉴(아래, 별도 영역)
    const ART_W = 688;
    const ART_H = 1024;
    const BAND = 0.33; // 원화에서 가족 일러스트가 시작하는 높이 비율
    const logoW = Math.round(Math.min(vp.w * 0.62, 300, (vp.h * 0.2) / 0.672));
    const logoH = Math.round(logoW * 0.672);
    const top = 10 + logoH + 2;
    const menuH = soundOn ? 104 : 120;
    const bottom = vp.h - menuH;
    const bandPx = ART_H * (1 - BAND);
    const k = Math.min(vp.w / ART_W, Math.max(120, bottom - top) / bandPx);
    const aw = ART_W * k;
    const ah = ART_H * k;
    const artTop = top + (bottom - top - bandPx * k) / 2 - ART_H * BAND * k;
    return (
      <div className={`sky ttl${leaving ? ' out' : ''}`} onPointerDown={() => { unlockAudio(); setSoundOn(true); }}>
        <div className="ttl-bg" aria-hidden />
        <div className="ttl-cloud c1" aria-hidden />
        <div className="ttl-cloud c2" aria-hidden />
        <img className={`ttl-art${aw < vp.w - 2 ? ' narrow' : ''}`} style={{ width: aw, height: ah, left: (vp.w - aw) / 2, top: artTop }} src={`${BASE}v2/title/keyart.jpg`} alt="고나와 가족이 황혼의 부유왕국 하늘을 나는 그림" />
        <div className="ttl-sparks" aria-hidden>
          {Array.from({ length: 12 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i * 0.37) % 2.6}s`, animationDuration: `${2.2 + (i % 4) * 0.5}s` }} />)}
        </div>
        <img className="ttl-logo" style={{ width: logoW }} src={`${BASE}v2/title/logo.png`} alt="GONA's Sky Adventure" />
        <div className="ttl-menu" style={{ height: menuH }}>
          <div className="ttl-row">
            <button type="button" className="ttl-start" onClick={go}>PRESS START</button>
            <button type="button" className="ttl-map" onClick={() => { sfx('menuMove'); onExit(); }}>월드맵</button>
          </div>
          {!soundOn && <p className="ttl-hint">♪ 화면을 터치하면 음악이 켜져요</p>}
          <p className="ttl-copy">{best > 0 && <b>HI-SCORE {String(best).padStart(8, '0')}</b>} STAGE 1 · 개발판</p>
        </div>
        <div className="ttl-wipe" aria-hidden />
      </div>
    );
  }

  if (phase === 'select') {
    const c = CHARACTERS[fam];
    const idx = FAMILY.indexOf(fam);
    const pick = (f: FamilyId) => {
      if (f !== fam) sfx('menuMove');
      setFam(f);
    };
    const step = (d: number) => pick(FAMILY[(idx + d + FAMILY.length) % FAMILY.length]);
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
          </div>
          <button type="button" className="sel-arrow" onClick={() => step(1)} aria-label="다음">▶</button>
        </div>
        <div className="sel-info">
          <div className="sel-preview" aria-hidden>
            <div className="sel-spr sel-spr-gona" />
            <div className="sel-spr sel-spr-fam" style={{ backgroundImage: `url(${BASE}v2/chars/${fam}/fly.png)` }} />
          </div>
          <dl>
            <dt className="sel-name">{c.name}</dt><dd className="sel-job">{c.job}</dd>
            <dt>일반</dt><dd>{c.attack}</dd>
            <dt>필살기</dt><dd><b>{SPECIAL_NAME[fam]}</b> — {SP_DESC[fam]}</dd>
          </dl>
        </div>
        <ul className="sel-roster">
          {FAMILY.map((f) => (
            <li key={f}>
              <button type="button" className={f === fam ? 'on' : ''} onClick={() => pick(f)} aria-label={CHARACTERS[f].name} style={{ backgroundImage: `url(${BASE}v2/chars/${f}/face.png)` }}>
                {f === fam && <i>1P</i>}
              </button>
            </li>
          ))}
        </ul>
        <div className="sel-btns">
          <button type="button" className="sky-btn sky-btn-go" onClick={() => { unlockAudio(); sfx('menuOk'); start(fam); }}>출격!</button>
          <button type="button" className="sky-btn" onClick={() => { sfx('menuMove'); setPhase('title'); }}>타이틀</button>
        </div>
      </div>
    );
  }

  const ready = gauge >= 1;
  return (
    <div className="sky sky-play" ref={boxRef}>
      <div className="sky-stage" style={{ width: box.w, height: box.h, marginBottom: box.bar ? CTRL : 0 }}>
        <canvas ref={canvasRef} className="sky-canvas" style={{ width: box.w, height: box.h }} />
        {phase === 'play' && (
          <>
            <button type="button" className="sky-pause" onPointerDown={(e) => { e.stopPropagation(); togglePause(true); }} aria-label="일시정지">II</button>
            <div className={`sky-ctrl${box.bar ? ' in-bar' : ''}`}>
              <button
                type="button"
                className="sky-act sky-charge"
                onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); engine.current?.holdCharge(true); }}
                onPointerUp={() => engine.current?.holdCharge(false)}
                onPointerCancel={() => engine.current?.holdCharge(false)}
                onLostPointerCapture={() => engine.current?.holdCharge(false)}
                onContextMenu={(e) => e.preventDefault()}
              >
                차지
              </button>
              <button
                type="button"
                className={`sky-act sky-sp${ready ? ' ready' : ''}`}
                onPointerDown={() => engine.current?.useFamily()}
                onContextMenu={(e) => e.preventDefault()}
                aria-label={`가족 필살기 ${Math.floor(gauge * 100)}%`}
              >
                <span className="sp-face" style={{ backgroundImage: `url(${BASE}v2/chars/${fam}/face.png)` }} />
                <span className="sp-fill" style={{ height: `${Math.round(gauge * 100)}%` }} />
                <b>{ready ? '필살!' : `${Math.floor(gauge * 100)}%`}</b>
              </button>
              <button type="button" className="sky-act sky-bomb" onPointerDown={() => engine.current?.useBomb()} onContextMenu={(e) => e.preventDefault()}>
                폭탄<small>×{bombs}</small>
              </button>
            </div>
          </>
        )}
        {paused && (
          <div className="sky-overlay">
            <div className="sky-panel">
              <h2>일시정지</h2>
              <button type="button" className="sky-btn sky-btn-go" onClick={() => togglePause(false)}>계속하기</button>
              <div className="sky-opt">
                <span>소리</span>
                <button type="button" className={!mute ? 'on' : ''} onClick={() => { setMuted(!mute); setMute(!mute); }}>{mute ? '꺼짐' : '켜짐'}</button>
              </div>
              <div className="sky-diag">
                <b>오디오 상태</b>
                <span>
                  {diag.mode === 'webaudio' ? 'Web Audio' : 'HTML5 오디오'} · {diag.ctx} · {diag.unlocked ? '잠금 해제됨' : '첫 터치 대기'} · 음원 {diag.decoded}/{diag.total}
                  {' · '}BGM {diag.bgm ?? '없음'}{diag.playing ? '(재생)' : ''}{diag.muted ? ' · 음소거' : ''}
                </span>
                {diag.errors.length > 0 && <small>{diag.errors[diag.errors.length - 1]}</small>}
                <div className="sky-diag-btns">
                  <button type="button" onClick={() => { reviveAudio(); setDiag(audioDiag()); }}>소리 다시 켜기</button>
                  <button type="button" onClick={() => testBeep()}>테스트음</button>
                </div>
              </div>
              <div className="sky-opt">
                <span>화면 흔들림</span>
                {([0, 0.5, 1] as const).map((v) => (
                  <button type="button" key={v} className={opts.shake === v ? 'on' : ''} onClick={() => setOpt({ shake: v })}>{v === 0 ? '끔' : v === 0.5 ? '약' : '보통'}</button>
                ))}
              </div>
              <div className="sky-opt">
                <span>진동</span>
                {canVibrate ? (
                  <button type="button" className={opts.vibrate ? 'on' : ''} onClick={() => setOpt({ vibrate: !opts.vibrate })}>{opts.vibrate ? '켜짐' : '꺼짐'}</button>
                ) : (
                  <em>이 브라우저 미지원</em>
                )}
              </div>
              <div className="sky-opt">
                <span>성능 표시</span>
                <button type="button" className={opts.perf ? 'on' : ''} onClick={() => setOpt({ perf: !opts.perf })}>{opts.perf ? '켜짐' : '꺼짐'}</button>
              </div>
              <button type="button" className="sky-btn" onClick={() => { setRun((n) => n + 1); setPaused(false); }}>처음부터</button>
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
              <button type="button" className="sky-btn sky-btn-go" onClick={() => { sfx('menuOk'); start(fam); }}>다시 도전!</button>
              <button type="button" className="sky-btn" onClick={() => setPhase('select')}>동료 바꾸기</button>
              <button type="button" className="sky-btn" onClick={() => setPhase('title')}>타이틀로</button>
              <button type="button" className="sky-btn" onClick={onExit}>월드맵으로</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
