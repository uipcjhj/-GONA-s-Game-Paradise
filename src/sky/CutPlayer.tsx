/**
 * 공통 컷신 플레이어 (오프닝 · 엔딩 · 에필로그) — 90년대 RPG 이벤트 CG + 하단 고정 대사창
 *
 *  화면: 위 = 이벤트 CG (원화 비율 그대로 · 잘리지 않게 화면 안에 맞춤) / 아래 = 네이비·골드 대사창 (위치·높이 고정)
 *  대사창: TYPE A 캐릭터(초상화 · 이름표 · 대사) / TYPE B 나레이션(크림색 · 넓게) — 같은 프레임 · 같은 높이 · 같은 본문 기준선
 *
 *  상태:  load(다음 CG 받기·디코딩) → dissolve(교차 디졸브 0.8초) → in(글자 0.25초 페이드인) → wait(터치 대기) → out(0.15초) → 다음
 *   - 같은 CG 안에서 다음 대사로: 글자만 바꿈 (CG 는 그대로)
 *   - CG 가 바뀔 때만 디졸브 (다음 그림이 준비될 때까지 지금 그림 유지 · 검은 화면 없음)
 *   - 기본은 수동 (터치할 때까지 글자 유지) · AUTO 는 선택 (기본 꺼짐 · 한글 길이로 읽기 시간 계산)
 *   - 장면 번호가 바뀔 때마다 세대(gen) +1 → 이전 타이머 전부 무효 (타이머 겹침으로 글자가 사라지는 일 없음)
 *   - 진행은 click(손을 뗀 뒤 한 번) · in/out/dissolve 중 연타는 무시 → 두 장씩 넘어가지 않음
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { unlockAudio } from './audio';

export interface CutCg {
  key: string;
  /** 원화 가로/세로 비율 */
  ratio: number;
  img?: string;
  /** 그림 위에 얹는 것 (스프라이트 · 하트 · 효과) — CG 상자 기준 % 좌표 */
  layers?: ReactNode;
  /** 미리 받을 그림 (img 포함) */
  preload: string[];
  cls?: string;
}
export type CutKind = 'narr' | 'char' | 'none' | 'press';
export interface CutLine { kind: CutKind; text: string; name?: string; face?: string; faceCls?: string }
export interface CutStep { cg: CutCg; line: CutLine; enter?: () => void }

