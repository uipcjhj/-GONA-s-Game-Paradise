import { createPlayerId } from './ids';
import { SESSION_PREFIX, sessionKey } from './keys';
import type { LaunchSession } from './result';
import { listKeys, safeGet, safeRemove, safeSet } from './store';
import type { KV, PlayerData } from './types';

export const SESSION_TTL_MS = 12 * 3600 * 1000;
export const KEEP_MS = 30 * 24 * 3600 * 1000;

/** PLAY 때 실행 세션 발급: 게임은 `?gp=<sessionId>` 한 개만 받고, 나머지(플레이어·돌아갈 주소)는 이 레코드에서 읽음 */
export function createSession(kv: KV, player: PlayerData, gameId: string, returnUrl: string, now: Date = new Date()): LaunchSession | null {
  const s: LaunchSession = {
    sessionId: createPlayerId(),
    gameId,
    playerId: player.playerId,
    startedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
    returnUrl,
    version: 1,
  };
  return safeSet(kv, sessionKey(s.sessionId), JSON.stringify(s)) ? s : null;
}
export function readSession(kv: KV, sid: string): LaunchSession | null {
  const raw = safeGet(kv, sessionKey(sid));
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as LaunchSession;
    if (s && s.version === 1 && s.sessionId === sid && typeof s.gameId === 'string' && typeof s.playerId === 'string') return s;
  } catch {
    /* 아래 null */
  }
  return null;
}
/** 30일 지난 세션 삭제 */
export function pruneSessions(kv: KV, now: Date = new Date()): number {
  let n = 0;
  for (const k of listKeys(kv, SESSION_PREFIX)) {
    const s = readSession(kv, k.slice(SESSION_PREFIX.length));
    if (!s || Date.parse(s.startedAt) + KEEP_MS < now.getTime()) {
      safeRemove(kv, k);
      n += 1;
    }
  }
  return n;
}
