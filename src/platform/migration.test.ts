import { describe, expect, it } from 'vitest';
import { BACKUP_KIND, buildBackup, parseBackup } from './backup';
import { KEYS } from './keys';
import { migrate, parsePlayerJson, validatePlayer } from './schema';
import { createMemoryStorage, loadPlayer, savePlayer } from './store';
import { SCHEMA_VERSION } from './types';

/** Phase 1(v1)에서 실제로 저장되던 모양 그대로 */
const V1 = {
  schemaVersion: 1,
  playerId: '11111111-2222-4333-8444-555555555555',
  nickname: '옛날고나',
  publicCode: 'K7Q2',
  avatarId: 'halmeoni',
  createdAt: '2026-11-13T00:00:00.000Z',
  lastPlayedAt: '2026-11-13T01:00:00.000Z',
  playerLevel: 1,
  totalXP: 0,
  coinBalance: 0,
  settings: { bgm: false },
  gameRecords: {},
  achievements: [],
  unlockedAvatarIds: [],
};

describe('v1 → v2 마이그레이션', () => {
  it('값 보존 + 새 구역 기본값', () => {
    const m = migrate(V1);
    expect(m.ok && m.migrated).toBe(true);
    const p = validatePlayer((m as { data: unknown }).data)!;
    expect(p.schemaVersion).toBe(SCHEMA_VERSION);
    expect(p).toMatchObject({ playerId: V1.playerId, nickname: '옛날고나', publicCode: 'K7Q2', avatarId: 'halmeoni', createdAt: V1.createdAt, lastPlayedAt: V1.lastPlayedAt });
    expect(p.settings).toEqual({ bgm: false, vibration: true, reduceMotion: false });
    expect(p.gameRecords).toEqual({});
    expect(p.achievements).toEqual({});
    expect(p.titleId).toBe('rookie');
    expect(p.inventory.equipped.frame).toBe('frame_basic');
    expect(p.stats.totalPlayCount).toBe(0);
    expect(p.resultLedger).toEqual([]);
  });
  it('저장된 v1 데이터를 불러오면 v2 로 변환해 다시 저장', () => {
    const kv = createMemoryStorage({ [KEYS.player]: JSON.stringify(V1) });
    const r = loadPlayer(kv);
    expect(r.status).toBe('migrated');
    expect(r.player!.schemaVersion).toBe(2);
    expect(JSON.parse(kv.getItem(KEYS.player)!).schemaVersion).toBe(2);
    expect(loadPlayer(kv).status).toBe('ok');
  });
  it('v1 백업 파일 복원 가능 (호환)', () => {
    const file = JSON.stringify({ kind: BACKUP_KIND, schemaVersion: 1, exportedAt: '2026-11-13T05:00:00.000Z', player: V1 });
    const r = parseBackup(file);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.player).toMatchObject({ playerId: V1.playerId, nickname: '옛날고나', schemaVersion: 2 });
  });
  it('v2 백업 왕복 + 기록·구매·업적 보존', () => {
    const p = validatePlayer((migrate(V1) as { data: unknown }).data)!;
    const rich = { ...p, coinBalance: 77, achievements: { first_adventure: { at: V1.createdAt } }, inventory: { ...p.inventory, owned: [...p.inventory.owned, 'frame_leaf'], history: [{ itemId: 'frame_leaf', price: 150, at: V1.createdAt }] } };
    const { text } = buildBackup(rich);
    const r = parseBackup(text);
    expect(r.ok && r.player).toEqual(validatePlayer(rich));
  });
  it('손상된 v2 구역은 기본값으로 복구하고 핵심 값 오류만 거부', () => {
    const p = validatePlayer((migrate(V1) as { data: unknown }).data)!;
    const broken = { ...p, daily: 'x', attendance: [], inventory: { owned: ['nope', 'frame_leaf'], equipped: { frame: 'frame_flame' }, history: 3 }, stats: null, codex: 5 };
    const fixed = validatePlayer(broken)!;
    expect(fixed.daily.missions).toEqual({});
    expect(fixed.attendance.streak).toBe(0);
    expect(fixed.inventory.owned).toContain('frame_leaf');
    expect(fixed.inventory.owned).not.toContain('nope');
    expect(fixed.inventory.equipped.frame).toBe('frame_basic'); // 보유하지 않은 아이템 장착은 해제
    expect(fixed.stats.purchases).toBe(0);
    expect(validatePlayer({ ...p, coinBalance: -5 })).toBeNull();
    expect(parsePlayerJson('{"schemaVersion":2}').ok).toBe(false);
  });
  it('v1 → v2 후 새 구조로 저장·재로드해도 동일', () => {
    const kv = createMemoryStorage();
    const p = validatePlayer((migrate(V1) as { data: unknown }).data)!;
    savePlayer(kv, p);
    expect(loadPlayer(kv).player).toEqual(p);
  });
});
