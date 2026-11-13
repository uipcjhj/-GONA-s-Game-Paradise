import { GAMES, getGame } from './games';
import { kstWeekId } from './kst';
import type { GameRecord, PlayerData } from './types';

/** 점수 → 0~1 정규화 (게임마다 점수 규모가 달라 원점수를 합산하지 않기 위함). 완만한 곡선(제곱근)으로 낮은 점수도 의미 있게 */
export function normalizeScore(score: number, referenceScore: number): number {
  if (referenceScore <= 0 || score <= 0) return 0;
  return Math.min(1, Math.sqrt(score / referenceScore));
}

export interface OverallEntry {
  gameId: string;
  name: string;
  best: number;
  normalized: number;
  weight: number;
  played: boolean;
}
/**
 * 내 종합 지수(로컬·참고용): 출시된(live) 게임만 대상. 게임별 정규화 점수를 가중 평균(안 해 본 게임은 0점)해 0~1000.
 * 온라인 종합 랭킹은 서버에서 '다른 플레이어 대비 백분위'로 계산하는 별도 방식(docs/platform/backend) — 이 값은 순위가 아니다.
 */
export function overallIndex(p: PlayerData): { index: number; entries: OverallEntry[] } {
  const live = GAMES.filter((g) => g.status === 'live');
  const entries: OverallEntry[] = live.map((g) => {
    const rec = p.gameRecords[g.gameId];
    const best = rec?.bestScore ?? 0;
    return { gameId: g.gameId, name: g.name, best, normalized: normalizeScore(best, g.rules.referenceScore), weight: g.rules.weight, played: !!rec };
  });
  const wsum = entries.reduce((a, e) => a + e.weight, 0);
  const index = wsum ? Math.round((1000 * entries.reduce((a, e) => a + e.normalized * e.weight, 0)) / wsum) : 0;
  return { index, entries };
}

/** 이번 주(KST 월~일) 내 최고 — 저장된 주차가 이번 주일 때만 */
export function weeklyBest(rec: GameRecord | undefined, now: number): { score: number; at: string } | null {
  if (!rec?.weekly) return null;
  return rec.weekly.weekId === kstWeekId(now) ? { score: rec.weekly.score, at: rec.weekly.at } : null;
}

export const rankingGames = () => [...GAMES.map((g) => ({ id: g.gameId, label: g.short, soon: g.status === 'soon', name: g.name })), { id: 'overall', label: '종합', soon: false, name: '종합' }];
export const isLive = (id: string): boolean => getGame(id)?.status === 'live';
