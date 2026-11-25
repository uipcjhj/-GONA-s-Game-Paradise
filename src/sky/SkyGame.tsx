import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { loadAssets, loadStageArt, type Assets, type StageArt } from './assets';
import { initAudio, preloadAudio, prepareBgm, playBgm, stopBgm, sfx, isMuted, setMuted, audioUnlocked, audioState, audioTap, audioDiag, unlockAudio, reviveAudio, testBeep, forceHtmlAudio } from './audio';
import { SkyEngine, SPECIAL_NAME, WEAPON_NAME, type EndInfo, type FamilyId, type RunOpts } from './engine';
import { josaWa, submit, bestOf, topOf, stageBoard, runBoard, dailyBoard, dailyFor, dailyState, dailyTry, dailyHistory, today, recordClear, setFlags, clears, clearKey, achievements, markSeen, DIFF_ORDER, recordStage, stampBoard, missions, type Daily, type Submitted } from './records';
import { activeProfile, createProfile, renameProfile, profiles, switchProfile, profileKey, exportProfile, importProfile } from './profile';
import { parTime } from './rank';
import { STAGES, DIFF, type Difficulty } from './stages';
import { CHARACTERS } from './data/characters';
import { settings, saveSettings, canVibrate, iosHaptic, buzz } from './settings';
import { NS, BETA, PROD } from './ns';
import { THEME, familyText } from './theme';
import { packPath } from './artpack';
import { talkLines, talkMode, type TalkKey } from './story';
import { TalkBox, BarkBox, resolveLines, type TalkLine } from './TalkBox';
import { PoopEnding } from './PoopEnding';
import { OpeningCinematic } from './OpeningCinematic';
import { HUB, HubBack, TestHub, type HubGo } from './TestHub';
import './sky.css';

const BASE = `${import.meta.env.BASE_URL}assets/sky/`;
const FAMILY: FamilyId[] = ['mom', 'dad', 'imo', 'halmeoni', 'halabeoji', 'samchon'];
const REC_KEY = `${NS}.records`;
const DIFFS: Difficulty[] = ['easy', 'normal', 'hard'];
// 테스트 메뉴(STAGE 1~6 선택 · 엔딩 보기): 주소에 ?dev / ?skytest, 또는 #dev (미리보기 링크는 #dev 만 전달됨)
const DEV = !PROD && (/[?&](dev|skytest)/.test(location.search) || location.hash === '#dev');
interface Rec { score: number; reach: number; clear: boolean }
type Records = Record<Difficulty, Rec>;
function loadRecords(): Records {
  const def: Records = { easy: { score: 0, reach: 1, clear: false }, normal: { score: 0, reach: 1, clear: false }, hard: { score: 0, reach: 1, clear: false } };
  try {
    const r = JSON.parse(localStorage.getItem(profileKey(REC_KEY)) ?? '{}') as Partial<Records>;
    for (const d of DIFFS) def[d] = { ...def[d], ...(r[d] ?? {}) };
  } catch {
    /* 무시 */
  }
  return def;
}
function saveRecords(r: Records): void {
  try {
    localStorage.setItem(profileKey(REC_KEY), JSON.stringify(r));
  } catch {
    /* 무시 */
  }
}
const DANGER = ['쌀알 병사 · 떡주먹 포 조심', '포자 소나기 · 가스 폭발 주의', '톱니 레이저 · 개틀링 탄막', '유도 촉수 · 물결 탄막', '방패 돌진 · 저격 비', '마왕의 봉인 · 십자 레이저 · 모든 것의 끝'];
const FAM_KO: Record<FamilyId, string> = { mom: '엄마', dad: '아빠', imo: '이모', halmeoni: '할머니', halabeoji: '할아버지', samchon: '삼촌' };
/** 기념사진을 폴라로이드 PNG 한 장으로 (닉네임 · 동료 · 난이도 · 날짜 · 점수 · 랭크 · 배지 도장) → 공유 또는 내려받기 */
async function savePhotoPng(src: string, badge: string | null, face: string | null, lines: [string, string, string], fileName: string): Promise<string> {
  const load = (u: string): Promise<HTMLImageElement> => new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = u; });
  const [ph, bd, fc] = await Promise.all([load(src), badge ? load(badge).catch(() => null) : null, face ? load(face).catch(() => null) : null]);
  const c = document.createElement('canvas');
  c.width = 640; c.height = 960;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff8ea'; g.fillRect(0, 0, 640, 960);
  g.strokeStyle = '#120a26'; g.lineWidth = 6; g.strokeRect(3, 3, 634, 954);
  g.drawImage(ph, 40, 40, 560, 747);
  g.strokeStyle = '#c8b89a'; g.lineWidth = 2; g.strokeRect(40, 40, 560, 747);
  g.textAlign = 'center'; g.fillStyle = '#3a1a08';
  g.font = '700 30px "Gowun Batang", serif'; g.fillText(lines[0], 320, 840);
  g.font = '700 22px Galmuri11, monospace'; g.fillStyle = '#7a3a0a'; g.fillText(lines[1], 320, 884);
  g.font = '18px Galmuri11, monospace'; g.fillStyle = '#6a4a2a'; g.fillText(lines[2], 320, 918);
  if (bd) { g.save(); g.translate(560, 760); g.rotate(0.18); g.drawImage(bd, -60, -86, 120, 172); if (fc) { g.beginPath(); g.arc(0, -86 + 172 * 0.21 + 20, 20, 0, Math.PI * 2); g.clip(); g.drawImage(fc, -20, -86 + 172 * 0.21, 40, 40); } g.restore(); }
  const blob: Blob | null = await new Promise((ok) => c.toBlob(ok, 'image/png'));
  c.width = 0; c.height = 0;
  if (!blob) return '저장 실패';
  const file = new File([blob], fileName, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "GONA's SKY ADVENTURE 기념사진" }); return '공유했어요'; } catch { /* 취소 → 내려받기 */ }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = fileName; document.body.append(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'PNG 로 저장했어요';
}
const ENDING = THEME.ending;
const CREDITS = THEME.credits;
const OPENED_KEY = `${NS}.opened`;
/** 오프닝이 있는 테마인지 (응가 = 시네마틱 · 다른 테마 = 슬라이드가 있을 때) */
const HAS_OPENING = THEME.id === 'poop' || THEME.opening.length > 0;
const SP_DESC: Record<FamilyId, string> = {
  mom: '거대한 하트 마법진 + 유도 하트 파상 공격',
  dad: '적 탄을 지우는 초고압 증기 레이저',
  imo: '별빛 유도탄 대량 발사',
  halmeoni: '체력 2 회복 + 5초 보호막',
  halabeoji: '광역 방패벽이 적 탄을 막고 창으로 반격',
  samchon: '거대 발명 메카의 미사일 연사 + 드릴 돌진',
};

type Phase = 'loading' | 'album' | 'gate' | 'hub' | 'title' | 'opening' | 'select' | 'prep' | 'play' | 'tally' | 'continue' | 'gameover' | 'ending' | 'credits' | 'records' | 'daily';

/** GONA's Sky Adventure 화면 전체 (타이틀 → 동료 선택 → 플레이 → 결과). 월드맵과는 onExit 한 줄로만 연결됨 */
/** 테스트 허브(#hub)일 때만 어느 화면에서든 '◀ 테스트 목록' 버튼을 띄움 */
export default function SkyGame({ onExit }: { onExit: () => void }) {
  return (
    <>
      <SkyGameMain onExit={onExit} />
      {HUB && THEME.id === 'poop' && <HubBack />}
    </>
  );
}

