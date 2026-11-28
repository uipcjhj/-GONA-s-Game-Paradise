/**
 * 오프닝 v2 — 스토리북 이벤트 CG 플레이어 (터치 진행 · 디졸브 · 상태 기계)
 *
 *  - 대사·순서·원화는 기존 오프닝(OpeningCinematic 의 CUES · opening3 원화) 그대로. 새 그림 없음
 *  - 상태: LOADING(다음 그림 디코딩) → TRANSITION(디졸브 0.9초) → TEXT_IN(0.3초) → WAIT(터치 또는 AUTO) → TEXT_OUT(0.25초) → 다음 장면
 *    · 한 번에 한 상태 · 모든 타이머는 '세대 번호'로 묶여 장면이 바뀌면 이전 타이머가 아무것도 못 바꿈
 *    · 전환·자막이 진행 중일 때의 터치: 자막 등장 중이면 즉시 완성 · 그 외엔 무시 (한 번 터치로 두 장면 건너뛰지 않음)
 *  - 그림: DOM <img> 두 겹 (현재 · 다음) · 다음 그림은 미리 받아 decode() 끝난 뒤에만 겹쳐 opacity 0→1
 *    (캔버스 매 프레임 그리기 · 색 입힌 사본 만들기 · React 10fps 갱신 없음 → 끊김 원인 제거)
 *  - 움직임: 기본 정지 · 몇 장면만 아주 느린 패닝/부유 (transform 만 · GPU)
 */
