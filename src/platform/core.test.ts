import { describe, expect, it } from 'vitest';
import { applyGameResult } from './engine';
import { consumeInbox } from './inbox';
import { importBest } from './records';
import { inboxKey, KEYS, sessionKey } from './keys';
import { claimAttendance, claimMission, ensureMissions, pickDaily } from './missions';
import { levelFromXP, xpToNext } from './progression';
import { parsePlayerJson, MIGRATIONS } from './schema';
import { buyItem, equipItem } from './shop';
import { createSession } from './session';
import { createMemoryStorage, createPlayer, loadPlayer, resetPlatformData, savePlayer } from './store';
import { validateEnvelope, type GameResult, type LaunchSession } from './result';
import { dateKST, weekIdKST } from './kst';
import { TUNING } from './tuning';
import type { PlayerData } from './types';
import { buildBackup, parseBackup } from './backup';

const NOW = new Date('2026-11-13T03:00:00.000Z'); // KST 12:00
const mk = (): PlayerData => {
  const r = createPlayer('고나짱', 'gona', NOW);
  if (!r.ok) throw new Error('x');
  return r.player;
};
const sess = (p: PlayerData, gameId = 'food-island'): LaunchSession => ({ sessionId: 'sess-aaaaaaaa', gameId, playerId: p.playerId, startedAt: new Date(NOW.getTime() - 600_000).toISOString(), expiresAt: new Date(NOW.getTime() + 3600_000).toISOString(), returnUrl: 'https://x.test/', version: 1 });
let n = 0;
const res = (o: Partial<GameResult> = {}): GameResult => ({
  resultId: `res-${String(++n).padStart(8, '0')}`,
  sessionId: 'sess-aaaaaaaa',
  gameId: 'food-island',
  gameVersion: '1.0.0',
  scoreSchemaVersion: 1,
  outcome: 'failed',
  score: 1000,
  stage: 2,
  stageLabel: '직립보행 고나',
  startedAt: new Date(NOW.getTime() - 120_000).toISOString(),
  endedAt: new Date(NOW.getTime() - 60_000).toISOString(),
  durationMs: 60_000,
  ...o,
});
const env = (r: GameResult) => JSON.stringify({ kind: 'gp-result', v: 1, sdk: 'gp-sdk/0.1', result: r });

describe('결과 봉투 검증', () => {
  const p = mk();
  const ctx = { now: NOW.getTime(), session: sess(p), playerId: p.playerId };
  const v = (r: unknown, c: { now: number; session: LaunchSession | null; playerId: string } = ctx) => validateEnvelope(typeof r === 'string' ? r : JSON.stringify(r), c);
  it('정상 결과 통과', () => expect(v(env(res())).ok).toBe(true));
  it('형식 오류·JSON 아님·크기 초과', () => {
    expect(v('not json')).toMatchObject({ ok: false, reason: 'format' });
    expect(v({ kind: 'x' })).toMatchObject({ ok: false, reason: 'format' });
    expect(v(env(res({ extra: { a: 'x'.repeat(3000) } as never })))).toMatchObject({ ok: false, reason: 'too-large' });
    expect(validateEnvelope(null, ctx)).toMatchObject({ ok: false });
  });
  it('새 버전은 보류(hold), 알 수 없는 게임은 거부', () => {
    expect(v({ kind: 'gp-result', v: 2, result: {} })).toMatchObject({ ok: false, hold: true });
    expect(v(env(res({ scoreSchemaVersion: 2 })))).toMatchObject({ ok: false, reason: 'schema-version', hold: true });
    expect(v(env(res({ gameId: 'nope' })))).toMatchObject({ ok: false });
  });
  it('점수 범위·음수·소수·초당 점수', () => {
    expect(v(env(res({ score: -1 })))).toMatchObject({ reason: 'score-range' });
    expect(v(env(res({ score: 1.5 })))).toMatchObject({ reason: 'score-range' });
    expect(v(env(res({ score: 9_000_000 })))).toMatchObject({ reason: 'score-range' });
    expect(v(env(res({ score: 400_000, durationMs: 60_000 })))).toMatchObject({ reason: 'score-rate' });
  });
  it('세션: 없음·다른 플레이어·다른 게임·만료·시간 이상', () => {
    expect(v(env(res()), { ...ctx, session: null })).toMatchObject({ reason: 'no-session' });
    expect(v(env(res()), { ...ctx, playerId: 'other-player-id' })).toMatchObject({ reason: 'wrong-player' });
    expect(v(env(res({ gameId: 'sky-battle' })))).toMatchObject({ reason: 'game-mismatch' });
    expect(v(env(res()), { ...ctx, session: { ...sess(p), expiresAt: new Date(NOW.getTime() - 2 * 3600_000).toISOString() } })).toMatchObject({ reason: 'session-expired' });
    expect(v(env(res({ endedAt: new Date(NOW.getTime() + 3600_000).toISOString() })))).toMatchObject({ reason: 'time' });
    expect(v(env(res({ durationMs: -5 })))).toMatchObject({ reason: 'time' });
    expect(v(env(res({ durationMs: 999_999 })))).toMatchObject({ reason: 'time' });
  });
  it('하위 게임: 등록된 것만 허용', () => {
    const ps = { ...ctx, session: sess(p, 'minigame-paradise') };
    expect(v(env(res({ gameId: 'minigame-paradise', subGameId: 'sort', score: 500 })), ps).ok).toBe(true);
    expect(v(env(res({ gameId: 'minigame-paradise', subGameId: 'zzz' })), ps)).toMatchObject({ reason: 'unknown-game' });
  });
});

