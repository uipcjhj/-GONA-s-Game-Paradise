import { weekIdKST } from './kst';
import { TUNING } from './tuning';
import type { GameRecord, PlayerData } from './types';
import type { GameResult } from './result';

export function emptyRecord(gameId: string, at: string): GameRecord {
  return { gameId, bestScore: 0, bestScoreAt: at, bestScoreSource: 'play', plays: 0, clears: 0, firstPlayedAt: at, lastPlayedAt: at, totalPlayTimeSec: 0, top: [] };
}

export interface RecordUpdate {
  record: GameRecord;
  prevBest: number;
  isNewBest: boolean;
  first: boolean;
}
/** 기록 갱신 규칙: plays+1 · 클리어면 clears+1 · 최고점(동점은 먼저 달성한 기록 유지) · 최고 단계 · 마지막 결과 · 시간 합산 */
export function applyRecord(prev: GameRecord | undefined, gameId: string, r: GameResult, comparable: boolean): RecordUpdate {
  const at = r.endedAt;
  const base = prev ?? emptyRecord(gameId, at);
  const first = base.plays === 0;
  const prevBest = base.bestScore;
  const cleared = r.outcome === 'cleared';
  const next: GameRecord = {
    ...base,
    plays: base.plays + 1,
    clears: base.clears + (cleared ? 1 : 0),
    firstPlayedAt: first ? at : base.firstPlayedAt,
    lastPlayedAt: at,
    totalPlayTimeSec: base.totalPlayTimeSec + Math.round(r.durationMs / 1000),
    lastResult: { score: r.score, stage: r.stage, cleared, at, resultId: r.resultId },
  };
  let isNewBest = false;
  if (comparable) {
    if (r.score > base.bestScore) {
      isNewBest = true;
      next.bestScore = r.score;
      next.bestScoreAt = at;
      next.bestScoreSource = 'play';
    }
    if (r.stage !== undefined && r.stage > (base.bestStage ?? 0)) {
      next.bestStage = r.stage;
      if (r.stageLabel) next.bestStageLabel = r.stageLabel;
    }
    // 이 기기 상위 기록
    if (r.score > 0) next.top = [...base.top, { score: r.score, at }].sort((a, b) => b.score - a.score || a.at.localeCompare(b.at)).slice(0, TUNING.topMax);
    const week = weekIdKST(Date.parse(at));
    if (!base.weekly || base.weekly.weekId !== week) next.weekly = r.score > 0 ? { weekId: week, score: r.score, at } : undefined;
    else if (r.score > base.weekly.score) next.weekly = { weekId: week, score: r.score, at };
  }
  return { record: next, prevBest, isNewBest, first };
}

/** 이전 Food 최고 기록 가져오기(1회성, 읽어 온 값만 사용). 이미 기록이 있으면 더 높은 값일 때만 */
export function importBest(p: PlayerData, gameId: string, score: number, stage: number | undefined, now: Date): PlayerData | null {
  if (!Number.isInteger(score) || score <= 0) return null;
  if (p.stats[`import:${gameId}`]) return null;
  const at = now.toISOString();
  const cur = p.gameRecords[gameId];
  const base = cur ?? emptyRecord(gameId, at);
  if (score <= base.bestScore) return { ...p, stats: { ...p.stats, [`import:${gameId}`]: 1 } };
  const rec: GameRecord = { ...base, bestScore: score, bestScoreAt: at, bestScoreSource: 'import', bestStage: Math.max(base.bestStage ?? 0, stage ?? 0) || undefined };
  return { ...p, gameRecords: { ...p.gameRecords, [gameId]: rec }, stats: { ...p.stats, [`import:${gameId}`]: 1 } };
}