function SkyGameMain({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [hubOpen, setHubOpen] = useState(0); // 오프닝 시작 시각 (테스트 허브)
  const [hubEnd, setHubEnd] = useState(0); // 엔딩 시작 장면 (테스트 허브)
  const hubJump = useRef<'' | 'midboss' | 'boss'>('');
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
  /** 스토리 대화 (응가 테마) — 있는 동안 전투 정지 */
  const [talk, setTalk] = useState<{ n: number; lines: TalkLine[] } | null>(null);
  const talkN = useRef(0);
  /** 무전창 대기열 (전투 중 짧은 대사) */
  const [barks, setBarks] = useState<{ n: number; line: TalkLine }[]>([]);
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
  /** 일일 도전 중이면 그 도전 (아니면 null = 아케이드) */
  const [daily, setDaily] = useState<Daily | null>(null);
  /** 방금 올린 기록 결과 (결과 화면의 NEW RECORD 표시) */
  const [subm, setSubm] = useState<Submitted | null>(null);
  const dailyRef = useRef<Daily | null>(null);
  /** 이번 클리어로 얻은 기념사진 (결과 화면 획득 연출) */
  const [photo, setPhoto] = useState<{ fam: FamilyId; diff: Difficulty; isNew: boolean } | null>(null);
  const [albTab, setAlbTab] = useState<'hall' | 'photo' | 'badge' | 'mission' | 'ach'>('hall');
  const [albView, setAlbView] = useState<string | null>(null);
  const [prof, setProf] = useState(activeProfile);
  const [nickEdit, setNickEdit] = useState<'new' | 'rename' | null>(null);
  const [nickVal, setNickVal] = useState('');
  /** 이번 결과로 새로 달성한 미션 · 업적 (결과 화면 알림) */
  const [unlocks, setUnlocks] = useState<string[]>([]);
  /** FINAL 클리어 승리 세리머니 (→ 찰칵! → 기념사진) */
  const [cer, setCer] = useState(false);
  const [toast, setToast] = useState('');
  const [profOpen, setProfOpen] = useState(false);
  const [backup, setBackup] = useState('');
  const [intro, setIntro] = useState(0);
  const [recTab, setRecTab] = useState<'stage' | 'run' | 'daily'>('stage');
  const [runOpts, setRunOpts] = useState<RunOpts | null>(null);
  const [stageArt, setStageArt] = useState<StageArt | null>(null);
  const [continues, setContinues] = useState(0);
  const [practice, setPractice] = useState(false);
  const [count, setCount] = useState(9);
  const [slide, setSlide] = useState(0);
  /** 오프닝 종료: 다음부터는 자동 재생하지 않음 (타이틀의 '오프닝'으로 다시 볼 수 있음) */
  /** 오프닝을 어디서 열었는지: 첫 시작(→ 선택 화면) · 타이틀의 '오프닝 다시보기'(→ 타이틀) */
  const openingFrom = useRef<'start' | 'title' | 'first'>('start');
  const finishOpening = (): void => {
    try { localStorage.setItem(OPENED_KEY, '1'); } catch { /* 무시 */ }
    setSlide(0);
    // 첫 실행(관문 → 오프닝) · 타이틀의 '오프닝 다시보기' → 끝나면 타이틀 / (예전 흐름) START 뒤 첫 오프닝 → 선택
    setPhase(openingFrom.current === 'start' ? 'select' : 'title');
    if (openingFrom.current !== 'start') playBgm('title', 0.6);
  };
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
        // 응가판 첫 실행: 오프닝부터 (소리를 켜려면 터치가 한 번 필요 → '터치하여 시작' 관문) · 재방문은 타이틀
        let seen = true;
        try { seen = localStorage.getItem(OPENED_KEY) === '1'; } catch { /* 무시 */ }
        setPhase(HUB && THEME.id === 'poop' ? 'hub' : THEME.id === 'poop' && HAS_OPENING && !seen && (!location.search.includes('skytest') || location.search.includes('firstrun')) ? 'gate' : 'title');
        void preloadAudio('game');
      })
      .catch((e: unknown) => setErr(String(e)));
  }, []);

  useEffect(() => () => stopBgm(0.3), []);

  // 응가판: 타이틀·선택·오프닝·엔딩(허브 테스트 중엔 항상)에서 세로 BETA 띠 숨김 — CSS :has 대신 body 클래스 (사파리 성능)
  useEffect(() => {
    const hide = (THEME.id as string) === 'poop' && (HUB || phase === 'title' || phase === 'select' || phase === 'opening' || phase === 'ending' || phase === 'hub');
    document.body.classList.toggle('sky-nobeta', hide);
  }, [phase]);
  useEffect(() => () => document.body.classList.remove('sky-nobeta'), []);

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
        const dl = dailyRef.current;
        if (r.won) {
          sfx('menuOk');
          // 기록: 스테이지 보드 (이번 스테이지 점수 + 보너스 · 랭크 · 시간) · 일일 도전 보드
          const sc = r.stageScore + r.bonus.total;
          const e = { score: sc, rank: r.rank, time: Math.round(r.time), fam: opts.fam, stage: r.stage, at: today() };
          const sb = submit(stageBoard(r.stage, opts.diff), e);
          // 업적 깃발 · FINAL 클리어면 기념사진(동료 × 난이도) 획득
          const doneBefore = new Set([...missions(), ...achievements()].filter((m) => m.done).map((m) => m.id));
          recordStage({ fam: opts.fam, diff: opts.diff, stage: r.stage, rank: r.rank, hits: r.hits, bombs: r.bombsUsed, allParts: r.partsTotal > 0 && r.partsBroken === r.partsTotal });
          setFlags({ 'nobomb-s1': r.stage === 1 && r.bombsUsed === 0, nomiss: r.hits === 0, rankS: r.rank === 'S', allparts: r.partsTotal > 0 && r.partsBroken === r.partsTotal });
          if (r.final && !dl) { setPhoto({ fam: opts.fam, diff: opts.diff, ...recordClear(opts.fam, opts.diff, r.score, r.rank) }); setCer(true); }
          else setPhoto(null);
          setUnlocks([...missions().filter((m) => m.done && !doneBefore.has(m.id)).map((m) => `MISSION CLEAR · ${m.name} ${'★'.repeat(m.stars)}`), ...achievements().filter((a) => a.done && !doneBefore.has(a.id)).map((a) => `NEW BADGE · ${a.name}`)]);
          if (dl) {
            const time = dl.rule === 'speed' && r.time > parTime(dl.stage) ? undefined : e.time;
            const ok = dl.rule !== 'speed' || time != null;
            dailyTry(dl.date, ok);
            setSubm(ok ? submit(dailyBoard(dl.date), { ...e, time }) : null);
            setPhase('tally');
            return;
          }
          setSubm(sb);
          // FINAL 도 결과(랭크)를 먼저 보여 주고 → '엔딩으로'
          setPhase('tally');
          if (!r.final) recordReach(r.stage + 1);
        } else if (dl) {
          dailyTry(dl.date, false);
          setCount(9);
          setPhase('continue');
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
    setTalk(null);
    setBarks([]);
    const opts = runOpts;
    eng.onBark = (key) => {
      if (location.search.includes('skytest')) ((window as unknown as { __talkKeys?: string[] }).__talkKeys ??= []).push(`S${opts.stage}:${key}`);
      const ls = talkLines(opts.stage, key);
      if (!ls) return;
      const lines = resolveLines(ls, opts.fam, STAGES[opts.stage - 1], key);
      setBarks((b) => [...b, ...lines.map((line) => ({ n: ++talkN.current, line }))]);
    };
    eng.onTalk = (key) => {
      if (location.search.includes('skytest')) ((window as unknown as { __talkKeys?: string[] }).__talkKeys ??= []).push(`S${opts.stage}:${key}`);
      const ls = talkLines(opts.stage, key);
      const lines = ls ? resolveLines(ls, opts.fam, STAGES[opts.stage - 1], key) : [];
      if (lines.length) {
        // 정지 대화가 시작되면 아직 못 보여 준 무전창 대사는 버림 (끝난 뒤 지난 대사가 뒤늦게 뜨지 않게)
        setBarks((b) => {
          if (b.length && location.search.includes('skytest')) {
            const w = window as unknown as { __talkSeen?: { mode: string; who: string; name: string; text: string }[] };
            const showing = !!(window as unknown as { __skyBark?: unknown }).__skyBark; // 지금 떠 있던 줄은 이미 '보임'으로 기록됨
            for (const x of showing ? b.slice(1) : b) (w.__talkSeen ??= []).push({ mode: 'drop', who: x.line.who, name: x.line.name, text: x.line.text });
          }
          return [];
        });
        setTalk({ n: ++talkN.current, lines });
      }
      else eng.endTalk();
    };
    // 테스트 허브: 중간보스·보스 바로 가기 (무적 · 최대 파워)
    if (hubJump.current) {
      const j = hubJump.current;
      hubJump.current = '';
      window.setTimeout(() => { eng.cheat('god'); eng.cheat('power'); eng.cheat(j); }, 900);
    }
    if (location.search.includes('skytest')) (window as unknown as { __sky: SkyEngine }).__sky = eng;
    return () => {
      setTalk(null);
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
    if (practice || daily) return;
    submit(runBoard(diff), { score: r.score, fam, stage: r.stage, at: today(), time: clear ? Math.round(r.time) : undefined });
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
        setIntro(o.stage);
        window.setTimeout(() => setIntro(0), 3400);
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

  // 오프닝 슬라이드 자동 넘김 (터치하면 바로 넘어감)
  useEffect(() => {
    if (phase !== 'opening' || THEME.id === 'poop') return; // 응가 테마는 시네마틱이 직접 진행
    const id = window.setTimeout(() => (slide < THEME.opening.length - 1 ? setSlide(slide + 1) : finishOpening()), 5200);
    return () => window.clearTimeout(id);
  }, [phase, slide]); // eslint-disable-line react-hooks/exhaustive-deps

  // 엔딩 슬라이드 자동 넘김
  useEffect(() => {
    if (phase !== 'ending' || THEME.id === 'poop') return; // 응가 테마는 PoopEnding 이 직접 진행
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

  const start = useCallback((f: FamilyId, d: Difficulty, stage: number, dl: Daily | null = null) => {
    setDaily(dl);
    dailyRef.current = dl;
    setSubm(null);
    if (dl) {
      setFam(f);
      setResult(null);
      setContinues(0);
      setPractice(true);
      const rules = { noBomb: dl.rule === 'nobomb', oneLife: dl.rule === 'onelife' };
      beginStage({ stage, diff: d, fam: f, hp: 5, bombs: DIFF[d].bombs, power: dl.rule === 'lv1' ? 1 : stage > 1 ? 3 : 1, score: 0, rules });
      return;
    }
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
  // 테스트 허브에서 고른 장면으로 이동
  const hubGo = (g: HubGo) => {
    unlockAudio();
    sfx('menuOk');
    if (g.to === 'title') setPhase('title');
    else if (g.to === 'select') setPhase('select');
    else if (g.to === 'credits') setPhase('credits');
    else if (g.to === 'opening') { setHubOpen(g.at); setPhase('opening'); }
    else if (g.to === 'ending') { setHubEnd(g.scene); setSlide(0); playBgm('ending', 0.6); setPhase('ending'); }
    else if (g.to === 'stage') { hubJump.current = g.jump; start(fam, 'normal', g.stage); }
  };
  useEffect(() => {
    if (!HUB) return;
    const back = () => { setPaused(false); setTalk(null); setBarks([]); stopBgm(0.3); setPhase('hub'); };
    window.addEventListener('sky-hub', back);
    return () => window.removeEventListener('sky-hub', back);
  }, []);
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
  if (location.search.includes('skytest')) Object.assign(window, {
    // 자동 검수: 스테이지·순간별로 보여야 하는 대사 (방식 · 순서)
    __skyExpected: (st: number, key: TalkKey, f: FamilyId) => resolveLines(talkLines(st, key) ?? [], f, STAGES[st - 1], key).map((l) => ({ mode: talkMode(st, key), text: l.text })),
  });
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
  // 홈 화면·다른 앱으로 나갔다 오면 전투는 일시정지 상태로 (돌아온 순간 피격·끊김 없이 이어 하기)
  useEffect(() => {
    if (phase !== 'play') return;
    const onHide = (): void => {
      if (document.visibilityState === 'hidden' && engine.current && !paused) { engine.current.setPaused(true); setPaused(true); }
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => { document.removeEventListener('visibilitychange', onHide); window.removeEventListener('pagehide', onHide); };
  }, [phase, paused]);
  const setOpt = (p: Partial<typeof settings>) => {
    saveSettings(p);
    setOpts({ ...settings });
    sfx('menuMove');
  };

  if (err)
    return (
      <div className="sky">
        <div className="sky-panel">
          <p>그림을 받아 오지 못했어요.<br />인터넷 연결을 확인하고 다시 시도해 주세요.</p>
          <p className="sky-err-detail">{err.replace(/^Error:\s*/, '')}</p>
          <button className="sky-btn sky-btn-go" onClick={() => location.reload()}>다시 시도</button>
          <button className="sky-btn" onClick={onExit}>월드맵으로</button>
        </div>
      </div>
    );

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

  if (phase === 'hub') return <TestHub go={hubGo} />;
  if (phase === 'gate') {
    // 첫 실행 관문: 검은 화면 + 문장 하나 → 터치하면 소리와 함께 오프닝 (브라우저는 터치 전 소리를 막음)
    const go = (): void => { unlockAudio(); setSoundOn(true); openingFrom.current = 'first'; setSlide(0); setPhase('opening'); };
    return (
      <div className="sky gate" onPointerDown={go} role="button" tabIndex={0} aria-label="터치하여 오프닝 시작">
        <img className="gate-bg" src={`${BASE}${packPath('opening3/room-eve-blur.jpg', '')}`} alt="" />
        <div className="gate-dust" aria-hidden>{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ left: `${(i * 41) % 100}%`, animationDelay: `${(i * 0.53) % 4}s`, animationDuration: `${4 + (i % 5)}s` }} />)}</div>
        <p className="gate-chron">서기 2026년 11월, 어느 저녁…</p>
        <p className="gate-line">고나의 모험이 시작됩니다</p>
        <p className="gate-tap">— TOUCH TO BEGIN —</p>
        <p className="gate-note">♪ 소리를 켜고 감상하세요</p>
      </div>
    );
  }
  if (phase === 'opening' && THEME.id === 'poop') return <OpeningCinematic key={hubOpen} startAt={hubOpen} onDone={() => { setHubOpen(0); if (HUB) { stopBgm(0.4); setPhase('hub'); } else finishOpening(); }} />;
  if (phase === 'opening') {
    const sl = THEME.opening[Math.min(slide, THEME.opening.length - 1)];
    const next = () => (slide < THEME.opening.length - 1 ? setSlide(slide + 1) : finishOpening());
    return (
      <div className="sky end opening" onClick={next}>
        <div className="end-pic" key={`o${slide}`}>
          {sl.img === 'family' ? (
            <div className="end-family">{FAMILY.map((f) => <img key={f} src={`${BASE}${packPath(`chars/${f}/illust.png`)}`} alt={CHARACTERS[f].name} />)}</div>
          ) : (
            <img src={`${BASE}${sl.img.startsWith('v2/') ? packPath(sl.img.slice(3)) : sl.img}`} alt="" />
          )}
        </div>
        <p className="end-text" key={`ot${slide}`}>{sl.text}</p>
        <button type="button" className="end-skip opening-skip" onClick={(e) => { e.stopPropagation(); finishOpening(); }}>건너뛰기 ▶ ({slide + 1}/{THEME.opening.length})</button>
      </div>
    );
  }

  if (phase === 'ending' || phase === 'credits') {
    const sl = ENDING[Math.min(slide, ENDING.length - 1)];
    if (phase === 'ending' && THEME.id === 'poop') return <PoopEnding key={hubEnd} startScene={hubEnd} onDone={() => { setHubEnd(0); setPhase('credits'); }} />;
    if (phase === 'ending') {
      return (
        <div className="sky end" onClick={() => (slide < ENDING.length - 1 ? setSlide(slide + 1) : setPhase('credits'))}>
          <div className="end-pic" key={slide}>
            {sl.img === 'family' ? (
              <div className="end-family">{FAMILY.map((f) => <img key={f} src={`${BASE}${packPath(`chars/${f}/illust.png`)}`} alt={CHARACTERS[f].name} />)}</div>
            ) : (
              <img src={`${BASE}${sl.img.startsWith('v2/') ? packPath(sl.img.slice(3)) : sl.img}`} alt="" />
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
        // 응가 대탈출 팩은 첫 플레이 때 오프닝을 자동으로 보여 줌 (스킵 가능 · 타이틀의 '오프닝'으로 다시 보기)
        let seen = true;
        try { seen = localStorage.getItem(OPENED_KEY) === '1'; } catch { /* 무시 */ }
        if (HAS_OPENING && !seen && THEME.id !== 'poop') { openingFrom.current = 'start'; setSlide(0); setPhase('opening'); } else setPhase('select');
      }, 520);
    };
    // 응가 대탈출: 세로 키아트를 화면 전체에 깔고 로고(위) · 버튼 HUD(아래, 그라데이션으로 이어짐)
    if ((THEME.id as string) === 'poop') {
      const sub = (f: () => void) => () => { unlockAudio(); sfx('menuMove'); f(); };
      return (
        <div className={`sky ttl ttl2 poop${leaving ? ' out' : ''}`} onPointerDown={() => { unlockAudio(); setSoundOn(true); }}>
          <img className="ttl2-art" src={`${BASE}${packPath('title/keyart-tall.jpg', 'v2/title/keyart.jpg')}`} alt="고나와 가족 여섯 명이 노을 진 하늘로 출격하는 그림" />
          <div className="ttl2-shade" aria-hidden />
          <div className="ttl-sparks" aria-hidden>
            {Array.from({ length: 10 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i * 0.37) % 2.6}s`, animationDuration: `${2.2 + (i % 4) * 0.5}s` }} />)}
          </div>
          <header className="ttl2-logo">
            <img src={`${BASE}${packPath('title/logo.png')}`} alt="GONA's SKY ADVENTURE" />
            <p className="ttl2-sub"><span>응가 대탈출 대작전</span></p>
          </header>
          <div className="ttl2-menu">
            <button type="button" className="ttl2-start ttl-start" onClick={go}>PRESS START</button>
            <div className="ttl2-row">
              {HAS_OPENING && <button type="button" className="ttl2-btn" onClick={sub(() => { openingFrom.current = 'title'; setSlide(0); setPhase('opening'); })}>오프닝 다시보기</button>}
              {DEV && <button type="button" className="ttl2-btn ttl-test" onClick={sub(() => { setSlide(0); playBgm('ending', 1.2); setPhase('ending'); })}>엔딩</button>}
              <button type="button" className="ttl2-btn" onClick={sub(() => onExit())}>월드맵</button>
            </div>
            <div className="ttl2-row">
              <button type="button" className="ttl2-btn ttl2-daily" onClick={sub(() => setPhase('daily'))}>★ 오늘의 도전{dailyState().cleared ? ' ✓' : ''}</button>
              <button type="button" className="ttl2-btn" onClick={sub(() => { setRecTab('stage'); setPhase('records'); })}>랭킹</button>
              <button type="button" className="ttl2-btn ttl2-album" onClick={sub(() => { setAlbTab('hall'); setPhase('album'); })}>앨범 · 업적</button>
            </div>
            {prof && (() => { const nx = missions().find((m) => !m.done); return nx ? <p className="ttl2-next">NEXT ▶ {nx.name} · {nx.desc}</p> : null; })()}
            <p className="ttl2-foot">{prof && <b className="ttl2-nick" onPointerDown={(e) => { e.stopPropagation(); setProfOpen(true); }}>👤 {prof.nick}</b>}{!soundOn ? ' ♪ 화면을 터치하면 음악이 켜져요' : <>{best > 0 && <b>HI-SCORE {String(best).padStart(8, '0')}</b>} 6 STAGES · {BETA ? '공개 테스트판' : PROD ? 'VER 1.1' : '개발판'}</>}</p>
          </div>
          <div className="ttl-wipe" aria-hidden />
          {((!prof && (!location.search.includes('skytest') || location.search.includes('firstrun'))) || nickEdit) && (
            <div className="nick-modal" onPointerDown={(e) => e.stopPropagation()}>
              <div className="nick-box">
                <h2>{nickEdit === 'rename' ? '이름 바꾸기' : '모험가의 이름은?'}</h2>
                <p>기록 · 기념사진 · 배지가 이 이름으로 모여요</p>
                <input value={nickVal} maxLength={10} placeholder="예: 고나아빠" onChange={(e) => setNickVal(e.target.value)} autoFocus />
                <button type="button" className="sky-btn sky-btn-go" onClick={() => {
                  sfx('menuOk');
                  if (nickEdit === 'rename' && prof) renameProfile(nickVal); else createProfile(nickVal);
                  setProf(activeProfile()); setRecords(loadRecords()); setNickEdit(null); setNickVal('');
                }}>{nickEdit === 'rename' ? '바꾸기' : '시작하기'}</button>
                {nickEdit && prof && <button type="button" className="sky-btn" onClick={() => { setNickEdit(null); setNickVal(''); }}>취소</button>}
              </div>
            </div>
          )}
          {profOpen && prof && (
            <div className="nick-modal" onPointerDown={(e) => e.stopPropagation()}>
              <div className="nick-box prof-box">
                <h2>모험가 프로필</h2>
                <p>프로필마다 최고 점수 · 기념사진 · 배지 · 미션 · 도전 기록이 따로 저장돼요 (이 기기)</p>
                <ul className="prof-list">
                  {profiles().map((pp) => (
                    <li key={pp.id} className={pp.id === prof.id ? 'on' : ''}>
                      <button type="button" onClick={() => { sfx('menuOk'); switchProfile(pp.id); setProf(activeProfile()); setRecords(loadRecords()); }}>{pp.id === prof.id ? '▶ ' : ''}{pp.nick}<small>{pp.created}</small></button>
                    </li>
                  ))}
                </ul>
                <div className="prof-btns">
                  <button type="button" className="sky-btn" onClick={() => { setProfOpen(false); setNickVal(prof.nick); setNickEdit('rename'); }}>이름 바꾸기</button>
                  <button type="button" className="sky-btn" onClick={() => { setProfOpen(false); setNickVal(''); setNickEdit('new'); }}>새 모험가</button>
                </div>
                <p className="prof-sub">다른 기기로 옮기기 (백업 코드)</p>
                <textarea value={backup} placeholder="여기에 백업 코드를 붙여 넣거나, '내보내기'를 누르세요" onChange={(e) => setBackup(e.target.value)} rows={3} />
                <div className="prof-btns">
                  <button type="button" className="sky-btn" onClick={() => { const c = exportProfile(); setBackup(c); void navigator.clipboard?.writeText(c).then(() => setToast('백업 코드를 복사했어요'), () => setToast('코드를 길게 눌러 복사하세요')); }}>내보내기</button>
                  <button type="button" className="sky-btn" onClick={() => { const p2 = importProfile(backup); if (p2) { setProf(activeProfile()); setRecords(loadRecords()); setToast(`${p2.nick} 님의 기록을 불러왔어요`); setBackup(''); } else setToast('올바른 백업 코드가 아니에요'); }}>불러오기</button>
                </div>
                {toast && <p className="prof-toast">{toast}</p>}
                <button type="button" className="sky-btn sky-btn-go" onClick={() => { setProfOpen(false); setToast(''); }}>닫기</button>
              </div>
            </div>
          )}
        </div>
      );
    }
    // 타이틀 전용 구도: 로고(위) · 캐릭터 띠(가운데, 원화의 인물 영역 33%~100%를 통째로) · 메뉴(아래, 별도 영역)
    const ART_W = 688;
    const ART_H = 1024;
    const BAND = THEME.id === 'poop' ? 0.2 : 0.33; // 원화에서 가족 일러스트가 시작하는 높이 비율 (응가판 새 키아트는 인물이 더 위에서 시작)
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
        <img className={`ttl-art${aw < vp.w - 2 ? ' narrow' : ''}`} style={{ width: aw, height: ah, left: (vp.w - aw) / 2, top: artTop }} src={`${BASE}${packPath('title/keyart.jpg')}`} alt="고나와 가족이 황혼의 부유왕국 하늘을 나는 그림" />
        <div className="ttl-sparks" aria-hidden>
          {Array.from({ length: 12 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i * 0.37) % 2.6}s`, animationDuration: `${2.2 + (i % 4) * 0.5}s` }} />)}
        </div>
        {THEME.id === 'poop' ? (
          <div className="ttl-logo ttl-logo-text" style={{ width: Math.min(vp.w - 24, 360), height: logoH }}>
            <h1><span>고나의 응가</span><span>대탈출 대작전</span></h1>
            <p>GONA&apos;s Sky Adventure — The Great Poo Escape</p>
          </div>
        ) : (
          <img className="ttl-logo" style={{ width: logoW }} src={`${BASE}${packPath('title/logo.png')}`} alt="GONA's Sky Adventure" />
        )}
        <div className="ttl-menu" style={{ height: menuH }}>
          <div className="ttl-row">
            <button type="button" className="ttl-start" onClick={go}>PRESS START</button>
            {HAS_OPENING && <button type="button" className="ttl-map" onClick={() => { unlockAudio(); sfx('menuMove'); openingFrom.current = 'title'; setSlide(0); setPhase('opening'); }}>{THEME.id === 'poop' ? '오프닝 다시보기' : '오프닝'}</button>}
            {DEV && THEME.id === 'poop' && <button type="button" className="ttl-map ttl-test" onClick={() => { sfx('menuMove'); setSlide(0); playBgm('ending', 1.2); setPhase('ending'); }}>엔딩</button>}
            <button type="button" className="ttl-map" onClick={() => { sfx('menuMove'); onExit(); }}>월드맵</button>
          </div>
          {!soundOn && <p className="ttl-hint">♪ 화면을 터치하면 음악이 켜져요</p>}
          {THEME.titleLine && <p className="ttl-sub">{THEME.titleLine}</p>}
          <p className="ttl-copy">{best > 0 && <b>HI-SCORE {String(best).padStart(8, '0')}</b>} {THEME.copy} · {BETA ? '공개 테스트판' : '개발판'}</p>
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
      <div className={`sky sel${(THEME.id as string) === 'poop' ? ' poop' : ''}`}>
        <div className="sel-pattern" aria-hidden />
        <header className="sel-head">
          <span className="sel-stage">6 STAGES · 황혼의 부유왕국 → 하늘 끝의 마왕성</span>
          <h1>SELECT WINGMATE</h1>
          <span className="sel-sub">고나와 함께 날아갈 가족을 고르세요</span>
        </header>
        <div className="sel-main">
          <button type="button" className="sel-arrow" onClick={() => step(-1)} aria-label="이전">◀</button>
          <div className="sel-art" key={fam}>
            <img className="sel-illust" src={`${BASE}${packPath(`chars/${fam}/illust.png`)}`} alt={c.name} />
          </div>
          <button type="button" className="sel-arrow" onClick={() => step(1)} aria-label="다음">▶</button>
        </div>
        <div className="sel-info">
          <div className="sel-preview" aria-hidden>
            <div className="sel-spr sel-spr-gona" />
            <div className="sel-spr sel-spr-fam" style={{ backgroundImage: `url(${BASE}${packPath(`chars/${fam}/fly.png`)})` }} />
          </div>
          <dl>
            <dt className="sel-name">{c.name}</dt><dd className="sel-job">{familyText(fam)?.job ?? c.job}</dd>
            <dt>일반</dt><dd>{familyText(fam)?.attack ?? c.attack}</dd>
            <dt>진화</dt><dd className="sel-evo">{WEAPON_NAME[fam].map((n, i) => <span key={n}><i>Lv{i + 1}</i>{n}</span>)}</dd>
            <dt>필살기</dt><dd><b>{familyText(fam)?.special ?? SPECIAL_NAME[fam]}</b> — {familyText(fam)?.specialDesc || SP_DESC[fam]}</dd>
          </dl>
        </div>
        <ul className="sel-roster">
          {FAMILY.map((f) => (
            <li key={f}>
              <button type="button" className={f === fam ? 'on' : ''} onClick={() => pick(f)} aria-label={CHARACTERS[f].name} style={{ backgroundImage: `url(${BASE}${packPath(`chars/${f}/face.png`)})` }}>
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

  const fmtT = (t: number | null | undefined): string => (t == null ? '—' : `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`);
  const medal = (r: string | undefined, cls = ''): ReactElement | null => (r ? <img className={`rk-medal ${cls}`} src={`${BASE}${packPath(`ui/rank-${r}.png`, '')}`} alt={`${r} 랭크`} /> : null);

  if (phase === 'daily') {
    const d = dailyFor();
    const st = dailyState(d.date);
    const best = bestOf(dailyBoard(d.date));
    return (
      <div className="sky end cred daily">
        <div className="cred-scroll still">
          <img className="daily-badge" src={`${BASE}${packPath('ui/daily.png', '')}`} alt="오늘의 도전" />
          <h2>오늘의 도전</h2>
          <p className="daily-date">{d.date}</p>
          <div className="daily-card">
            <b>{d.title}</b>
            <p>{d.desc}</p>
            {d.rule === 'speed' && <p>기준 시간 {fmtT(parTime(d.stage))}</p>}
            <p className="daily-fam">출격 동료: {CHARACTERS[d.fam].name} · {WEAPON_NAME[d.fam][0]}</p>
          </div>
          <dl className="cred-score">
            <dt>오늘 상태</dt><dd>{st.cleared ? '★ 클리어!' : `도전 ${st.tries}회`}</dd>
            <dt>오늘 최고</dt><dd>{best.score ? <>{medal(best.rank, 'sm')} {String(best.score).padStart(8, '0')}</> : '—'}</dd>
          </dl>
        </div>
        <div className="sel-btns cred-btns">
          <button type="button" className="sky-btn sky-btn-go" onClick={() => { unlockAudio(); sfx('menuOk'); start(d.fam, d.diff, d.stage, d); }}>도전 시작!</button>
          <button type="button" className="sky-btn" onClick={() => { sfx('menuMove'); setRecTab('daily'); setPhase('records'); }}>기록</button>
          <button type="button" className="sky-btn" onClick={() => { sfx('menuMove'); setPhase('title'); }}>타이틀</button>
        </div>
      </div>
    );
  }

  if (phase === 'album') {
    const cl = clears();
    const FAM_NAME = (f: FamilyId): string => (f === 'samchon' ? '삼촌' : CHARACTERS[f].name);
    const got = Object.keys(cl).length;
    const ach = achievements();
    const mis = missions();
    const stamps = stampBoard();
    const master = got >= 18;
    const VICTORY: Record<FamilyId, [string, string, string]> = {
      mom: ['우리 고나 최고! 사진 한 장 더~', '물보라처럼 시원하게 해냈어!', '엄마의 목욕물은 전설이 되었다…!'],
      dad: ['아빠 어깨 위가 제일 높지?', '급수 완료! 임무 성공이다!', '소방관의 명예를 걸고… 대성공!'],
      imo: ['조카랑 셀카는 필수지~', '프룬 파워, 완벽하게 통했어!', '이모의 별빛이 우주를 덮었다!'],
      halmeoni: ['아이고 우리 강아지, 장하다~', '할미 손은 약손, 고나 배는 똥배!', '불꽃 약손, 전설의 치유 성공!'],
      halabeoji: ['허허, 방패 위가 편하구나.', '걱정 마라, 할아버지가 지켰다.', '이 방패, 끝내 뚫리지 않았노라!'],
      samchon: ['찰칵! 이 발명품도 완벽해!', '이론상 완벽했고, 실제로도 완벽했다!', '메가 인벤션, 역사에 남을 발명!'],
    };
    const photoSrc = (f: FamilyId, d: Difficulty): string => `${BASE}${packPath(`album/${f}-${d}.jpg`, '')}`;
    return (
      <div className="sky end cred album">
        <h2 className="recs-h">ALBUM · 추억 앨범</h2>
        <div className="alb-rate"><i style={{ width: `${Math.round((got / 18) * 100)}%` }} /><span>앨범 완성률 {Math.round((got / 18) * 100)}%</span></div>
        <p className="alb-who">{prof ? <><b>{prof.nick}</b> 님의 앨범</> : '모험가'} · 기념사진 {got}/18 · 미션 ★{mis.filter((x) => x.done).reduce((a, x) => a + x.stars, 0)}/{mis.reduce((a, x) => a + x.stars, 0)} · 업적 {ach.filter((a) => a.done).length}/{ach.length}
          <button type="button" className="alb-mini" onClick={() => { setNickVal(prof?.nick ?? ''); setNickEdit('rename'); setPhase('title'); }}>이름 바꾸기</button>
          {profiles().length > 1 && <button type="button" className="alb-mini" onClick={() => { const ps = profiles(); const i = ps.findIndex((p) => p.id === prof?.id); switchProfile(ps[(i + 1) % ps.length].id); setProf(activeProfile()); setRecords(loadRecords()); }}>다른 모험가</button>}
          <button type="button" className="alb-mini" onClick={() => { setNickVal(''); setNickEdit('new'); setPhase('title'); }}>새 모험가</button>
        </p>
        <nav className="recs-tabs">
          {(['hall', 'photo', 'badge', 'mission', 'ach'] as const).map((t) => <button key={t} type="button" className={albTab === t ? 'on' : ''} onClick={() => { sfx('menuMove'); setAlbTab(t); }}>{t === 'hall' ? '명예의 전당' : t === 'photo' ? '사진' : t === 'badge' ? '배지' : t === 'mission' ? '미션' : '업적'}</button>)}
        </nav>
        <div className="recs-body">
          {albTab === 'hall' && (
            <div className="hall">
              <div className="hall-top">
                <img src={`${BASE}${packPath('ui/master.png', '')}`} alt="" className={master ? '' : 'off'} />
                <div><b>{prof?.nick ?? '모험가'}</b><span>총 완성도 {Math.round(((got + ach.filter((a) => a.done).length + mis.filter((m) => m.done).length) / (18 + ach.length + mis.length)) * 100)}%</span><small>사진 {got}/18 · 업적 {ach.filter((a) => a.done).length}/{ach.length} · 미션 {mis.filter((m) => m.done).length}/{mis.length}</small></div>
              </div>
              <p className="alb-sub">난이도 정복 — 동료 6명 모두로 클리어하면 칭호</p>
              {DIFF_ORDER.map((d) => { const n = FAMILY.filter((f) => cl[clearKey(f, d)]).length; return (
                <div key={d} className={`hall-row d-${d}${n >= 6 ? ' done' : ''}`}>
                  <img src={`${BASE}${packPath(`ui/badge-${d}.png`, '')}`} alt="" />
                  <span><b>{d.toUpperCase()} {n >= 6 ? '마스터 ★' : '정복 중'}</b><small>{FAMILY.map((f) => (cl[clearKey(f, d)] ? FAM_KO[f] : '·')).join(' ')}</small></span>
                  <em>{n}/6</em>
                </div>
              ); })}
              <p className="alb-sub">최고 기록 ({prof?.nick ?? '모험가'})</p>
              <div className="hall-scores">{DIFFS.map((d) => <span key={d}><em>{DIFF[d].name}</em>{String(records[d].score).padStart(8, '0')}{records[d].clear ? ' ★' : ''}</span>)}</div>
              <p className="alb-sub">다음 목표</p>
              <ul className="hall-next">{mis.filter((m) => !m.done).slice(0, 3).map((m) => <li key={m.id}>▶ {m.name} <small>{m.desc} ({m.prog[0]}/{m.prog[1]})</small></li>)}{!master && <li>▶ 기념사진 18장 모으기 <small>({got}/18 · 다 모으면 MASTER 배지와 온 가족 특별 사진)</small></li>}</ul>
            </div>
          )}
          {albTab === 'photo' && (
            <div className="alb-grid">
              {FAMILY.map((f) => DIFF_ORDER.map((d) => {
                const k = clearKey(f, d);
                const on = !!cl[k];
                return (
                  <button key={k} type="button" className={`alb-card d-${d}${on ? '' : ' locked'}`} onClick={() => { if (on) { sfx('menuOk'); markSeen(k); setAlbView(k); } else sfx('menuMove'); }}>
                    <img src={photoSrc(f, d)} alt={on ? `${FAM_NAME(f)} ${d} 기념사진` : '잠긴 기념사진'} loading="lazy" decoding="async" />
                    <span>{on ? FAM_NAME(f) : '???'}</span><em>{d.toUpperCase()}</em>
                  </button>
                );
              }))}
              <button type="button" className={`alb-card special${master ? '' : ' locked'}`} onClick={() => { if (master) { sfx('menuOk'); setAlbView('special'); } else sfx('menuMove'); }}>
                <img src={`${BASE}${packPath('album/special.jpg', '')}`} alt={master ? '온 가족 특별 기념사진' : '잠긴 특별 사진'} loading="lazy" decoding="async" />
                <span>{master ? '온 가족 SPECIAL' : '??? (18장 모두 모으면)'}</span>
              </button>
            </div>
          )}
          {albTab === 'mission' && (
            <ul className="alb-ach">
              {mis.map((a) => (
                <li key={a.id} className={a.done ? 'done' : ''}>
                  <b>{a.done ? '★' : '☆'}</b><span>[{a.group}] {a.name} <small className="mis-star">{'★'.repeat(a.stars)}</small></span><em>{a.desc}</em>
                  <i className="alb-prog"><i style={{ width: `${(a.prog[0] / a.prog[1]) * 100}%` }} /></i><small>{a.done ? '달성!' : `${a.prog[0]}/${a.prog[1]}`}</small>
                </li>
              ))}
            </ul>
          )}
          {albTab === 'badge' && (
            <div className="alb-stamps">
              <div className={`alb-master${master ? '' : ' locked'}`}><img src={`${BASE}${packPath('ui/master.png', '')}`} alt="마스터 배지" /><span>{master ? 'MASTER · 모든 동료 · 모든 난이도 클리어!' : 'MASTER 배지 — 기념사진 18장을 모두 모으면'}</span></div>
              <p className="alb-sub">스테이지 도장판 (스테이지 최고 랭크)</p>
              {DIFF_ORDER.map((d) => (
                <div key={d} className={`stamp-row d-${d}`}>
                  <span>{d.toUpperCase()}</span>
                  {STAGES.map((st) => { const r = stamps[`${d}:${st.id}`]; return <i key={st.id} className={r ? 'on' : ''}>{r && r !== 'C0' ? <img src={`${BASE}${packPath(`ui/rank-${r}.png`, '')}`} alt={r} /> : r ? '✓' : st.id === 6 ? 'F' : st.id}</i>; })}
                  <b className={FAMILY.some((f) => cl[clearKey(f, d)]) ? 'on' : ''}><img src={`${BASE}${packPath(`ui/badge-${d}.png`, '')}`} alt="" /><em>ALL</em></b>
                </div>
              ))}
              <p className="alb-sub">동료별 클리어 배지</p>
            </div>
          )}
          {albTab === 'badge' && (
            <div className="alb-badges">
              {FAMILY.map((f) => (
                <div key={f} className="alb-brow">
                  <span className="alb-bname">{FAM_NAME(f)}</span>
                  {DIFF_ORDER.map((d) => {
                    const on = !!cl[clearKey(f, d)];
                    return (
                      <div key={d} className={`alb-badge d-${d}${on ? '' : ' locked'}`} title={`${FAM_NAME(f)} ${d.toUpperCase()} 클리어`}>
                        <img className="bd-frame" src={`${BASE}${packPath(`ui/badge-${d}.png`, '')}`} alt="" />
                        <img className="bd-face" src={`${BASE}${packPath(`chars/${f}/face.png`)}`} alt={FAM_NAME(f)} />
                        <em>{d.toUpperCase()}</em>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
          {albTab === 'ach' && (
            <ul className="alb-ach">
              {ach.map((a) => (
                <li key={a.id} className={a.done ? 'done' : ''}>
                  <b>{a.done ? '★' : '☆'}</b><span>{a.name}</span><em>{a.desc}</em>
                  <i className="alb-prog"><i style={{ width: `${(a.prog[0] / a.prog[1]) * 100}%` }} /></i><small>{a.prog[0]}/{a.prog[1]}</small>
                </li>
              ))}
            </ul>
          )}
        </div>
        {albView === 'special' && (
          <div className="alb-view" onClick={() => setAlbView(null)}>
            <div className="polaroid gold"><img src={`${BASE}${packPath('album/special.jpg', '')}`} alt="온 가족 특별 기념사진" /><q>“우리 가족, 세상에서 가장 위대한 탈출 성공!”</q><small>{prof?.nick ?? '모험가'} · ALL CLEAR</small></div>
            <p>터치하면 닫기</p>
          </div>
        )}
        {albView && albView !== 'special' && (() => { const [f, d] = albView.split(':') as [FamilyId, Difficulty]; const di = DIFF_ORDER.indexOf(d); return (
          <div className="alb-view" onClick={() => setAlbView(null)}>
            <div className={`polaroid d-${d}`}>
              <img src={photoSrc(f, d)} alt="기념사진" />
              <q>“{VICTORY[f][di]}”</q>
              <small>{prof?.nick ?? '모험가'} · {FAM_NAME(f)} · {d.toUpperCase()} CLEAR · {cl[albView]?.at} · {cl[albView]?.score?.toLocaleString()}점</small>
              <span className="polaroid-stamp"><img src={`${BASE}${packPath(`ui/badge-${d}.png`, '')}`} alt="" /><img className="ps-face" src={`${BASE}${packPath(`chars/${f}/face.png`)}`} alt="" /></span>
              {cl[albView]?.rank && <img className="polaroid-rank" src={`${BASE}${packPath(`ui/rank-${cl[albView].rank}.png`, '')}`} alt={cl[albView].rank} />}
            </div>
            <div className="alb-save" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="sky-btn sky-btn-go" onClick={() => { void savePhotoPng(photoSrc(f, d), `${BASE}${packPath(`ui/badge-${d}.png`, '')}`, `${BASE}${packPath(`chars/${f}/face.png`)}`, [`“${VICTORY[f][di]}”`, `${FAM_NAME(f)} × 고나 · ${d.toUpperCase()} CLEAR${cl[albView]?.rank ? ` · RANK ${cl[albView].rank}` : ''}`, `${prof?.nick ?? '모험가'} · ${cl[albView]?.at ?? ''} · ${(cl[albView]?.score ?? 0).toLocaleString()}점 · GONA's SKY ADVENTURE`], `gona-${f}-${d}.png`).then(setToast); }}>PNG 저장 · 공유</button>
              {toast && <span className="prof-toast">{toast}</span>}
            </div>
            <p>바깥을 터치하면 닫기</p>
          </div>
        ); })()}
        <div className="sel-btns cred-btns">
          <button type="button" className="sky-btn" onClick={() => { sfx('menuMove'); setPhase('title'); }}>타이틀</button>
        </div>
      </div>
    );
  }

  if (phase === 'records') {
    return (
      <div className="sky end cred recs">
        <h2 className="recs-h">RANKING · 기록</h2>
        <nav className="recs-tabs">
          {(['stage', 'run', 'daily'] as const).map((t) => (
            <button key={t} type="button" className={recTab === t ? 'on' : ''} onClick={() => { sfx('menuMove'); setRecTab(t); }}>{t === 'stage' ? '스테이지' : t === 'run' ? '전체 런' : '오늘의 도전'}</button>
          ))}
        </nav>
        {recTab !== 'daily' && (
          <div className="recs-diff">
            {DIFFS.map((d) => <button key={d} type="button" className={diff === d ? 'on' : ''} onClick={() => { sfx('menuMove'); setDiff(d); }}>{DIFF[d].name}</button>)}
          </div>
        )}
        <div className="recs-body">
          {recTab === 'stage' && (
            <table className="recs-table">
              <thead><tr><th>STAGE</th><th>랭크</th><th>최고 점수</th><th>최단</th></tr></thead>
              <tbody>
                {STAGES.map((st) => {
                  const b = bestOf(stageBoard(st.id, diff));
                  return <tr key={st.id}><td>{st.id === 6 ? 'FINAL' : st.id}<small>{THEME.stages[st.id - 1]?.name ?? st.name}</small></td><td>{medal(b.rank, 'sm') ?? '—'}</td><td>{b.score ? String(b.score).padStart(7, '0') : '—'}</td><td>{fmtT(b.time)}</td></tr>;
                })}
              </tbody>
            </table>
          )}
          {recTab === 'run' && (
            <ol className="recs-list">
              {topOf(runBoard(diff)).length === 0 && <li className="empty">아직 기록이 없어요 · STAGE 1 부터 한 판 끝까지!</li>}
              {topOf(runBoard(diff)).map((e, i) => <li key={i}><b>{i + 1}</b><span>{String(e.score).padStart(8, '0')}</span><em>{e.nick ? `${e.nick} · ` : ''}{e.time != null ? 'ALL CLEAR' : `STAGE ${e.stage}`} · {CHARACTERS[e.fam].name}</em><small>{e.at.slice(5)}</small></li>)}
            </ol>
          )}
          {recTab === 'daily' && (
            <ol className="recs-list">
              {(() => { const d = dailyFor(); const b = bestOf(dailyBoard(d.date)); return <li className="today"><b>오늘</b><span>{b.score ? String(b.score).padStart(8, '0') : '—'}</span><em>{d.title}</em><small>{dailyState(d.date).cleared ? '★ 클리어' : '미완료'}</small></li>; })()}
              {dailyHistory(7).filter((h) => h.date !== today()).map((h) => <li key={h.date}><b>{h.date.slice(5)}</b><span>{h.best ? String(h.best).padStart(8, '0') : '—'}</span><em>{h.d.title}</em><small>{h.cleared ? '★ 클리어' : '실패'}</small></li>)}
            </ol>
          )}
        </div>
        <div className="sel-btns cred-btns">
          <button type="button" className="sky-btn sky-btn-go" onClick={() => { sfx('menuMove'); setPhase('daily'); }}>오늘의 도전</button>
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
        {phase === 'play' && intro > 0 && (
          <div className="st-intro" key={intro}>
            <i className="st-emblem" style={{ backgroundImage: `url(${BASE}${packPath(`${STAGES[intro - 1].art}/boss.png`, '')})` }} />
            <b>{intro === 6 ? 'FINAL STAGE' : `STAGE ${intro}`}</b>
            <span>{THEME.stages[intro - 1]?.name ?? STAGES[intro - 1].name}</span>
            <em>⚠ {DANGER[intro - 1]}</em>
          </div>
        )}
        {phase === 'play' && !talk && !paused && barks.length > 0 && runOpts && (
          <BarkBox key={barks[0].n} line={barks[0].line} st={STAGES[runOpts.stage - 1]} art={stageArt} onNext={() => setBarks((b) => b.slice(1))} />
        )}
        {phase === 'play' && talk && runOpts && (
          <TalkBox
            key={talk.n}
            lines={talk.lines}
            st={STAGES[runOpts.stage - 1]}
            art={stageArt}
            onDone={() => { setTalk(null); engine.current?.endTalk(); }}
          />
        )}
        {phase === 'play' && !talk && (
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
                <span className="sp-face" style={{ backgroundImage: `url(${BASE}${packPath(`chars/${fam}/face.png`)})` }} />
                <span className="sp-fill" style={{ height: `${Math.round(gauge * 100)}%` }} />
                <b>{ready ? '필살!' : `${Math.floor(gauge * 100)}%`}</b>
              </button>
              <button type="button" className="sky-act sky-melee" onPointerDown={() => engine.current?.useMelee()} onContextMenu={(e) => e.preventDefault()} aria-label="근접 공격">
                근접
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
                  <>
                    <button type="button" className={opts.vibrate ? 'on' : ''} onClick={() => { setOpt({ vibrate: !opts.vibrate }); if (!opts.vibrate) window.setTimeout(() => buzz([60, 80, 60], 0), 30); }}>{opts.vibrate ? '켜짐' : '꺼짐'}</button>
                    <button type="button" onClick={() => buzz([80, 60, 80, 60, 120], 0)}>테스트</button>
                    <em>{iosHaptic ? 'iPhone(iOS 18+): 짧은 ‘톡’ 방식 · 설정 › 사운드 및 햅틱 › 시스템 햅틱이 켜져 있어야 함' : 'Android 등: 표준 진동 (패턴 지원)'}</em>
                  </>
                ) : (
                  <em>이 브라우저는 진동 미지원 → 화면 흔들림 · 섬광 · 효과음으로 대신 알려 줘요</em>
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
        {phase === 'tally' && result && cer && photo && (
          <div className={`cer d-${photo.diff}`} onPointerDown={() => { setCer(false); sfx('menuOk'); }} ref={(el) => { if (el && !el.dataset.on) { el.dataset.on = '1'; buzz([40, 40, 60, 40, 120], 0); window.setTimeout(() => { sfx('cutin'); el.classList.add('snap'); }, 3000); window.setTimeout(() => setCer(false), 3600); } }}>
            <img className="cer-bg" src={`${BASE}${packPath(`ui/cer-${photo.diff}.jpg`, '')}`} alt="" />
            <div className="cer-confetti" aria-hidden>{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ left: `${(i * 53) % 100}%`, animationDelay: `${(i % 6) * 0.25}s`, background: ['#ffd84a', '#ff9ec0', '#9cd8ff', '#b8f07a'][i % 4] }} />)}</div>
            <img className="cer-fam" src={`${BASE}${packPath(`chars/${photo.fam}/illust.png`)}`} alt={FAM_KO[photo.fam]} />
            <img className="cer-gona" src={`${BASE}${packPath('opening2/gona-hero.png', 'chars/gona/illust.png')}`} alt="고나" />
            <p className="cer-title">{photo.diff === 'hard' ? 'LEGENDARY CLEAR!!' : photo.diff === 'normal' ? 'GREAT CLEAR!' : 'CLEAR!'}</p>
            <p className="cer-line">{FAM_KO[photo.fam]}{josaWa(FAM_KO[photo.fam])} 고나, {photo.diff.toUpperCase()} 정복!</p>
            <p className="cer-snap">찰칵!</p>
            <i className="cer-flash" />
          </div>
        )}
        {phase === 'tally' && result && !cer && (
          <div className="sky-overlay">
            <div className="sky-panel tally res">
              <div className="res-crest">
                <img src={`${BASE}${packPath('ui/crest.png', '')}`} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                <h2>{daily ? 'DAILY CLEAR!' : `STAGE ${result.stage} CLEAR!`}</h2>
              </div>
              <div className="res-main">
                <div className={`res-rank r-${result.rank ?? 'D'}`}>
                  {medal(result.rank, 'big')}
                  <span>{result.rankPts ?? 0} / 100</span>
                </div>
                <ul className="res-items">
                  {(result.rankItems ?? []).map((it, i) => (
                    <li key={it.key} style={{ animationDelay: `${0.15 + i * 0.12}s` }} className={it.pts >= it.max ? 'full' : it.pts === 0 ? 'zero' : ''}>
                      <span>{it.label}</span><em>{it.detail}</em><b>{it.pts}<small>/{it.max}</small></b>
                    </li>
                  ))}
                </ul>
              </div>
              <dl className="res-bonus">
                <dt>클리어</dt><dd>{result.bonus.clear}</dd>
                <dt>체력</dt><dd>{result.bonus.hp}</dd>
                <dt>폭탄</dt><dd>{result.bonus.bomb}</dd>
                <dt>노미스</dt><dd>{result.noMiss ? result.bonus.noMiss : '—'}</dd>
                <dt>랭크 {result.rank}</dt><dd>{result.bonus.rank}</dd>
                <dt className="sum">보너스 합계</dt><dd className="sum">{result.bonus.total}</dd>
                <dt className="sum">SCORE</dt><dd className="sum">{String(result.score).padStart(8, '0')}</dd>
              </dl>
              {subm && (subm.newScore || subm.newRank || subm.newTime) && (
                <p className="res-new">NEW RECORD! {[subm.newScore && '최고 점수', subm.newRank && '최고 랭크', subm.newTime && '최단 클리어'].filter(Boolean).join(' · ')}{subm.place > 0 && ` · ${subm.place}위`}</p>
              )}
              {unlocks.length > 0 && <ul className="res-unlocks">{unlocks.map((u, i) => <li key={u} style={{ animationDelay: `${1.4 + i * 0.25}s` }}>{u}</li>)}</ul>}
              {daily && !subm && <p className="res-new miss">기준 시간 초과 — 도전 실패! 다시 노려 보세요</p>}
              {result.final && photo && (
                <div className={`res-photo d-${photo.diff}`}>
                  <p>{photo.isNew ? '★ NEW PHOTO! · NEW BADGE! ★' : '기념사진 (이미 획득 · 기록 갱신)'}</p>
                  <div className="res-photo-card">
                    <img src={`${BASE}${packPath(`album/${photo.fam}-${photo.diff}.jpg`, '')}`} alt="클리어 기념사진" />
                    <img className="res-badge" src={`${BASE}${packPath(`ui/badge-${photo.diff}.png`, '')}`} alt="" />
                  </div>
                  <span>{photo.fam === 'samchon' ? '삼촌' : CHARACTERS[photo.fam].name} · {photo.diff.toUpperCase()} CLEAR</span>
                </div>
              )}
              {THEME.id === 'poop' && !daily && (
                <div className="tally-train" aria-label={`응가 열차 ${result.stage}/${STAGES.length}`}>
                  {STAGES.map((_, i) => <i key={i} className={i < result.stage ? 'on' : ''} />)}
                  <img src={`${BASE}${packPath('ending/train.png', 'v2/fx/missile.png')}`} alt="응가 열차" style={{ left: `${((result.stage - 0.5) / STAGES.length) * 100}%` }} />
                </div>
              )}
              {daily ? (
                <>
                  <button type="button" className="sky-btn sky-btn-go" onClick={() => { sfx('menuOk'); start(daily.fam, daily.diff, daily.stage, daily); }}>한 번 더 도전</button>
                  <button type="button" className="sky-btn" onClick={() => { setRecTab('daily'); setPhase('records'); }}>기록 보기</button>
                </>
              ) : (
                <>
                  {result.final ? (
                    <button type="button" className="sky-btn sky-btn-go" onClick={() => { sfx('menuOk'); recordRun(result, true); setSlide(0); playBgm('ending', 1.2); setPhase('ending'); }}>엔딩으로 ▶</button>
                  ) : (
                    <>
                      <p className="tally-next">NEXT ▶ STAGE {result.stage + 1} · {THEME.stages[result.stage]?.name ?? STAGES[result.stage]?.name}</p>
                      <button type="button" className="sky-btn sky-btn-go" onClick={nextStage}>다음 스테이지</button>
                      <button type="button" className="sky-btn" onClick={() => { recordRun(result, false); setPhase('title'); }}>타이틀로</button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
        {phase === 'continue' && result && (
          <div className="sky-overlay">
            <div className="sky-panel cont">
              <h2>CONTINUE?</h2>
              <b className="cont-count">{Math.max(0, count)}</b>
              <p>STAGE {result.stage} · {STAGES[result.stage - 1].name}<br />이어하면 점수는 0 부터 다시 시작해요</p>
              {daily ? (
                <button type="button" className="sky-btn sky-btn-go" onClick={() => { sfx('menuOk'); start(daily.fam, daily.diff, daily.stage, daily); }}>처음부터 다시 도전</button>
              ) : <button type="button" className="sky-btn sky-btn-go" onClick={doContinue}>이어하기</button>}
              <button type="button" className="sky-btn" onClick={() => { recordRun(result, false); setPhase('gameover'); }}>그만하기</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
