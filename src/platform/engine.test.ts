import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, CODEX, getItem, SHOP_ITEMS, unlockedTitles } from './content';
import { BALANCE } from './balance';
import { applyResult, applyResults, buyItem, checkIn, claimMission, computeReward, effectiveDate, equipItem, missionsForDate, pinAchievement, recordLaunch, recordVisit, setTitle, unequipSlot } from './engine';
import { getGame, scoreLimit } from './games';
import { kstDate, kstWeekId } from './kst';
import { levelForXp, xpProgress } from './progression';
import type { GameResult } from './result';
import { createPlayer } from './store';
import type { PlayerData } from './types';

const T0 = Date.parse('2026-11-13T03:00:00Z'); // KST 12:00
const mk = (now = T0): PlayerData => {
  const r = createPlayer('고나짱', 'gona', new Date(now));
  if (!r.ok) throw new Error('x');
  return r.player;
};
let n = 0;
const res = (o: Partial<GameResult> = {}, base = T0): GameResult => {
  n += 1;
  const end = base;
  return { resultId: `res-${String(n).padStart(6, '0')}`, sessionId: 'sess-0000001', gameId: 'food-island', gameVersion: '1.0.0', scoreSchemaVersion: 1, outcome: 'failed', score: 1000, stage: 2, startedAt: new Date(end - 120000).toISOString(), endedAt: new Date(end).toISOString(), durationMs: 120000, ...o };
};

describe('KST 날짜', () => {
  it('UTC 15:00 에 한국 날짜가 바뀜', () => {
    expect(kstDate(Date.parse('2026-11-13T14:59:59Z'))).toBe('2026-11-13');
    expect(kstDate(Date.parse('2026-11-13T15:00:00Z'))).toBe('2026-11-14');
  });
  it('주차 ID = 한국 기준 월요일 (월 00:00 ~ 일 23:59:59)', () => {
    expect(kstWeekId(Date.parse('2026-11-15T14:59:59Z'))).toBe('2026-11-09'); // 일요일 23:59:59 KST
    expect(kstWeekId(Date.parse('2026-11-15T15:00:00Z'))).toBe('2026-11-16'); // 월요일 00:00 KST
  });
});

describe('레벨 / XP', () => {
  it('누적 XP → 레벨', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(100 + 140)).toBe(3);
    expect(levelForXp(1e9)).toBe(BALANCE.maxLevel);
  });
  it('진행도', () => expect(xpProgress(2, 150)).toMatchObject({ into: 50, need: 140 }));
});

