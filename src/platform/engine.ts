/**
 * 게임천국 규칙 엔진 — 모든 함수는 순수 함수: (플레이어 데이터, 입력) → 새 플레이어 데이터 + 알림.
 * 코인·XP·업적·칭호·도감·미션·출석·구매가 **한 객체에서 한 번에** 바뀌므로 서로 어긋나지 않는다.
 * 저장은 호출하는 쪽(PlayerContext)이 결과를 한 번만 쓴다.
 */
import { AVATARS, isAvatarUnlocked } from './avatars';
import { ACHIEVEMENTS, CODEX, DEFAULT_ITEMS, getItem, getMission, isTitleUnlocked, metric, MISSION_POOL, TITLES, unlockedTitles, type MissionDef } from './content';
import { BALANCE } from './balance';
import { getGame, type GameDef } from './games';
import { dayNumber, daysBetween, hashString, kstDate, kstWeekId } from './kst';
import { levelForXp } from './progression';
import { emptyDaily } from './schema';
import type { GameRecord, PlayerData, ShopSlot } from './types';
import type { GameResult } from './result';

export type Notice =
  | { kind: 'levelup'; from: number; to: number; coins: number }
  | { kind: 'achievement'; id: string }
  | { kind: 'title'; id: string }
  | { kind: 'avatar'; id: string }
  | { kind: 'codex'; id: string }
  | { kind: 'mission'; id: string }
  | { kind: 'attendance'; streak: number; coins: number; xp: number };

export interface Outcome<T = undefined> {
  player: PlayerData;
  notices: Notice[];
  data: T;
  changed: boolean;
}

const clone = (p: PlayerData): PlayerData => JSON.parse(JSON.stringify(p)) as PlayerData;
const iso = (now: number): string => new Date(now).toISOString();

/** 시계를 뒤로 돌려도 날짜가 되돌아가지 않게: 지금까지 본 가장 늦은 한국 날짜를 '오늘'로 쓴다 */
export function effectiveDate(p: PlayerData, now: number): string {
  const today = kstDate(now);
  const seen = p.attendance.maxSeenDate;
  return seen && dayNumber(seen) > dayNumber(today) ? seen : today;
}

export function missionsForDate(date: string): MissionDef[] {
  const h = hashString(date);
  const v = MISSION_POOL.visit[h % MISSION_POOL.visit.length];
  const c = MISSION_POOL.challenge[(h >>> 3) % MISSION_POOL.challenge.length];
  return [v, MISSION_POOL.launch[0], MISSION_POOL.play[0], c];
}

function rollDaily(p: PlayerData, now: number): void {
  const date = effectiveDate(p, now);
  p.attendance.maxSeenDate = date;
  if (p.daily.dateKST !== date) {
    p.daily = emptyDaily(date);
  }
  for (const m of missionsForDate(date)) if (!p.daily.missions[m.id]) p.daily.missions[m.id] = { progress: 0, claimed: false };
}

function grant(p: PlayerData, xp: number, coins: number): void {
  p.totalXP += xp;
  p.coinBalance += coins;
  p.stats.totalXpEarned += xp;
  p.stats.totalCoinsEarned += coins;
}

