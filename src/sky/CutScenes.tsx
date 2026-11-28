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
import { audioTap, bgmInfo, playBgm, sfx, songHold, songJump, songPos, songStart, songStop } from './audio';

const BASE = `${import.meta.env.BASE_URL}assets/sky/`;
const src = (rel: string): string => `${BASE}${packPath(rel)}`;
/** 원화 비율 (가로/세로) */
const RATIO: Record<string, number> = {
  'opening3/dream.jpg': 600 / 1072, 'opening3/guard-bg.jpg': 540 / 960, 'ending/family.jpg': 810 / 1085, 'ending/hug2.jpg': 810 / 1085, 'ending/finale.jpg': 540 / 960,
};
const ratioOf = (rel: string): number => RATIO[rel] ?? 810 / 1432;
const FACE = (f: string): string => src(`chars/${f}/face.png`);


// ───────── 오프닝 ─────────
/**
 * 기존 오프닝(OpeningCinematic · tools/sky-audio/opening.py)의 음악 동기화 시각표 — 새로 정하지 않고 그대로 가져옴 (곡 위치 · 초)
 *  28.2 마왕 등장 합창 · 29.9 웃음 · 31.5 성문 '쿵' → 암전
 *  32.0 여섯 수호자 시작 · 32.1 + 0.12×i 여섯 빛 (종소리)
 *  33.0 + 0.6×i 가족 컷인 (팀파니 한 번에 한 명) — 순서 엄마 · 아빠 · 이모 · 삼촌 · 할머니 · 할아버지
 *  36.6 빛이 고나에게 모임 · 37.0 출격 장 · 38.0 고나 눈뜸(차임) · 38.4 비상(심벌 · 드럼) · 41.4 타이틀 '쿵'
 *  자막: 32.3 '그러나 작은 영웅은…' · 33.2 '고나를 걱정하던…' · 37.3 '지금, 세상에서…' · 38.6 '가장 위대한 탈출 작전…'
 */
export const OT = { march: [23.3, 28.3] as [number, number], maou: 28.2, maouHold: [28.2, 30.95] as [number, number], bIn: 31.3, gate: 31.5, s7: 32.0, chime: 32.1, cutins: 33.0, beat: 0.6, gather: 36.6, s8: 37.0, wake: 38.0, rise: 38.4, title: 41.4, songEnd: 46.5 };
const OP_FAMILY = ['mom', 'dad', 'imo', 'samchon', 'halmeoni', 'halabeoji'];
const OP_COL: Record<string, string> = { mom: '#5ec8ff', dad: '#ff8a3c', imo: '#b45cff', samchon: '#7ff0d0', halmeoni: '#ff8ac8', halabeoji: '#7ab8ff' };
const famOf = (img: string): string => (/fam-(\w+)\./.exec(img)?.[1] ?? '');