describe('기록·보상 적용', () => {
  it('첫 판: 기록 생성, 플레이 횟수, 신기록 표시, 보상, 도감·업적', () => {
    const { player, outcome } = applyGameResult(mk(), res(), NOW);
    const rec = player.gameRecords['food-island'];
    expect(rec).toMatchObject({ plays: 1, clears: 0, bestScore: 1000, bestStage: 2 });
    expect(outcome).toMatchObject({ first: true, isNewBest: true });
    expect(player.totalPlayCount).toBe(1);
    expect(outcome.xp).toBeGreaterThan(0);
    expect(player.coinBalance).toBeGreaterThan(0);
    expect(outcome.achievements).toContain('play-1');
    expect(player.codex['game-food-island']).toBeTruthy();
    expect(player.resultLedger).toHaveLength(1);
  });
  it('최고점·동점(먼저 달성한 기록 유지)·클리어·단계', () => {
    let p = applyGameResult(mk(), res({ score: 2000 }), NOW).player;
    const t0 = p.gameRecords['food-island'].bestScoreAt;
    const lower = applyGameResult(p, res({ score: 500 }), NOW);
    expect(lower.outcome.isNewBest).toBe(false);
    expect(lower.player.gameRecords['food-island'].bestScore).toBe(2000);
    const tie = applyGameResult(lower.player, res({ score: 2000, endedAt: new Date(NOW.getTime() - 1000).toISOString() }), NOW);
    expect(tie.outcome.isNewBest).toBe(false);
    expect(tie.player.gameRecords['food-island'].bestScoreAt).toBe(t0);
    p = applyGameResult(tie.player, res({ score: 3000, outcome: 'cleared', stage: 4 }), NOW).player;
    expect(p.gameRecords['food-island']).toMatchObject({ plays: 4, clears: 1, bestScore: 3000, bestStage: 4 });
    expect(p.stats.newBests).toBe(1);
  });
  it('같은 resultId 는 두 번 반영되지 않음', () => {
    const r = res();
    const a = applyGameResult(mk(), r, NOW);
    const b = applyGameResult(a.player, r, NOW);
    expect(b.outcome.duplicate).toBe(true);
    expect(b.player).toBe(a.player);
    expect(b.player.totalPlayCount).toBe(1);
  });
  it('일일 상한: 같은 날 계속 해도 XP·코인이 상한을 넘지 않음, 지나면 다시', () => {
    let p = mk();
    for (let i = 0; i < 40; i++) p = applyGameResult(p, res({ score: 20000, outcome: 'cleared', endedAt: new Date(NOW.getTime() - 1000).toISOString() }), NOW).player;
    const b = p.daily.byGame['food-island'];
    expect(b.xp).toBeLessThanOrEqual(TUNING.dailyCap.xpPerGame);
    expect(b.coins).toBeLessThanOrEqual(TUNING.dailyCap.coinsPerGame);
    const tomorrow = new Date(NOW.getTime() + 86400_000);
    const o = applyGameResult(p, res({ endedAt: tomorrow.toISOString(), startedAt: new Date(tomorrow.getTime() - 60000).toISOString() }), tomorrow);
    expect(o.outcome.xp).toBeGreaterThan(0);
  });
  it('너무 짧은 판은 기록만 하고 보상 없음', () => {
    const { player, outcome } = applyGameResult(mk(), res({ durationMs: 2000, endedAt: new Date(NOW.getTime() - 58_000).toISOString() }), NOW);
    expect(outcome.xp).toBe(0);
    expect(outcome.coins).toBe(0);
    expect(player.gameRecords['food-island'].plays).toBe(1);
  });
  it('레벨 곡선과 레벨업', () => {
    expect(levelFromXP(0)).toBe(1);
    expect(levelFromXP(xpToNext(1) - 1)).toBe(1);
    expect(levelFromXP(xpToNext(1))).toBe(2);
    expect(levelFromXP(xpToNext(1) + xpToNext(2))).toBe(3);
    expect(levelFromXP(1e9)).toBe(TUNING.maxLevel);
  });
  it('Mini Game Land: 하위 게임별 기록, 부모는 합산(최고점 없음)', () => {
    let p = mk();
    const o = (sub: string, score: number, outcome: 'cleared' | 'failed' = 'failed') => res({ gameId: 'minigame-paradise', subGameId: sub, score, outcome, stage: 1 });
    p = applyGameResult(p, o('sort', 800, 'cleared'), NOW).player;
    p = applyGameResult(p, o('tower', 300), NOW).player;
    p = applyGameResult(p, o('sort', 900), NOW).player;
    const parent = p.gameRecords['minigame-paradise'];
    expect(parent.plays).toBe(3);
    expect(parent.bestScore).toBe(0);
    expect(parent.subGames?.sort).toMatchObject({ plays: 2, clears: 1, bestScore: 900 });
    expect(parent.subGames?.tower.bestScore).toBe(300);
    expect(p.codex['mini-sort']).toBeTruthy();
  });
  it('업적은 한 번만 지급(멱등)', () => {
    let p = mk();
    p = applyGameResult(p, res(), NOW).player;
    const coins = p.coinBalance;
    const again = applyGameResult(p, res(), NOW);
    expect(again.outcome.achievements).not.toContain('play-1');
    expect(Object.keys(again.player.achievements).filter((x) => x === 'play-1')).toHaveLength(1);
    expect(again.player.coinBalance).toBeGreaterThanOrEqual(coins);
  });
  it('가져오기: 1회성, 더 낮으면 기록은 안 바뀜', () => {
    const p = mk();
    const a = importBest(p, 'food-island', 5000, 3, NOW)!;
    expect(a.gameRecords['food-island']).toMatchObject({ bestScore: 5000, bestScoreSource: 'import', plays: 0, bestStage: 3 });
    expect(importBest(a, 'food-island', 9000, 4, NOW)).toBeNull();
    const b = applyGameResult(a, res({ score: 6000 }), NOW).player;
    expect(b.gameRecords['food-island'].bestScoreSource).toBe('play');
    expect(importBest(p, 'food-island', -5, 1, NOW)).toBeNull();
  });
});