describe('결과 반영 · 게임 기록', () => {
  it('첫 결과: 기록 생성, 첫 기록은 신기록 보너스 없음', () => {
    const o = applyResult(mk(), res({ score: 4000, stage: 3 }), T0);
    const s = o.data!;
    const rec = o.player.gameRecords['food-island'];
    expect(rec).toMatchObject({ bestScore: 4000, bestStage: 3, plays: 1, clears: 0, totalPlayTimeSec: 120 });
    expect(rec.bestStageLabel).toBe('직립보행 고나');
    expect(rec.recent).toHaveLength(1);
    expect(s.isFirst).toBe(true);
    expect(s.reward.bonuses).toEqual([]);
    expect(o.player.stats.totalPlayCount).toBe(1);
  });
  it('최고점·클리어·플레이 횟수·마지막 날짜', () => {
    let p = mk();
    p = applyResult(p, res({ score: 3000 }), T0).player;
    const o2 = applyResult(p, res({ score: 9000, outcome: 'cleared', stage: 4 }, T0 + 3600000), T0 + 3600000);
    expect(o2.data!.isNewBest).toBe(true);
    expect(o2.data!.prevBest).toBe(3000);
    const rec = o2.player.gameRecords['food-island'];
    expect(rec).toMatchObject({ bestScore: 9000, plays: 2, clears: 1, bestStage: 4 });
    expect(rec.lastPlayedAt).toBe(new Date(T0 + 3600000).toISOString());
    const o3 = applyResult(o2.player, res({ score: 9000 }, T0 + 7200000), T0 + 7200000);
    expect(o3.data!.isNewBest).toBe(false); // 동점은 신기록 아님
    expect(o3.player.gameRecords['food-island'].bestScoreAt).toBe(new Date(T0 + 3600000).toISOString()); // 먼저 달성한 기록 유지
  });
  it('최근 기록은 20개까지, 최신순', () => {
    let p = mk();
    for (let i = 0; i < 25; i++) p = applyResult(p, res({ score: i * 10 }, T0 + i * 1000), T0 + i * 1000).player;
    const rec = p.gameRecords['food-island'];
    expect(rec.recent).toHaveLength(20);
    expect(rec.recent[0].score).toBe(240);
  });
  it('주간 최고는 한국 월요일 기준으로 새 주에 초기화', () => {
    let p = applyResult(mk(), res({ score: 5000 }, Date.parse('2026-11-15T10:00:00Z')), T0).player; // 일 19시 KST
    expect(p.gameRecords['food-island'].weekly).toMatchObject({ weekId: '2026-11-09', score: 5000 });
    p = applyResult(p, res({ score: 100 }, Date.parse('2026-11-15T15:30:00Z')), T0).player; // 월 00:30 KST
    expect(p.gameRecords['food-island'].weekly).toMatchObject({ weekId: '2026-11-16', score: 100 });
    expect(p.gameRecords['food-island'].bestScore).toBe(5000);
  });
  it('subGameId: 미니게임별 기록 분리 (게임 규칙이 허용할 때)', () => {
    const r = res({ gameId: 'minigame-paradise', subGameId: 'cat-jump', score: 300, stage: undefined });
    const o = applyResult(mk(), r, T0);
    expect(o.player.gameRecords['minigame-paradise'].subGames!['cat-jump']).toMatchObject({ bestScore: 300, plays: 1 });
  });
  it('알 수 없는 게임은 반영 안 함', () => {
    const o = applyResult(mk(), res({ gameId: 'nope' }), T0);
    expect(o.changed).toBe(false);
    expect(o.data).toBeUndefined();
  });
});

describe('중복 방지', () => {
  it('같은 resultId 는 두 번 반영되지 않음', () => {
    const r = res({ score: 5000 });
    const a = applyResult(mk(), r, T0);
    const b = applyResult(a.player, r, T0);
    expect(b.changed).toBe(false);
    expect(b.data!.duplicate).toBe(true);
    expect(b.player.gameRecords['food-island'].plays).toBe(1);
    expect(b.player.coinBalance).toBe(a.player.coinBalance);
  });
  it('한 묶음 안의 중복도 1번만', () => {
    const r = res();
    const o = applyResults(mk(), [r, { ...r }], T0);
    expect(o.player.gameRecords['food-island'].plays).toBe(1);
    expect(o.summaries.filter((s) => !s.duplicate)).toHaveLength(1);
  });
  it('원장은 100개까지만 유지', () => {
    let p = mk();
    for (let i = 0; i < 120; i++) p = applyResult(p, res({ durationMs: 1000 }, T0 + i), T0 + i).player;
    expect(p.resultLedger).toHaveLength(BALANCE.ledgerKept);
  });
});

