import { describe, expect, it } from 'vitest';
import { BACKUP_KIND, BACKUP_MAX_BYTES, buildBackup, parseBackup } from './backup';
import { CODE_ALPHABET, CODE_RE, createPlayerId, createPublicCode } from './ids';
import { KEYS, LEGACY_KEYS } from './keys';
import { checkNickname, nicknameLength } from './nickname';
import { xpProgress, xpToNext } from './progression';
import { migrate, parsePlayerJson, validatePlayer } from './schema';
import { createMemoryStorage, createPlayer, loadPlayer, resetPlatformData, savePlayer, withProfile } from './store';
import { AVATARS, getAvatar, isAvatarAvailable } from './avatars';
import { SCHEMA_VERSION } from './types';

const mk = (nick = '고나짱', av = 'gona') => {
  const r = createPlayer(nick, av, new Date('2026-11-13T00:00:00Z'));
  if (!r.ok) throw new Error('create failed');
  return r.player;
};

describe('닉네임 검증', () => {
  it.each(['고나', '고나짱', 'Gona99', '가나다라마바사아자차', 'ab', '12', 'ㅋㅋㅋ'])('허용: %s', (n) => expect(checkNickname(n).ok).toBe(true));
  it('길이 오류(1자·11자)', () => {
    expect(checkNickname('고').error).toBe('length');
    expect(checkNickname('가나다라마바사아자차카').error).toBe('length');
  });
  it('빈 값/공백/특수문자/이모지', () => {
    expect(checkNickname('').error).toBe('empty');
    expect(checkNickname('고 나').error).toBe('space');
    expect(checkNickname(' 고나').error).toBe('space');
    expect(checkNickname('고나!').error).toBe('chars');
    expect(checkNickname('고나😀').error).toBe('chars');
    expect(checkNickname('a_b').error).toBe('chars');
  });
  it('금지어·예약어', () => {
    expect(checkNickname('FuckYou').error).toBe('banned');
    expect(checkNickname('운영자').error).toBe('reserved');
    expect(checkNickname('Admin').error).toBe('reserved');
  });
  it('코드포인트 기준 길이 + NFC 정규화', () => {
    expect(nicknameLength('가'.normalize('NFD'))).toBe(1);
    expect(checkNickname('고나'.normalize('NFD')).ok).toBe(true);
  });
});

describe('playerId · 식별코드', () => {
  it('UUID v4 형식, 매번 다름', () => {
    const a = createPlayerId();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(new Set(Array.from({ length: 200 }, createPlayerId)).size).toBe(200);
  });
  it('식별코드: 4자, 혼동 문자 없음', () => {
    for (let i = 0; i < 500; i++) {
      const c = createPublicCode();
      expect(c).toMatch(CODE_RE);
      expect(c).not.toMatch(/[01OIL]/);
    }
    expect(CODE_ALPHABET).not.toMatch(/[01OIL]/);
  });
  it('동일 닉네임이어도 playerId 는 다름(중복 허용)', () => {
    expect(mk('고나').playerId).not.toBe(mk('고나').playerId);
  });
});

describe('저장·불러오기', () => {
  it('저장 후 다시 불러오면 동일', () => {
    const kv = createMemoryStorage();
    expect(loadPlayer(kv)).toEqual({ status: 'none', player: null });
    const p = mk();
    expect(savePlayer(kv, p)).toBe(true);
    const r = loadPlayer(kv);
    expect(r.status).toBe('ok');
    expect(r.player).toEqual(p);
  });
  it('필수 필드 존재', () => {
    const p = mk();
    for (const k of ['playerId', 'nickname', 'publicCode', 'avatarId', 'createdAt', 'lastPlayedAt', 'playerLevel', 'totalXP', 'coinBalance', 'settings', 'schemaVersion'] as const) expect(p[k]).toBeDefined();
    expect(p.playerLevel).toBe(1);
    expect(p.coinBalance).toBe(0);
    expect(p.totalXP).toBe(0);
    expect(p.schemaVersion).toBe(SCHEMA_VERSION);
  });
  it('닉네임·아바타 변경은 playerId·코드·기록 유지', () => {
    const p = mk();
    const n = withProfile(p, { nickname: '새이름', avatarId: 'mom' })!;
    expect(n.playerId).toBe(p.playerId);
    expect(n.publicCode).toBe(p.publicCode);
    expect(n.createdAt).toBe(p.createdAt);
    expect(n.nickname).toBe('새이름');
    expect(n.avatarId).toBe('mom');
    expect(withProfile(p, { nickname: '잘못!' })).toBeNull();
    expect(withProfile(p, { avatarId: '없는아바타' })!.avatarId).toBe(p.avatarId);
  });
  it('저장 시 직전 정상본을 .bak 로 보관', () => {
    const kv = createMemoryStorage();
    const p = mk();
    savePlayer(kv, p);
    savePlayer(kv, withProfile(p, { nickname: '바꿈' })!);
    expect(JSON.parse(kv.getItem(KEYS.backup)!).nickname).toBe('고나짱');
  });
});

