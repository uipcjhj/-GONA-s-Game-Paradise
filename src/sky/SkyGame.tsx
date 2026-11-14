import { useCallback, useEffect, useRef, useState } from 'react';
import { loadAssets, loadStageArt, type Assets, type StageArt } from './assets';
import { initAudio, preloadAudio, prepareBgm, playBgm, stopBgm, sfx, isMuted, setMuted, audioUnlocked, audioState, audioTap, audioDiag, unlockAudio, reviveAudio, testBeep, forceHtmlAudio } from './audio';
import { SkyEngine, SPECIAL_NAME, type EndInfo, type FamilyId, type RunOpts } from './engine';
import { STAGES, DIFF, type Difficulty } from './stages';
import { CHARACTERS } from './data/characters';
import { settings, saveSettings, canVibrate } from './settings';
import { NS, BETA } from './ns';
import './sky.css';

const BASE = `${import.meta.env.BASE_URL}assets/sky/`;
const FAMILY: FamilyId[] = ['mom', 'dad', 'imo', 'halmeoni', 'halabeoji', 'samchon'];
const REC_KEY = `${NS}.records`;
const DIFFS: Difficulty[] = ['easy', 'normal', 'hard'];
const DEV = /[?&](dev|skytest)/.test(location.search);
interface Rec { score: number; reach: number; clear: boolean }
type Records = Record<Difficulty, Rec>;
function loadRecords(): Records {
  const def: Records = { easy: { score: 0, reach: 1, clear: false }, normal: { score: 0, reach: 1, clear: false }, hard: { score: 0, reach: 1, clear: false } };
  try {
    const r = JSON.parse(localStorage.getItem(REC_KEY) ?? '{}') as Partial<Records>;
    for (const d of DIFFS) def[d] = { ...def[d], ...(r[d] ?? {}) };
  } catch {
    /* 무시 */
  }
  return def;
}
function saveRecords(r: Records): void {
  try {
    localStorage.setItem(REC_KEY, JSON.stringify(r));
  } catch {
    /* 무시 */
  }
}
const ENDING = [
  { img: 'v2/title/keyart.jpg', text: '마왕성의 심장이 부서지자, 하늘을 뒤덮던 어둠이 걷혔다.' },
  { img: 'v2/chars/gona/illust.png', text: '고나: "아부부부!" — 작은 날개로 끝까지 날아낸 고나.' },
  { img: 'family', text: '엄마 · 아빠 · 이모 · 할머니 · 할아버지 · 삼촌. 온 가족이 함께였기에 가능했던 비행.' },
  { img: 'v2/title/keyart.jpg', text: '부유왕국에 다시 노을빛이 돌아오고, 고나네 가족은 집으로 향한다.' },
  { img: 'v2/chars/gona/illust.png', text: '그리고 고나의 다음 모험은… 게임천국 어딘가에서 계속된다!' },
];
const CREDITS = [
  ["GONA's Sky Adventure", ''], ['기획 · 원작', '고나네 가족'], ['캐릭터', '고나 · 엄마 · 아빠 · 이모 · 할머니 · 할아버지 · 안경쟁이 삼촌'],
  ['게임 프로그래밍 · 사운드 합성', 'Claude Code'], ['음악 · 효과음', '오리지널 합성 (tools/sky-audio)'], ['원화 · 스프라이트', '승인 원화 + 스테이지 2~6 임시 그래픽'],
  ['스페셜 땡스', '게임천국에 놀러 와 준 모든 친구들'], ['', 'THANK YOU FOR PLAYING!'],
];
const SP_DESC: Record<FamilyId, string> = {
  mom: '거대한 하트 마법진 + 유도 하트 파상 공격',
  dad: '적 탄을 지우는 초고압 증기 레이저',
  imo: '별빛 유도탄 대량 발사',
  halmeoni: '체력 2 회복 + 5초 보호막',
  halabeoji: '광역 방패벽이 적 탄을 막고 창으로 반격',
  samchon: '거대 발명 메카의 미사일 연사 + 드릴 돌진',
};

type Phase = 'loading' | 'title' | 'select' | 'prep' | 'play' | 'tally' | 'continue' | 'gameover' | 'ending' | 'credits';