import { Fragment, useCallback, useEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import { packPath } from './artpack';
import { playBgm, stopBgm, unlockAudio } from './audio';
import { CUES } from './OpeningCinematic';

const BASE = `${import.meta.env.BASE_URL}assets/sky/`;
const src = (rel: string): string => `${BASE}${packPath(rel, '')}`;

/** 장면 레이어: 배경 + (선택) 스프라이트 · fit 위치 · 아주 작은 움직임 */
export interface Sprite { img: string; x: number; y: number; w: number; float?: boolean }
export interface Page { bg: string; pos?: string; motion?: 'pan-up' | 'push' | 'none'; sprites?: Sprite[]; lines: number[]; hold?: number; cut?: string[] }
/** 수호자 컷인: 기존 오프닝처럼 0.6초(음악 한 박) 간격으로 한 명씩 '삭' 등장 · 실루엣 → 색 공개 · 빛줄기 */
const CUT_BEAT = 0.6;
const CUT_START = 0.75;
const L = (i: number): number => i; // CUES 번호
/** 기존 오프닝 장면 순서 그대로 (1 서기 2026 → 2 풍요 → 3 징조 → 4 사투 → 5 막혀버린 왕국 → 6 마왕 → 7 수호자 → 8 출격) */
export const PAGES: Page[] = [
  { bg: 'opening3/room-eve.jpg', lines: [L(0), L(1)] },
  { bg: 'opening3/eat-full.jpg', lines: [L(2), L(3)] },
  { bg: 'opening3/room-eve.jpg', sprites: [{ img: 'opening3/a-clutch.png', x: 50, y: 66, w: 52 }], lines: [L(4), L(5)] },
  { bg: 'opening3/strain-full.jpg', lines: [L(6)] },
  { bg: 'opening3/cry-full.jpg', lines: [L(7)] },
  { bg: 'opening3/sleep-full.jpg', motion: 'pan-up', lines: [], hold: 2.6 },
  { bg: 'opening3/castle.jpg', pos: '50% 100%', lines: [L(8), L(9)] },
  { bg: 'opening3/castle.jpg', pos: '50% 0%', sprites: [{ img: 'opening2/v-king2.png', x: 50, y: 44, w: 62 }], lines: [L(10), L(11)] },
  { bg: 'opening3/dream.jpg', sprites: [{ img: 'opening3/b-sleep.png', x: 50, y: 52, w: 46, float: true }], lines: [L(12)] },
  { bg: 'opening3/guard-bg.jpg', sprites: [
    { img: 'opening3/fam-mom.webp', x: 18, y: 34, w: 30 }, { img: 'opening3/fam-dad.webp', x: 50, y: 30, w: 30 }, { img: 'opening3/fam-imo.webp', x: 82, y: 34, w: 30 },
    { img: 'opening3/fam-halmeoni.webp', x: 18, y: 60, w: 30 }, { img: 'opening3/fam-halabeoji.webp', x: 50, y: 58, w: 32 }, { img: 'opening3/fam-samchon.webp', x: 82, y: 60, w: 30 },
  ], lines: [L(13)], cut: ['#5ec8ff', '#ff8a3c', '#b45cff', '#ff8ac8', '#7ab8ff', '#7ff0d0'] },
  { bg: 'opening3/sortie.jpg', motion: 'push', lines: [L(14), L(15)] },
];
const TITLE = PAGES.length; // 마지막 '페이지' = 타이틀

const T_DISSOLVE = 900;
const T_TEXT_IN = 300;
const T_TEXT_OUT = 250;
/** AUTO 읽기 시간: 한글 글자 수 기준 (공백·기호 제외) · 전환 시간은 따로 */
export function readMs(text: string): number {
  const n = text.replace(/\[\[|\]\]|[\s.…,!?·'"“”]/g, '').length;
  return Math.round(Math.min(9000, Math.max(3200, 1800 + n * 150)));
}

const cache = new Map<string, Promise<void>>();
/** 받기 + 디코딩 (디코딩까지 끝난 그림만 화면에 올림 → 전환 중 멈춤 없음) */
function prepare(rel: string): Promise<void> {
  const u = src(rel);
  let p = cache.get(u);
  if (!p) {
    p = new Promise<void>((res) => {
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => { (im.decode ? im.decode() : Promise.resolve()).then(() => res(), () => res()); };
      im.onerror = () => res();
      im.src = u;
    });
    cache.set(u, p);
  }
  return p;
}
const preparePage = (i: number): Promise<unknown> => (i >= PAGES.length ? Promise.all(['title/logo-v10.png', 'title/sub-v10.png'].map(prepare)) : Promise.all([PAGES[i].bg, ...(PAGES[i].sprites ?? []).map((s) => s.img)].map(prepare)));

type St = 'loading' | 'transition' | 'textIn' | 'wait' | 'textOut' | 'done';
function Line({ text }: { text: string }): ReactElement {
  const parts = text.split(/(\[\[.*?\]\])/g).filter(Boolean);
  return <>{parts.map((p, i) => (p.startsWith('[[') ? <em key={i}>{p.slice(2, -2)}</em> : <span key={i}>{p}</span>))}</>;
}
function Layer({ i, on }: { i: number; on: boolean }): ReactElement {
  if (i >= PAGES.length) {
    return (
      <div className={`os-layer os-title${on ? ' on' : ''}`}>
        <img className="os-logo" src={src('title/logo-v10.png')} alt="GONA's SKY ADVENTURE" />
        <img className="os-sublogo" src={src('title/sub-v10.png')} alt="응가 대탈출 대작전" />
        <p className="os-copy">“막힌 운명을 뚫어라!”</p>
      </div>
    );
  }
  const p = PAGES[i];
  return (
    <div className={`os-layer m-${p.motion ?? 'none'}${on ? ' on' : ''}`}>
      <img className="os-bg" src={src(p.bg)} alt="" style={p.pos ? { objectPosition: p.pos } : undefined} />
      {(p.sprites ?? []).map((s, k) => {
        if (!p.cut) return <img key={s.img} className={`os-spr${s.float ? ' float' : ''}`} src={src(s.img)} alt="" style={{ left: `${s.x}%`, top: `${s.y}%`, width: `${s.w}%` }} />;
        const v = { '--d': `${CUT_START + k * CUT_BEAT}s`, '--c': p.cut[k], '--dx': `${k % 2 ? 46 : -46}vw` } as CSSProperties;
        return (
          <Fragment key={s.img}>
            <i className={`os-streak${k % 2 ? ' r' : ''}`} style={{ ...v, top: `${s.y}%` }} />
            <img className="os-spr cut" src={src(s.img)} alt="" style={{ ...v, left: `${s.x}%`, top: `${s.y}%`, width: `${s.w}%` }} />
          </Fragment>
        );
      })}
    </div>
  );
}

export function OpeningStory({ onDone }: { onDone: () => void }): ReactElement {
  const [cur, setCur] = useState(-1);       // 화면에 확정된 장면
  const [next, setNext] = useState(-1);     // 디졸브로 올라오는 장면
  const [st, setSt] = useState<St>('loading');
  const [auto, setAuto] = useState(false);
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  const gen = useRef(0);                    // 장면이 바뀔 때마다 +1 → 이전 타이머 무효
  const timers = useRef<number[]>([]);
  const done = useRef(false);
  const stRef = useRef<St>('loading');
  const curRef = useRef(-1);
  const autoRef = useRef(false);
  const pausedRef = useRef(false);
  const waitLeft = useRef(0);               // AUTO 남은 읽기 시간 (일시정지 때 보존)
  const waitStart = useRef(0);
  const set = (s: St): void => { stRef.current = s; setSt(s); if (location.search.includes('skytest') || location.search.includes('preview')) ((window as unknown as { __osLog?: unknown[] }).__osLog ??= []).push([Math.round(performance.now()), curRef.current, s]); };
  const later = (ms: number, f: () => void): void => {
    const g = gen.current;
    timers.current.push(window.setTimeout(() => { if (g === gen.current && !done.current) f(); }, ms));
  };
  const clearTimers = (): void => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = []; };

  const finish = useCallback((): void => {
    if (done.current) return;
    done.current = true;
    clearTimers();
    stopBgm(0.6);
    window.setTimeout(onDone, 0);
  }, [onDone]);

  const armWait = (i: number): void => {
    set('wait');
    if (i >= TITLE) return;
    const p = PAGES[i];
    const text = p.lines.map((k) => CUES[k].text).join(' ');
    // 대사 없는 장면(잠드는 장면)은 짧게 머문 뒤 스스로 넘어감 · 대사 있는 장면은 AUTO 일 때만
    const ms = p.lines.length ? (autoRef.current ? readMs(text) : -1) : (p.hold ?? 2.4) * 1000;
    waitLeft.current = ms;
    if (ms >= 0 && !pausedRef.current) { waitStart.current = performance.now(); later(ms, () => advance()); }
  };
  /** 장면 i 로: 그림 준비(디코딩) → 디졸브 → 자막 등장 → 대기 */
  const goTo = (i: number): void => {
    gen.current += 1;
    clearTimers();
    set('loading');
    const g = gen.current;
    void preparePage(i).then(() => {
      if (g !== gen.current || done.current) return;
      setNext(i);                                   // 투명(opacity 0)으로 먼저 깔고
      requestAnimationFrame(() => requestAnimationFrame(() => {   // 두 프레임 뒤 1 로 → 실제 디졸브가 일어남
        if (g !== gen.current || done.current) return;
        set('transition');
        if (i >= TITLE) playBgm('title', 1.2);
        later(T_DISSOLVE, () => {
        setCur(i); curRef.current = i; setNext(-1);
        set('textIn');
        later(T_TEXT_IN, () => armWait(i));
        void preparePage(i + 1); void preparePage(i + 2);   // 다음 두 장면 미리
        });
      }));
    });
  };
  const advance = (): void => {
    const s = stRef.current;
    const i = curRef.current;
    if (s === 'textIn') { gen.current += 1; clearTimers(); armWait(i); return; } // 첫 터치: 자막 즉시 완성
    if (s !== 'wait') return;                                                   // 전환·로딩·사라지는 중엔 무시
    if (i >= TITLE) { finish(); return; }
    gen.current += 1; clearTimers();
    set('textOut');
    later(PAGES[i].lines.length ? T_TEXT_OUT : 0, () => goTo(i + 1));
  };
  const back = (): void => {
    const i = curRef.current;
    if (i <= 0 || (stRef.current !== 'wait' && stRef.current !== 'textIn')) return;
    goTo(i - 1);
  };

  useEffect(() => {
    // 첫 두 장면 디코딩 후 시작 · 나머지는 뒤에서 순서대로 미리 받기
    void Promise.all([preparePage(0), preparePage(1)]).then(() => { setReady(true); playBgm('opening', 0.3, 0.05); goTo(0); });
    let k = 2;
    const warm = (): void => { if (k > TITLE || done.current) return; void preparePage(k++).then(() => window.setTimeout(warm, 120)); };
    window.setTimeout(warm, 400);
    // 오프닝 곡(약 34초)이 끝나면 조용히 타이틀 곡으로 (천천히 읽는 사람도 무음 구간 없이)
    const bgmT = window.setTimeout(() => { if (!done.current && curRef.current < TITLE) playBgm('title', 2.5); }, 34000);
    const vis = (): void => { if (document.visibilityState === 'hidden' && !pausedRef.current) togglePause(true); };
    document.addEventListener('visibilitychange', vis);
    if (location.search.includes('skytest') || location.search.includes('preview')) Object.assign(window, { __osPages: PAGES.length + 1, __osReadMs: readMs });
    return () => { gen.current += 1; clearTimers(); window.clearTimeout(bgmT); document.removeEventListener('visibilitychange', vis); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const togglePause = (p: boolean): void => {
    pausedRef.current = p; setPaused(p);
    if (stRef.current !== 'wait' || waitLeft.current < 0) return;
    if (p) { gen.current += 1; clearTimers(); waitLeft.current = Math.max(0, waitLeft.current - (performance.now() - waitStart.current)); }
    else { waitStart.current = performance.now(); later(waitLeft.current, () => advance()); }
  };
  const toggleAuto = (): void => {
    const a = !autoRef.current;
    autoRef.current = a; setAuto(a);
    // 대기 중에 켜면 그 자리에서 읽기 시간만큼 기다린 뒤 넘김 · 끄면 타이머만 지움 (건너뛰기·중복 없음)
    if (stRef.current === 'wait') { gen.current += 1; clearTimers(); armWait(curRef.current); }
  };

  const showText = st === 'textIn' || st === 'wait';
  const page = cur >= 0 && cur < TITLE ? PAGES[cur] : null;
  // click(손을 뗀 뒤 한 번) 으로 진행 → 화면이 바뀐 자리에 다음 화면 버튼이 눌리는 '유령 클릭' 없음
  const ctl = (f: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); unlockAudio(); f(); };
  return (
    <div className={`sky os${paused ? ' paused' : ''}`} onClick={() => { unlockAudio(); if (!pausedRef.current) advance(); }}>
      <div className="os-stage">
        {/* 같은 장면은 같은 key 로 유지 → 디졸브가 끝나 '현재 장면'이 돼도 다시 만들지 않음 (컷인·카메라 움직임이 처음부터 다시 시작되지 않게) */}
        {[cur, next].filter((k, j, a) => k >= 0 && a.indexOf(k) === j).map((k) => <Layer key={`p${k}`} i={k} on={k === cur || st !== 'loading'} />)}
        {!ready && <div className="os-loading">LOADING…</div>}
      </div>
      {page && page.lines.length > 0 && (
        <div className={`os-subs${showText ? ' in' : ''}${st === 'textIn' ? ' entering' : ''}`} aria-live="polite">
          {page.lines.map((k) => <p key={k} className={`os-line ${CUES[k].cls}`}><Line text={CUES[k].text} /></p>)}
        </div>
      )}
      {st === 'wait' && cur >= 0 && !paused && (cur >= TITLE ? <p className="os-press">▶ 터치하여 시작</p> : page?.lines.length ? <span className="os-hint">▼ 터치하여 계속</span> : null)}
      <nav className="os-ctl" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="os-back" aria-label="이전 대사" onClick={ctl(back)} disabled={cur <= 0}>◀</button>
        <button type="button" className={`os-auto${auto ? ' on' : ''}`} onClick={ctl(toggleAuto)}>AUTO</button>
        <button type="button" className="os-pause" aria-label={paused ? '계속' : '일시정지'} onClick={ctl(() => togglePause(!pausedRef.current))}>{paused ? '▶' : '❚❚'}</button>
        <button type="button" className="os-skip oc-skip" onClick={ctl(finish)}>SKIP ▶▶</button>
      </nav>
      {paused && <div className="os-paused" onClick={ctl(() => togglePause(false))}><b>일시정지</b><small>터치하면 계속</small></div>}
    </div>
  );
}
