/** 공통 난이도 곡선. 게임별 파라미터는 각 게임의 difficulty(level) 가 정합니다. */

export const CHALLENGE = {
  startLives: 3,
  maxLives: 5,
  /** 연속 클리어 N회마다 목숨 +1 */
  lifeEvery: 5,
} as const;

/** 챌린지: 2라운드마다 레벨 +1 (상한 없음 — 게임이 maxLevel 로 클램프하고 시간만 압축) */
export const challengeLevel = (round: number) => 1 + Math.floor((Math.max(1, round) - 1) / 2);

/** 챌린지 제한시간 배율: 라운드마다 3% 압축, 최소 0.6 */
export const challengeTimeScale = (round: number) => Math.max(0.6, 1 - 0.03 * (Math.max(1, round) - 1));

/** maxLevel 을 넘긴 레벨은 파라미터 대신 시간만 압축 (레벨당 5%, 최소 0.5) */
export const overflowTimeScale = (level: number, maxLevel: number) =>
  level <= maxLevel ? 1 : Math.max(0.5, 1 - 0.05 * (level - maxLevel));

export const clampLevel = (level: number, maxLevel: number) => Math.min(Math.max(1, Math.floor(level)), maxLevel);

/** 실제 제한시간(ms). base 가 null 이면 무제한 */
export function effectiveLimitMs(baseSec: number | null, scale: number): number | null {
  if (baseSec == null) return null;
  return Math.max(5000, Math.round(baseSec * scale * 1000));
}
