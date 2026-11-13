import { effectiveRule } from './registry';

/** 게임 → 게임천국 결과 계약 v1 (docs/platform/GAME_RESULT_CONTRACT.md) */
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
  sdk: string;
  result: GameResult;
}
export interface LaunchSession {
  sessionId: string;
  gameId: string;
  playerId: string;
  startedAt: string;
  expiresAt: string;
  returnUrl: string;
  version: 1;
}

export const ENVELOPE_MAX_BYTES = 2048;
export const MAX_DURATION_MS = 12 * 3600 * 1000;

export type RejectReason = 'format' | 'too-large' | 'version-newer' | 'unknown-game' | 'schema-version' | 'no-session' | 'session-expired' | 'wrong-player' | 'game-mismatch' | 'time' | 'score-range' | 'score-rate' | 'old-version';
/** 'hold' = 지금은 처리 못 하지만 지우지 않음(더 새 버전), 'reject' = 보관소로 이동 */
export type Verdict = { ok: true; result: GameResult } | { ok: false; reason: RejectReason; hold: boolean };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown, max: number): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;
const isIso = (v: unknown): v is string => typeof v === 'string' && v.length <= 40 && !Number.isNaN(Date.parse(v));
const ID_RE = /^[\w.-]{8,64}$/;

function cmpVer(a: string, b: string): number {
  const pa = a.split('.').map((x) => parseInt(x, 10) || 0);
  const pb = b.split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  return 0;
}

export interface ValidateCtx {
  now: number;
  session: LaunchSession | null;
  playerId: string;
}

/** 게임이 보낸 값은 신뢰하지 않고 모든 필드를 다시 검증 */
export function validateEnvelope(text: string | null, ctx: ValidateCtx): Verdict {
  const bad = (reason: RejectReason, hold = false): Verdict => ({ ok: false, reason, hold });
  if (text === null) return bad('format');
  if (text.length > ENVELOPE_MAX_BYTES) return bad('too-large');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return bad('format');
  }
  if (!isObj(raw) || raw.kind !== 'gp-result') return bad('format');
  if (typeof raw.v !== 'number' || !Number.isInteger(raw.v)) return bad('format');
  if (raw.v > 1) return bad('version-newer', true);
  if (raw.v !== 1 || !isObj(raw.result)) return bad('format');
  const r = raw.result;
  if (!isStr(r.resultId, 64) || !ID_RE.test(r.resultId) || !isStr(r.sessionId, 64) || !ID_RE.test(r.sessionId)) return bad('format');
  if (!isStr(r.gameId, 40) || !isStr(r.gameVersion, 20) || (r.subGameId !== undefined && !isStr(r.subGameId, 40))) return bad('format');
  if (r.outcome !== 'cleared' && r.outcome !== 'failed') return bad('format');
  if (typeof r.score !== 'number' || !Number.isFinite(r.score) || !Number.isInteger(r.score) || r.score < 0) return bad('score-range');
  if (typeof r.scoreSchemaVersion !== 'number' || !Number.isInteger(r.scoreSchemaVersion) || r.scoreSchemaVersion < 1) return bad('format');
  if (r.stage !== undefined && (typeof r.stage !== 'number' || !Number.isInteger(r.stage) || r.stage < 0 || r.stage > 9999)) return bad('format');
  if (r.stageLabel !== undefined && !isStr(r.stageLabel, 40)) return bad('format');
  if (!isIso(r.startedAt) || !isIso(r.endedAt)) return bad('time');
  if (typeof r.durationMs !== 'number' || !Number.isFinite(r.durationMs) || r.durationMs < 0 || r.durationMs > MAX_DURATION_MS) return bad('time');
  let extra: Record<string, number | string | boolean> | undefined;
  if (r.extra !== undefined) {
    if (!isObj(r.extra)) return bad('format');
    extra = {};
    for (const [k, v] of Object.entries(r.extra).slice(0, 12)) if (k.length <= 24 && (typeof v === 'number' || typeof v === 'boolean' || (typeof v === 'string' && v.length <= 40))) extra[k] = v;
  }
  const rule = effectiveRule(r.gameId, r.subGameId as string | undefined);
  if (!rule) return bad('unknown-game');
  if (r.scoreSchemaVersion > rule.scoreSchemaVersion) return bad('schema-version', true);
  if (r.scoreSchemaVersion < rule.scoreSchemaVersion) return bad('schema-version');
  if (rule.minVersion && cmpVer(r.gameVersion as string, rule.minVersion) < 0) return bad('old-version');
  const s = ctx.session;
  if (!s || s.sessionId !== r.sessionId) return bad('no-session');
  if (s.playerId !== ctx.playerId) return bad('wrong-player');
  if (s.gameId !== r.gameId) return bad('game-mismatch');
  const started = Date.parse(s.startedAt);
  const expires = Date.parse(s.expiresAt);
  const ended = Date.parse(r.endedAt as string);
  const rStart = Date.parse(r.startedAt as string);
  if (ended < rStart || rStart < started - 60_000 || ended > ctx.now + 5 * 60_000) return bad('time');
  if (ended > expires + 60 * 60_000) return bad('session-expired');
  if (r.durationMs > ended - rStart + 2000) return bad('time');
  if (r.score > rule.maxScore) return bad('score-range');
  if (rule.maxScorePerSec && r.score > rule.maxScorePerSec * Math.max(5, r.durationMs / 1000) + (rule.scoreBurst ?? 0)) return bad('score-rate');
  return { ok: true, result: { ...(r as unknown as GameResult), extra } };
}
