/**
 * 스테이지 랭크 평가 (S · A · B · C · D) — 아케이드식으로 짜게
 *
 *  100점 만점 = 노미스 30 + 노폭탄 15 + 부위 파괴 20 + 클리어 시간 15 + 콤보 10 + 스테이지 점수 10
 *  난이도 보정: 쉬움 ×0.85 · 보통 ×1 · 어려움 ×1.1 (최대 100)
 *  S ≥ 90 · A ≥ 76 · B ≥ 60 · C ≥ 42 · D 그 아래
 *  기준값(PAR 시간 · 콤보 · 점수)은 자동 플레이 측정값을 바탕으로 사람이 노려 볼 만하게 맞춤
 */
import type { Difficulty } from './stages';

export type Rank = 'S' | 'A' | 'B' | 'C' | 'D';
export const RANKS: Rank[] = ['S', 'A', 'B', 'C', 'D'];
export const rankValue = (r: Rank | '' | undefined): number => (r ? 5 - RANKS.indexOf(r) : 0);

/** 스테이지별 기준: 클리어 시간(초) · 노려 볼 최대 콤보 · 스테이지 점수 */
const PAR: { time: number; combo: number; score: number }[] = [
  { time: 165, combo: 70, score: 60000 },
  { time: 160, combo: 80, score: 75000 },
  { time: 165, combo: 90, score: 90000 },
  { time: 155, combo: 95, score: 100000 },
  { time: 168, combo: 100, score: 115000 },
  { time: 245, combo: 110, score: 140000 },
];
const DIFF_MUL: Record<Difficulty, number> = { easy: 0.85, normal: 1, hard: 1.1 };
/** 랭크 보너스 점수 (스테이지 번호 배) */
export const RANK_BONUS: Record<Rank, number> = { S: 30000, A: 15000, B: 6000, C: 2000, D: 0 };

export interface RankInput {
  stage: number; diff: Difficulty; time: number; hits: number; bombsUsed: number; maxCombo: number;
  partsBroken: number; partsTotal: number; stageScore: number;
}
export interface RankItem { key: string; label: string; detail: string; pts: number; max: number }
export interface RankResult { rank: Rank; points: number; items: RankItem[]; bonus: number }

export function parTime(stage: number): number {
  return (PAR[stage - 1] ?? PAR[PAR.length - 1]).time;
}

export function evalRank(r: RankInput): RankResult {
  const p = PAR[r.stage - 1] ?? PAR[PAR.length - 1];
  const fmt = (s: number): string => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const items: RankItem[] = [
    { key: 'miss', label: '노미스', detail: r.hits === 0 ? 'NO MISS!' : `피격 ${r.hits}회`, pts: [30, 20, 12, 6][r.hits] ?? 0, max: 30 },
    { key: 'bomb', label: '노폭탄', detail: r.bombsUsed === 0 ? 'NO BOMB!' : `폭탄 ${r.bombsUsed}개`, pts: [15, 10, 5][r.bombsUsed] ?? 0, max: 15 },
    {
      key: 'parts', label: '부위 파괴', detail: r.partsTotal ? `${r.partsBroken}/${r.partsTotal}` : '—',
      pts: r.partsTotal ? Math.round((20 * r.partsBroken) / r.partsTotal) : 20, max: 20,
    },
    {
      key: 'time', label: '클리어 시간', detail: `${fmt(r.time)} / 기준 ${fmt(p.time)}`,
      pts: Math.round(15 * Math.max(0, Math.min(1, (p.time * 1.6 - r.time) / (p.time * 0.6)))), max: 15,
    },
    { key: 'combo', label: '최대 콤보', detail: `${r.maxCombo} HIT`, pts: Math.round(10 * Math.min(1, r.maxCombo / p.combo)), max: 10 },
    { key: 'score', label: '스테이지 점수', detail: `${r.stageScore}`, pts: Math.round(10 * Math.min(1, r.stageScore / p.score)), max: 10 },
  ];
  const raw = items.reduce((a, b) => a + b.pts, 0);
  const points = Math.min(100, Math.round(raw * DIFF_MUL[r.diff]));
  const rank: Rank = points >= 90 ? 'S' : points >= 76 ? 'A' : points >= 60 ? 'B' : points >= 42 ? 'C' : 'D';
  return { rank, points, items, bonus: RANK_BONUS[rank] * r.stage };
}