describe('미션·출석·상점', () => {
  it('접속 처리는 같은 날 멱등, 연속 출석 증가, 하루 건너뛰면 1로', () => {
    let p = ensureMissions(mk(), NOW);
    expect(p.missions!.attendance.streak).toBe(1);
    expect(ensureMissions(p, NOW)).toBe(p);
    const d2 = new Date(NOW.getTime() + 86400_000);
    p = ensureMissions(p, d2);
    expect(p.missions!.attendance.streak).toBe(2);
    p = ensureMissions(p, new Date(d2.getTime() + 3 * 86400_000));
    expect(p.missions!.attendance.streak).toBe(1);
  });
  it('시계를 과거로 돌려도 미션이 새로 생기지 않음', () => {
    const p = ensureMissions(mk(), NOW);
    expect(ensureMissions(p, new Date(NOW.getTime() - 3 * 86400_000))).toBe(p);
  });
  it('오늘의 미션 3개는 같은 날 항상 같고 중복 없음', () => {
    const a = pickDaily('2026-11-13', 'abc');
    expect(a).toEqual(pickDaily('2026-11-13', 'abc'));
    expect(new Set(a).size).toBe(3);
  });
  it('미션 달성 후 한 번만 수령, 출석 보상도 하루 한 번', () => {
    let p = applyGameResult(mk(), res({ outcome: 'cleared' }), NOW).player;
    const m = p.missions!;
    const done = m.daily.find((x) => x.value >= (x.id === 'd-play1' ? 1 : 99));
    if (done) {
      const c1 = claimMission(p, done.id, NOW);
      expect(c1.ok).toBe(true);
      if (c1.ok) expect(claimMission(c1.player, done.id, NOW)).toMatchObject({ ok: false, error: 'claimed' });
    }
    const notDone = m.daily.find((x) => x.value === 0);
    if (notDone) expect(claimMission(p, notDone.id, NOW)).toMatchObject({ ok: false, error: 'not-done' });
    const a1 = claimAttendance(p, NOW);
    expect(a1.ok).toBe(true);
    if (a1.ok) {
      p = a1.player;
      expect(claimAttendance(p, NOW)).toMatchObject({ ok: false, error: 'claimed' });
    }
  });
  it('상점: 잔액 부족·중복 구매·음수 불가, 장착은 보유 아이템만', () => {
    let p = mk();
    expect(buyItem(p, 'frame-mint', NOW)).toMatchObject({ ok: false, error: 'coins' });
    p = { ...p, coinBalance: 100 };
    const b = buyItem(p, 'frame-mint', NOW);
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(b.player.coinBalance).toBe(60);
    expect(buyItem(b.player, 'frame-mint', NOW)).toMatchObject({ error: 'owned' });
    expect(buyItem(b.player, 'title-clear', NOW)).toMatchObject({ error: 'not-for-sale' });
    expect(equipItem(b.player, 'frame-berry', 'frame')).toBeNull();
    expect(equipItem(b.player, 'frame-mint', 'frame')?.inventory.equipped.frame).toBe('frame-mint');
    expect(equipItem(b.player, 'frame-mint', 'title')).toBeNull();
    expect(b.player.stats.purchases).toBe(1);
  });
});

