/**
 * 게임 등록부 — 새 게임은 항목 하나만 추가 (섬 항목 `data/islands.ts` 의 id 와 같은 gameId).
 * 결과 검증 규칙(점수 상한·초당 점수·버전)과 보상 환산 단위를 가진다.
 */
export interface GameRule {
  /** 이보다 큰 점수는 '의심'으로 분류(기록 반영 안 함). 임시값 — 실제 데이터로 조정 필요 */
  maxScore: number;
  maxScorePerSec?: number;
  /** 지금 받는 점수 규칙 버전(규칙이 바뀌면 +1) */
  scoreSchemaVersion: number;
  hasClear: boolean;
  stageLabel?: string;
  stageCount?: number;
  /** 이 시간 미만(ms)의 판은 기록은 하되 XP·코인은 주지 않음(연타 방지) */
  minRewardMs: number;
  /** XP 환산 단위: 점수 N점당 1 XP (최대 TUNING.reward.scoreXPMax) */
  scoreXPUnit: number;
  /** 서로 다른 하위 게임의 점수는 비교할 수 없어 부모 최고점을 두지 않음 */
  scoreComparable: boolean;
  minVersion?: string;
}
export interface SubGameDef {
  id: string;
  name: string;
  rule: Partial<GameRule>;
}
export interface GameDef {
  gameId: string;
  name: string;
  short: string;
  rule: GameRule;
  subGames?: SubGameDef[];
}

export const GAMES: GameDef[] = [
  {
    gameId: 'food-island',
    name: "GONA's Food Adventure",
    short: 'Food',
    rule: { maxScore: 5_000_000, maxScorePerSec: 600, scoreSchemaVersion: 1, hasClear: true, stageLabel: '성장 단계', stageCount: 4, minRewardMs: 10_000, scoreXPUnit: 100, scoreComparable: true },
  },
  {
    gameId: 'sky-battle',
    name: '스카이 배틀',
    short: 'Sky',
    rule: { maxScore: 10_000_000, maxScorePerSec: 1000, scoreSchemaVersion: 1, hasClear: true, stageLabel: '스테이지', minRewardMs: 10_000, scoreXPUnit: 200, scoreComparable: true },
  },
  {
    gameId: 'minigame-paradise',
    name: '미니게임천국',
    short: 'Mini',
    rule: { maxScore: 200_000, maxScorePerSec: 300, scoreSchemaVersion: 1, hasClear: true, stageLabel: '레벨', minRewardMs: 5_000, scoreXPUnit: 50, scoreComparable: false },
    subGames: [
      { id: 'sort', name: '고나의 편가르기 대소동', rule: {} },
      { id: 'tower', name: '고나의 아슬아슬 탑', rule: {} },
      { id: 'toyroom', name: '고나의 엉망진창 장난감방', rule: {} },
      { id: 'challenge', name: '랜덤 챌린지', rule: { maxScore: 500_000, scoreComparable: true } },
    ],
  },
];

export function getGame(id: string): GameDef | undefined {
  return GAMES.find((g) => g.gameId === id);
}
export function getSubGame(gameId: string, subId: string): SubGameDef | undefined {
  return getGame(gameId)?.subGames?.find((s) => s.id === subId);
}
/** 하위 게임이 있으면 그 규칙을 덮어쓴 유효 규칙 */
export function effectiveRule(gameId: string, subGameId?: string): GameRule | null {
  const g = getGame(gameId);
  if (!g) return null;
  if (!subGameId) return g.rule;
  const s = getSubGame(gameId, subGameId);
  return s ? { ...g.rule, scoreComparable: true, ...s.rule } : null;
}
export function gameName(gameId: string, subGameId?: string): string {
  const g = getGame(gameId);
  if (!g) return gameId;
  if (subGameId) return getSubGame(gameId, subGameId)?.name ?? g.name;
  return g.name;
}
