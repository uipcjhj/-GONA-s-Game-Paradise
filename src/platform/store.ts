import { DEFAULT_AVATAR_ID, isKnownAvatar } from './avatars';
import { createPlayerId, createPublicCode } from './ids';
import { KEYS, RESETTABLE_KEYS } from './keys';
import { checkNickname } from './nickname';
import { parsePlayerJson } from './schema';
import { SCHEMA_VERSION, type KV, type PlayerData } from './types';

/** 브라우저 localStorage (사용 불가 환경이면 null) */
export function browserStorage(): KV | null {
  try {
    const s = window.localStorage;
    s.setItem('gp.v1.__probe', '1');
    s.removeItem('gp.v1.__probe');
    return s;
  } catch {
    return null;
  }
}

/** 테스트·저장소 차단 환경용 메모리 저장소 */
export function createMemoryStorage(initial: Record<string, string> = {}): KV & { dump(): Record<string, string> } {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
    dump: () => Object.fromEntries(m),
  };
}

export type LoadStatus = 'none' | 'ok' | 'recovered' | 'migrated' | 'corrupt' | 'newer';
export interface LoadResult {
  status: LoadStatus;
  player: PlayerData | null;
}

function safeGet(kv: KV, key: string): string | null {
  try {
    return kv.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(kv: KV, key: string, value: string): boolean {
  try {
    kv.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** 저장된 플레이어 읽기. 손상 시 직전 정상본(.bak)으로 복구, 그래도 안 되면 corrupt. 손상 원본은 지우지 않고 보관 */
export function loadPlayer(kv: KV): LoadResult {
  const raw = safeGet(kv, KEYS.player);
  if (raw === null) {
    const bak = parsePlayerJson(safeGet(kv, KEYS.backup));
    if (bak.ok) {
      safeSet(kv, KEYS.player, JSON.stringify(bak.player));
      return { status: 'recovered', player: bak.player };
    }
    return { status: 'none', player: null };
  }
  const res = parsePlayerJson(raw);
  if (res.ok) {
    if (res.migrated) safeSet(kv, KEYS.player, JSON.stringify(res.player));
    return { status: res.migrated ? 'migrated' : 'ok', player: res.player };
  }
  if (res.reason === 'newer') return { status: 'newer', player: null }; // 더 새 버전 데이터: 덮어쓰지 않음
  safeSet(kv, KEYS.corrupt, raw);
  const bak = parsePlayerJson(safeGet(kv, KEYS.backup));
  if (bak.ok) {
    safeSet(kv, KEYS.player, JSON.stringify(bak.player));
    return { status: 'recovered', player: bak.player };
  }
  return { status: 'corrupt', player: null };
}

/** 저장: 쓰기 전에 직전 정상본을 .bak 로 남김. 성공 여부 반환 */
export function savePlayer(kv: KV, player: PlayerData): boolean {
  const prev = safeGet(kv, KEYS.player);
  if (prev !== null && parsePlayerJson(prev).ok) safeSet(kv, KEYS.backup, prev);
  return safeSet(kv, KEYS.player, JSON.stringify(player));
}

export type CreateResult = { ok: true; player: PlayerData } | { ok: false; error: 'nickname' };
export function createPlayer(nickname: string, avatarId: string, now: Date = new Date()): CreateResult {
  if (!checkNickname(nickname).ok) return { ok: false, error: 'nickname' };
  const iso = now.toISOString();
  return {
    ok: true,
    player: {
      schemaVersion: SCHEMA_VERSION,
      playerId: createPlayerId(),
      nickname: nickname.normalize('NFC'),
      publicCode: createPublicCode(),
      avatarId: isKnownAvatar(avatarId) ? avatarId : DEFAULT_AVATAR_ID,
      createdAt: iso,
      lastPlayedAt: iso,
      playerLevel: 1,
      totalXP: 0,
      coinBalance: 0,
      settings: { bgm: true },
      gameRecords: {},
      achievements: [],
      unlockedAvatarIds: [],
    },
  };
}

/** 닉네임·아바타 변경: playerId·publicCode·기록은 그대로 */
export function withProfile(p: PlayerData, patch: { nickname?: string; avatarId?: string }): PlayerData | null {
  const next: PlayerData = { ...p };
  if (patch.nickname !== undefined) {
    if (!checkNickname(patch.nickname).ok) return null;
    next.nickname = patch.nickname.normalize('NFC');
  }
  if (patch.avatarId !== undefined) next.avatarId = isKnownAvatar(patch.avatarId) ? patch.avatarId : p.avatarId;
  return next;
}

/** 플랫폼 키(gp.v1.*)만 삭제. gona.openingSeen · gona.mute · 다른 게임 키는 건드리지 않음 */
export function resetPlatformData(kv: KV): void {
  for (const k of RESETTABLE_KEYS) {
    try {
      kv.removeItem(k);
    } catch {
      /* 무시 */
    }
  }
}