function openingSteps(): CutStep[] {
  const out: CutStep[] = [];
  const plainCg = (pi: number): CutCg => {
    const p = PAGES[pi];
    const sprites = p.sprites ?? [];
    return {
      key: `o${pi}`, ratio: ratioOf(p.bg), img: src(p.bg), preload: [p.bg, ...sprites.map((q) => q.img)].map(src),
      layers: sprites.length ? <>{sprites.map((q) => <img key={q.img} className={`cp-spr${q.float ? ' float' : ''}`} src={src(q.img)} alt="" style={{ left: `${q.x}%`, top: `${q.y}%`, width: `${q.w}%` }} />)}</> : undefined,
    };
  };
  // A. 스토리 구간 (수동): 장면 0~7 (마왕 대사까지)
  for (let pi = 0; pi <= 7; pi++) {
    const cg = plainCg(pi);
    const p = PAGES[pi];
    if (!p.lines.length) out.push({ cg, line: { kind: 'none', text: '' } });
    for (const k of p.lines) out.push({ cg, line: { kind: 'narr', text: CUES[k].text } });
  }
  // B. 음악 동기화 구간 (자동 · 곡 위치 기준)
  const dream = PAGES[8], guard = PAGES[9], sortie = PAGES[10];
  const sleep = dream.sprites?.[0];
  const ring = (i: number): [number, number] => { const a = (i / 6) * Math.PI * 2 - Math.PI / 2; return [50 + Math.cos(a) * 30, 50 + Math.sin(a) * 19]; };
  const lights = (conv: boolean): ReactElement => (
    <>{OP_FAMILY.map((f, i) => {
      const [x, y] = ring(i);
      const st = { left: `${x}%`, top: `${y}%`, '--c': OP_COL[f], '--dx': `${(50 - x) * 4.5}%`, '--dy': `${(52 - y) * 4.5}%` } as CSSProperties;
      return <i key={f} className={`cp-light${conv ? ' cv' : ''}`} data-at={conv ? OT.s8 : +(OT.chime + i * 0.12).toFixed(2)} data-k={`${conv ? '모임' : '빛'}:${f}`} style={st} />;
    })}</>
  );
  const sleepImg = sleep ? <img className="cp-spr float" src={src(sleep.img)} alt="" style={{ left: `${sleep.x}%`, top: `${sleep.y}%`, width: `${sleep.w}%` }} /> : null;
  out.push({
    sync: true, dis: 450,
    cg: { key: 'o8', ratio: ratioOf(dream.bg), img: src(dream.bg), preload: [dream.bg, ...(sleep ? [sleep.img] : [])].map(src), layers: <>{sleepImg}{lights(false)}</> },
    line: { kind: 'narr', text: CUES[12].text },
  });
  const gs = guard.sprites ?? [];
  out.push({
    sync: true, at: 32.75, dis: 250,
    cg: {
      key: 'o9', ratio: ratioOf(guard.bg), img: src(guard.bg), preload: [guard.bg, ...gs.map((q) => q.img)].map(src),
      layers: (
        <>{gs.map((q) => {
          const f = famOf(q.img);
          const k = OP_FAMILY.indexOf(f);
          const at = +(OT.cutins + k * OT.beat).toFixed(2);
          const v = { '--c': OP_COL[f], '--dx': `${k % 2 ? 60 : -60}%` } as CSSProperties;
          return (
            <span key={q.img}>
              <i className={`os-streak${k % 2 ? ' r' : ''}`} data-at={at} style={{ ...v, top: `${q.y}%` }} />
              <img className="cp-spr cut" data-at={at} data-k={`등장:${f}`} src={src(q.img)} alt="" style={{ ...v, left: `${q.x}%`, top: `${q.y}%`, width: `${q.w}%` }} />
            </span>
          );
        })}<i className="cp-gather" data-at={OT.gather} data-k="빛 모임" /></>
      ),
    },
    line: { kind: 'narr', text: CUES[13].text },
  });
  out.push({
    sync: true, at: OT.s8, dis: 400,
    cg: {
      key: 'o8w', ratio: ratioOf(dream.bg), img: src(dream.bg), preload: [dream.bg, 'opening3/b-sleep.png', 'opening3/b-wake.png'].map(src),
      layers: (
        <>
          {lights(true)}
          {sleep && <img className="cp-spr cp-swapout" data-at={OT.wake} src={src(sleep.img)} alt="" style={{ left: `${sleep.x}%`, top: `${sleep.y}%`, width: `${sleep.w}%` }} />}
          {sleep && <img className="cp-spr cp-swapin" data-at={OT.wake} data-k="고나 눈뜸" src={src('opening3/b-wake.png')} alt="" style={{ left: `${sleep.x}%`, top: `${sleep.y}%`, width: `${sleep.w}%` }} />}
          <i className="cp-glow" data-at={OT.wake} />
        </>
      ),
    },
    line: { kind: 'narr', text: CUES[14].text },
  });
  out.push({
    sync: true, at: OT.rise, dis: 450,
    cg: { key: 'o10', ratio: ratioOf(sortie.bg), img: src(sortie.bg), preload: [src(sortie.bg)], layers: <i className="cp-spark-in" /> },
    line: { kind: 'narr', text: CUES[15].text },
  });
  // 타이틀 (41.4 '쿵'에 맞춰 자동 도착 → 여기서부터 다시 수동)
  out.push({
    at: OT.title, dis: 350,
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
 * 오프닝 음악 흐름 (한 곡 · 재생 위치가 곧 연출 시계)
 *  A 스토리 구간(수동): 곡을 0초부터. 읽는 속도가 느리면 곡이 앞서 가지 않도록
 *     - 마왕 장면 전에는 '똥돌이 병사 행진'(23.3~28.3초 · 화음 D–B♭–G–A 가 다시 D 로) 을 이음매 없이 반복
 *     - 마왕 장면(첫 진입)에서는 곡을 마왕 등장 지점(28.2초)으로 · 머무는 동안 28.2~30.95초 반복 (웃음·천둥)
 *  B 음악 동기화 구간(자동): 마지막 마왕 대사에서 터치하면 곡을 31.3초(성문 '쿵' 직전)로 → 그 뒤 모든 등장·장면 전환이 곡 위치 기준
 *     (가족 컷인 33.0 + 0.6×i · 고나 눈뜸 38.0 · 비상 38.4 · 타이틀 41.4)
 *  타이틀: 오프닝 곡의 끝(타이틀 팡파르)이 거의 끝날 때 타이틀 곡으로 2초 교차 페이드
 */
export function CutOpening({ onDone }: { onDone: () => void }): ReactElement {
  const steps = useMemo(openingSteps, []);
  const bFirst = steps.findIndex((q) => q.sync);
  const maouFirst = steps.findIndex((q) => q.cg.key === 'o7');
  const started = useRef(false);
  const titled = useRef(false);
  const where = useRef<'a' | 'maou' | 'b'>('a');
  const log = (ev: string): void => {
    if (!location.search.includes('skytest') && !location.search.includes('preview')) return;
    ((window as unknown as { __bgmLog?: unknown[] }).__bgmLog ??= []).push([Math.round(performance.now()), ev, +songPos().toFixed(2)]);
  };
  useEffect(() => {
    if (location.search.includes('skytest') || location.search.includes('preview')) Object.assign(window, { __bgmInfo: bgmInfo, __audioTap: audioTap, __songPos: songPos, __OT: OT });
    // 타이틀 화면에 와 있고 곡(타이틀 팡파르)이 끝나 가면 → 타이틀 곡으로 2초 교차 페이드
    const id = window.setInterval(() => {
      if (titled.current || where.current !== 'b') return;
      if (songPos() >= OT.songEnd - 2.2) { titled.current = true; songStop(2.2); playBgm('title', 0.1, 2.2); log('title:곡 끝(타이틀 화면)'); }
    }, 100);
    return () => { window.clearInterval(id); if (!titled.current) songStop(0.8); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <CutPlayer
      name="opening"
      steps={steps}
      onDone={onDone}
      clock={songPos}
      onEnter={(i) => {
        if (!started.current) { started.current = true; void songStart('opening', 0, 0.6).then(() => songHold(...OT.march)); log('곡 시작 0초'); return; }
        if (i >= bFirst) {
          if (i === bFirst) { where.current = 'b'; titled.current = false; songJump(OT.bIn, 0.35); log(`동기화 구간 진입 → ${OT.bIn}초`); }
          return;
        }
        if (i >= maouFirst) {
          const p = songPos();
          if (where.current !== 'maou' || p < 27.9 || p >= 31.2) { songJump(OT.maou, 0.8); log(`마왕 장면 → ${OT.maou}초`); }
          where.current = 'maou';
          songHold(...OT.maouHold);
          return;
        }
        if (where.current !== 'a') { songJump(OT.march[0], 0.8); log(`이전 장면으로 → ${OT.march[0]}초`); }
        where.current = 'a';
        songHold(...OT.march);
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
