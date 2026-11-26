// 서버 점수 규칙(supabase/functions/_shared/rules.ts)과 게임 계산(src/sky/rank.ts + engine finish 보너스)이 같은지 무작위 2만 건 비교
// 실행: node --experimental-strip-types tools/sky-online-rules-test.mjs
import { evalRank as gameRank, RANK_BONUS } from '../src/sky/rank.ts';
import { checkStage } from '../supabase/functions/_shared/rules.ts';
const D = ['easy', 'normal', 'hard'];
let n = 0, bad = 0, rej = 0;
for (let i = 0; i < 20000; i++) {
  const stage = 1 + (i % 6), diff = D[i % 3];
  const r = { stage, time: 80 + Math.random() * 300, hits: Math.floor(Math.random() * 6), bombsUsed: Math.floor(Math.random() * 5), bombsLeft: Math.floor(Math.random() * 5), hp: 1 + Math.floor(Math.random() * 5), maxCombo: Math.floor(Math.random() * 200), partsBroken: 0, partsTotal: 3, stageScore: Math.floor(Math.random() * 200000) };
  r.partsBroken = Math.floor(Math.random() * 4);
  const g = gameRank({ ...r, diff });
  const gameTotal = r.stageScore + 10000 * stage + Math.min(r.hp, 5) * 2000 + r.bombsLeft * 1000 + (r.hits === 0 ? 20000 * stage : 0) + g.bonus;
  const c = checkStage({ ...r, rank: g.rank }, diff);
  if (!c.ok) { rej++; continue; }
  n++;
  if (c.total !== gameTotal) bad++;
}
// 위조 시도: 랭크를 S 로 바꾸거나 점수를 부풀리면 거절
const f1 = checkStage({ stage: 1, time: 150, hits: 3, bombsUsed: 2, bombsLeft: 1, hp: 2, maxCombo: 10, partsBroken: 0, partsTotal: 3, stageScore: 20000, rank: 'S' }, 'normal');
const f2 = checkStage({ stage: 1, time: 30, hits: 0, bombsUsed: 0, bombsLeft: 3, hp: 5, maxCombo: 70, partsBroken: 3, partsTotal: 3, stageScore: 60000, rank: 'S' }, 'normal');
const f3 = checkStage({ stage: 2, time: 150, hits: 0, bombsUsed: 0, bombsLeft: 3, hp: 5, maxCombo: 70, partsBroken: 3, partsTotal: 3, stageScore: 9_000_000, rank: 'S' }, 'normal');
console.log(`일치 검사 ${n}건 · 불일치 ${bad} · (합리성 범위 밖이라 거절 ${rej})`);
console.log(`위조: 랭크 조작 → ${f1.ok ? '통과(문제)' : '거절 ' + f1.why} · 너무 빠른 클리어 → ${f2.ok ? '통과(문제)' : '거절 ' + f2.why} · 점수 부풀림 → ${f3.ok ? '통과(문제)' : '거절 ' + f3.why}`);
console.log(`RANK_BONUS 같음: ${JSON.stringify(RANK_BONUS) === JSON.stringify({ S: 30000, A: 15000, B: 6000, C: 2000, D: 0 })}`);
process.exit(bad || f1.ok || f2.ok || f3.ok ? 1 : 0);
