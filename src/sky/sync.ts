/**
 * 저장 데이터 병합 · 마이그레이션 백업 — 서버 동기화와 백업 코드 불러오기가 함께 씀
 *
 *  원칙 (지시서 PART 7-3):
 *   - 추억사진 · 배지 · 깃발 · 완주 엽서 = 합집합 (한 번 얻은 건 절대 사라지지 않음)
 *   - 최고 점수 · 랭크 = 더 좋은 쪽 / 최소 피격 · 최소 폭탄 = 더 작은 쪽 / 처음 얻은 날 = 더 이른 쪽
 *   - 점수판 = 두 쪽 기록을 합쳐 중복 제거 후 상위 10개
 *   - 무조건 덮어쓰기 금지 · 서로 다른 프로필(계정) 데이터끼리는 호출하는 쪽에서 섞지 않음 (닉네임만 같다고 합치지 않음)
 */
import { NS } from './ns';
import { rankValue, type Rank } from './rank';

type Entry = { score: number; rank?: Rank; time?: number; fam: string; stage: number; at: string; nick?: string };
type StageRec = { rank?: Rank; hits: number; bombs: number; allParts: boolean; at?: string; score?: number };
type ClearRec = { at: string; score: number; rank?: Rank };
export interface SaveStore {
  v: 2;
  boards: Record<string, Entry[]>;
  daily: Record<string, { cleared: boolean; tries: number }>;
  col?: { clears: Record<string, ClearRec>; flags: Record<string, boolean>; seen: Record<string, boolean>; stages?: Record<string, StageRec>; counts?: Record<string, number> };
}
export type RunRecords = Record<'easy' | 'normal' | 'hard', { score: number; reach: number; clear: boolean }>;
/** 서버·백업 코드로 오가는 한 모험가의 기록 묶음 */
import { mergeStory, type StoryStore } from './story-merge';
export { mergeStory, type StoryStore };
export interface SaveBundle { schema: 3; rec2: SaveStore | null; records: RunRecords | null; story?: StoryStore | null }


const better = (a?: Rank, b?: Rank): Rank | undefined => (rankValue(b) > rankValue(a) ? b : a);
const minDate = (a?: string, b?: string): string | undefined => (!a ? b : !b ? a : a < b ? a : b);

export function mergeStore(a: SaveStore | null, b: SaveStore | null): SaveStore | null {
  if (!a) return b;
  if (!b) return a;
  const out: SaveStore = { v: 2, boards: {}, daily: {} };
  for (const k of new Set([...Object.keys(a.boards), ...Object.keys(b.boards)])) {
    const seen = new Set<string>();
    out.boards[k] = [...(a.boards[k] ?? []), ...(b.boards[k] ?? [])]
      .filter((e) => { const id = `${e.score}|${e.at}|${e.fam}|${e.stage}|${e.time ?? ''}|${e.nick ?? ''}`; if (seen.has(id)) return false; seen.add(id); return true; })
      .sort((x, y) => y.score - x.score)
      .slice(0, 10);
  }
  for (const k of new Set([...Object.keys(a.daily), ...Object.keys(b.daily)])) {
    const x = a.daily[k];
    const y = b.daily[k];
    out.daily[k] = { cleared: !!(x?.cleared || y?.cleared), tries: Math.max(x?.tries ?? 0, y?.tries ?? 0) };
  }
  const ca = a.col ?? { clears: {}, flags: {}, seen: {} };
  const cb = b.col ?? { clears: {}, flags: {}, seen: {} };
  const col: NonNullable<SaveStore['col']> = { clears: {}, flags: {}, seen: {}, stages: {}, counts: {} };
  for (const k of new Set([...Object.keys(ca.clears), ...Object.keys(cb.clears)])) {
    const x = ca.clears[k];
    const y = cb.clears[k];
    col.clears[k] = { at: minDate(x?.at, y?.at) ?? '', score: Math.max(x?.score ?? 0, y?.score ?? 0), rank: better(x?.rank, y?.rank) };
  }
  for (const k of new Set([...Object.keys(ca.flags), ...Object.keys(cb.flags)])) col.flags[k] = !!(ca.flags[k] || cb.flags[k]);
  for (const k of new Set([...Object.keys(ca.seen), ...Object.keys(cb.seen)])) col.seen[k] = !!(ca.seen[k] || cb.seen[k]);
  const sa = ca.stages ?? {};
  const sb = cb.stages ?? {};
  for (const k of new Set([...Object.keys(sa), ...Object.keys(sb)])) {
    const x = sa[k];
    const y = sb[k];
    col.stages![k] = {
      rank: better(x?.rank, y?.rank),
      hits: Math.min(x?.hits ?? 99, y?.hits ?? 99), bombs: Math.min(x?.bombs ?? 99, y?.bombs ?? 99),
      allParts: !!(x?.allParts || y?.allParts), at: minDate(x?.at, y?.at), score: Math.max(x?.score ?? 0, y?.score ?? 0),
    };
  }
  for (const k of new Set([...Object.keys(ca.counts ?? {}), ...Object.keys(cb.counts ?? {})])) col.counts![k] = Math.max(ca.counts?.[k] ?? 0, cb.counts?.[k] ?? 0);
  out.col = col;
  return out;
}
export function mergeRecords(a: RunRecords | null, b: RunRecords | null): RunRecords | null {
  if (!a) return b;
  if (!b) return a;
  const out = {} as RunRecords;
  for (const d of ['easy', 'normal', 'hard'] as const) {
    const x = a[d] ?? { score: 0, reach: 1, clear: false };
    const y = b[d] ?? { score: 0, reach: 1, clear: false };
    out[d] = { score: Math.max(x.score, y.score), reach: Math.max(x.reach, y.reach), clear: x.clear || y.clear };
  }
  return out;
}
export function mergeBundle(a: SaveBundle | null, b: SaveBundle | null): SaveBundle {
  return { schema: 3, rec2: mergeStore(a?.rec2 ?? null, b?.rec2 ?? null), records: mergeRecords(a?.records ?? null, b?.records ?? null), story: mergeStory(a?.story, b?.story) };
}

// ───────── 저장 구조 버전 · 백업 ─────────
const SCHEMA_KEY = `${NS}.schema`;
/** 버전이 바뀌기 전 기록 전체를 한 번 복사해 둠 (되돌릴 수 있게) · 지금 구조는 그대로 읽히므로 변환은 필요 없음 */
export function migrateLocal(): void {
  try {
    const v = +(localStorage.getItem(SCHEMA_KEY) ?? '2');
    if (v >= 3) return;
    const snap: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (k.startsWith(`${NS}.`) && !k.includes('.backup.')) snap[k] = localStorage.getItem(k)!;
    }
    localStorage.setItem(`${NS}.backup.v2`, JSON.stringify({ at: new Date().toISOString(), snap }));
    localStorage.setItem(SCHEMA_KEY, '3');
  } catch {
    /* 저장 공간 부족 → 백업 없이 계속 (기존 기록은 건드리지 않음) */
  }
}
/** 처음 로그인하기 직전: 그때의 기기 기록을 따로 보관 */
export function backupBeforeLogin(): void {
  try {
    const k = `${NS}.backup.prelogin`;
    if (localStorage.getItem(k)) return;
    const snap: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;
      if (key.startsWith(`${NS}.`) && !key.includes('.backup.')) snap[key] = localStorage.getItem(key)!;
    }
    localStorage.setItem(k, JSON.stringify({ at: new Date().toISOString(), snap }));
  } catch {
    /* 무시 */
  }
}
