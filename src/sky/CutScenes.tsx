/**
 * 오프닝 · 엔딩 · 에필로그 → 공통 컷신 플레이어(CutPlayer) 용 단계 목록
 *  - 문구·순서는 기존 그대로: 오프닝 = OpeningCinematic 의 CUES (장면 묶음은 OpeningStory 의 PAGES) · 엔딩/에필로그 = PoopEnding 의 SCENES
 *  - 바뀐 것은 표시 방식만: 대사 한 줄 = 한 단계 · 같은 CG 면 글자만 바뀜
 *  - 연출 정리: 반복 줌·카메라 이동·흔들림 제거 / 남긴 것 = 수호자 컷인 · 꿈속 고나 살짝 떠 있기 · 뿡!(짧은 강조) · 하트 · 은은한 빛
 */
import { useEffect, useMemo, useRef, type CSSProperties, type ReactElement } from 'react';
import { CutPlayer, type CutCg, type CutStep } from './CutPlayer';
import { PAGES } from './OpeningStory';
import { CUES } from './OpeningCinematic';
import { SCENES, type SceneId } from './PoopEnding';
import { packPath, hasPack } from './artpack';
import { audioTap, bgmInfo, playBgm, releaseBgm, sfx } from './audio';

const BASE = `${import.meta.env.BASE_URL}assets/sky/`;
const src = (rel: string): string => `${BASE}${packPath(rel)}`;
/** 원화 비율 (가로/세로) */
const RATIO: Record<string, number> = {
  'opening3/dream.jpg': 600 / 1072, 'opening3/guard-bg.jpg': 540 / 960, 'ending/family.jpg': 810 / 1085, 'ending/hug2.jpg': 810 / 1085, 'ending/finale.jpg': 540 / 960,
};
const ratioOf = (rel: string): number => RATIO[rel] ?? 810 / 1432;
const FACE = (f: string): string => src(`chars/${f}/face.png`);

const CUT_BEAT = 0.6;
const CUT_START = 0.6;

// ───────── 오프닝 ─────────
function openingSteps(): CutStep[] {
  const out: CutStep[] = [];
  PAGES.forEach((p, pi) => {
    const sprites = p.sprites ?? [];
    const cg: CutCg = {
      key: `o${pi}`,
      ratio: ratioOf(p.bg),
      img: src(p.bg),
      preload: [p.bg, ...sprites.map((s) => s.img)].map(src),
      layers: sprites.length ? (
        <>
          {sprites.map((s, k) => {
            if (!p.cut) return <img key={s.img} className={`cp-spr${s.float ? ' float' : ''}`} src={src(s.img)} alt="" style={{ left: `${s.x}%`, top: `${s.y}%`, width: `${s.w}%` }} />;
            // 여섯 수호자: 기존 오프닝처럼 한 박(0.6초)에 한 명씩 '삭' 등장
            const v = { '--d': `${CUT_START + k * CUT_BEAT}s`, '--c': p.cut[k], '--dx': `${k % 2 ? 60 : -60}%` } as CSSProperties;
            return (
              <span key={s.img}>
                <i className={`os-streak${k % 2 ? ' r' : ''}`} style={{ ...v, top: `${s.y}%` }} />
                <img className="cp-spr cut" src={src(s.img)} alt="" style={{ ...v, left: `${s.x}%`, top: `${s.y}%`, width: `${s.w}%` }} />
              </span>
            );
          })}
        </>
      ) : undefined,
    };
    if (!p.lines.length) out.push({ cg, line: { kind: 'none', text: '' } });
    for (const k of p.lines) out.push({ cg, line: { kind: 'narr', text: CUES[k].text } });
  });
  // 마지막: 타이틀
  out.push({
    cg: {
      key: 'title', ratio: 9 / 16, cls: 'cp-title', preload: ['title/logo-v10.png', 'title/sub-v10.png'].map(src),
      layers: (
        <div className="cp-titlebox">
          <img className="os-logo" src={src('title/logo-v10.png')} alt="GONA's SKY ADVENTURE" />
          <img className="os-sublogo" src={src('title/sub-v10.png')} alt="응가 대탈출 대작전" />
          <p className="os-copy">“막힌 운명을 뚫어라!”</p>
        </div>
      ),
    },
    line: { kind: 'press', text: '' },
  });
  return out;
}

/**
 * 오프닝 음악 흐름 (한 곡이 끝까지 이어지게)
 *  - 첫 장면에서 오프닝 곡을 처음부터 1회 시작 ('openingHold') — 그림 전환 · ◀ 이전 · 빠른 연타에도 다시 시작하지 않음
 *  - 타이틀 화면에 닿기 전에 곡이 '여섯 수호자' 악절(33.0~37.8초)까지 오면 그 악절을 이음매 없이 반복하며 기다림
 *    (출격 고조 · 타이틀 '쿵'은 타이틀 곡이 맡음 → 타이틀 음악이 타이틀보다 먼저 나오지 않음)
 *  - 타이틀 화면에 닿는 순간에만 2초 교차 페이드로 타이틀 곡
 */