describe('XP · 코인 보상 규칙', () => {
  const g = getGame('food-island')!;
  const base = (p: PlayerData, r: GameResult, isNewBest = false, isFirst = false) => computeReward(g, r, { p, isNewBest, isFirst });
  it('기본 + 점수 보너스(상한)', () => {
    const p = mk();
    const r = base(p, res({ score: 2000 }));
    expect(r).toMatchObject({ xp: BALANCE.play.baseXp + 10, coins: BALANCE.play.baseCoins + 2 });
    const big = base(p, res({ score: 900000 }));
    expect(big.xp).toBe(BALANCE.play.baseXp + BALANCE.play.scoreXpCap);
    expect(big.coins).toBe(BALANCE.play.baseCoins + BALANCE.play.scoreCoinCap);
  });
  it('클리어·신기록 보너스', () => {
    const p = mk();
    const r = base(p, res({ score: 0, outcome: 'cleared' }), true, false);
    expect(r.bonuses).toEqual(['clear', 'best']);
    expect(r.xp).toBe(BALANCE.play.baseXp + BALANCE.play.clearXp + BALANCE.play.newBestXp);
    expect(r.coins).toBe(BALANCE.play.baseCoins + BALANCE.play.clearCoins + BALANCE.play.newBestCoins);
    expect(base(p, res({ outcome: 'cleared' }), true, true).bonuses).toEqual(['clear']); // 첫 기록은 신기록 보너스 없음
  });
  it('너무 짧은 판은 보상 없음(기록은 반영)', () => {
    const o = applyResult(mk(), res({ durationMs: 5000, score: 100 }), T0);
    expect(o.data!.reward).toMatchObject({ xp: 0, coins: 0, skipped: 'short' });
    expect(o.player.gameRecords['food-island'].plays).toBe(1);
    expect(o.data!.reward.xp).toBe(0);
  });
  it('하루 보상 한도 · 세션 한도', () => {
    let p = mk();
    let rewarded = 0;
    for (let i = 0; i < 12; i++) {
      const o = applyResult(p, res({ sessionId: `sess-${i}0000000` }, T0 + i * 1000), T0 + i * 1000);
      if (o.data!.reward.xp > 0) rewarded += 1;
      else expect(o.data!.reward.skipped).toBe('daily-cap');
      p = o.player;
    }
    expect(rewarded).toBe(BALANCE.caps.dailyRewardedRuns);
    // 다음 날은 다시 보상
    const next = applyResult(p, res({ sessionId: 'sess-next000' }, T0 + 86400000), T0 + 86400000);
    expect(next.data!.reward.xp).toBeGreaterThan(0);
    // 세션 한도
    let q = mk();
    let n2 = 0;
    for (let i = 0; i < 8; i++) {
      const o = applyResult(q, res({ sessionId: 'sess-same000' }, T0 + i * 1000), T0 + i * 1000);
      if (o.data!.reward.xp > 0) n2 += 1;
      q = o.player;
    }
    expect(n2).toBe(BALANCE.caps.perSessionRewardedRuns);
  });
  it('클리어 보너스는 하루 3회까지', () => {
    let p = mk();
    const bonus: number[] = [];
    for (let i = 0; i < 5; i++) {
      const o = applyResult(p, res({ outcome: 'cleared', sessionId: `sess-c${i}000000` }, T0 + i * 1000), T0 + i * 1000);
      bonus.push(o.data!.reward.bonuses.includes('clear') ? 1 : 0);
      p = o.player;
    }
    expect(bonus).toEqual([1, 1, 1, 0, 0]);
  });
  it('레벨업: 레벨 보상 코인은 레벨당 1회, 알림 발생', () => {
    const p = mk();
    const o = applyResult(p, res({ outcome: 'cleared', score: 20000, stage: 4 }), T0);
    expect(o.player.playerLevel).toBeGreaterThan(1);
    expect(o.notices.some((x) => x.kind === 'levelup')).toBe(true);
    expect(o.player.levelRewardsGiven).toBe(o.player.playerLevel);
    const again = applyResult(o.player, res({ score: 1 }), T0);
    expect(again.player.levelRewardsGiven).toBeGreaterThanOrEqual(o.player.levelRewardsGiven);
  });
  it('코인·XP 합계가 누적 통계와 일치(불일치 없음)', () => {
    let p = mk();
    for (let i = 0; i < 6; i++) p = applyResult(p, res({ score: 1000 * i, outcome: i % 2 ? 'cleared' : 'failed', stage: 1 + (i % 4), sessionId: `sess-z${i}000000` }, T0 + i * 1000), T0 + i * 1000).player;
    const spent = p.inventory.history.reduce((a, h) => a + h.price, 0);
    expect(p.coinBalance).toBe(p.stats.totalCoinsEarned - spent);
    expect(p.totalXP).toBe(p.stats.totalXpEarned);
  });
});

