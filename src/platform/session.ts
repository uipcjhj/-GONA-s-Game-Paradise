import { BALANCE } from './balance';
import { INBOX_PREFIX, REJECTED_PREFIX, SESSION_PREFIX } from './keys';
import { createPlayerId } from './ids';
import type { KV, PlayerData } from './types';

/** 게임천국이 PLAY 때 만드는 실행 세션 (같은 출처 localStorage). 게임은 `?gp=<sessionId>` 로 이 세션을 찾아 활성화된다. */
export interface LaunchSession {
  version: 1;
  sessionId: string;
  gameId: string;
  playerId: string;
  startedAt: string;
  expiresAt: string;
  /** 게임이 돌아갈 주소 — 주소창으로 받지 않고 여기 저장된 값만 쓴다(열린 리다이렉트 방지) */
  returnUrl: string;
  /** 온라인 랭킹 서버가 발급한 세션 ID(서버가 시간을 재는 검증 경로). 없으면 로컬 기록만 */
  serverSessionId?: string;
}

export function createSession(kv: KV, gameId: string, player: PlayerData, returnUrl: string, now: number = Date.now(), serverSessionId?: string): LaunchSession {
  const s: LaunchSession = {
    version: 1,
    sessionId: createPlayerId(),
    gameId,
    playerId: player.playerId,
    startedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + BALANCE.validation.sessionHours * 3600 * 1000).toISOString(),
    returnUrl,
    ...(serverSessionId ? { serverSessionId } : {}),
  };
  kv.setItem(SESSION_PREFIX + s.sessionId, JSON.stringify(s));
  pruneSessions(kv, now);
  return s;
}

export function getSession(kv: KV, sessionId: string): LaunchSession | null {
  if (!/^[\w-]{8,64}$/.test(sessionId)) return null;
  try {
    const raw = kv.getItem(SESSION_PREFIX + sessionId);
    if (!raw) return null;
    const s = JSON.parse(raw) as LaunchSession;
    if (s && s.version === 1 && s.sessionId === sessionId && typeof s.gameId === 'string' && typeof s.playerId === 'string' && (s.serverSessionId === undefined || typeof s.serverSessionId === 'string') && !Number.isNaN(Date.parse(s.startedAt)) && !Number.isNaN(Date.parse(s.expiresAt))) return s;
  } catch {
    /* 깨진 세션은 없는 것으로 */
  }
  return null;
}

/** 24시간 지난 세션·30일 지난 보류 결과 정리 (최대 10개 세션 유지) */
export function pruneSessions(kv: KV, now: number = Date.now()): void {
  try {
    const keys = (kv.keys?.() ?? []).filter((k) => k.startsWith(SESSION_PREFIX));
    const sessions = keys.map((k) => ({ k, s: getSession(kv, k.slice(SESSION_PREFIX.length)) }));
    for (const { k, s } of sessions) if (!s || now - Date.parse(s.startedAt) > 24 * 3600 * 1000) kv.removeItem(k);
    const alive = sessions.filter((x) => x.s && now - Date.parse(x.s.startedAt) <= 24 * 3600 * 1000).sort((a, b) => Date.parse(b.s!.startedAt) - Date.parse(a.s!.startedAt));
    for (const x of alive.slice(10)) kv.removeItem(x.k);
    for (const k of (kv.keys?.() ?? []).filter((k) => k.startsWith(REJECTED_PREFIX))) {
      const at = Number(kv.getItem(k)?.match(/"at":(\d+)/)?.[1] ?? 0);
      if (now - at > 7 * 24 * 3600 * 1000) kv.removeItem(k);
    }
  } catch {
    /* 정리 실패는 무시 */
  }
}

export const inboxKey = (resultId: string): string => INBOX_PREFIX + resultId;
