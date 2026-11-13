import { BALANCE } from './balance';

export const xpToNext = BALANCE.xpToNext;

/** 누적 XP → 레벨 */
export function levelForXp(totalXP: number): number {
  let level = 1;
  let rest = totalXP;
  while (level < BALANCE.maxLevel && rest >= BALANCE.xpToNext(level)) {
    rest -= BALANCE.xpToNext(level);
    level += 1;
  }
  return level;
}
/** 현재 레벨 안에서의 진행도 */
export function xpProgress(level: number, totalXP: number): { into: number; need: number; ratio: number } {
  let start = 0;
  for (let i = 1; i < level; i++) start += BALANCE.xpToNext(i);
  const need = BALANCE.xpToNext(level);
  const into = Math.max(0, Math.min(need, totalXP - start));
  return { into, need, ratio: need ? into / need : 0 };
}
