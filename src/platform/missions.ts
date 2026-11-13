import { addDays, dateKST, dayDiff, weekIdKST } from './kst';
import { grant } from './progression';
import { TUNING } from './tuning';
import type { MissionProgress, MissionState, PlayerData } from './types';

export interface MissionEvent {
  cleared: boolean;
  newBest: boolean;
}
export interface MissionDef {
  id: string;
  scope: 'daily' | 'weekly';
  name: string;
  target: number;
  rewardCoins: number;
  rewardXP: number;
  /** 결과 1건에서 올라가는 값 (null = 다른 값에서 계산) */
  inc: ((e: MissionEvent) => number) | null;
}
const plays = () => 1;
export const MISSIONS: MissionDef[] = [
  { id: 'd-play1', scope: 'daily', name: '게임 1판 끝내기', target: 1, rewardCoins: 5, rewardXP: 10, inc: plays },
  { id: 'd-play3', scope: 'daily', name: '게임 3판 끝내기', target: 3, rewardCoins: 10, rewardXP: 20, inc: plays },
  { id: 'd-clear1', scope: 'daily', name: '게임 1번 클리어', target: 1, rewardCoins: 10, rewardXP: 20, inc: (e) => (e.cleared ? 1 : 0) },
  { id: 'd-newbest', scope: 'daily', name: '내 기록 갱신하기', target: 1, rewardCoins: 10, rewardXP: 20, inc: (e) => (e.newBest ? 1 : 0) },
  { id: 'd-games2', scope: 'daily', name: '서로 다른 게임 2종류 하기', target: 2, rewardCoins: 12, rewardXP: 20, inc: null },
  { id: 'd-play5', scope: 'daily', name: '게임 5판 끝내기', target: 5, rewardCoins: 15, rewardXP: 30, inc: plays },
  { id: 'w-play15', scope: 'weekly', name: '이번 주 15판 끝내기', target: 15, rewardCoins: 40, rewardXP: 60, inc: plays },
  { id: 'w-clear5', scope: 'weekly', name: '이번 주 클리어 5번', target: 5, rewardCoins: 50, rewardXP: 80, inc: (e) => (e.cleared ? 1 : 0) },
  { id: 'w-days3', scope: 'weekly', name: '이번 주 3일 접속하기', target: 3, rewardCoins: 30, rewardXP: 50, inc: null },
];
export const getMission = (id: string) => MISSIONS.find((m) => m.id === id);
const DAILY = MISSIONS.filter((m) => m.scope === 'daily');
const WEEKLY = MISSIONS.filter((m) => m.scope === 'weekly');

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
/** 날짜+플레이어로 정해지는 오늘의 미션 3개 (같은 날엔 항상 같음) */
export function pickDaily(date: string, playerId: string): string[] {
  const pool = [...DAILY];
  const out: string[] = [];
  let h = hash(date + playerId);
  while (out.length < 3 && pool.length) {
    const i = h % pool.length;
    out.push(pool.splice(i, 1)[0].id);
    h = hash(String(h) + date);
  }
  return out;
}
const fresh = (ids: string[]): MissionProgress[] => ids.map((id) => ({ id, value: 0, claimed: false }));

export function weekDays(m: MissionState): number {
  return m.days.filter((d) => weekIdKST(Date.parse(`${d}T12:00:00Z`)) === m.weekId).length;
}

