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
import type { Difficulty } from './stages';
import type { FamilyId } from './engine';
import { rankValue, type Rank } from './rank';

export interface Entry {
  score: number;
  rank?: Rank;
  /** 클리어 시간(초) · 클리어 못 했으면 없음 */
  time?: number;
  fam: FamilyId;
  stage: number;
  /** 기록한 날 (YYYY-MM-DD) */
  at: string;
}
interface Store {
  v: 2;
  boards: Record<string, Entry[]>;
  daily: Record<string, { cleared: boolean; tries: number }>;
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
      const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Store | null;
      if (s && s.v === 2 && s.boards) return { v: 2, boards: s.boards, daily: s.daily ?? {} };
    } catch {
      /* 깨진 기록은 무시하고 새로 */
    }
    return { v: 2, boards: {}, daily: {} };
  },
  save(s) {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
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