describe('inbox 수신', () => {
  function setup() {
    const kv = createMemoryStorage();
    const p = mk();
    savePlayer(kv, p);
    const s = createSession(kv, p, 'food-island', 'https://x.test/', new Date(NOW.getTime() - 300_000))!;
    return { kv, p, s };
  }
  const put = (kv: ReturnType<typeof createMemoryStorage>, r: GameResult) => kv.setItem(inboxKey(r.resultId), env(r));
  it('여러 결과를 한 번에 반영하고 저장 후 inbox 삭제', () => {
    const { kv, p, s } = setup();
    for (const sc of [100, 900, 400]) put(kv, res({ sessionId: s.sessionId, score: sc, startedAt: new Date(NOW.getTime() - 200_000).toISOString(), endedAt: new Date(NOW.getTime() - 100_000 + sc).toISOString() }));
    const rep = consumeInbox(kv, p, NOW);
    expect(rep.applied).toHaveLength(3);
    expect(rep.player.gameRecords['food-island'].plays).toBe(3);
    expect(rep.player.gameRecords['food-island'].bestScore).toBe(900);
    expect(Object.keys(kv.dump()).filter((k) => k.startsWith('gp.v1.inbox.'))).toHaveLength(0);
    expect(loadPlayer(kv).player?.gameRecords['food-island'].plays).toBe(3);
  });
  it('저장 후 삭제 전 종료 시뮬레이션: 다시 처리해도 중복 반영 없음', () => {
    const { kv, p, s } = setup();
    const r = res({ sessionId: s.sessionId });
    put(kv, r);
    const rep = consumeInbox(kv, p, NOW);
    expect(rep.applied).toHaveLength(1);
    put(kv, r); // 삭제 전에 꺼졌다고 가정(키가 남아 있음)
    const rep2 = consumeInbox(kv, loadPlayer(kv).player!, NOW);
    expect(rep2.applied).toHaveLength(0);
    expect(rep2.duplicates).toBe(1);
    expect(rep2.player.totalPlayCount).toBe(1);
    expect(Object.keys(kv.dump()).filter((k) => k.startsWith('gp.v1.inbox.'))).toHaveLength(0);
  });
  it('저장 실패 시 inbox 보존 + 화면 데이터는 이전 값', () => {
    const { kv, p, s } = setup();
    const r = res({ sessionId: s.sessionId });
    put(kv, r);
    const failing = { ...kv, getItem: kv.getItem, removeItem: kv.removeItem, keys: kv.keys, setItem: (k: string, v: string) => { if (k === KEYS.player) throw new Error('quota'); kv.setItem(k, v); } };
    const rep = consumeInbox(failing, p, NOW);
    expect(rep.saveFailed).toBe(true);
    expect(rep.player).toBe(p);
    expect(kv.getItem(inboxKey(r.resultId))).not.toBeNull();
    const ok = consumeInbox(kv, p, NOW);
    expect(ok.applied).toHaveLength(1);
  });
  it('의심·형식 오류는 반영하지 않고 보관소로, 새 버전은 보류', () => {
    const { kv, p, s } = setup();
    put(kv, res({ sessionId: s.sessionId, score: 9_999_999 }));
    kv.setItem(inboxKey('res-garbage1'), '{{{');
    kv.setItem(inboxKey('res-newer001'), JSON.stringify({ kind: 'gp-result', v: 2, result: {} }));
    const rep = consumeInbox(kv, p, NOW);
    expect(rep.applied).toHaveLength(0);
    expect(rep.rejected).toHaveLength(2);
    expect(rep.held).toBe(1);
    expect(kv.getItem(inboxKey('res-newer001'))).not.toBeNull();
    expect(Object.keys(kv.dump()).filter((k) => k.startsWith('gp.v1.rejected.'))).toHaveLength(2);
    expect(rep.player.totalPlayCount).toBe(0);
  });
  it('다른 플레이어의 세션 결과는 반영하지 않음', () => {
    const { kv, s } = setup();
    const other = mk();
    put(kv, res({ sessionId: s.sessionId }));
    const rep = consumeInbox(kv, other, NOW);
    expect(rep.applied).toHaveLength(0);
    expect(rep.rejected[0].reason).toBe('wrong-player');
  });
  it('초기화는 세션·inbox·보관 키도 지움, 다른 키는 보존', () => {
    const { kv, s } = setup();
    put(kv, res({ sessionId: s.sessionId }));
    kv.setItem('gona.mute', '1');
    kv.setItem('dino-snack-adventure.best', '999');
    resetPlatformData(kv);
    const keys = Object.keys(kv.dump());
    expect(keys.sort()).toEqual(['dino-snack-adventure.best', 'gona.mute']);
    expect(kv.getItem(sessionKey(s.sessionId))).toBeNull();
  });
});

