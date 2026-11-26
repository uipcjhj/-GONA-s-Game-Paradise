/**
 * 스토리 모드 체크포인트 (모험가 프로필마다 · 동료 6 × 난이도 3 = 18칸)
 *  - 보스를 쓰러뜨리고 스테이지를 클리어할 때마다 '다음 스테이지 시작 지점'을 저장 (스테이지 도중 상태는 저장하지 않음)
 *  - 저장 값 = '다음 스테이지' 버튼과 똑같은 값 → 이어해도 점수·아이템·보상이 늘지 않음
 *  - CONTINUE / ARCADE: STAGE 1 부터 끊김 없이(이어하기·체크포인트 재개 없이) 끝까지 = ARCADE CLEAR · 나머지 완주 = CONTINUE CLEAR
 *  - 안전: 같은 내용을 .bak 에 먼저 쓰고 본 저장 → 읽다 깨지면 .bak 으로 복구 · 기존 기록(records.ts)은 건드리지 않음
 */
import { NS } from './ns';
import { profileKey } from './profile';
import type { FamilyId } from './engine';
import type { Difficulty } from './stages';

export const STORY_VER = 1;
export interface Slot {
  v: number; fam: FamilyId; diff: Difficulty;
  /** 다음에 시작할 스테이지 (1~6) */
  stage: number; score: number; hp: number; bombs: number; power: number;
  /** 이 진행이 아직 끊김 없는 연속 도전인지 (정보용 · 재개하면 CONTINUE) */
  arcade: boolean; at: string;
}
export interface Finish { score: number; at: string }
interface Store { v: number; last?: string; slots: Record<string, Slot>; arcade: Record<string, Finish>; cont: Record<string, Finish> }
const KEY = (): string => profileKey(`${NS}.story`);
export const slotKey = (f: FamilyId, d: Difficulty): string => `${f}:${d}`;
const empty = (): Store => ({ v: STORY_VER, slots: {}, arcade: {}, cont: {} });
function parse(raw: string | null): Store | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Store;
    if (!s || typeof s !== 'object' || typeof s.slots !== 'object') return null;
    return { v: s.v ?? STORY_VER, last: s.last, slots: s.slots ?? {}, arcade: s.arcade ?? {}, cont: s.cont ?? {} };
  } catch { return null; }
}
export function loadStory(): Store {
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY()); } catch { /* 무시 */ }
  const s = parse(raw);
  if (s) return s;
  if (raw) {   // 깨진 저장 → 백업으로 복구 (깨진 원본도 따로 보관)
    try { localStorage.setItem(`${KEY()}.broken`, raw); } catch { /* 무시 */ }
    const b = parse((() => { try { return localStorage.getItem(`${KEY()}.bak`); } catch { return null; } })());
    if (b) { saveStory(b, false); return b; }
  }
  return empty();
}
function saveStory(s: Store, backup = true): void {
  try {
    const j = JSON.stringify(s);
    // 백업에 먼저 쓰고 본 저장 → 어느 쪽 쓰기가 도중에 끊겨도 다른 한쪽은 온전한 최신(또는 직전) 상태
    if (backup) localStorage.setItem(`${KEY()}.bak`, j);
    localStorage.setItem(KEY(), j);
  } catch { /* 저장 공간 부족 등 → 이번 체크포인트만 저장 안 됨 */ }
}
export function getSlot(f: FamilyId, d: Difficulty): Slot | undefined { return loadStory().slots[slotKey(f, d)]; }
/** 마지막으로 저장한 진행 (로비 '모험 계속하기') */
export function lastSlot(): Slot | undefined { const s = loadStory(); return s.last ? s.slots[s.last] : undefined; }
export function putSlot(sl: Omit<Slot, 'v' | 'at'>): Slot {
  const s = loadStory();
  const full: Slot = { ...sl, v: STORY_VER, at: new Date().toISOString() };
  s.slots[slotKey(sl.fam, sl.diff)] = full;
  s.last = slotKey(sl.fam, sl.diff);
  saveStory(s);
  return full;
}
export function markContinue(f: FamilyId, d: Difficulty): void {
  const s = loadStory(); const k = slotKey(f, d);
  if (s.slots[k] && s.slots[k].arcade) { s.slots[k].arcade = false; saveStory(s); }
}
/** FINAL 클리어: 칸 비우고 완주 기록 (모드별 최고 점수 · 처음 완주한 날) */
export function finishStory(f: FamilyId, d: Difficulty, mode: 'arcade' | 'cont', score: number): { best: boolean } {
  const s = loadStory(); const k = slotKey(f, d);
  delete s.slots[k];
  if (s.last === k) s.last = Object.entries(s.slots).sort((a, b) => b[1].at.localeCompare(a[1].at))[0]?.[0];
  const prev = s[mode][k];
  const best = !prev || score > prev.score;
  if (best) s[mode][k] = { score, at: new Date().toISOString().slice(0, 10) };
  saveStory(s);
  return { best };
}
export function storyBest(f: FamilyId, d: Difficulty): { arcade?: Finish; cont?: Finish } { const s = loadStory(); const k = slotKey(f, d); return { arcade: s.arcade[k], cont: s.cont[k] }; }