/** 파생 상태(레벨·업적·도감)를 더 이상 변하지 않을 때까지 정리하고, 새 칭호를 알림으로 */
function finalize(p: PlayerData, notices: Notice[], now: number, titlesBefore: Set<string>): void {
  const levelFrom = p.playerLevel;
  let coinsFromLevels = 0;
  for (let guard = 0; guard < 8; guard++) {
    let changed = false;
    const lv = levelForXp(p.totalXP);
    if (lv > p.playerLevel) {
      for (let l = Math.max(p.levelRewardsGiven, 1) + 1; l <= lv; l++) {
        const c = BALANCE.levelUpCoins(l);
        grant(p, 0, c);
        coinsFromLevels += c;
      }
      p.playerLevel = lv;
      p.levelRewardsGiven = Math.max(p.levelRewardsGiven, lv);
      changed = true;
    }
    for (const a of ACHIEVEMENTS) {
      if (p.achievements[a.id] || metric(p, a.metric) < a.target) continue;
      p.achievements[a.id] = { at: iso(now) };
      grant(p, a.xp, a.coins);
      notices.push({ kind: 'achievement', id: a.id });
      changed = true;
    }
    for (const c of CODEX) {
      if (p.codex[c.id] || !c.test(p)) continue;
      p.codex[c.id] = { at: iso(now) };
      notices.push({ kind: 'codex', id: c.id });
      changed = true;
    }
    // 아바타 해금: 조건을 처음 충족하면 영구 해금 목록에 기록. 정식 에셋이 있는 아바타만 알림(제작 전에는 조용히 해금 상태만 저장)
    for (const a of AVATARS) {
      if (a.unlock.kind === 'free' || p.unlockedAvatarIds.includes(a.id) || !isAvatarUnlocked(a, p)) continue;
      p.unlockedAvatarIds.push(a.id);
      if (a.asset === 'ready') notices.push({ kind: 'avatar', id: a.id });
    }
    if (!changed) break;
  }
  if (p.playerLevel > levelFrom) notices.push({ kind: 'levelup', from: levelFrom, to: p.playerLevel, coins: coinsFromLevels });
  for (const t of unlockedTitles(p)) if (!titlesBefore.has(t.id)) notices.push({ kind: 'title', id: t.id });
  if (!TITLES.some((t) => t.id === p.titleId && isTitleUnlocked(p, t))) p.titleId = 'rookie';
  p.coinBalance = Math.max(0, p.coinBalance);
}

function run<T>(p0: PlayerData, now: number, fn: (p: PlayerData, notices: Notice[]) => T | undefined): Outcome<T | undefined> {
  const p = clone(p0);
  const notices: Notice[] = [];
  const titlesBefore = new Set(unlockedTitles(p).map((t) => t.id));
  rollDaily(p, now);
  const data = fn(p, notices);
  finalize(p, notices, now, titlesBefore);
  return { player: p, notices, data, changed: JSON.stringify(p) !== JSON.stringify(p0) };
}

// ───────────────── 게임 결과 ─────────────────
export interface RewardInfo {
  xp: number;
  coins: number;
  /** 보상이 없거나 줄어든 이유 */
  skipped?: 'short' | 'daily-cap' | 'session-cap';
  bonuses: ('clear' | 'best')[];
}
export interface ResultSummary {
  gameId: string;
  subGameId?: string;
  resultId: string;
  score: number;
  outcome: 'cleared' | 'failed';
  stage?: number;
  stageLabel?: string;
  durationSec: number;
  isFirst: boolean;
  isNewBest: boolean;
  prevBest: number;
  bestScore: number;
  plays: number;
  clears: number;
  lastPlayedAt: string;
  reward: RewardInfo;
  levelBefore: number;
  levelAfter: number;
  snacks?: number;
  duplicate?: boolean;
}

export function computeReward(game: GameDef, r: GameResult, ctx: { isNewBest: boolean; isFirst: boolean; p: PlayerData }): RewardInfo {
  const B = BALANCE;
  const dur = r.durationMs / 1000;
  const none: RewardInfo = { xp: 0, coins: 0, bonuses: [] };
  if (dur < B.play.minDurationSec) return { ...none, skipped: 'short' };
  if (ctx.p.daily.rewardedRuns >= B.caps.dailyRewardedRuns) return { ...none, skipped: 'daily-cap' };
  if ((ctx.p.sessionRewarded[r.sessionId] ?? 0) >= B.caps.perSessionRewardedRuns) return { ...none, skipped: 'session-cap' };
  let xp = B.play.baseXp + Math.min(B.play.scoreXpCap, Math.floor(r.score / B.play.scoreXpPer));
  let coins = B.play.baseCoins + Math.min(B.play.scoreCoinCap, Math.floor(r.score / B.play.scoreCoinPer));
  const bonuses: RewardInfo['bonuses'] = [];
  if (r.outcome === 'cleared' && game.rules.hasClear && ctx.p.daily.clearBonuses < B.caps.dailyClearBonuses) {
    xp += B.play.clearXp;
    coins += B.play.clearCoins;
    bonuses.push('clear');
  }
  if (ctx.isNewBest && !ctx.isFirst) {
    xp += B.play.newBestXp;
    coins += B.play.newBestCoins;
    bonuses.push('best');
  }
  return { xp, coins, bonuses };
}

