import { describe, expect, it } from 'vitest';
import { initGame } from '../../docs/platform/sdk/gp-sdk.js';
import { finishConsume, planConsume } from './inbox';
import { INBOX_PREFIX } from './keys';
import { createSession } from './session';
import { createMemoryStorage, createPlayer, savePlayer } from './store';

const ORIGIN = 'https://uipcjhj.github.io';
const RET = `${ORIGIN}/-GONA-s-Game-Paradise/`;
let t = Date.parse('2026-11-13T03:00:00Z');
let n = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

function setup(gameId: string, sess?: { gameId?: string; ret?: string }) {
  const kv = createMemoryStorage();
  const pl = createPlayer('고나짱', 'gona', new Date(t - 3600000));
  if (!pl.ok) throw new Error('x');
  savePlayer(kv, pl.player);
  const s = createSession(kv, sess?.gameId ?? gameId, pl.player, sess?.ret ?? RET, t - 60000);
  const gp = initGame({ gameId, gameVersion: '1.0.0', storage: kv, search: `?gp=${s.sessionId}`, origin: ORIGIN, now: () => t, uuid });
  return { kv, gp, player: pl.player };
}
const inbox = (kv: ReturnType<typeof createMemoryStorage>) => kv.keys!().filter((k) => k.startsWith(INBOX_PREFIX));

describe('공통 게임 SDK (Sky Battle · Mini Game Land 용) ↔ 게임천국 수신', () => {
  it('Sky Battle: 시작 → 클리어(스테이지 5) → inbox → 게임천국 반영(단계·클리어)', () => {
    const { kv, gp, player } = setup('sky-battle');
    expect(gp.active).toBe(true);
    gp.runStart();
    t += 200000;
    gp.runEnd({ outcome: 'cleared', score: 48000, stage: 5, stageLabel: '최종 스테이지', extra: { bossKills: 3 } });
    const plan = planConsume(kv, player, t);
    expect(plan.rejected).toEqual([]);
    expect(plan.summaries[0]).toMatchObject({ gameId: 'sky-battle', outcome: 'cleared', stage: 5, score: 48000, durationSec: 200 });
    expect(plan.player.gameRecords['sky-battle']).toMatchObject({ bestScore: 48000, bestStage: 5, plays: 1, clears: 1 });
    expect(plan.player.achievements.sky_first && plan.player.achievements.sky_clear && plan.player.achievements.sky_stage_3).toBeTruthy();
  });
  it('Mini Game Land: subGameId 별 기록 분리(미니게임별 최고·플레이 횟수) + 미니게임 업적', () => {
    const { kv, gp, player } = setup('minigame-paradise');
    const play = (sub: string, score: number) => {
      gp.runStart({ subGameId: sub });
      t += 40000;
      gp.runEnd({ outcome: 'failed', score });
      t += 1000;
    };
    play('cat-jump', 300);
    play('cat-jump', 900);
    play('fish-catch', 150);
    play('block-pop', 50);
    expect(inbox(kv)).toHaveLength(4);
    const plan = planConsume(kv, player, t);
    expect(plan.summaries).toHaveLength(4);
    const rec = plan.player.gameRecords['minigame-paradise'];
    expect(rec.plays).toBe(4);
    expect(rec.subGames!['cat-jump']).toMatchObject({ bestScore: 900, plays: 2 });
    expect(rec.subGames!['fish-catch']).toMatchObject({ bestScore: 150, plays: 1 });
    expect(Object.keys(rec.subGames!)).toHaveLength(3);
    expect(plan.player.achievements.mini_first && plan.player.achievements.mini_three).toBeTruthy();
    finishConsume(kv, plan, t);
    expect(inbox(kv)).toHaveLength(0);
  });
  it('판당 1건: runEnd 중복 호출·시작 전 호출 무시, 일시정지 제외, 음수/소수 점수 정리', () => {
    const { kv, gp, player } = setup('sky-battle');
    expect(gp.runEnd({ outcome: 'failed', score: 5 })).toBeNull(); // 시작 전
    gp.runStart();
    t += 20000; gp.runPause(); t += 500000; gp.runResume(); t += 20000;
    gp.runEnd({ outcome: 'failed', score: 1234.9 });
    gp.runEnd({ outcome: 'failed', score: 99999 });
    expect(inbox(kv)).toHaveLength(1);
    const plan = planConsume(kv, player, t);
    expect(plan.summaries[0]).toMatchObject({ score: 1234, durationSec: 40 });
    const g2 = setup('sky-battle');
    g2.gp.runStart();
    t += 20000;
    g2.gp.runEnd({ outcome: 'failed', score: -50 });
    expect(planConsume(g2.kv, g2.player, t).summaries[0].score).toBe(0);
  });
  it('비활성: gp 없음/세션 없음/다른 게임/다른 출처 → no-op(키 쓰기 없음)', () => {
    const kv = createMemoryStorage();
    const base = { gameId: 'sky-battle', storage: kv, origin: ORIGIN, now: () => t };
    for (const search of ['', '?gp=sess-doesnotexist']) {
      const gp = initGame({ ...base, search });
      gp.runStart();
      gp.runEnd({ outcome: 'failed', score: 1 });
      expect(gp.active).toBe(false);
    }
    expect(inbox(kv)).toHaveLength(0);
    expect(setup('sky-battle', { gameId: 'food-island' }).gp.active).toBe(false);
    expect(setup('sky-battle', { ret: 'https://evil.example/' }).gp.active).toBe(false);
  });
  it('저장 실패 시 보관 후 재시도', () => {
    const kv = createMemoryStorage();
    const pl = createPlayer('고나짱', 'gona', new Date(t));
    if (!pl.ok) throw new Error('x');
    const s = createSession(kv, 'sky-battle', pl.player, RET, t - 1000);
    let fail = true;
    const flaky = { getItem: (k: string) => kv.getItem(k), setItem: (k: string, v: string) => { if (fail && k.startsWith(INBOX_PREFIX)) throw new Error('quota'); kv.setItem(k, v); } };
    const gp = initGame({ gameId: 'sky-battle', storage: flaky, search: `?gp=${s.sessionId}`, origin: ORIGIN, now: () => t, uuid });
    gp.runStart(); t += 20000; gp.runEnd({ outcome: 'failed', score: 10 });
    expect(inbox(kv)).toHaveLength(0);
    fail = false;
    gp.flush();
    expect(inbox(kv)).toHaveLength(1);
  });
});
