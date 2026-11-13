/**
 * 서버 쪽 게임 규칙. 게임천국 앱의 `src/platform/games.ts` 규칙과 같아야 한다(테스트가 일치 여부를 검증).
 * 점수 검증은 서버가 잰 경과 시간 기준이므로 클라이언트 값에 의존하지 않는다.
 */
export interface ServerGame {
  gameId: string;
  live: boolean;
  maxScore: number;
  maxScorePerSec: number;
  carryAllowance: number;
  stageCount?: number;
  hasClear: boolean;
  scoreSchemaVersion: number;
  weight: number;
}
export const SERVER_GAMES: ServerGame[] = [
  { gameId: 'food-island', live: true, maxScore: 2_000_000, maxScorePerSec: 120, carryAllowance: 60_000, stageCount: 4, hasClear: true, scoreSchemaVersion: 1, weight: 1 },
  { gameId: 'sky-battle', live: false, maxScore: 10_000_000, maxScorePerSec: 1000, carryAllowance: 60_000, stageCount: 5, hasClear: true, scoreSchemaVersion: 1, weight: 1 },
  { gameId: 'minigame-paradise', live: false, maxScore: 1_000_000, maxScorePerSec: 1000, carryAllowance: 60_000, hasClear: false, scoreSchemaVersion: 1, weight: 1 },
];
export const AVATAR_IDS = ['gona', 'mom', 'dad', 'imo', 'halmeoni', 'halabeoji', 'samchon', 'kiss', 'sniff', 'glasses', 'farter'];
export const scoreLimit = (g: ServerGame, durationSec: number): number => Math.min(g.maxScore, Math.ceil(g.maxScorePerSec * Math.max(durationSec, 10)) + g.carryAllowance);
export const getServerGame = (id: string, allowTest: boolean): ServerGame | undefined => {
  const g = SERVER_GAMES.find((x) => x.gameId === id);
  return g && (g.live || allowTest) ? g : undefined;
};