describe('업적', () => {
  it('실제 기록으로만 달성 · 보상 1회 · 날짜 기록', () => {
    const o = applyResult(mk(), res({ score: 100, outcome: 'cleared', stage: 4, durationMs: 60000 }), T0);
    const ids = Object.keys(o.player.achievements);
    expect(ids).toEqual(expect.arrayContaining(['first_complete', 'first_clear', 'food_stage_3', 'food_stage_4']));
    expect(o.player.achievements['first_clear'].at).toBeTruthy();
    expect(ids).not.toContain('plays_10');
    const coinsAfter = o.player.coinBalance;
    // 같은 조건을 또 만족해도 보상 재지급 없음
    const again = applyResult(o.player, res({ score: 1, durationMs: 1000 }, T0 + 1000), T0 + 1000);
    expect(Object.keys(again.player.achievements).filter((a) => a === 'first_clear')).toHaveLength(1);
    expect(again.notices.filter((x) => x.kind === 'achievement' && x.id === 'first_clear')).toHaveLength(0);
    expect(again.player.coinBalance).toBeGreaterThanOrEqual(coinsAfter);
  });
  it('연동 전 상태(기록 없음)에서는 게임 업적이 달성되지 않음', () => {
    const p = mk();
    const o = recordVisit(p, 'profile', T0);
    for (const a of ACHIEVEMENTS.filter((x) => x.needsGameLink)) expect(o.player.achievements[a.id]).toBeUndefined();
  });
  it('실행 업적: PLAY(실행) 기록으로 첫 모험 시작', () => {
    const o = recordLaunch(mk(), 'food-island', T0);
    expect(o.player.achievements['first_adventure']).toBeTruthy();
    expect(o.notices.some((x) => x.kind === 'achievement' && x.id === 'first_adventure')).toBe(true);
  });
  it('누적 플레이 10회 업적', () => {
    let p = mk();
    for (let i = 0; i < 10; i++) p = applyResult(p, res({ durationMs: 1000, sessionId: `sess-p${i}000000` }, T0 + i), T0 + i).player;
    expect(p.achievements['plays_10']).toBeTruthy();
    expect(p.achievements['plays_50']).toBeUndefined();
  });
  it('대표 업적: 달성한 업적만 지정 가능', () => {
    let p = recordLaunch(mk(), 'food-island', T0).player;
    expect(pinAchievement(p, 'first_clear', T0).data).toBe(false);
    p = pinAchievement(p, 'first_adventure', T0).player;
    expect(p.pinnedAchievement).toBe('first_adventure');
  });
});

describe('칭호', () => {
  it('기본 칭호만 처음부터, 미획득 칭호는 선택 불가', () => {
    const p = mk();
    expect(unlockedTitles(p).map((t) => t.id)).toEqual(['rookie']);
    const o = setTitle(p, 't_cleared', T0);
    expect(o.data).toBe(false);
    expect(o.player.titleId).toBe('rookie');
  });
  it('업적/레벨 달성으로 해금되고 장착 가능', () => {
    let p = applyResult(mk(), res({ outcome: 'cleared', stage: 4, score: 100, durationMs: 60000 }), T0).player;
    expect(unlockedTitles(p).map((t) => t.id)).toEqual(expect.arrayContaining(['t_cleared', 't_giant']));
    const o = setTitle(p, 't_cleared', T0);
    expect(o.data).toBe(true);
    expect(o.player.titleId).toBe('t_cleared');
    p = o.player;
  });
  it('해금 알림', () => {
    const o = applyResult(mk(), res({ outcome: 'cleared', stage: 4, score: 100, durationMs: 60000 }), T0);
    expect(o.notices.filter((x) => x.kind === 'title').map((x) => (x as { id: string }).id)).toEqual(expect.arrayContaining(['t_cleared']));
  });
});

describe('도감', () => {
  it('고나만 처음부터 발견 · 나머지는 실제 기록 조건으로만', () => {
    const p = mk();
    const o = recordVisit(p, 'codex', T0);
    expect(Object.keys(o.player.codex)).toEqual(['c_gona']);
  });
  it('성장 3단계 → 뽀뽀괴물·몬스터·쿠키·부메랑 발견, 클리어 → 가족·킁카괴물', () => {
    let p = applyResult(mk(), res({ stage: 3, score: 100 }), T0).player;
    expect(Object.keys(p.codex)).toEqual(expect.arrayContaining(['c_kiss', 'c_glasses', 'c_farter', 'c_cookie', 'c_boomerang', 'c_strawberry', 'c_banana']));
    expect(p.codex['c_mom']).toBeUndefined();
    p = applyResult(p, res({ stage: 4, outcome: 'cleared' }, T0 + 5000), T0 + 5000).player;
    expect(Object.keys(p.codex)).toEqual(expect.arrayContaining(['c_mom', 'c_dad', 'c_imo', 'c_halmeoni', 'c_halabeoji', 'c_samchon', 'c_sniff', 'c_jelly']));
    expect(Object.keys(p.codex).length).toBe(CODEX.length);
  });
  it('이미지 없는 항목에 임의 이미지를 넣지 않음', () => {
    for (const c of CODEX.filter((x) => ['보스', '몬스터'].includes(x.category) || x.id === 'c_jelly' || x.id === 'c_boomerang')) expect(c.image).toBeUndefined();
  });
});