export function CutOpening({ onDone }: { onDone: () => void }): ReactElement {
  const steps = useMemo(openingSteps, []);
  const title = steps.length - 1;
  const started = useRef(false);
  const titled = useRef(false);
  const log = (ev: string): void => {
    if (!location.search.includes('skytest') && !location.search.includes('preview')) return;
    const b = bgmInfo();
    ((window as unknown as { __bgmLog?: unknown[] }).__bgmLog ??= []).push([Math.round(performance.now()), ev, b.name, +b.pos.toFixed(2), +b.dur.toFixed(1)]);
  };
  useEffect(() => {
    if (location.search.includes('skytest') || location.search.includes('preview')) Object.assign(window, { __bgmInfo: bgmInfo, __audioTap: audioTap });
    // 오프닝이 끝나면(교차 페이드가 끝난 뒤) 오프닝 곡 메모리 반납
    return () => { window.setTimeout(() => releaseBgm('openingHold'), 3000); };
  }, []);
  return (
    <CutPlayer
      name="opening"
      steps={steps}
      onDone={onDone}
      onStep={(i) => {
        if (!started.current) { started.current = true; playBgm('openingHold', 0.8, 0.6); log('opening:start'); }
        if (i === title && !titled.current) { titled.current = true; playBgm('title', 2.0, 2.0); log('title:타이틀 화면'); }
      }}
    />
  );
}

// ───────── 엔딩 · 에필로그 ─────────
const heart = (): string => `${BASE}${packPath('fx/heal-heart.png', 'v2/fx/heart-p.png')}`;
function endingSteps(startScene: number, stopAfter?: SceneId): CutStep[] {
  const P = (rel: string): string | null => (hasPack(rel) ? src(rel) : null);
  const one = (key: string, rel: string, layers?: ReactElement, extra: string[] = []): CutCg => ({ key, ratio: ratioOf(rel), img: P(rel) ?? src('title/keyart.jpg'), layers, preload: [P(rel) ?? src('title/keyart.jpg'), ...extra] });
  const room = (key: string, kid: string): CutCg => ({
    key, ratio: ratioOf('opening3/room-morn.jpg'), img: src('opening3/room-morn.jpg'), preload: [src('opening3/room-morn.jpg'), src(kid)],
    layers: <img className="cp-spr cp-kid" src={src(kid)} alt="고나" />,
  });
  const puffs = (
    <>
      <b className="cp-boom">뿡!</b>
      {['a', 'b', 'c'].map((k) => <i key={k} className={`pe-puff ${k}`} style={{ backgroundImage: `url(${src('fx/steam-puff.png')})` }} />)}
    </>
  );
  const hearts = <div className="pe-hearts">{Array.from({ length: 7 }, (_, i) => <i key={i} style={{ left: `${10 + i * 12}%`, animationDelay: `${(i % 4) * 0.5}s`, backgroundImage: `url(${heart()})` }} />)}</div>;
  const CG: Record<string, CutCg> = {
    train: one('e-train', 'ending/collapse.jpg', <i className="pe-sparkle" />),
    white: { key: 'e-white', ratio: 810 / 1432, cls: 'cp-white', preload: [] },
    wake: one('e-wake', 'ending/wake.jpg'),
    st1: room('e-st1', 'opening3/n-strain.png'),
    st2: room('e-st2', 'opening3/n-strain2.png'),
    fart: one('e-fart', 'ending/relief.jpg', puffs, [src('fx/steam-puff.png')]),
    success: one('e-family', 'ending/family.jpg'),
    hug: one('e-hug', 'ending/hug2.jpg', hearts, [heart()]),
    epi: one('e-epi', 'ending/epilogue.jpg', <i className="pe-sparkle" />),
  };
  const out: CutStep[] = [];
  for (let s = startScene; s < SCENES.length; s++) {
    const sc = SCENES[s];
    if (sc.id === 'epi' && !hasPack('ending/epilogue.jpg')) break;
    sc.lines.forEach((l, i) => {
      const cg = sc.id === 'strain' ? (i === 0 ? CG.wake : i === 1 ? CG.st1 : CG.st2) : CG[sc.id];
      const first = i === 0;
      const enter = (): void => {
        // 기존 엔딩 효과음 그대로 (장면 첫 줄 · 줄마다)
        if (first && sc.id === 'white') sfx('cutin', 0.8);
        if (first && sc.id === 'fart') { sfx('boomS', 0.9); sfx('shotHeavy', 0.6); }
        if (first && sc.id === 'success') sfx('gaugeFull', 0.9);
        if (first && sc.id === 'hug') sfx('heal', 0.8);
        if (sc.id === 'train' && i === 1) sfx('start', 0.8);
        if (sc.id === 'strain' && i === 2) sfx('chargeUp', 0.7);
        if (sc.id === 'success' && i > 0) sfx('item', 0.6);
      };
      const line = l.who === 'narr'
        ? { kind: 'narr' as const, text: l.text }
        : { kind: 'char' as const, text: l.text, name: l.name, face: l.who === 'train' ? src('ending/train.png') : l.fam ? FACE(l.fam) : undefined, faceCls: l.who === 'train' ? 'train' : '' };
      out.push({ cg, line, enter });
    });
    if (sc.id === stopAfter) break;
  }
  return out;
}

export function CutEnding({ onDone, startScene = 0, stopAfter }: { onDone: () => void; startScene?: number; stopAfter?: SceneId }): ReactElement {
  const steps = useMemo(() => endingSteps(startScene, stopAfter), [startScene, stopAfter]);
  return <CutPlayer name={startScene >= 6 ? 'epilogue' : 'ending'} steps={steps} onDone={onDone} skipLabel="SKIP ▶▶" />;
}
