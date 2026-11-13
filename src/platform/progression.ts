/** 임시 설계값(D7: 운영 전 별도 승인). Phase 1 에는 XP·코인 획득이 없어 표시용으로만 사용 */
export function xpToNext(level: number): number {
  return 100 + 40 * (Math.max(1, level) - 1);
}
export function xpProgress(level: number, totalXP: number): { into: number; need: number; ratio: number } {
  // 레벨 L 시작 누적 XP = Σ_{i<L} xpToNext(i)
  let start = 0;
  for (let i = 1; i < level; i++) start += xpToNext(i);
  const need = xpToNext(level);
  const into = Math.max(0, Math.min(need, totalXP - start));
  return { into, need, ratio: need ? into / need : 0 };
}
