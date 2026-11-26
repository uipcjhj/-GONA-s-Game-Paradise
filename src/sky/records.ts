/**
 * 기록 · 랭킹 · 일일 도전 (지금은 이 기기 브라우저 저장소 · 나중에 서버로 바꿀 수 있게 백엔드를 한 곳에 모음)
 *
 *  저장 키: `${NS}.rec2` = { v: 2, boards: { [보드]: Entry[] (점수순 상위 10) }, daily: { [날짜]: { cleared, tries } } }
 *  보드 이름 (서버 랭킹 테이블 이름으로 그대로 쓸 수 있게):
 *    stage:<1~6>:<easy|normal|hard>   스테이지별 기록 (랭크 · 시간 포함)
 *    run:<easy|normal|hard>           처음부터 한 판 전체 점수
 *    daily:<YYYY-MM-DD>               그날의 도전
 *  최고 점수 · 최고 랭크 · 최단 클리어는 보드의 기록들에서 따로 계산 (bestOf)
 */
import { NS } from './ns';
import { profileKey, activeProfile } from './profile';
import type { Difficulty } from './stages';
import type { FamilyId } from './engine';
import { rankValue, type Rank } from './rank';

/** 받침 있으면 '과', 없으면 '와' */
export const josaWa = (w: string): string => { const c = w.charCodeAt(w.length - 1) - 0xac00; return c >= 0 && c < 11172 && c % 28 ? '과' : '와'; };

export interface Entry {
  score: number;
  rank?: Rank;
  /** 클리어 시간(초) · 클리어 못 했으면 없음 */
  time?: number;
  fam: FamilyId;
  stage: number;
  /** 기록한 날 (YYYY-MM-DD) */
  at: string;
  /** 기록한 모험가 닉네임 (서버 랭킹으로 옮길 때 그대로 사용) */
  nick?: string;
}
interface Store {
  v: 2;
  boards: Record<string, Entry[]>;
  daily: Record<string, { cleared: boolean; tries: number }>;
  /** 수집: 동료 × 난이도 클리어(기념사진 · 배지) · 업적 깃발 · 처음 본 사진 */
  col?: { clears: Record<string, { at: string; score: number; rank?: Rank }>; flags: Record<string, boolean>; seen: Record<string, boolean>;
    /** 스테이지 클리어 최고 기록: `동료:난이도:스테이지` → 랭크 · 최소 피격 · 최소 폭탄 · 부위 전부 파괴 여부 */
    stages?: Record<string, { rank?: Rank; hits: number; bombs: number; allParts: boolean; at?: string; score?: number }>;
    /** 누적 횟수 (부위 전부 파괴한 보스 수 등) */
    counts?: Record<string, number> };
}
const KEY = `${NS}.rec2`;
const MAX = 10;

/** 저장 백엔드 — 서버 랭킹을 붙일 때 이 인터페이스만 구현하면 됨 */
export interface ScoreBackend {
  load(): Store;
  save(s: Store): void;
}
const local: ScoreBackend = {
  load() {
    try {
      const s = JSON.parse(localStorage.getItem(profileKey(KEY)) ?? 'null') as Store | null;
      if (s && s.v === 2 && s.boards) return { v: 2, boards: s.boards, daily: s.daily ?? {}, col: s.col };
    } catch {
      /* 깨진 기록은 무시하고 새로 */
    }
    return { v: 2, boards: {}, daily: {} };
  },
  save(s) {
    try {
      localStorage.setItem(profileKey(KEY), JSON.stringify(s));
    } catch {
      /* 저장 공간 부족 등 → 이번 기록만 저장 안 됨 */
    }
  },
};
let backend: ScoreBackend = local;
export function setScoreBackend(b: ScoreBackend): void {
  backend = b;
}

export const today = (d = new Date()): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const stageBoard = (stage: number, diff: Difficulty): string => `stage:${stage}:${diff}`;
export const runBoard = (diff: Difficulty): string => `run:${diff}`;
/** MEMORY HUNT 단독 스테이지 점수 (스토리 모드 기록과 따로) */
export const huntBoard = (stage: number, diff: Difficulty): string => `hunt:${stage}:${diff}`;
export const dailyBoard = (date: string): string => `daily:${date}`;