function updateRecord(rec: GameRecord | undefined, r: GameResult, game: GameDef, gameId: string, now: number): { rec: GameRecord; isFirst: boolean; isNewBest: boolean; prevBest: number } {
  const at = r.endedAt;
  const label = r.stage ? game.rules.stageLabels?.[r.stage - 1] ?? r.stageLabel : undefined;
  const isFirst = !rec;
  const next: GameRecord = rec
    ? { ...rec, recent: [...rec.recent] }
    : { gameId, bestScore: 0, bestScoreAt: at, bestStage: 0, plays: 0, clears: 0, firstPlayedAt: at, lastPlayedAt: at, totalPlayTimeSec: 0, recent: [] };
  const prevBest = next.bestScore;
  const isNewBest = isFirst ? r.score > 0 : r.score > prevBest;
  if (isFirst || r.score > prevBest) {
    next.bestScore = r.score;
    next.bestScoreAt = at;
  }
  if (r.stage && r.stage > next.bestStage) {
    next.bestStage = r.stage;
    next.bestStageLabel = label;
  }
  next.plays += 1;
  if (r.outcome === 'cleared') next.clears += 1;
  if (Date.parse(at) >= Date.parse(next.lastPlayedAt)) next.lastPlayedAt = at;
  if (Date.parse(at) < Date.parse(next.firstPlayedAt)) next.firstPlayedAt = at;
  next.totalPlayTimeSec += Math.round(r.durationMs / 1000);
  next.recent = [{ resultId: r.resultId, score: r.score, stage: r.stage, cleared: r.outcome === 'cleared', at }, ...next.recent].slice(0, BALANCE.recentPlaysKept);
  const wk = kstWeekId(Date.parse(at));
  if (!next.weekly || next.weekly.weekId !== wk) {
    if (!next.weekly || Date.parse(at) >= Date.parse(next.weekly.at)) next.weekly = { weekId: wk, score: r.score, at };
  } else if (r.score > next.weekly.score) next.weekly = { weekId: wk, score: r.score, at };
  void now;
  return { rec: next, isFirst, isNewBest, prevBest };
}