describe('손상 데이터', () => {
  it('깨진 JSON + 백업 없음 → corrupt (원본 보관)', () => {
    const kv = createMemoryStorage({ [KEYS.player]: '{oops' });
    const r = loadPlayer(kv);
    expect(r.status).toBe('corrupt');
    expect(r.player).toBeNull();
    expect(kv.getItem(KEYS.corrupt)).toBe('{oops');
    expect(kv.getItem(KEYS.player)).toBe('{oops'); // 임의로 지우지 않음
  });
  it('깨진 JSON + 정상 백업 → recovered', () => {
    const kv = createMemoryStorage();
    const p = mk();
    savePlayer(kv, p);
    savePlayer(kv, p); // .bak 생성
    kv.setItem(KEYS.player, '###');
    const r = loadPlayer(kv);
    expect(r.status).toBe('recovered');
    expect(r.player).toEqual(p);
    expect(loadPlayer(kv).status).toBe('ok');
  });
  it('구조 오류(닉네임 규칙 위반·음수 코인·잘못된 코드) 거부', () => {
    const p = mk();
    for (const bad of [{ ...p, nickname: 'x' }, { ...p, coinBalance: -1 }, { ...p, publicCode: 'ab12' }, { ...p, playerId: '' }, { ...p, settings: null }, { ...p, playerLevel: 0 }, { ...p, totalXP: 1.5 }, { ...p, createdAt: 'x' }]) {
      expect(validatePlayer(bad)).toBeNull();
    }
    expect(parsePlayerJson('null').ok).toBe(false);
    expect(parsePlayerJson('[]').ok).toBe(false);
  });
  it('알 수 없는 아바타는 기본값으로 대체(손상 아님)', () => {
    expect(validatePlayer({ ...mk(), avatarId: 'removed' })!.avatarId).toBe('gona');
  });
  it('더 새로운 스키마는 덮어쓰지 않음', () => {
    const kv = createMemoryStorage({ [KEYS.player]: JSON.stringify({ ...mk(), schemaVersion: 99 }) });
    const before = kv.getItem(KEYS.player);
    expect(loadPlayer(kv).status).toBe('newer');
    expect(kv.getItem(KEYS.player)).toBe(before);
  });
});

describe('스키마 마이그레이션', () => {
  it('v1→v3 체인 적용', () => {
    const out = migrate({ schemaVersion: 1, a: 1 }, { 1: (r) => ({ ...r, b: 2 }), 2: (r) => ({ ...r, c: 3 }) }, 3);
    expect(out).toEqual({ ok: true, migrated: true, data: { schemaVersion: 3, a: 1, b: 2, c: 3 } });
  });
  it('현재 버전은 그대로, 누락 단계/잘못된 버전은 invalid, 미래 버전은 newer', () => {
    expect(migrate({ schemaVersion: 1 }, {}, 1)).toMatchObject({ ok: true, migrated: false });
    expect(migrate({ schemaVersion: 1 }, {}, 2)).toEqual({ ok: false, reason: 'invalid' });
    expect(migrate({ schemaVersion: 0 })).toEqual({ ok: false, reason: 'invalid' });
    expect(migrate({})).toEqual({ ok: false, reason: 'invalid' });
    expect(migrate({ schemaVersion: 5 }, {}, 2)).toEqual({ ok: false, reason: 'newer' });
  });
});

