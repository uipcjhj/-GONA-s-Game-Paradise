import { isKnownAvatar, DEFAULT_AVATAR_ID } from './avatars';
import { CODE_RE } from './ids';
import { checkNickname } from './nickname';
import { SCHEMA_VERSION, type PlayerData } from './types';

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const isIso = (v: unknown): v is string => typeof v === 'string' && v.length <= 40 && !Number.isNaN(Date.parse(v));
const nonNegInt = (v: unknown, max: number): number | null => (typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v) && v >= 0 && v <= max ? v : null);

/** 마이그레이션: 키 n 은 schema n → n+1 변환 함수. 지금은 v1 이 최초라 비어 있음(테스트에서 가짜 체인으로 검증) */
export type Migration = (raw: Raw) => Raw;
export const MIGRATIONS: Record<number, Migration> = {};

export type MigrateResult = { ok: true; data: Raw; migrated: boolean } | { ok: false; reason: 'newer' | 'invalid' };

export function migrate(raw: unknown, migrations: Record<number, Migration> = MIGRATIONS, current = SCHEMA_VERSION): MigrateResult {
  if (!isObj(raw)) return { ok: false, reason: 'invalid' };
  let v = raw.schemaVersion;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) return { ok: false, reason: 'invalid' };
  if (v > current) return { ok: false, reason: 'newer' };
  let data: Raw = { ...raw };
  let migrated = false;
  while (v < current) {
    const step = migrations[v];
    if (!step) return { ok: false, reason: 'invalid' };
    data = { ...step(data), schemaVersion: v + 1 };
    v += 1;
    migrated = true;
  }
  return { ok: true, data, migrated };
}

/** 구조 검증 + 안전한 값 정리. 필수 값이 이상하면 null (= 손상). */
export function validatePlayer(raw: unknown): PlayerData | null {
  if (!isObj(raw)) return null;
  if (raw.schemaVersion !== SCHEMA_VERSION) return null;
  const { playerId, nickname, publicCode } = raw;
  if (typeof playerId !== 'string' || !/^[\w-]{8,64}$/.test(playerId)) return null;
  if (typeof nickname !== 'string' || !checkNickname(nickname).ok) return null;
  if (typeof publicCode !== 'string' || !CODE_RE.test(publicCode)) return null;
  if (!isIso(raw.createdAt)) return null;
  const level = nonNegInt(raw.playerLevel, 999);
  const xp = nonNegInt(raw.totalXP, 1e9);
  const coin = nonNegInt(raw.coinBalance, 1e9);
  if (level === null || level < 1 || xp === null || coin === null) return null;
  if (!isObj(raw.settings) || typeof raw.settings.bgm !== 'boolean') return null;
  const avatarId = typeof raw.avatarId === 'string' && isKnownAvatar(raw.avatarId) ? raw.avatarId : DEFAULT_AVATAR_ID; // 알 수 없는 아바타는 기본값으로
  const gameRecords = isObj(raw.gameRecords) ? (raw.gameRecords as PlayerData['gameRecords']) : {};
  const achievements = Array.isArray(raw.achievements) ? raw.achievements.filter((x): x is string => typeof x === 'string').slice(0, 500) : [];
  const unlocked = Array.isArray(raw.unlockedAvatarIds) ? raw.unlockedAvatarIds.filter((x): x is string => typeof x === 'string').slice(0, 100) : [];
  return {
    schemaVersion: SCHEMA_VERSION,
    playerId,
    nickname: nickname.normalize('NFC'),
    publicCode,
    avatarId,
    createdAt: raw.createdAt,
    lastPlayedAt: isIso(raw.lastPlayedAt) ? raw.lastPlayedAt : raw.createdAt,
    playerLevel: level,
    totalXP: xp,
    coinBalance: coin,
    settings: { bgm: raw.settings.bgm },
    gameRecords,
    achievements,
    unlockedAvatarIds: unlocked,
  };
}

/** 문자열 → 마이그레이션 → 검증. 실패 사유를 구분해 돌려줌 */
export type ParseResult = { ok: true; player: PlayerData; migrated: boolean } | { ok: false; reason: 'not-json' | 'newer' | 'invalid' };
export function parsePlayerJson(text: string | null): ParseResult {
  if (text === null) return { ok: false, reason: 'invalid' };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'not-json' };
  }
  return parsePlayerObject(raw);
}
export function parsePlayerObject(raw: unknown): ParseResult {
  const m = migrate(raw);
  if (!m.ok) return { ok: false, reason: m.reason };
  const player = validatePlayer(m.data);
  return player ? { ok: true, player, migrated: m.migrated } : { ok: false, reason: 'invalid' };
}