export interface Best { score: number; rank: Rank | ''; time: number | null; plays: number }
export function bestOf(board: string): Best {
  const list = backend.load().boards[board] ?? [];
  let rank: Rank | '' = '';
  let time: number | null = null;
  for (const e of list) {
    if (rankValue(e.rank) > rankValue(rank)) rank = e.rank ?? '';
    if (e.time != null && (time == null || e.time < time)) time = e.time;
  }
  return { score: list[0]?.score ?? 0, rank, time, plays: list.length };
}
export function topOf(board: string): Entry[] {
  return backend.load().boards[board] ?? [];
}

export interface Submitted { place: number; newScore: boolean; newRank: boolean; newTime: boolean }
/** 기록 올리기 → 몇 등인지 · 최고 점수/랭크/시간 갱신 여부 */
export function submit(board: string, e: Entry): Submitted {
  const st = backend.load();
  const before = bestOf(board);
  if (!e.nick) e.nick = activeProfile()?.nick;
  const list = [...(st.boards[board] ?? [])];
  // 최고 랭크 · 최단 시간은 상위 10 밖으로 밀려도 잃지 않도록: 10 등 밖이면 그 값만 가진 기록과 바꿔 둠
  list.push(e);
  list.sort((a, b) => b.score - a.score);
  let kept = list.slice(0, MAX);
  if (!kept.includes(e) && (rankValue(e.rank) > rankValue(before.rank) || (e.time != null && (before.time == null || e.time < before.time)))) kept = [...kept.slice(0, MAX - 1), e];
  st.boards[board] = kept;
  backend.save(st);
  return {
    place: kept.indexOf(e) + 1,
    newScore: e.score > before.score,
    newRank: rankValue(e.rank) > rankValue(before.rank),
    newTime: e.time != null && (before.time == null || e.time < before.time),
  };
}

// ───────── 일일 도전 ─────────
export type DailyRule = 'nobomb' | 'lv1' | 'onelife' | 'hard' | 'speed';
export interface Daily { date: string; stage: number; fam: FamilyId; rule: DailyRule; diff: Difficulty; title: string; desc: string }
const FAMS: FamilyId[] = ['mom', 'dad', 'imo', 'halmeoni', 'halabeoji', 'samchon'];
const FAM_KO: Record<FamilyId, string> = { mom: '엄마', dad: '아빠', imo: '이모', halmeoni: '할머니', halabeoji: '할아버지', samchon: '삼촌' };
const RULES: Record<DailyRule, [string, string]> = {
  nobomb: ['노폭탄', '폭탄 없이 클리어 (폭탄 아이템은 점수로 바뀜)'],
  lv1: ['무기 Lv.1 출격', '무기 Lv.1 에서 시작 · P 를 모아 키워 가며 클리어'],
  onelife: ['원 하트', '하트 1개로 클리어 (회복 아이템은 점수로 바뀜)'],
  hard: ['하드 모드', '어려움 난이도로 클리어'],
  speed: ['타임 어택', '기준 시간 안에 클리어'],
};
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
/** 날짜만으로 정해지는 오늘의 도전 (서버 없이도 모두 같은 도전 — 나중에 서버가 내려 주면 그걸 우선) */
export function dailyFor(date = today()): Daily {
  const h = hash(`gona-daily-${date}`);
  const stage = 1 + (h % 6);
  const fam = FAMS[(h >>> 4) % FAMS.length];
  const rules: DailyRule[] = ['nobomb', 'lv1', 'onelife', 'hard', 'speed'];
  const rule = rules[(h >>> 9) % rules.length];
  return {
    date, stage, fam, rule, diff: rule === 'hard' ? 'hard' : 'normal',
    title: `STAGE ${stage} · ${FAM_KO[fam]} · ${RULES[rule][0]}`,
    desc: RULES[rule][1],
  };
}
export function dailyState(date = today()): { cleared: boolean; tries: number } {
  return backend.load().daily[date] ?? { cleared: false, tries: 0 };
}
export function dailyTry(date: string, cleared: boolean): void {
  const st = backend.load();
  const d = st.daily[date] ?? { cleared: false, tries: 0 };
  st.daily[date] = { cleared: d.cleared || cleared, tries: d.tries + 1 };
  backend.save(st);
}
/** 지난 도전들 (최근 순) */
export function dailyHistory(n = 7): { date: string; d: Daily; cleared: boolean; best: number }[] {
  const st = backend.load();
  return Object.keys(st.daily).sort().reverse().slice(0, n).map((date) => ({ date, d: dailyFor(date), cleared: st.daily[date].cleared, best: bestOf(dailyBoard(date)).score }));
}

