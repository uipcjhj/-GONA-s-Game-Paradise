import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from './achievements';
import { CODEX } from './codex';
import { localBoard } from './localRanking';
import { applyGameResult } from './engine';
import { MISSIONS, pickDaily } from './missions';
import { ITEMS, getItem } from './shop';
import { createPlayer } from './store';
import type { GameResult } from './result';

const NOW = new Date('2026-11-13T03:00:00.000Z');
const mk = () => {
  const r = createPlayer('고나', 'gona', NOW);
  if (!r.ok) throw new Error('x');
  return r.player;
};
let n = 0;
const res = (o: Partial<GameResult> = {}): GameResult => ({ resultId: `r-${String(++n).padStart(8, '0')}`, sessionId: 'sess-aaaaaaaa', gameId: 'food-island', gameVersion: '1.0.0', scoreSchemaVersion: 1, outcome: 'failed', score: 1000, stage: 1, startedAt: new Date(NOW.getTime() - 120_000).toISOString(), endedAt: new Date(NOW.getTime() - 60_000 + n).toISOString(), durationMs: 60_000, ...o });

describe('콘텐츠 정의 무결성', () => {
  it('id 중복 없음', () => {
    for (const list of [ACHIEVEMENTS.map((a) => a.id), CODEX.map((c) => c.id), MISSIONS.map((m) => m.id), ITEMS.map((i) => i.id)]) expect(new Set(list).size).toBe(list.length);
  });
  it('업적 칭호 보상은 실제 칭호 아이템, 가격 0(보상 전용)', () => {
    for (const a of ACHIEVEMENTS) if (a.rewardTitle) expect(getItem(a.rewardTitle)).toMatchObject({ kind: 'title', price: 0 });
  });
  it('새 플레이어는 아무것도 달성·해금하지 않음(고나 도감 제외)', () => {
    const p = mk();
    expect(ACHIEVEMENTS.filter((a) => a.value(p) >= a.target)).toHaveLength(0);
    expect(CODEX.filter((c) => c.unlocked(p)).map((c) => c.id)).toEqual(['char-gona']);
  });
  it('미션 목표·보상은 양수, 오늘의 미션은 어떤 날짜·플레이어든 3개', () => {
    for (const m of MISSIONS) expect(m.target).toBeGreaterThan(0);
    for (let i = 0; i < 40; i++) expect(new Set(pickDaily(`2026-12-${String((i % 28) + 1).padStart(2, '0')}`, `player-${i}`)).size).toBe(3);
  });
  it('상점 판매 아이템에는 가격, 최소 코인으로 기본 구매 가능한 것이 있음', () => {
    const sale = ITEMS.filter((i) => i.price > 0);
    expect(sale.length).toBeGreaterThanOrEqual(6);
    expect(Math.min(...sale.map((i) => i.price))).toBeLessThanOrEqual(40);
  });
});

describe('이 기기 순위', () => {
  it('상위 점수 정렬·최대 10개·주간은 이번 주 기록만', () => {
    let p = mk();
    for (let i = 1; i <= 14; i++) p = applyGameResult(p, res({ score: i * 100 }), NOW).player;
    const all = localBoard(p, 'food-island', 'all-time', undefined, NOW);
    expect(all).toHaveLength(10);
    expect(all[0]).toMatchObject({ rank: 1, score: 1400 });
    expect(all.map((r) => r.score)).toEqual([...all.map((r) => r.score)].sort((a, b) => b - a));
    const nextWeek = new Date(NOW.getTime() + 8 * 86400_000);
    expect(localBoard(p, 'food-island', 'weekly', undefined, nextWeek)).toHaveLength(0);
    expect(localBoard(p, 'food-island', 'weekly', undefined, NOW).length).toBeGreaterThan(0);
  });
  it('기록 없으면 빈 목록, 하위 게임은 따로', () => {
    const p = applyGameResult(mk(), res({ gameId: 'minigame-paradise', subGameId: 'sort', score: 700 }), NOW).player;
    expect(localBoard(p, 'food-island', 'all-time')).toEqual([]);
    expect(localBoard(p, 'minigame-paradise', 'all-time', 'sort')[0].score).toBe(700);
    expect(localBoard(p, 'minigame-paradise', 'all-time', 'tower')).toEqual([]);
  });
});
