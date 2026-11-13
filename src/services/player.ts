/**
 * 향후 확장용 타입 · 인터페이스 (1차 개발에서는 구현하지 않음).
 * 서버 · 데이터베이스가 없으므로 가짜 데이터를 만들지 않습니다.
 *
 * 준비된 기능: 공통 닉네임/플레이어 ID · 게임별 최고 점수 · 주간/역대/통합 랭킹 · 업적/배지
 * 각 게임은 독립 프로젝트로 유지하고, 나중에 gameId(= Island.id)로 점수를 보고하는 방식을 가정합니다.
 */

export interface PlayerProfile {
  playerId: string;
  nickname: string;
}

export interface ScoreEntry {
  gameId: string;
  playerId: string;
  score: number;
  achievedAt: string; // ISO 8601
}

export type RankingScope = 'weekly' | 'all-time' | 'overall';

export interface Badge {
  id: string;
  name: string;
  gameId?: string;
}

/** 나중에 서버(또는 무료 백엔드)를 붙일 때 구현할 자리 */
export interface ParadiseBackend {
  getProfile(): Promise<PlayerProfile | null>;
  saveNickname(nickname: string): Promise<PlayerProfile>;
  submitScore(entry: Omit<ScoreEntry, 'achievedAt'>): Promise<void>;
  getBestScore(gameId: string): Promise<number | null>;
  getRanking(scope: RankingScope, gameId?: string): Promise<ScoreEntry[]>;
  getBadges(): Promise<Badge[]>;
}