// ───────── 수집: 기념사진 · 클리어 배지 · 업적 ─────────
export const DIFF_ORDER: Difficulty[] = ['easy', 'normal', 'hard'];
const colOf = (st: Store): NonNullable<Store['col']> => (st.col ??= { clears: {}, flags: {}, seen: {} });
export const clearKey = (fam: FamilyId, diff: Difficulty): string => `${fam}:${diff}`;
export function clears(): Record<string, { at: string; score: number; rank?: Rank }> {
  return backend.load().col?.clears ?? {};
}
/** FINAL 클리어 기록 → 새로 얻은 기념사진(= 배지)인지 */
export function recordClear(fam: FamilyId, diff: Difficulty, score: number, rank?: Rank): { isNew: boolean } {
  const st = backend.load();
  const c = colOf(st);
  const k = clearKey(fam, diff);
  const isNew = !c.clears[k];
  const prev = c.clears[k];
  c.clears[k] = { at: prev?.at ?? today(), score: Math.max(prev?.score ?? 0, score), rank: rankValue(rank) > rankValue(prev?.rank) ? rank : prev?.rank };
  backend.save(st);
  return { isNew };
}
export function setFlags(f: Record<string, boolean>): void {
  const st = backend.load();
  const c = colOf(st);
  let ch = false;
  for (const [k, v] of Object.entries(f)) if (v && !c.flags[k]) { c.flags[k] = true; ch = true; }
  if (ch) backend.save(st);
}
export function markSeen(k: string): void {
  const st = backend.load();
  const c = colOf(st);
  if (!c.seen[k]) { c.seen[k] = true; backend.save(st); }
}
export interface Achievement { id: string; name: string; desc: string; done: boolean; prog: [number, number] }
const FAM_ALL: FamilyId[] = ['mom', 'dad', 'imo', 'halmeoni', 'halabeoji', 'samchon'];
const FAM_KO2: Record<FamilyId, string> = { mom: '엄마', dad: '아빠', imo: '이모', halmeoni: '할머니', halabeoji: '할아버지', samchon: '삼촌' };
const BOSS_KO = ['쌀떡 골렘', '뿡뿡 버섯대왕', '철벽 믹서 3000', '젤리 크라켄', '철벽 똥기사', '변비마왕 꽉막혀'];
export function achievements(): Achievement[] {
  const st = backend.load();
  const c = st.col ?? { clears: {}, flags: {}, seen: {} };
  const has = (f: FamilyId, d?: Difficulty): boolean => (d ? !!c.clears[clearKey(f, d)] : DIFF_ORDER.some((x) => !!c.clears[clearKey(f, x)]));
  const n = Object.keys(c.clears).length;
  const famN = FAM_ALL.filter((f) => has(f)).length;
  const diffN = DIFF_ORDER.filter((d) => FAM_ALL.some((f) => has(f, d))).length;
  const hardN = FAM_ALL.filter((f) => has(f, 'hard')).length;
  const daily = Object.values(st.daily).some((d) => d.cleared);
  const ph = Object.keys(c.stages ?? {});
  const a = (id: string, name: string, desc: string, cur: number, max: number): Achievement => ({ id, name, desc, done: cur >= max, prog: [Math.min(cur, max), max] });
  return [
    a('first', '첫 번째 탈출', '어떤 동료와든 FINAL 클리어', n, 1),
    ...FAM_ALL.map((f) => a(`fam-${f}`, `${FAM_KO2[f]}${josaWa(FAM_KO2[f])} 함께`, `${FAM_KO2[f]}${josaWa(FAM_KO2[f])} FINAL 클리어`, has(f) ? 1 : 0, 1)),
    a('easy', 'EASY 정복', 'EASY 로 FINAL 클리어', FAM_ALL.some((f) => has(f, 'easy')) ? 1 : 0, 1),
    a('normal', 'NORMAL 정복', 'NORMAL 로 FINAL 클리어', FAM_ALL.some((f) => has(f, 'normal')) ? 1 : 0, 1),
    a('hard', 'HARD 정복', 'HARD 로 FINAL 클리어', hardN > 0 ? 1 : 0, 1),
    a('allfam', '온 가족 출동', '동료 6명 모두로 클리어', famN, 6),
    a('alldiff', '난이도 마스터', 'EASY · NORMAL · HARD 모두 클리어', diffN, 3),
    a('hardall', '전설의 가족', '동료 6명 모두 HARD 클리어', hardN, 6),
    a('nobomb1', '맨손의 용기', '폭탄 없이 STAGE 1 클리어', c.flags['nobomb-s1'] ? 1 : 0, 1),
    a('nomiss', '노미스 비행', '한 번도 안 맞고 스테이지 클리어', c.flags.nomiss ? 1 : 0, 1),
    a('rankS', 'S 랭크', '스테이지 랭크 S 획득', c.flags.rankS ? 1 : 0, 1),
    a('parts', '부위 파괴왕', '보스 부위를 전부 부수고 격파', c.flags.allparts ? 1 : 0, 1),
    a('daily', '오늘의 영웅', '오늘의 도전 클리어', daily ? 1 : 0, 1),
    ...BOSS_KO.map((b, i) => a(`boss${i + 1}`, `${b} 격파`, `${i === 5 ? 'FINAL' : `STAGE ${i + 1}`} 보스 격파 (아무 동료 · 아무 난이도)`, ph.filter((k) => k.endsWith(`:${i + 1}`)).length > 0 ? 1 : 0, 1)),
    ...BOSS_KO.map((b, i) => a(`bossall${i + 1}`, `${b} 추억 완성`, `${b} 기념사진 18장 (동료 6 × 난이도 3)`, ph.filter((k) => k.endsWith(`:${i + 1}`)).length, 18)),
    a('runs', '완주 엽서 수집가', '완주 기념 엽서 18장 모으기', n, 18),
    a('album', '추억 앨범 완성', '보스 기념사진 108장 모두 모으기', ph.length, 108),
  ];
}