/** 검증을 통과한 결과 1건을 반영. 이미 반영한 resultId 는 아무 것도 바꾸지 않고 duplicate 로 돌려준다. */
export function applyResult(p0: PlayerData, r: GameResult, now: number): Outcome<ResultSummary | undefined> {
  const game = getGame(r.gameId);
  const dup = p0.resultLedger.includes(r.resultId);
  if (!game || dup) {
    const rec = p0.gameRecords[r.gameId];
    return {
      player: p0, notices: [], changed: false,
      data: game && dup ? { gameId: r.gameId, resultId: r.resultId, score: r.score, outcome: r.outcome, stage: r.stage, durationSec: Math.round(r.durationMs / 1000), isFirst: false, isNewBest: false, prevBest: rec?.bestScore ?? 0, bestScore: rec?.bestScore ?? 0, plays: rec?.plays ?? 0, clears: rec?.clears ?? 0, lastPlayedAt: rec?.lastPlayedAt ?? r.endedAt, reward: { xp: 0, coins: 0, bonuses: [] }, levelBefore: p0.playerLevel, levelAfter: p0.playerLevel, duplicate: true } : undefined,
    };
  }
  const out = run(p0, now, (p) => {
    const levelBefore = p.playerLevel;
    const parent = updateRecord(p.gameRecords[r.gameId], r, game, r.gameId, now);
    if (r.subGameId) {
      const sub = updateRecord(parent.rec.subGames?.[r.subGameId], r, game, r.subGameId, now);
      parent.rec.subGames = { ...(parent.rec.subGames ?? {}), [r.subGameId]: sub.rec };
    }
    const reward = computeReward(game, r, { isNewBest: parent.isNewBest, isFirst: parent.isFirst, p });
    p.gameRecords[r.gameId] = parent.rec;
    p.stats.totalPlayCount += 1;
    p.stats.totalPlayTimeSec += Math.round(r.durationMs / 1000);
    if (parent.isNewBest && !parent.isFirst) p.stats.newBestCount += 1;
    if (reward.xp || reward.coins) {
      grant(p, reward.xp, reward.coins);
      p.daily.rewardedRuns += 1;
      p.sessionRewarded[r.sessionId] = (p.sessionRewarded[r.sessionId] ?? 0) + 1;
      if (reward.bonuses.includes('clear')) p.daily.clearBonuses += 1;
    }
    // 미션 진행(결과 기반)
    const bump = (id: string, ok: boolean) => {
      const m = p.daily.missions[id];
      const def = getMission(id);
      if (m && def && ok && !m.claimed) m.progress = Math.min(def.target, m.progress + 1);
    };
    bump('m_play1', true);
    bump('m_score3000', r.gameId === 'food-island' && r.score >= 3000);
    bump('m_best', parent.isNewBest && !parent.isFirst);
    p.resultLedger = [...p.resultLedger, r.resultId].slice(-BALANCE.ledgerKept);
    p.lastPlayedAt = iso(now);
    const snacks = typeof r.extra?.snacks === 'number' ? r.extra.snacks : undefined;
    const summary: ResultSummary = {
      gameId: r.gameId, subGameId: r.subGameId, resultId: r.resultId, score: r.score, outcome: r.outcome, stage: r.stage, stageLabel: r.stage ? game.rules.stageLabels?.[r.stage - 1] ?? r.stageLabel : undefined,
      durationSec: Math.round(r.durationMs / 1000), isFirst: parent.isFirst, isNewBest: parent.isNewBest, prevBest: parent.prevBest, bestScore: parent.rec.bestScore, plays: parent.rec.plays, clears: parent.rec.clears,
      lastPlayedAt: parent.rec.lastPlayedAt, reward, levelBefore, levelAfter: levelBefore, snacks,
    };
    return summary;
  }) as Outcome<ResultSummary | undefined>;
  if (out.data) out.data.levelAfter = out.player.playerLevel;
  return out;
}

/** 여러 결과를 시간순으로 한 번에 반영 (저장은 호출하는 쪽에서 1회) */
export function applyResults(p0: PlayerData, results: GameResult[], now: number): { player: PlayerData; summaries: ResultSummary[]; notices: Notice[]; changed: boolean } {
  let p = p0;
  const summaries: ResultSummary[] = [];
  const notices: Notice[] = [];
  let changed = false;
  for (const r of [...results].sort((a, b) => Date.parse(a.endedAt) - Date.parse(b.endedAt))) {
    const lvBefore = p.playerLevel;
    const o = applyResult(p, r, now);
    if (o.data) summaries.push({ ...o.data, levelBefore: o.data.duplicate ? o.data.levelBefore : lvBefore, levelAfter: o.player.playerLevel });
    notices.push(...o.notices);
    p = o.player;
    changed ||= o.changed;
  }
  return { player: p, summaries, notices, changed };
}

// ───────────────── 실행 · 방문 · 출석 · 미션 ─────────────────
export function recordLaunch(p: PlayerData, gameId: string, now: number): Outcome<undefined> {
  return run(p, now, (c) => {
    c.stats.launches += 1;
    if (gameId === 'food-island') {
      const m = c.daily.missions['m_launch'];
      if (m && !m.claimed) m.progress = 1;
    }
    return undefined;
  }) as Outcome<undefined>;
}

export function recordVisit(p: PlayerData, kind: string, now: number, islandId?: string): Outcome<undefined> {
  return run(p, now, (c) => {
    if (kind === 'islands') {
      if (islandId && !c.daily.islandsOpened.includes(islandId)) c.daily.islandsOpened.push(islandId);
      const m = c.daily.missions['m_islands'];
      if (m && !m.claimed) m.progress = Math.min(2, c.daily.islandsOpened.length);
    } else {
      if (!c.daily.visits.includes(kind)) c.daily.visits.push(kind);
      const def = MISSION_POOL.visit.find((d) => d.visit === kind);
      const m = def && c.daily.missions[def.id];
      if (m && def && !m.claimed) m.progress = def.target;
    }
    return undefined;
  }) as Outcome<undefined>;
}

