import { getGame } from './games';
import { createSession } from './session';
import type { KV, PlayerData } from './types';

/**
 * PLAY: 기록 연동이 'live' 인 게임만 세션을 만들어 `?gp=<세션>` 으로 연다.
 * 'pending'(게임 쪽 패치 전)이면 세션 없이 기존 주소 그대로 연다 — 기록이 쌓이는 것처럼 보이지 않게.
 */
export function buildLaunchUrl(kv: KV | null, gameId: string, baseUrl: string, player: PlayerData, returnUrl: string, now: number = Date.now(), serverSessionId?: string): { url: string; linked: boolean } {
  const g = getGame(gameId);
  if (!kv || !g || g.link !== 'live') return { url: baseUrl, linked: false };
  try {
    const s = createSession(kv, gameId, player, returnUrl, now, serverSessionId);
    const u = new URL(baseUrl, typeof location !== 'undefined' ? location.href : undefined); // 같은 사이트의 상대 주소(./mini-game-land/)도 허용
    u.searchParams.set('gp', s.sessionId);
    return { url: u.toString(), linked: true };
  } catch {
    return { url: baseUrl, linked: false }; // 저장 실패 → 기록 없이 실행
  }
}
