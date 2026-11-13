import { weekIdKST } from './kst';
import type { GameRecord, PlayerData } from './types';

/**
 * "이 기기 순위": 이 기기에서 내가 기록한 점수의 순위일 뿐, 다른 플레이어와의 순위가 아니다.
 * 실제 공유 랭킹(주간·역대·종합)은 서버가 필요 → services/ranking.ts 의 RankingProvider (현재 미연결).
 */
export interface LocalEntry {
  rank: number;
  score: number;
  at: string;
  source: 'play' | 'import';
}
export function recordFor(p: PlayerData, gameId: string, subGameId?: string): GameRecord | undefined {
  const r = p.gameRecords[gameId];
  return subGameId ? r?.subGames?.[subGameId] : r;
}
export function localBoard(p: PlayerData, gameId: string, period: 'weekly' | 'all-time', subGameId?: string, now: Date = new Date()): LocalEntry[] {
  const rec = recordFor(p, gameId, subGameId);
  if (!rec) return [];
  let rows: { score: number; at: string; source: 'play' | 'import' }[] = rec.top.map((t) => ({ score: t.score, at: t.at, source: 'play' }));
  if (period === 'weekly') {
    const w = weekIdKST(now);
    rows = rows.filter((t) => weekIdKST(Date.parse(t.at)) === w);
  } else if (rec.bestScoreSource === 'import' && rec.bestScore > 0 && !rows.some((r) => r.score >= rec.bestScore)) {
    rows = [{ score: rec.bestScore, at: rec.bestScoreAt, source: 'import' }, ...rows];
  }
  return rows.sort((a, b) => b.score - a.score || a.at.localeCompare(b.at)).map((r, i) => ({ ...r, rank: i + 1 }));
}