const T_DISSOLVE = 800;
const T_IN = 250;
const T_OUT = 150;
/** AUTO 읽기 시간 (한글 글자 수 기준, 공백·기호 제외) */
export function readMs(text: string): number {
  const n = text.replace(/\[\[|\]\]|[\s.…,!?·'"“”~()]/g, '').length;
  return Math.round(Math.min(9000, Math.max(2600, 1600 + n * 150)));
}

const cache = new Map<string, Promise<void>>();
export function prepare(u: string): Promise<void> {
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
const prepCg = (cg: CutCg): Promise<unknown> => Promise.all(cg.preload.map(prepare));

/** [[ ]] = 금색 강조 */
function Rich({ text }: { text: string }): ReactElement {
  const parts = text.split(/(\[\[.*?\]\])/g).filter(Boolean);
  return <>{parts.map((p, i) => (p.startsWith('[[') ? <em key={i}>{p.slice(2, -2)}</em> : <span key={i}>{p}</span>))}</>;
}
const plain = (t: string): string => t.replace(/\[\[|\]\]/g, '');

function Layer({ cg, on }: { cg: CutCg; on: boolean }): ReactElement {
  return (
    <div className={`cp-layer${on ? ' on' : ''}`}>
      <div className={`cp-cg${cg.cls ? ` ${cg.cls}` : ''}`} style={{ '--r': cg.ratio } as CSSProperties}>
        {cg.img && <img className="cp-bg" src={cg.img} alt="" draggable={false} />}
        {cg.layers}
      </div>
    </div>
  );
}

type St = 'load' | 'dissolve' | 'in' | 'wait' | 'out' | 'done';

export function CutPlayer({ steps, onDone, onStep, skipLabel = 'SKIP ▶▶', name }: {
  steps: CutStep[];
  onDone: () => void;
  /** 단계가 화면에 확정될 때 (음악 바꾸기 등) */
  onStep?: (i: number) => void;
  skipLabel?: string;
  /** 자동 검수용 이름 (opening / ending) */
  name: string;
}): ReactElement {
  const [idx, setIdx] = useState(-1);          // 대사창에 있는 단계
  const [cur, setCur] = useState<string | null>(null);   // 확정된 CG
  const [next, setNext] = useState<string | null>(null); // 디졸브로 올라오는 CG
  const [st, setSt] = useState<St>('load');
  const [auto, setAuto] = useState(false);
  const [keepFace, setKeepFace] = useState(false);  // 같은 사람이 이어서 말하면 초상화·이름표는 그대로
  const gen = useRef(0);
  const timers = useRef<number[]>([]);
  const done = useRef(false);
  const stRef = useRef<St>('load');
  const idxRef = useRef(-1);
  const curRef = useRef<string | null>(null);
  const autoRef = useRef(false);
  const cgs = useRef(new Map<string, CutCg>());
  if (!cgs.current.size) for (const s of steps) if (!cgs.current.has(s.cg.key)) cgs.current.set(s.cg.key, s.cg);
  const test = location.search.includes('skytest') || location.search.includes('preview');

  const set = (s: St): void => {
    stRef.current = s; setSt(s);
    if (test) {
      const w = window as unknown as { __cutLog?: unknown[]; __cut?: unknown };
      (w.__cutLog ??= []).push([Math.round(performance.now()), idxRef.current, s, curRef.current]);
      const l = steps[idxRef.current]?.line;
      w.__cut = { name, i: idxRef.current, n: steps.length, st: s, kind: l?.kind, who: l?.name ?? '', text: l ? plain(l.text) : '', cg: curRef.current, auto: autoRef.current };
    }
  };
  const later = (ms: number, f: () => void): void => {
    const g = gen.current;
    timers.current.push(window.setTimeout(() => { if (g === gen.current && !done.current) f(); }, ms));
  };
  const clear = (): void => { gen.current += 1; timers.current.forEach((t) => window.clearTimeout(t)); timers.current = []; };

  const finish = useCallback((): void => {
    if (done.current) return;
    clear();
    set('done');
    done.current = true;
    window.setTimeout(onDone, 0);
  }, [onDone]); // eslint-disable-line react-hooks/exhaustive-deps

  const armWait = (i: number): void => {
    set('wait');
    if (!autoRef.current) return;
    const l = steps[i].line;
    later(l.kind === 'press' ? 99999999 : l.text ? readMs(plain(l.text)) : 2400, () => advance());
  };
  const enterText = (i: number): void => {
    idxRef.current = i; setIdx(i);
    steps[i].enter?.();
    onStep?.(i);
    set('in');
    later(T_IN, () => armWait(i));
  };
  /** 단계 i 로 (CG 가 같으면 글자만 · 다르면 준비 → 디졸브 → 글자) */
  const show = (i: number): void => {
    clear();
    const cg = steps[i].cg;
    if (cg.key === curRef.current) { enterText(i); return; }
    idxRef.current = i; setIdx(i);
    set('load');
    const g = gen.current;
    void prepCg(cg).then(() => {
      if (g !== gen.current || done.current) return;
      setNext(cg.key);                                            // 투명으로 먼저 깔고
      requestAnimationFrame(() => requestAnimationFrame(() => {   // 두 프레임 뒤 불투명으로 → 실제 교차 디졸브
        if (g !== gen.current || done.current) return;
        set('dissolve');
        later(curRef.current ? T_DISSOLVE : 450, () => {
          curRef.current = cg.key; setCur(cg.key); setNext(null);
          enterText(i);
          // 다음 두 CG 미리 받기
          const ks = new Set<string>();
          for (let k = i + 1; k < steps.length && ks.size < 2; k++) if (steps[k].cg.key !== cg.key) { ks.add(steps[k].cg.key); void prepCg(steps[k].cg); }
        });
      }));
    });
  };
  const go = (i: number): void => {
    const a = steps[idxRef.current]?.line, b = steps[i]?.line;
    setKeepFace(!!a && !!b && a.kind === 'char' && b.kind === 'char' && a.name === b.name && steps[i].cg.key === curRef.current);
    clear();
    set('out');
    later(T_OUT, () => show(i));
  };
  const advance = (): void => {
    const s = stRef.current;
    const i = idxRef.current;
    if (s === 'in') { clear(); armWait(i); return; }   // 페이드 중 터치: 바로 다 보이기
    if (s !== 'wait') return;                          // 받는 중 · 디졸브 · 사라지는 중엔 무시
    if (i + 1 >= steps.length) { finish(); return; }
    go(i + 1);
  };
  const back = (): void => {
    const i = idxRef.current;
    if (i <= 0 || (stRef.current !== 'wait' && stRef.current !== 'in')) return;
    go(i - 1);
  };
  const toggleAuto = (): void => {
    autoRef.current = !autoRef.current; setAuto(autoRef.current);
    if (stRef.current === 'wait') { clear(); armWait(idxRef.current); }
  };

  useEffect(() => {
    void Promise.all(steps.slice(0, 6).map((s) => prepCg(s.cg))).then(() => show(0));
    // 나머지 CG 는 뒤에서 차례로 받아 둠 (디졸브 때 멈춤 없게)
    const keys = [...cgs.current.values()];
    let k = 0;
    const warm = (): void => { if (k >= keys.length || done.current) return; void prepCg(keys[k++]).then(() => window.setTimeout(warm, 80)); };
    window.setTimeout(warm, 600);
    // 앱이 가려졌다 돌아오면: 진행 위치 그대로 · AUTO 타이머만 처음부터
    const vis = (): void => { if (document.visibilityState === 'visible' && stRef.current === 'wait') { clear(); armWait(idxRef.current); } else if (document.visibilityState === 'hidden') { const s = stRef.current; clear(); if (s === 'in') set('wait'); } };
    document.addEventListener('visibilitychange', vis);
    const key = (e: KeyboardEvent): void => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'z') { e.preventDefault(); advance(); } else if (e.key === 'Escape') finish(); };
    window.addEventListener('keydown', key);
    if (test) Object.assign(window, { __cutSteps: steps.map((s) => ({ cg: s.cg.key, kind: s.line.kind, name: s.line.name ?? '', text: plain(s.line.text) })) });
    return () => { clear(); document.removeEventListener('visibilitychange', vis); window.removeEventListener('keydown', key); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const step = idx >= 0 ? steps[idx] : null;
  const line = step?.line;
  const textOn = st === 'in' || st === 'wait';
  const faceOn = textOn || (st === 'out' && keepFace);
  const narr = !line || line.kind !== 'char';
  const long = !!line && line.kind === 'narr' && [...plain(line.text)].length > 30;
  const ctl = (f: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); unlockAudio(); f(); };
  const shown = [cur, next].filter((k, j, a): k is string => !!k && a.indexOf(k) === j);
  return (
    <div className={`sky cp cp-${name}`} onClick={() => { unlockAudio(); advance(); }}>
      <div className="cp-stage">
        {shown.map((k) => <Layer key={k} cg={cgs.current.get(k)!} on={k === cur || st !== 'load'} />)}
        <nav className="cp-ctl" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="cp-back" aria-label="이전 대사" onClick={ctl(back)} disabled={idx <= 0}>◀</button>
          <button type="button" className={`cp-auto${auto ? ' on' : ''}`} aria-pressed={auto} onClick={ctl(toggleAuto)}>AUTO</button>
          <button type="button" className="cp-skip" onClick={ctl(finish)}>{skipLabel}</button>
        </nav>
      </div>
      <div className="cp-dock">
        <div className={`cp-box${narr ? ' narr' : ' char'}`} aria-live="polite">
          {!narr && line && (
            <>
              <div className={`cp-face${faceOn ? ' on' : ''}`}><span className={line.faceCls} style={line.face ? { backgroundImage: `url(${line.face})` } : undefined} /></div>
              <b className={`cp-name${faceOn ? ' on' : ''}`}>{line.name}</b>
            </>
          )}
          <div className={`cp-text${textOn ? ' on' : ''}${st === 'in' ? ' entering' : ''}${long ? ' long' : ''}`}>
            {line && (line.kind === 'narr' || line.kind === 'char') && <p><Rich text={line.text} /></p>}
            {line?.kind === 'press' && <p className="cp-press">▶ 터치하여 시작</p>}
          </div>
          <span className={`cp-more${st === 'wait' && line?.kind !== 'press' ? ' on' : ''}`}>{idx + 1 < steps.length ? '▼' : '■'}</span>
        </div>
      </div>
    </div>
  );
}
