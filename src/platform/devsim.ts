import { inboxKey } from './session';
import { createSession } from './session';
import type { GpResultEnvelope } from './result';
import type { KV, PlayerData } from './types';
import { createPlayerId } from './ids';

/** 개발용 시뮬레이터(운영 빌드에는 포함되지 않음): 게임이 쓸 결과를 실제와 똑같은 방식으로 inbox 에 넣는다. */
export const DEV_SIM: boolean = import.meta.env.DEV || import.meta.env.VITE_DEV_SIM === '1';

export function simulateResult(kv: KV, player: PlayerData, o: { score: number; stage: number; cleared: boolean; durationSec?: number }, now: number = Date.now()): string {
  const s = createSession(kv, 'food-island', player, location.href.split('#')[0], now - (o.durationSec ?? 120) * 1000 - 5000);
  const dur = (o.durationSec ?? 120) * 1000;
  const env: GpResultEnvelope = {
    kind: 'gp-result',
    v: 1,
    sdk: 'dev-sim',
    result: {
      resultId: createPlayerId(), sessionId: s.sessionId, gameId: 'food-island', gameVersion: 'dev-sim', scoreSchemaVersion: 1, outcome: o.cleared ? 'cleared' : 'failed', score: o.score, stage: o.stage,
      startedAt: new Date(now - dur).toISOString(), endedAt: new Date(now).toISOString(), durationMs: dur, extra: { snacks: Math.floor(o.score / 40) },
    },
  };
  kv.setItem(inboxKey(env.result.resultId), JSON.stringify(env));
  return env.result.resultId;
}