export function claimMission(p: PlayerData, id: string, now: number): Outcome<'claimed' | 'not-ready' | 'unknown'> {
  const def = getMission(id);
  return run(p, now, (c, notices) => {
    const m = c.daily.missions[id];
    if (!def || !m) return 'unknown' as const;
    if (m.claimed || m.progress < def.target) return 'not-ready' as const;
    m.claimed = true;
    grant(c, def.xp, def.coins);
    c.stats.missionsCompleted += 1;
    notices.push({ kind: 'mission', id });
    return 'claimed' as const;
  }) as Outcome<'claimed' | 'not-ready' | 'unknown'>;
}

/** 하루 첫 접속 출석. 같은 한국 날짜에는 1번만, 시계를 되돌려도 중복 지급 불가 */
export function checkIn(p: PlayerData, now: number): Outcome<'checked' | 'already'> {
  return run(p, now, (c, notices) => {
    const date = effectiveDate(c, now);
    if (c.attendance.lastDate && dayNumber(c.attendance.lastDate) >= dayNumber(date)) return 'already' as const;
    const gap = c.attendance.lastDate ? daysBetween(c.attendance.lastDate, date) : null;
    c.attendance.streak = gap === 1 ? c.attendance.streak + 1 : 1;
    c.attendance.longest = Math.max(c.attendance.longest, c.attendance.streak);
    c.attendance.total += 1;
    c.attendance.lastDate = date;
    c.stats.checkins += 1;
    const coins = BALANCE.attendance.coins[(c.attendance.streak - 1) % BALANCE.attendance.coins.length];
    grant(c, BALANCE.attendance.xp, coins);
    notices.push({ kind: 'attendance', streak: c.attendance.streak, coins, xp: BALANCE.attendance.xp });
    return 'checked' as const;
  }) as Outcome<'checked' | 'already'>;
}

// ───────────────── 상점 · 칭호 · 대표 업적 ─────────────────
export type BuyResult = 'ok' | 'unknown' | 'owned' | 'no-coins';
export function buyItem(p: PlayerData, itemId: string, now: number): Outcome<BuyResult> {
  return run(p, now, (c) => {
    const item = getItem(itemId);
    if (!item) return 'unknown' as const;
    if (c.inventory.owned.includes(itemId)) return 'owned' as const;
    if (item.price > c.coinBalance) return 'no-coins' as const;
    c.coinBalance -= item.price;
    c.inventory.owned.push(itemId);
    c.inventory.history = [...c.inventory.history, { itemId, price: item.price, at: iso(now) }].slice(-BALANCE.historyKept);
    c.stats.purchases += 1;
    return 'ok' as const;
  }) as Outcome<BuyResult>;
}
export function equipItem(p: PlayerData, itemId: string, now: number): Outcome<boolean> {
  return run(p, now, (c) => {
    const item = getItem(itemId);
    if (!item || !c.inventory.owned.includes(itemId)) return false;
    c.inventory.equipped[item.slot] = itemId;
    return true;
  }) as Outcome<boolean>;
}
/** 장착 해제 = 그 슬롯의 기본 아이템으로 되돌림 */
export function unequipSlot(p: PlayerData, slot: ShopSlot, now: number): Outcome<boolean> {
  return run(p, now, (c) => {
    c.inventory.equipped[slot] = DEFAULT_ITEMS[slot];
    return true;
  }) as Outcome<boolean>;
}
export function setTitle(p: PlayerData, id: string, now: number): Outcome<boolean> {
  return run(p, now, (c) => {
    const t = TITLES.find((x) => x.id === id);
    if (!t || !isTitleUnlocked(c, t)) return false;
    c.titleId = id;
    return true;
  }) as Outcome<boolean>;
}
export function pinAchievement(p: PlayerData, id: string | undefined, now: number): Outcome<boolean> {
  return run(p, now, (c) => {
    if (id !== undefined && !c.achievements[id]) return false;
    c.pinnedAchievement = id;
    return true;
  }) as Outcome<boolean>;
}
export function updateSettingsPure(p: PlayerData, patch: Partial<PlayerData['settings']>): PlayerData {
  return { ...p, settings: { ...p.settings, ...patch } };
}