describe('백업·복원', () => {
  it('내보내기 → 가져오기 왕복', () => {
    const p = mk();
    const { text, filename } = buildBackup(p, new Date('2026-11-13T05:00:00Z'));
    expect(filename).toBe('gona-paradise-backup-20261113.json');
    const parsed = JSON.parse(text);
    expect(parsed.kind).toBe(BACKUP_KIND);
    expect(Object.keys(parsed)).not.toContain('gona.mute'); // 기기 설정 미포함
    expect(parseBackup(text)).toEqual({ ok: true, player: p });
  });
  it('잘못된 파일 오류 구분', () => {
    const good = JSON.parse(buildBackup(mk()).text);
    expect(parseBackup('not json')).toEqual({ ok: false, error: 'not-json' });
    expect(parseBackup('{"a":1}')).toEqual({ ok: false, error: 'wrong-format' });
    expect(parseBackup('x'.repeat(BACKUP_MAX_BYTES + 1))).toEqual({ ok: false, error: 'too-large' });
    expect(parseBackup(JSON.stringify({ ...good, player: { ...good.player, nickname: '!!' } }))).toEqual({ ok: false, error: 'invalid' });
    expect(parseBackup(JSON.stringify({ ...good, player: { ...good.player, schemaVersion: 9 } }))).toEqual({ ok: false, error: 'newer' });
    expect(parseBackup(JSON.stringify({ kind: BACKUP_KIND }))).toEqual({ ok: false, error: 'invalid' });
  });
});

describe('초기화', () => {
  it('플랫폼 키만 삭제 · gona.* 와 다른 게임 키 보존', () => {
    const kv = createMemoryStorage({ [LEGACY_KEYS.openingSeen]: '1', [LEGACY_KEYS.mute]: '1', 'dino-snack-adventure.best': '123' });
    savePlayer(kv, mk());
    savePlayer(kv, mk('다른이'));
    expect(kv.getItem(KEYS.backup)).not.toBeNull();
    resetPlatformData(kv);
    expect(loadPlayer(kv)).toEqual({ status: 'none', player: null });
    expect(kv.getItem(LEGACY_KEYS.openingSeen)).toBe('1');
    expect(kv.getItem(LEGACY_KEYS.mute)).toBe('1');
    expect(kv.getItem('dino-snack-adventure.best')).toBe('123');
  });
});

describe('저장소 오류 내성', () => {
  it('쓰기 실패 시 false, 읽기 실패 시 none', () => {
    const bad = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); }, removeItem: () => { throw new Error('x'); } };
    expect(savePlayer(bad, mk())).toBe(false);
    expect(loadPlayer(bad).status).toBe('none');
    expect(() => resetPlatformData(bad)).not.toThrow();
  });
});

describe('아바타 · 진행도', () => {
  it('Food 실제 캐릭터만 등록(고나·가족 6)', () => {
    expect(AVATARS.map((a) => a.id)).toEqual(['gona', 'mom', 'dad', 'imo', 'halmeoni', 'halabeoji', 'samchon']);
    expect(AVATARS.some((a) => /strawberry|cookie|egg|star/.test(a.id))).toBe(false);
    expect(getAvatar('nope').id).toBe('gona');
  });
  it('해금 구조', () => {
    expect(isAvatarAvailable({ ...AVATARS[0], unlock: 'unlock' }, [])).toBe(false);
    expect(isAvatarAvailable({ ...AVATARS[0], unlock: 'unlock' }, ['gona'])).toBe(true);
    expect(isAvatarAvailable(AVATARS[1], [])).toBe(true);
  });
  it('XP 진행률(임시 곡선)', () => {
    expect(xpToNext(1)).toBe(100);
    expect(xpToNext(3)).toBe(180);
    expect(xpProgress(1, 0)).toEqual({ into: 0, need: 100, ratio: 0 });
    expect(xpProgress(2, 150)).toMatchObject({ into: 50, need: 140 });
  });
});