describe('미션 · 출석 (KST)', () => {
  it('날짜별 미션 구성은 결정적(같은 날 같은 미션)', () => {
    expect(missionsForDate('2026-11-13').map((m) => m.id)).toEqual(missionsForDate('2026-11-13').map((m) => m.id));
    expect(missionsForDate('2026-11-13')).toHaveLength(4);
  });
  it('방문 미션 진행 → 수령 → 중복 수령 불가', () => {
    let p = mk();
    const d = missionsForDate(kstDate(T0));
    const visit = d[0];
    p = recordVisit(p, visit.visit!, T0, 'food-island').player;
    if (visit.visit === 'islands') p = recordVisit(p, 'islands', T0, 'sky-battle').player;
    expect(p.daily.missions[visit.id].progress).toBe(visit.target);
    const c1 = claimMission(p, visit.id, T0);
    expect(c1.data).toBe('claimed');
    expect(c1.player.coinBalance).toBe(p.coinBalance + visit.coins);
    const c2 = claimMission(c1.player, visit.id, T0);
    expect(c2.data).toBe('not-ready');
    expect(c2.player.coinBalance).toBe(c1.player.coinBalance);
  });
  it('게임 연동 미션은 결과 없이 진행되지 않음', () => {
    const p = recordVisit(mk(), 'profile', T0).player;
    expect(p.daily.missions['m_play1'].progress).toBe(0);
    expect(claimMission(p, 'm_play1', T0).data).toBe('not-ready');
  });
  it('결과 수신 시 게임 미션 진행', () => {
    const p = applyResult(mk(), res({ score: 3500 }), T0).player;
    expect(p.daily.missions['m_play1'].progress).toBe(1);
    const defs = missionsForDate(kstDate(T0));
    if (defs.some((m) => m.id === 'm_score3000')) expect(p.daily.missions['m_score3000'].progress).toBe(1);
  });
  it('날짜가 바뀌면 일일 상태 초기화 (한국 자정)', () => {
    let p = recordLaunch(mk(), 'food-island', T0).player;
    expect(p.daily.missions['m_launch'].progress).toBe(1);
    const next = Date.parse('2026-11-13T15:00:01Z'); // KST 11-14 00:00:01
    p = recordVisit(p, 'profile', next).player;
    expect(p.daily.dateKST).toBe('2026-11-14');
    expect(p.daily.missions['m_launch'].progress).toBe(0);
  });
  it('출석: 하루 1회, 연속 증가, 끊기면 1부터', () => {
    const a = checkIn(mk(), T0);
    expect(a.data).toBe('checked');
    expect(a.player.attendance).toMatchObject({ streak: 1, total: 1, lastDate: '2026-11-13' });
    expect(a.player.coinBalance).toBe(BALANCE.attendance.coins[0]);
    const again = checkIn(a.player, T0 + 3600000);
    expect(again.data).toBe('already');
    expect(again.player.coinBalance).toBe(a.player.coinBalance);
    const d2 = checkIn(again.player, T0 + 86400000);
    expect(d2.player.attendance.streak).toBe(2);
    const gap = checkIn(d2.player, T0 + 4 * 86400000);
    expect(gap.player.attendance.streak).toBe(1);
    expect(gap.player.attendance.longest).toBe(2);
  });
  it('7일 연속: 마지막 날 큰 보상, 연속 업적', () => {
    let p = mk();
    for (let i = 0; i < 7; i++) p = checkIn(p, T0 + i * 86400000).player;
    expect(p.attendance.streak).toBe(7);
    expect(p.achievements['streak_3']).toBeTruthy();
    expect(p.achievements['streak_7']).toBeTruthy();
  });
  it('비정상 날짜: 시계를 과거로 돌려도 출석·미션 중복 지급 없음', () => {
    const a = checkIn(mk(), T0 + 5 * 86400000).player; // 미래 날짜로 출석
    const back = checkIn(a, T0); // 시계를 과거로
    expect(back.data).toBe('already');
    expect(effectiveDate(a, T0)).toBe(kstDate(T0 + 5 * 86400000));
    expect(back.player.attendance.streak).toBe(1);
  });
  it('새로고침/탭 중복: 같은 입력을 여러 번 줘도 코인은 한 번', () => {
    let p = mk();
    const coins = [];
    for (let i = 0; i < 5; i++) {
      p = checkIn(p, T0 + i * 1000).player;
      coins.push(p.coinBalance);
    }
    expect(new Set(coins).size).toBe(1);
  });
});

