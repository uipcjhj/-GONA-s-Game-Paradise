// 점수 검증 규칙 — 게임(src/sky/rank.ts · engine.ts finish())과 같은 계산을 서버에서 다시 함
// ⚠ 게임의 PAR · RANK_BONUS · 보너스 식을 바꾸면 이 파일도 함께 바꿀 것 (tools/sky-online-rules-test.mjs 가 둘이 같은지 검사)

export type Diff = 'easy' | 'normal' | 'hard';
export type Rank = 'S' | 'A' | 'B' | 'C' | 'D';
export const PAR = [
  { time: 165, combo: 70, score: 60000 },
  { time: 160, combo: 80, score: 75000 },
  { time: 165, combo: 90, score: 90000 },
  { time: 155, combo: 95, score: 100000 },
  { time: 168, combo: 100, score: 115000 },
  { time: 245, combo: 110, score: 140000 },
];
const DIFF_MUL: Record<Diff, number> = { easy: 0.85, normal: 1, hard: 1.1 };
const RANK_BONUS: Record<Rank, number> = { S: 30000, A: 15000, B: 6000, C: 2000, D: 0 };
const MAX_HP = 5;

export interface StageReport {
  stage: number; time: number; hits: number; bombsUsed: number; bombsLeft: number; hp: number; maxCombo: number;
  partsBroken: number; partsTotal: number; stageScore: number; rank: Rank;
}

export function evalRank(r: StageReport, diff: Diff): { rank: Rank; bonus: number } {
  const p = PAR[r.stage - 1];
  const pts =
    ([30, 20, 12, 6][r.hits] ?? 0) +
    ([15, 10, 5][r.bombsUsed] ?? 0) +
    (r.partsTotal ? Math.round((20 * r.partsBroken) / r.partsTotal) : 20) +
    Math.round(15 * Math.max(0, Math.min(1, (p.time * 1.6 - r.time) / (p.time * 0.6)))) +
    Math.round(10 * Math.min(1, r.maxCombo / p.combo)) +
    Math.round(10 * Math.min(1, r.stageScore / p.score));
  const points = Math.min(100, Math.round(pts * DIFF_MUL[diff]));
  const rank: Rank = points >= 90 ? 'S' : points >= 76 ? 'A' : points >= 60 ? 'B' : points >= 42 ? 'C' : 'D';
  return { rank, bonus: RANK_BONUS[rank] * r.stage };
}

/** 스테이지 하나의 합리성 검사 + 보너스 재계산 → 통과하면 그 스테이지 점수(보너스 포함), 아니면 사유 */
export function checkStage(r: StageReport, diff: Diff): { ok: true; total: number } | { ok: false; why: string } {
  const p = PAR[r.stage - 1];
  if (!p) return { ok: false, why: 'stage' };
  const int = (v: number) => Number.isFinite(v) && v >= 0;
  if (![r.time, r.hits, r.bombsUsed, r.bombsLeft, r.hp, r.maxCombo, r.partsBroken, r.partsTotal, r.stageScore].every(int)) return { ok: false, why: 'field' };
  if (r.time < p.time * 0.55) return { ok: false, why: 'too-fast' };               // 대본(적 편대·보스 등장)상 이보다 빨리 깰 수 없음
  if (r.time > 60 * 30) return { ok: false, why: 'too-slow' };
  if (r.stageScore > p.score * 4) return { ok: false, why: 'stage-score' };         // 기준 점수의 4배 초과 = 비정상
  if (r.maxCombo > 3000) return { ok: false, why: 'combo' };
  if (r.hp > MAX_HP || r.hp < 1) return { ok: false, why: 'hp' };
  if (r.partsTotal > 3 || r.partsBroken > r.partsTotal) return { ok: false, why: 'parts' };
  if (r.bombsUsed > 12 || r.bombsLeft > 9) return { ok: false, why: 'bombs' };
  const rk = evalRank(r, diff);
  if (rk.rank !== r.rank) return { ok: false, why: 'rank-mismatch' };
  const bonus = 10000 * r.stage + Math.min(r.hp, MAX_HP) * 2000 + r.bombsLeft * 1000 + (r.hits === 0 ? 20000 * r.stage : 0) + rk.bonus;
  return { ok: true, total: r.stageScore + bonus };
}
