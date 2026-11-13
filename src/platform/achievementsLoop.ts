import { newlyUnlocked, getAchievement } from './achievements';
import { newlyCodex } from './codex';
import { grant } from './progression';
import { grantItem } from './shop';
import type { PlayerData } from './types';

/** 업적 보상(코인·칭호)이 레벨·도감 조건을 또 채울 수 있어 안정될 때까지 반복(최대 5회). 각 업적은 한 번만 지급 → 멱등 */
export function achievementsLoop(p0: PlayerData, now: Date): { player: PlayerData; achievements: string[]; codex: string[] } {
  let p = p0;
  const ach: string[] = [];
  const cdx: string[] = [];
  for (let i = 0; i < 5; i++) {
    const a = newlyUnlocked(p);
    const c = newlyCodex(p);
    if (!a.length && !c.length) break;
    const at = now.toISOString();
    for (const def of a) {
      p = { ...p, achievements: { ...p.achievements, [def.id]: at } };
      p = grant(p, { coins: def.rewardCoins, reason: 'achievement', refId: def.id, now });
      if (def.rewardTitle) p = grantItem(p, def.rewardTitle);
      ach.push(def.id);
    }
    if (c.length) p = { ...p, codex: { ...p.codex, ...Object.fromEntries(c.map((x) => [x.id, at])) } };
    cdx.push(...c.map((x) => x.id));
  }
  return { player: p, achievements: ach.filter((id) => !!getAchievement(id)), codex: cdx };
}