/** GONA's Sky Adventure 화면 전체 (타이틀 → 동료 선택 → 플레이 → 결과). 월드맵과는 onExit 한 줄로만 연결됨 */
export default function SkyGame({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [assets, setAssets] = useState<Assets | null>(null);
  const [fam, setFam] = useState<FamilyId>(() => {
    try {
      const f = localStorage.getItem(`${NS}.fam`) as FamilyId | null;
      return f && FAMILY.includes(f) ? f : 'mom';
    } catch {
      return 'mom';
    }
  });
  const [run, setRun] = useState(0);
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<EndInfo | null>(null);
  const [records, setRecords] = useState(loadRecords);
  const [diff, setDiff] = useState<Difficulty>(() => {
    try {
      const d = localStorage.getItem(`${NS}.diff`) as Difficulty | null;
      return d && DIFFS.includes(d) ? d : 'normal';
    } catch {
      return 'normal';
    }
  });
  const [startStage, setStartStage] = useState(1);
  const [runOpts, setRunOpts] = useState<RunOpts | null>(null);
  const [stageArt, setStageArt] = useState<StageArt | null>(null);
  const [continues, setContinues] = useState(0);
  const [practice, setPractice] = useState(false);
  const [count, setCount] = useState(9);
  const [slide, setSlide] = useState(0);
  const best = Math.max(records.easy.score, records.normal.score, records.hard.score);
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

  const playing = phase === 'play' || phase === 'tally' || phase === 'continue';
  useEffect(() => {
    if (!playing || !assets || !stageArt || !runOpts || !canvasRef.current) return;
    setPaused(false);
    setGauge(0);
    setBombs(runOpts.bombs);
    const eng = new SkyEngine(
      canvasRef.current,
      assets,
      stageArt,
      runOpts,
      (r) => {
        setResult(r);
        if (r.won) {
          sfx('menuOk');
          setPhase(r.final ? 'ending' : 'tally');
          if (r.final) { setSlide(0); playBgm('ending', 1.2); recordRun(r, true); }
          else recordReach(r.stage + 1);
        } else {
          setCount(9);
          setPhase('continue');
        }
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
  }, [playing, run, assets, stageArt]); // eslint-disable-line react-hooks/exhaustive-deps

  const recordReach = (stage: number) => {
    if (practice) return;
    setRecords((r) => {
      const n = { ...r, [diff]: { ...r[diff], reach: Math.max(r[diff].reach, Math.min(stage, STAGES.length)) } };
      saveRecords(n);
      return n;
    });
  };
  const recordRun = (r: EndInfo, clear: boolean) => {
    if (practice) return;
    setRecords((rec) => {
      const cur = rec[diff];
      const n = { ...rec, [diff]: { score: Math.max(cur.score, r.score), reach: Math.max(cur.reach, r.stage), clear: cur.clear || clear } };
      saveRecords(n);
      return n;
    });
  };

  /** 스테이지 준비: 그림·BGM 을 먼저 불러온 뒤 엔진 시작 */
  const beginStage = useCallback((o: RunOpts) => {
    setRunOpts(o);
    setPhase('prep');
    const st = STAGES[o.stage - 1];
    Promise.all([loadStageArt(st.art), prepareBgm([st.bgm, st.bossBgm])])
      .then(([art]) => {
        setStageArt(art);
        setRun((n) => n + 1);
        setPhase('play');
        // 다음 스테이지 그림을 미리 받아 둠
        const nx = STAGES[o.stage];
        if (nx) void loadStageArt(nx.art);
      })
      .catch((e: unknown) => setErr(String(e)));
  }, []);

  // 컨티뉴 카운트다운
  useEffect(() => {
    if (phase !== 'continue') return;
    if (count < 0) {
      if (result) recordRun(result, false);
      setPhase('gameover');
      return;
    }
    const id = window.setTimeout(() => setCount((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [phase, count]); // eslint-disable-line react-hooks/exhaustive-deps

  // 엔딩 슬라이드 자동 넘김
  useEffect(() => {
    if (phase !== 'ending') return;
    const id = window.setTimeout(() => (slide < ENDING.length - 1 ? setSlide(slide + 1) : setPhase('credits')), 4200);
    return () => window.clearTimeout(id);
  }, [phase, slide]);

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

  const start = useCallback((f: FamilyId, d: Difficulty, stage: number) => {
    setFam(f);
    try {
      localStorage.setItem(`${NS}.fam`, f);
      localStorage.setItem(`${NS}.diff`, d);
    } catch {
      /* 무시 */
    }
    setResult(null);
    setContinues(0);
    setPractice(stage > 1);
    beginStage({ stage, diff: d, fam: f, hp: 5, bombs: DIFF[d].bombs, power: stage > 1 ? 3 : 1, score: 0 });
  }, [beginStage]);
  const nextStage = () => {
    if (!result || !runOpts) return;
    sfx('menuOk');
    beginStage({ ...runOpts, stage: result.stage + 1, hp: Math.max(result.hp, 3), bombs: Math.max(result.bombs, DIFF[runOpts.diff].bombs), power: result.power, score: result.score });
  };
  const doContinue = () => {
    if (!runOpts || !result) return;
    sfx('menuOk');
    setContinues((c) => c + 1);
    beginStage({ ...runOpts, stage: result.stage, hp: 5, bombs: DIFF[runOpts.diff].bombs, power: Math.max(2, result.power), score: 0 });
  };
  if (location.search.includes('skytest')) Object.assign(window, { __skyFlow: { nextStage, doContinue, start: (st: number, d: Difficulty = 'normal') => start(fam, d, st), phase } });

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

  if (phase === 'loading' || phase === 'prep') {
    const st = runOpts ? STAGES[runOpts.stage - 1] : null;
    return (
      <div className="sky sky-play">
        <div className="sky-loading">
          {st && <b className="ld-stage">{st.sub}</b>}
          {st && <span className="ld-name">{st.name}</span>}
          <span>LOADING...</span>
        </div>
      </div>
    );
  }

  if (phase === 'ending' || phase === 'credits') {
    const sl = ENDING[Math.min(slide, ENDING.length - 1)];
    if (phase === 'ending') {
      return (
        <div className="sky end" onClick={() => (slide < ENDING.length - 1 ? setSlide(slide + 1) : setPhase('credits'))}>
          <div className="end-pic" key={slide}>
            {sl.img === 'family' ? (
              <div className="end-family">{FAMILY.map((f) => <img key={f} src={`${BASE}v2/chars/${f}/illust.png`} alt={CHARACTERS[f].name} />)}</div>
            ) : (
              <img src={`${BASE}${sl.img}`} alt="" />
            )}
          </div>
          <p className="end-text" key={`t${slide}`}>{sl.text}</p>
          <span className="end-skip">터치하면 넘어가요 ({slide + 1}/{ENDING.length})</span>
        </div>
      );
    }
    return (
      <div className="sky end cred">
        <div className="cred-scroll">
          <h2>ALL CLEAR!</h2>
          {result && (
            <dl className="cred-score">
              <dt>최종 점수</dt><dd>{String(result.score).padStart(8, '0')}</dd>
              <dt>난이도</dt><dd>{DIFF[diff].name}</dd>
              <dt>컨티뉴</dt><dd>{continues}회</dd>
              <dt>최고 기록</dt><dd>{String(records[diff].score).padStart(8, '0')}</dd>
            </dl>
          )}
          {CREDITS.map(([a, b], i) => (
            <div className="cred-line" key={i}><small>{a}</small><b>{b}</b></div>
          ))}
        </div>
        <div className="sel-btns cred-btns">
          <button type="button" className="sky-btn sky-btn-go" onClick={() => { sfx('menuOk'); setPhase('title'); }}>타이틀로</button>
          <button type="button" className="sky-btn" onClick={onExit}>월드맵으로</button>
        </div>
      </div>
    );
  }

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
          <p className="ttl-copy">{best > 0 && <b>HI-SCORE {String(best).padStart(8, '0')}</b>} 6 STAGES · {BETA ? '공개 테스트판' : '개발판'}</p>
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
          <span className="sel-stage">6 STAGES · 황혼의 부유왕국 → 하늘 끝의 마왕성</span>
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
        <div className="sel-opts">
          <span>난이도</span>
          {DIFFS.map((d) => (
            <button type="button" key={d} className={d === diff ? 'on' : ''} onClick={() => { sfx('menuMove'); setDiff(d); setStartStage(1); }}>{DIFF[d].name}</button>
          ))}
        </div>
        <p className="sel-diffdesc">{DIFF[diff].desc}{records[diff].score > 0 && ` · 최고 ${records[diff].score}`}{records[diff].clear && ' · ALL CLEAR'}</p>
        {(DEV ? STAGES.length : records[diff].reach) > 1 && (
          <div className="sel-opts">
            <span>연습</span>
            <button type="button" onClick={() => setStartStage((n) => Math.max(1, n - 1))}>◀</button>
            <b className="sel-stno">{startStage === 1 ? 'STAGE 1부터' : `STAGE ${startStage}`}</b>
            <button type="button" onClick={() => setStartStage((n) => Math.min(DEV ? STAGES.length : records[diff].reach, n + 1))}>▶</button>
          </div>
        )}
        <div className="sel-btns">
          <button type="button" className="sky-btn sky-btn-go" onClick={() => { unlockAudio(); sfx('menuOk'); start(fam, diff, startStage); }}>출격!</button>
          <button type="button" className="sky-btn" onClick={() => { sfx('menuMove'); setPhase('title'); }}>타이틀</button>
        </div>
      </div>
    );
  }

  if (phase === 'gameover' && result) {
    return (
      <div className="sky end cred">
        <div className="cred-scroll still">
          <h2>GAME OVER</h2>
          <dl className="cred-score">
            <dt>도달</dt><dd>STAGE {result.stage}</dd>
            <dt>점수</dt><dd>{String(result.score).padStart(8, '0')}</dd>
            <dt>난이도</dt><dd>{DIFF[diff].name}</dd>
            <dt>최고 기록</dt><dd>{String(records[diff].score).padStart(8, '0')}</dd>
          </dl>
        </div>
        <div className="sel-btns cred-btns">
          <button type="button" className="sky-btn sky-btn-go" onClick={() => { sfx('menuOk'); setPhase('select'); }}>다시 도전</button>
          <button type="button" className="sky-btn" onClick={() => setPhase('title')}>타이틀</button>
          <button type="button" className="sky-btn" onClick={onExit}>월드맵</button>
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
              <button type="button" className="sky-btn" onClick={() => { setPaused(false); if (runOpts) beginStage(runOpts); }}>이 스테이지 다시</button>
              <button type="button" className="sky-btn" onClick={() => setPhase('select')}>동료 바꾸기</button>
              <button type="button" className="sky-btn" onClick={onExit}>월드맵으로</button>
            </div>
          </div>
        )}
        {phase === 'tally' && result && (
          <div className="sky-overlay">
            <div className="sky-panel tally">
              <h2>STAGE {result.stage} CLEAR!</h2>
              <dl>
                <dt>클리어 보너스</dt><dd>{result.bonus.clear}</dd>
                <dt>체력 보너스</dt><dd>{result.bonus.hp}</dd>
                <dt>폭탄 보너스</dt><dd>{result.bonus.bomb}</dd>
                <dt>노미스 보너스</dt><dd>{result.noMiss ? result.bonus.noMiss : '—'}</dd>
                <dt>합계</dt><dd><b>{result.bonus.total}</b></dd>
                <dt>SCORE</dt><dd>{String(result.score).padStart(8, '0')}</dd>
                <dt>최대 콤보</dt><dd>{result.maxCombo}</dd>
              </dl>
              <p className="tally-next">NEXT ▶ STAGE {result.stage + 1} · {STAGES[result.stage]?.name}</p>
              <button type="button" className="sky-btn sky-btn-go" onClick={nextStage}>다음 스테이지</button>
              <button type="button" className="sky-btn" onClick={() => { recordRun(result, false); setPhase('title'); }}>타이틀로</button>
            </div>
          </div>
        )}
        {phase === 'continue' && result && (
          <div className="sky-overlay">
            <div className="sky-panel cont">
              <h2>CONTINUE?</h2>
              <b className="cont-count">{Math.max(0, count)}</b>
              <p>STAGE {result.stage} · {STAGES[result.stage - 1].name}<br />이어하면 점수는 0 부터 다시 시작해요</p>
              <button type="button" className="sky-btn sky-btn-go" onClick={doContinue}>이어하기</button>
              <button type="button" className="sky-btn" onClick={() => { recordRun(result, false); setPhase('gameover'); }}>그만하기</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
