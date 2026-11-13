import { TUNING } from './tuning';
import type { CoinTx, PlayerData } from './types';

/** 임시 설계값(D7: 운영 전 별도 승인) */
export function xpToNext(level: number): number {
  return 100 + 40 * (Math.max(1, level) - 1);
}
/** 누적 XP → 레벨 (상한 TUNING.maxLevel) */
export function levelFromXP(totalXP: number): number {
  let level = 1;
  let left = Math.max(0, totalXP);
  while (level < TUNING.maxLevel && left >= xpToNext(level)) {
    left -= xpToNext(level);
    level += 1;
  }
  return level;
}
export function xpProgress(level: number, totalXP: number): { into: number; need: number; ratio: number } {
  // 레벨 L 시작 누적 XP = Σ_{i<L} xpToNext(i)
  let start = 0;
  for (let i = 1; i < level; i++) start += xpToNext(i);
  const need = xpToNext(level);
  const into = Math.max(0, Math.min(need, totalXP - start));
  return { into, need, ratio: need ? into / need : 0 };
}

export interface Grant {
  xp?: number;
  coins?: number;
  reason: CoinTx['reason'];
  refId?: string;
  now: Date;
}
/** XP·코인 지급 (코인은 원장에 기록, 레벨 재계산). 음수·소수 입력은 0 으로 정리 */
export function grant(p: PlayerData, g: Grant): PlayerData {
  const xp = Math.max(0, Math.floor(g.xp ?? 0));
  const coins = Math.max(0, Math.floor(g.coins ?? 0));
  if (!xp && !coins) return p;
  const totalXP = Math.min(1e9, p.totalXP + xp);
  const next: PlayerData = { ...p, totalXP, playerLevel: levelFromXP(totalXP) };
  if (coins) {
    next.coinBalance = Math.min(1e9, p.coinBalance + coins);
    next.coinLog = [{ txId: `${g.reason}-${g.refId ?? ''}-${g.now.getTime()}-${p.coinLog.length}`, delta: coins, reason: g.reason, at: g.now.toISOString(), refId: g.refId }, ...p.coinLog].slice(0, TUNING.coinLogMax);
    next.stats = { ...p.stats, coinsEarned: (p.stats.coinsEarned ?? 0) + coins };
  }
  return next;
}