// ───────── 스테이지 기록 · 미션 ─────────
export interface StageResult { fam: FamilyId; diff: Difficulty; stage: number; rank?: Rank; hits: number; bombs: number; allParts: boolean; score?: number }
/** 보스 격파 기록 → 이 조합(동료 × 난이도 × 보스)의 기념사진이 새로 열렸는지 */
export function recordStage(r: StageResult): { isNew: boolean } {
  const st = backend.load();
  const c = colOf(st);
  const st2 = (c.stages ??= {});
  const k = `${r.fam}:${r.diff}:${r.stage}`;
  const p = st2[k];
  st2[k] = {
    rank: rankValue(r.rank) > rankValue(p?.rank) ? r.rank : p?.rank,
    hits: Math.min(p?.hits ?? 99, r.hits), bombs: Math.min(p?.bombs ?? 99, r.bombs), allParts: !!p?.allParts || r.allParts,
    at: p?.at ?? today(), score: Math.max(p?.score ?? 0, r.score ?? 0),
  };
  const cn = (c.counts ??= {});
  if (r.allParts) cn.allParts = (cn.allParts ?? 0) + 1;
  cn.stageClears = (cn.stageClears ?? 0) + 1;
  backend.save(st);
  return { isNew: !p };
}
/** 보스 기념사진 108장: `동료:난이도:스테이지` → 해금 정보 */
export type PhotoInfo = { rank?: Rank; at?: string; score?: number; hits: number; bombs: number; allParts: boolean };
export function photos(): Record<string, PhotoInfo> {
  return backend.load().col?.stages ?? {};
}
export const photoKey = (fam: FamilyId, diff: Difficulty, stage: number): string => `${fam}:${diff}:${stage}`;
/** 스테이지 도장판: 난이도 × 스테이지 → 그 스테이지의 최고 랭크 (아무 동료나) */
export function stampBoard(): Record<string, Rank | 'C0'> {
  const out: Record<string, Rank | 'C0'> = {};
  const sts = backend.load().col?.stages ?? {};
  for (const [k, v] of Object.entries(sts)) {
    const [, d, n] = k.split(':');
    const key = `${d}:${n}`;
    const cur = out[key];
    const r = v.rank ?? 'C0';
    if (!cur || (r !== 'C0' && rankValue(r) > rankValue(cur === 'C0' ? undefined : cur))) out[key] = r;
  }
  return out;
}
export interface Mission { id: string; group: '공용' | '동료' | '난이도'; name: string; desc: string; done: boolean; prog: [number, number]; stars: number }
const RANK_GE = (r: Rank | undefined, min: Rank): boolean => rankValue(r) >= rankValue(min);
export function missions(): Mission[] {
  const st = backend.load();
  const c = st.col ?? { clears: {}, flags: {}, seen: {} };
  const sts = c.stages ?? {};
  const cn = c.counts ?? {};
  const all = Object.entries(sts).map(([k, v]) => { const [f, d, n] = k.split(':'); return { f: f as FamilyId, d: d as Difficulty, n: +n, ...v }; });
  const any = (fn: (x: (typeof all)[number]) => boolean): boolean => all.some(fn);
  const m = (id: string, group: Mission['group'], name: string, desc: string, cur: number, max: number, stars: number): Mission => ({ id, group, name, desc, done: cur >= max, prog: [Math.min(cur, max), max], stars });
  const b = (x: boolean): number => (x ? 1 : 0);
  return [
    m('m-parts1', '공용', '부위 파괴 입문', '보스 부위를 전부 부수고 보스 격파', cn.allParts ?? 0, 1, 1),
    m('m-parts6', '공용', '부위 파괴 장인', '부위 전부 파괴 보스 6번', cn.allParts ?? 0, 6, 3),
    m('m-bomb', '공용', '절약 비행', '폭탄 1개 이하로 STAGE 3 이후 스테이지 클리어', b(any((x) => x.n >= 3 && x.bombs <= 1)), 1, 2),
    m('m-hit', '공용', '아슬아슬 회피', '피격 2회 이하로 STAGE 5 클리어', b(any((x) => x.n === 5 && x.hits <= 2)), 1, 2),
    m('m-rankA', '공용', 'A 랭크의 맛', '아무 스테이지 A 랭크 이상', b(any((x) => RANK_GE(x.rank, 'A'))), 1, 1),
    m('m-finalA', '공용', '최종 결전의 달인', 'FINAL STAGE 를 A 랭크 이상으로', b(any((x) => x.n === 6 && RANK_GE(x.rank, 'A'))), 1, 3),
    m('m-daily', '공용', '오늘의 영웅', '오늘의 도전 클리어', b(Object.values(st.daily).some((d) => d.cleared)), 1, 1),
    m('m-daily3', '공용', '꾸준한 영웅', '오늘의 도전 3일 클리어', Object.values(st.daily).filter((d) => d.cleared).length, 3, 3),
    m('m-mom2', '동료', '목욕물 폭포', '엄마와 STAGE 2 클리어', b(any((x) => x.f === 'mom' && x.n >= 2)), 1, 1),
    m('m-dad3', '동료', '고압 소방대', '아빠와 노미스로 스테이지 클리어', b(any((x) => x.f === 'dad' && x.hits === 0)), 1, 2),
    m('m-imo4', '동료', '프룬 요정의 별빛', '이모와 STAGE 4 를 B 랭크 이상', b(any((x) => x.f === 'imo' && x.n === 4 && RANK_GE(x.rank, 'B'))), 1, 2),
    m('m-halm', '동료', '약손의 기적', '할머니와 폭탄 없이 스테이지 클리어', b(any((x) => x.f === 'halmeoni' && x.bombs === 0)), 1, 2),
    m('m-hala3', '동료', '철벽 수호', '할아버지와 HARD STAGE 3 클리어', b(any((x) => x.f === 'halabeoji' && x.d === 'hard' && x.n >= 3)), 1, 3),
    m('m-sam5', '동료', '유산균 대작전', '삼촌과 STAGE 5 의 보스 부위 전부 파괴', b(any((x) => x.f === 'samchon' && x.n === 5 && x.allParts)), 1, 2),
    m('m-easy6', '난이도', 'EASY 완주', 'EASY 로 STAGE 1~6 모두 클리어', new Set(all.filter((x) => x.d === 'easy').map((x) => x.n)).size, 6, 2),
    m('m-norm6', '난이도', 'NORMAL 완주', 'NORMAL 로 STAGE 1~6 모두 클리어', new Set(all.filter((x) => x.d === 'normal').map((x) => x.n)).size, 6, 3),
    m('m-hard6', '난이도', 'HARD 완주', 'HARD 로 STAGE 1~6 모두 클리어', new Set(all.filter((x) => x.d === 'hard').map((x) => x.n)).size, 6, 5),
    m('m-hardS', '난이도', '전설의 S', 'HARD 에서 S 랭크', b(any((x) => x.d === 'hard' && x.rank === 'S')), 1, 5),
  ];
}
