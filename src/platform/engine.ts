import { achievementsLoop } from './achievementsLoop';
import { dateKST } from './kst';
import { ensureMissions, progressMissions } from './missions';
import { grant } from './progression';
import { applyRecord } from './records';
import { effectiveRule, getGame } from './registry';
import type { GameResult } from './result';
import { TUNING } from './tuning';
import type { DailyCounters, GameRecord, PlayerData } from './types';

export interface ResultOutcome {
  result: GameResult;
  /** 화면에 보여 줄 기록(하위 게임이면 그 하위 게임 기록) */
  record: GameRecord;
  prevBest: number;
  isNewBest: boolean;
  first: boolean;
  xp: number;
  coins: number;
  /** 일일 상한 또는 최소 시간 미달로 보상이 줄었음 */
  capped: boolean;
  levelFrom: number;
  levelTo: number;
  achievements: string[];
  codex: string[];
  /** 같은 resultId 가 이미 반영돼 있어 아무것도 바꾸지 않음 */
  duplicate?: boolean;
}

function dailyFor(p: PlayerData, now: Date): DailyCounters {
  const d = dateKST(now);
  return p.daily.dateKST === d ? p.daily : { dateKST: d, byGame: {} };
}

/** 결과 1건을 플레이어 데이터에 반영 (순수 함수: 입력을 바꾸지 않고 새 데이터를 반환) */
export function applyGameResult(player: PlayerData, r: GameResult, now: Date): { player: PlayerData; outcome: ResultOutcome } {
  const game = getGame(r.gameId);
  const rule = effectiveRule(r.gameId, r.subGameId);
  if (!game || !rule) throw new Error(`unknown game ${r.gameId}`);
  if (player.resultLedger.includes(r.resultId)) {
    const rec = (r.subGameId ? player.gameRecords[r.gameId]?.subGames?.[r.subGameId] : player.gameRecords[r.gameId]) ?? player.gameRecords[r.gameId];
    return { player, outcome: { result: r, record: rec, prevBest: 0, isNewBest: false, first: false, xp: 0, coins: 0, capped: false, levelFrom: player.playerLevel, levelTo: player.playerLevel, achievements: [], codex: [], duplicate: true } };
  }
  const levelFrom = player.playerLevel;
  let p = ensureMissions(player, now);

  // ── 기록
  const parentPrev = p.gameRecords[r.gameId];
  let shown: ReturnType<typeof applyRecord>;
  let parent: GameRecord;
  if (r.subGameId) {
    const subPrev = parentPrev?.subGames?.[r.subGameId];
    shown = applyRecord(subPrev, `${r.gameId}/${r.subGameId}`, r, true);
    const agg = applyRecord(parentPrev, r.gameId, r, game.rule.scoreComparable);
    parent = { ...agg.record, subGames: { ...(parentPrev?.subGames ?? {}), [r.subGameId]: shown.record } };
  } else {
    shown = applyRecord(parentPrev, r.gameId, r, game.rule.scoreComparable);
    parent = { ...shown.record, subGames: parentPrev?.subGames };
    if (!parent.subGames) delete parent.subGames;
  }
  p = { ...p, gameRecords: { ...p.gameRecords, [r.gameId]: parent }, totalPlayCount: p.totalPlayCount + 1, totalPlayTimeSec: p.totalPlayTimeSec + Math.round(r.durationMs / 1000), lastPlayedAt: r.endedAt };
  const cleared = r.outcome === 'cleared';
  const realNewBest = shown.isNewBest && !shown.first;
  p = { ...p, stats: { ...p.stats, clears: (p.stats.clears ?? 0) + (cleared ? 1 : 0), newBests: (p.stats.newBests ?? 0) + (realNewBest ? 1 : 0) } };

  // ── 보상 (일일 상한 · 최소 시간)
  const R = TUNING.reward;
  const wantXP = R.baseXP + (cleared ? R.clearXP : 0) + (realNewBest ? R.newBestXP : 0) + Math.min(R.scoreXPMax, Math.floor(r.score / rule.scoreXPUnit));
  const wantCoins = R.baseCoins + (cleared ? R.clearCoins : 0) + (realNewBest ? R.newBestCoins : 0);
  const daily = dailyFor(p, now);
  const bucket = daily.byGame[r.gameId] ?? { xp: 0, coins: 0, plays: 0 };
  const totalXP = Object.values(daily.byGame).reduce((s, b) => s + b.xp, 0);
  const totalCoins = Object.values(daily.byGame).reduce((s, b) => s + b.coins, 0);
  const C = TUNING.dailyCap;
  const tooShort = r.durationMs < rule.minRewardMs;
  const xp = tooShort ? 0 : Math.max(0, Math.min(wantXP, C.xpPerGame - bucket.xp, C.xpTotal - totalXP));
  const coins = tooShort ? 0 : Math.max(0, Math.min(wantCoins, C.coinsPerGame - bucket.coins, C.coinsTotal - totalCoins));
  const capped = xp < wantXP || coins < wantCoins;
  p = { ...p, daily: { dateKST: daily.dateKST, byGame: { ...daily.byGame, [r.gameId]: { xp: bucket.xp + xp, coins: bucket.coins + coins, plays: bucket.plays + 1 } } } };
  p = grant(p, { xp, coins, reason: 'game', refId: r.resultId, now });

  // ── 미션 → 업적 · 도감
  const distinct = Object.values(p.daily.byGame).filter((b) => b.plays > 0).length;
  p = progressMissions(p, { cleared, newBest: realNewBest }, distinct);
  const loop = achievementsLoop(p, now);
  p = loop.player;

  p = { ...p, resultLedger: [...p.resultLedger, r.resultId].slice(-TUNING.ledgerMax) };
  return {
    player: p,
    outcome: { result: r, record: shown.record, prevBest: shown.prevBest, isNewBest: shown.isNewBest, first: shown.first, xp, coins, capped, levelFrom, levelTo: p.playerLevel, achievements: loop.achievements, codex: loop.codex },
  };
}