/** 접속 처리: 날짜가 바뀌면 오늘의 미션·주간 미션 교체, 출석 연속 일수 갱신. 같은 날 여러 번 불러도 결과 동일(멱등) */
export function ensureMissions(p: PlayerData, now: Date): PlayerData {
  const today = dateKST(now);
  const week = weekIdKST(now);
  let m = p.missions;
  if (m && m.dateKST === today && m.weekId === week && m.days.includes(today)) return p;
  if (!m) m = { dateKST: today, daily: fresh(pickDaily(today, p.playerId)), weekId: week, weekly: fresh(WEEKLY.map((x) => x.id)), days: [], attendance: { streak: 0, lastDateKST: '', claimedDateKST: '' } };
  else m = { ...m };
  if (m.dateKST !== today) {
    // 시계가 과거로 돌아간 경우(기기 시계 조작)에는 교체하지 않음 → 보상 반복 방지
    if (m.dateKST > today) return p;
    m.dateKST = today;
    m.daily = fresh(pickDaily(today, p.playerId));
  }
  if (m.weekId !== week && m.weekId < week) {
    m.weekId = week;
    m.weekly = fresh(WEEKLY.map((x) => x.id));
  }
  if (!m.days.includes(today)) m.days = [...m.days, today].slice(-14);
  const att = { ...m.attendance };
  if (att.lastDateKST !== today) {
    att.streak = att.lastDateKST && dayDiff(att.lastDateKST, today) === 1 ? att.streak + 1 : 1;
    att.lastDateKST = today;
  }
  m.attendance = att;
  // w-days3 는 접속 일수에서 계산
  m.weekly = m.weekly.map((w) => (w.id === 'w-days3' ? { ...w, value: Math.min(getMission('w-days3')!.target, weekDays(m!)) } : w));
  return { ...p, missions: m };
}

/** 결과 1건 반영 (distinctGames: 오늘 플레이한 서로 다른 게임 수) */
export function progressMissions(p: PlayerData, e: MissionEvent, distinctGames: number): PlayerData {
  const m = p.missions;
  if (!m) return p;
  const step = (list: MissionProgress[]) =>
    list.map((x) => {
      const def = getMission(x.id);
      if (!def || x.claimed) return x;
      if (x.id === 'd-games2') return { ...x, value: Math.min(def.target, distinctGames) };
      if (!def.inc) return x;
      return { ...x, value: Math.min(def.target, x.value + def.inc(e)) };
    });
  return { ...p, missions: { ...m, daily: step(m.daily), weekly: step(m.weekly) } };
}

export type ClaimResult = { ok: true; player: PlayerData; coins: number; xp: number } | { ok: false; error: 'none' | 'not-done' | 'claimed' };
export function claimMission(p: PlayerData, id: string, now: Date): ClaimResult {
  const m = p.missions;
  const def = getMission(id);
  if (!m || !def) return { ok: false, error: 'none' };
  const list = def.scope === 'daily' ? m.daily : m.weekly;
  const item = list.find((x) => x.id === id);
  if (!item) return { ok: false, error: 'none' };
  if (item.claimed) return { ok: false, error: 'claimed' };
  if (item.value < def.target) return { ok: false, error: 'not-done' };
  const upd = list.map((x) => (x.id === id ? { ...x, claimed: true } : x));
  const base: PlayerData = { ...p, missions: { ...m, [def.scope === 'daily' ? 'daily' : 'weekly']: upd }, stats: { ...p.stats, missionsClaimed: (p.stats.missionsClaimed ?? 0) + 1 } };
  return { ok: true, player: grant(base, { xp: def.rewardXP, coins: def.rewardCoins, reason: 'mission', refId: id, now }), coins: def.rewardCoins, xp: def.rewardXP };
}

export function attendanceReward(streak: number): number {
  const t = TUNING.attendanceCoins;
  return t[(Math.max(1, streak) - 1) % t.length];
}
export function claimAttendance(p: PlayerData, now: Date): ClaimResult {
  const m = p.missions;
  if (!m) return { ok: false, error: 'none' };
  const today = dateKST(now);
  if (m.attendance.claimedDateKST === today) return { ok: false, error: 'claimed' };
  if (m.attendance.lastDateKST !== today) return { ok: false, error: 'none' };
  const coins = attendanceReward(m.attendance.streak);
  const base: PlayerData = { ...p, missions: { ...m, attendance: { ...m.attendance, claimedDateKST: today } } };
  return { ok: true, player: grant(base, { xp: TUNING.attendanceXP, coins, reason: 'attendance', refId: today, now }), coins, xp: TUNING.attendanceXP };
}
export { addDays };