describe('스키마 v2 · 마이그레이션 · 백업', () => {
  it('v1 데이터가 v2 로 변환되고 기존 값은 보존', () => {
    const v2 = mk();
    const v1 = { schemaVersion: 1, playerId: v2.playerId, nickname: '옛날고나', publicCode: v2.publicCode, avatarId: 'mom', createdAt: v2.createdAt, lastPlayedAt: v2.createdAt, playerLevel: 3, totalXP: 250, coinBalance: 77, settings: { bgm: true }, gameRecords: {}, achievements: ['x'], unlockedAvatarIds: [] };
    const r = parsePlayerJson(JSON.stringify(v1));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.migrated).toBe(true);
    expect(r.player).toMatchObject({ schemaVersion: 2, nickname: '옛날고나', avatarId: 'mom', playerLevel: 3, totalXP: 250, coinBalance: 77, totalPlayCount: 0 });
    expect(r.player.settings).toMatchObject({ vibration: true, reduceMotion: false });
    expect(Object.keys(r.player.achievements)).toEqual(['x']);
    expect(r.player.inventory.owned).toContain('frame-gold');
    expect(typeof MIGRATIONS[1]).toBe('function');
  });
  it('v1 저장 데이터를 읽으면 자동으로 v2 로 저장(migrated 상태)', () => {
    const v2 = mk();
    const kv = createMemoryStorage({ [KEYS.player]: JSON.stringify({ schemaVersion: 1, playerId: v2.playerId, nickname: '고나', publicCode: v2.publicCode, avatarId: 'gona', createdAt: v2.createdAt, playerLevel: 1, totalXP: 0, coinBalance: 0, settings: { bgm: true }, gameRecords: {}, achievements: [], unlockedAvatarIds: [] }) });
    expect(loadPlayer(kv).status).toBe('migrated');
    expect(JSON.parse(kv.getItem(KEYS.player)!).schemaVersion).toBe(2);
  });
  it('v1 백업 파일도 복원됨, v2 백업 왕복 무손실', () => {
    let p = applyGameResult(mk(), res({ score: 1234, outcome: 'cleared' }), NOW).player;
    p = ensureMissions(p, NOW);
    const b = buildBackup(p, NOW);
    const back = parseBackup(b.text);
    expect(back.ok).toBe(true);
    if (back.ok) expect(back.player).toEqual(p);
    const v1file = { kind: 'gona-game-paradise/player-backup', schemaVersion: 1, exportedAt: NOW.toISOString(), player: { schemaVersion: 1, playerId: p.playerId, nickname: '고나', publicCode: p.publicCode, avatarId: 'gona', createdAt: p.createdAt, playerLevel: 1, totalXP: 0, coinBalance: 0, settings: { bgm: true }, gameRecords: {}, achievements: [], unlockedAvatarIds: [] } };
    expect(parseBackup(JSON.stringify(v1file)).ok).toBe(true);
  });
  it('깨진 부가 구조는 그 부분만 기본값(전체 손상 아님)', () => {
    const p = mk();
    const bad = { ...p, gameRecords: { x: 5, y: { plays: 'a' } }, missions: 'oops', inventory: 7, stats: { a: -5, b: 'z' }, daily: 3 };
    const r = parsePlayerJson(JSON.stringify(bad));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.player.gameRecords).toEqual({});
  });
  it('KST 날짜·주차 계산', () => {
    expect(dateKST(new Date('2026-11-12T15:30:00Z'))).toBe('2026-11-13'); // KST 00:30
    expect(weekIdKST(new Date('2026-11-13T03:00:00Z'))).toBe('2026-11-09'); // 금요일 → 월요일
    expect(weekIdKST(new Date('2026-11-15T14:59:00Z'))).toBe('2026-11-09'); // 일요일 23:59 KST
    expect(weekIdKST(new Date('2026-11-15T15:00:00Z'))).toBe('2026-11-16'); // 월요일 00:00 KST
  });
});
