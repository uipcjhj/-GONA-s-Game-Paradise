/** 점수 규칙 (설계서 §3.3). 모두 순수 함수. */
import type { Mode, Outcome } from './types';

/** 콤보 배수: 1 + 0.1×연속, 상한 ×2 */
export const comboMultiplier = (combo: number) => Math.min(2, 1 + 0.1 * Math.max(0, Math.floor(combo)));

/** 챌린지 라운드 배율: 1 + 0.05×(라운드−1), 상한 ×2 */
export const roundMultiplier = (round: number) => Math.min(2, 1 + 0.05 * (Math.max(1, round) - 1));

/** 클리어 시 남은 시간 보너스: 남은 초 × 10 (무제한이면 0) */
export const timeBonus = (remainingMs: number | null) => (remainingMs == null ? 0 : Math.floor(Math.max(0, remainingMs) / 1000) * 10);

export interface RoundScoreInput {
  mode: Mode;
  outcome: Outcome;
  /** 게임이 라운드 동안 쌓은 점수(콤보 배수 적용 후) */
  raw: number;
  remainingMs: number | null;
  /** 챌린지 라운드 번호(자유 플레이는 무시) */
  round?: number;
}

export interface RoundScore {
  raw: number;
  timeBonus: number;
  multiplier: number;
  total: number;
}

/**
 * 자유 플레이: 실패해도 쌓은 점수는 인정(시간 보너스·배율 없음).
 * 챌린지: 클리어만 점수(+라운드 배율), 실패 라운드는 0점.
 */
export function roundScore(i: RoundScoreInput): RoundScore {
  const raw = Math.max(0, Math.round(i.raw));
  if (i.mode === 'challenge') {
    if (i.outcome === 'fail') return { raw, timeBonus: 0, multiplier: 1, total: 0 };
    const bonus = timeBonus(i.remainingMs);
    const multiplier = roundMultiplier(i.round ?? 1);
    return { raw, timeBonus: bonus, multiplier, total: Math.round((raw + bonus) * multiplier) };
  }
  const bonus = i.outcome === 'clear' ? timeBonus(i.remainingMs) : 0;
  return { raw, timeBonus: bonus, multiplier: 1, total: raw + bonus };
}
