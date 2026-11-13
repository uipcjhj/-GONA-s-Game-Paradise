/**
 * 온라인 랭킹 인터페이스 (Phase 1 에서는 구현체 없음 — 연결 금지 단계).
 * 향후 Cloudflare Workers + D1 어댑터가 이 인터페이스를 구현. 서버가 없으면 NullRankingProvider 가
 * 'unavailable' 을 돌려주고 화면은 "온라인 랭킹 준비 중"만 표시 (가짜 순위 금지).
 */
export type RankingGame = string | 'overall';
export type RankingPeriod = 'weekly' | 'all-time';

export interface RankingQuery {
  gameId: RankingGame;
  period: RankingPeriod;
  /** 주간 랭킹 주차(서버가 KST 월요일 기준으로 계산). 비우면 이번 주 */
  weekId?: string;
  limit?: number;
}
export interface RankingEntry {
  rank: number;
  playerId: string;
  nickname: string;
  publicCode: string;
  avatarId: string;
  score: number;
  achievedAt: string;
}
export type RankingResult =
  | { status: 'ok'; entries: RankingEntry[]; me?: RankingEntry; updatedAt: string }
  | { status: 'unavailable' }
  | { status: 'error'; message: string };

export interface RankingProvider {
  readonly connected: boolean;
  getRanking(q: RankingQuery): Promise<RankingResult>;
}

export const NullRankingProvider: RankingProvider = {
  connected: false,
  async getRanking() {
    return { status: 'unavailable' };
  },
};