describe('상점', () => {
  const rich = (): PlayerData => ({ ...mk(), coinBalance: 2000, stats: { ...mk().stats, totalCoinsEarned: 2000 } });
  it('기본 아이템은 보유·장착 상태', () => {
    const p = mk();
    expect(p.inventory.equipped).toMatchObject({ frame: 'frame_basic', nameplate: 'np_default', titleStyle: 'ts_plain', background: 'bg_check', avatarDeco: 'deco_none' });
  });
  it('구매: 코인 차감·보유 추가·내역 저장·업적', () => {
    const o = buyItem(rich(), 'frame_leaf', T0);
    expect(o.data).toBe('ok');
    expect(o.player.coinBalance).toBe(o.player.stats.totalCoinsEarned - 150); // 업적 보상 코인 포함, 차감은 정확히 150
    expect(o.player.coinBalance).toBeLessThan(2000 + 100);
    expect(o.player.inventory.owned).toContain('frame_leaf');
    expect(o.player.inventory.history).toEqual([{ itemId: 'frame_leaf', price: 150, at: new Date(T0).toISOString() }]);
    expect(o.player.achievements['first_shop']).toBeTruthy();
  });
  it('중복 구매 · 코인 부족 · 없는 아이템 방지', () => {
    const o = buyItem(rich(), 'frame_leaf', T0).player;
    expect(buyItem(o, 'frame_leaf', T0).data).toBe('owned');
    expect(buyItem(o, 'frame_leaf', T0).player.coinBalance).toBe(o.coinBalance);
    expect(buyItem(mk(), 'frame_rainbow', T0).data).toBe('no-coins');
    expect(buyItem(mk(), 'frame_rainbow', T0).player.coinBalance).toBe(mk().coinBalance);
    expect(buyItem(rich(), 'nope', T0).data).toBe('unknown');
  });
  it('장착 · 해제(기본으로) · 미보유 장착 불가', () => {
    let p = buyItem(rich(), 'frame_star', T0).player;
    expect(equipItem(p, 'frame_flame', T0).data).toBe(false);
    p = equipItem(p, 'frame_star', T0).player;
    expect(p.inventory.equipped.frame).toBe('frame_star');
    p = unequipSlot(p, 'frame', T0).player;
    expect(p.inventory.equipped.frame).toBe('frame_basic');
    expect(p.inventory.owned).toContain('frame_star'); // 해제해도 보유는 유지
  });
  it('능력치 아이템 없음 — 모든 아이템은 꾸미기 슬롯뿐', () => {
    expect(new Set(SHOP_ITEMS.map((i) => i.slot))).toEqual(new Set(['frame', 'nameplate', 'titleStyle', 'background', 'avatarDeco']));
    expect(getItem('frame_basic')!.price).toBe(0);
  });
  it('잔액은 음수가 되지 않음', () => {
    let p = rich();
    for (const i of SHOP_ITEMS) p = buyItem(p, i.id, T0).player;
    expect(p.coinBalance).toBeGreaterThanOrEqual(0);
    expect(p.coinBalance).toBe(p.stats.totalCoinsEarned - p.inventory.history.reduce((a, h) => a + h.price, 0));
  });
});

describe('점수 한도', () => {
  it('시간 기반 상한 + 이어하기 허용치', () => {
    const g = getGame('food-island')!;
    expect(scoreLimit(g, 100)).toBe(g.rules.maxScorePerSec * 100 + BALANCE.validation.carryAllowance);
    expect(scoreLimit(g, 1e9)).toBe(g.rules.maxScore);
  });
});
