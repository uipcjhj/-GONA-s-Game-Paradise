import { BALANCE } from './balance';
import { getGame, scoreLimit, type GameDef } from './games';
import type { LaunchSession } from './session';

export interface GameResult {
  resultId: string;
  sessionId: string;
  gameId: string;
  subGameId?: string;
  gameVersion: string;
  scoreSchemaVersion: number;
  outcome: 'cleared' | 'failed';
  score: number;
  stage?: number;
  stageLabel?: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  extra?: Record<string, number | string | boolean>;
}
export interface GpResultEnvelope {
  kind: 'gp-result';
  v: 1;
  sdk?: string;
  result: GameResult;
}

export type RejectReason = 'format' | 'unknown-game' | 'session' | 'player' | 'time' | 'score' | 'duration' | 'stage' | 'outcome' | 'expired';
export type Validation = { ok: true; result: GameResult } | { ok: false; reason: RejectReason; hold?: boolean };

export interface ValidateEnv {
  now: number;
  playerId: string;
  getSession: (sessionId: string) => LaunchSession | null;
  getGameDef?: (id: string) => GameDef | undefined;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const ms = (s: unknown): number => (typeof s === 'string' && s.length <= 40 ? Date.parse(s) : NaN);
const uid = /^[\w-]{8,64}$/;

/** 게임이 보낸 값은 전혀 믿지 않고 형식·범위·시간·세션·플레이어를 모두 다시 검사한다. hold=true 는 '더 새로운 버전' → 지우지 말고 보류 */
export function validateEnvelope(raw: unknown, env: ValidateEnv): Validation {
  if (!isObj(raw) || raw.kind !== 'gp-result') return { ok: false, reason: 'format' };
  if (typeof raw.v !== 'number' || !Number.isInteger(raw.v) || raw.v < 1) return { ok: false, reason: 'format' };
  if (raw.v > 1) return { ok: false, reason: 'format', hold: true };
  const r = raw.result;
  if (!isObj(r)) return { ok: false, reason: 'format' };
  if (typeof r.resultId !== 'string' || !uid.test(r.resultId) || typeof r.sessionId !== 'string' || !uid.test(r.sessionId)) return { ok: false, reason: 'format' };
  if (typeof r.gameId !== 'string' || typeof r.gameVersion !== 'string' || r.gameVersion.length > 30) return { ok: false, reason: 'format' };
  if (r.subGameId !== undefined && (typeof r.subGameId !== 'string' || !/^[\w-]{1,40}$/.test(r.subGameId))) return { ok: false, reason: 'format' };
  if (r.outcome !== 'cleared' && r.outcome !== 'failed') return { ok: false, reason: 'format' };
  if (typeof r.score !== 'number' || !Number.isInteger(r.score) || r.score < 0) return { ok: false, reason: 'score' };
  if (typeof r.durationMs !== 'number' || !Number.isFinite(r.durationMs) || r.durationMs < 0) return { ok: false, reason: 'duration' };
  if (typeof r.scoreSchemaVersion !== 'number' || !Number.isInteger(r.scoreSchemaVersion)) return { ok: false, reason: 'format' };
  const started = ms(r.startedAt);
  const ended = ms(r.endedAt);
  if (Number.isNaN(started) || Number.isNaN(ended)) return { ok: false, reason: 'format' };

  const game = (env.getGameDef ?? getGame)(r.gameId);
  if (!game) return { ok: false, reason: 'unknown-game' };
  if (r.scoreSchemaVersion > game.rules.scoreSchemaVersion) return { ok: false, reason: 'format', hold: true };
  if (r.scoreSchemaVersion < game.rules.scoreSchemaVersion) return { ok: false, reason: 'format' };

  // 세션: 존재 · 게임 일치 · 같은 플레이어 · 유효 시간대
  const s = env.getSession(r.sessionId);
  if (!s || s.gameId !== r.gameId) return { ok: false, reason: 'session' };
  if (s.playerId !== env.playerId) return { ok: false, reason: 'player' };
  const skew = BALANCE.validation.clockSkewSec * 1000;
  if (ended > env.now + skew || started > ended) return { ok: false, reason: 'time' };
  if (env.now - ended > BALANCE.validation.maxAgeDays * 86400000) return { ok: false, reason: 'expired' };
  if (started < Date.parse(s.startedAt) - skew || ended > Date.parse(s.expiresAt) + skew) return { ok: false, reason: 'time' };
  if (r.durationMs > ended - started + 2000) return { ok: false, reason: 'duration' };

  if (r.score > scoreLimit(game, r.durationMs / 1000)) return { ok: false, reason: 'score' };
  let stage: number | undefined;
  if (r.stage !== undefined) {
    if (typeof r.stage !== 'number' || !Number.isInteger(r.stage) || r.stage < 0 || r.stage > (game.rules.stageCount ?? 99)) return { ok: false, reason: 'stage' };
    stage = r.stage;
  }
  if (r.outcome === 'cleared' && !game.rules.hasClear) return { ok: false, reason: 'outcome' };

  const extra: Record<string, number | string | boolean> = {};
  if (isObj(r.extra)) for (const [k, v] of Object.entries(r.extra).slice(0, 10)) if (/^[\w-]{1,30}$/.test(k) && (typeof v === 'number' || typeof v === 'boolean' || (typeof v === 'string' && v.length <= 60))) extra[k] = v;

  return {
    ok: true,
    result: {
      resultId: r.resultId, sessionId: r.sessionId, gameId: r.gameId, subGameId: r.subGameId as string | undefined, gameVersion: r.gameVersion, scoreSchemaVersion: r.scoreSchemaVersion,
      outcome: r.outcome, score: r.score, stage, stageLabel: typeof r.stageLabel === 'string' ? r.stageLabel.slice(0, 40) : undefined, startedAt: r.startedAt as string, endedAt: r.endedAt as string,
      durationMs: Math.round(r.durationMs), extra: Object.keys(extra).length ? extra : undefined,
    },
  };
}
