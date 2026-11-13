import { isKnownAvatar, DEFAULT_AVATAR_ID } from './avatars';
import { CODE_RE } from './ids';
import { checkNickname } from './nickname';
import { TUNING } from './tuning';
import { DEFAULT_OWNED } from './shop';
import { SCHEMA_VERSION, type CoinTx, type DailyCounters, type GameRecord, type Inventory, type MissionState, type PlayerData, type ScoreEntry } from './types';

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const isIso = (v: unknown): v is string => typeof v === 'string' && v.length <= 40 && !Number.isNaN(Date.parse(v));
const nonNegInt = (v: unknown, max: number): number | null => (typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v) && v >= 0 && v <= max ? v : null);

/** 마이그레이션: 키 n 은 schema n → n+1 변환 함수. 지금은 v1 이 최초라 비어 있음(테스트에서 가짜 체인으로 검증) */
export type Migration = (raw: Raw) => Raw;
export const MIGRATIONS: Record<number, Migration> = {
  /** v1 → v2: 기록·원장·진행 구조 추가. v1 의 gameRecords(비어 있음)·achievements(문자열 배열)를 새 형식으로 변환 */
  1: (raw) => {
    const old: unknown[] = Array.isArray(raw.achievements) ? raw.achievements : [];
    const ach: Record<string, string> = {};
    for (const id of old) if (typeof id === 'string') ach[id] = typeof raw.createdAt === 'string' ? raw.createdAt : new Date(0).toISOString();
    const settings = isObj(raw.settings) ? raw.settings : {};
    return { ...raw, gameRecords: {}, totalPlayCount: 0, totalPlayTimeSec: 0, resultLedger: [], achievements: ach, settings: { ...settings, vibration: true, reduceMotion: false } };
  },
};

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

const str = (v: unknown, max = 80): string | null => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : null);
const num = (v: unknown, max = 1e9): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? Math.floor(v) : 0);
const dateStr = (v: unknown): string => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '');

function cleanRecord(raw: unknown, gameId: string, depth = 0): GameRecord | null {
  if (!isObj(raw) || !isIso(raw.lastPlayedAt) || !isIso(raw.firstPlayedAt)) return null;
  const top: ScoreEntry[] = Array.isArray(raw.top)
    ? raw.top.filter((t): t is ScoreEntry => isObj(t) && typeof t.score === 'number' && t.score >= 0 && isIso(t.at)).slice(0, TUNING.topMax)
    : [];
  const rec: GameRecord = {
    gameId,
    bestScore: num(raw.bestScore),
    bestScoreAt: isIso(raw.bestScoreAt) ? raw.bestScoreAt : raw.firstPlayedAt,
    bestScoreSource: raw.bestScoreSource === 'import' ? 'import' : 'play',
    plays: num(raw.plays, 1e7),
    clears: num(raw.clears, 1e7),
    firstPlayedAt: raw.firstPlayedAt,
    lastPlayedAt: raw.lastPlayedAt,
    totalPlayTimeSec: num(raw.totalPlayTimeSec, 1e9),
    top,
  };
  if (typeof raw.bestStage === 'number') rec.bestStage = num(raw.bestStage, 9999);
  if (typeof raw.bestStageLabel === 'string') rec.bestStageLabel = raw.bestStageLabel.slice(0, 40);
  if (isObj(raw.lastResult) && typeof raw.lastResult.resultId === 'string' && isIso(raw.lastResult.at)) {
    rec.lastResult = { score: num(raw.lastResult.score), stage: typeof raw.lastResult.stage === 'number' ? num(raw.lastResult.stage, 9999) : undefined, cleared: raw.lastResult.cleared === true, at: raw.lastResult.at, resultId: raw.lastResult.resultId.slice(0, 64) };
  }
  if (isObj(raw.weekly) && typeof raw.weekly.weekId === 'string' && isIso(raw.weekly.at)) rec.weekly = { weekId: raw.weekly.weekId, score: num(raw.weekly.score), at: raw.weekly.at };
  if (depth === 0 && isObj(raw.subGames)) {
    const subs: Record<string, GameRecord> = {};
    for (const [k, v] of Object.entries(raw.subGames).slice(0, 20)) {
      const c = cleanRecord(v, `${gameId}/${k}`, 1);
      if (c) subs[k] = c;
    }
    rec.subGames = subs;
  }
  return rec;
}
function cleanMissions(raw: unknown): MissionState | null {
  if (!isObj(raw) || !dateStr(raw.dateKST) || !dateStr(raw.weekId)) return null;
  const prog = (a: unknown) => (Array.isArray(a) ? a.filter(isObj).map((x) => ({ id: String(x.id).slice(0, 40), value: num(x.value, 1e6), claimed: x.claimed === true })).slice(0, 10) : []);
  const att = isObj(raw.attendance) ? raw.attendance : {};
  return {
    dateKST: raw.dateKST as string,
    daily: prog(raw.daily),
    weekId: raw.weekId as string,
    weekly: prog(raw.weekly),
    days: Array.isArray(raw.days) ? raw.days.filter((d): d is string => !!dateStr(d)).slice(-14) : [],
    attendance: { streak: num(att.streak, 9999), lastDateKST: dateStr(att.lastDateKST), claimedDateKST: dateStr(att.claimedDateKST) },
  };
}
function cleanStrMap(raw: unknown, max: number): Record<string, string> {
  const out: Record<string, string> = {};
  if (isObj(raw)) for (const [k, v] of Object.entries(raw).slice(0, max)) if (k.length <= 60 && isIso(v)) out[k] = v;
  return out;
}

/** 구조 검증 + 안전한 값 정리. 필수 값이 이상하면 null (= 손상). 부가 구조(기록·미션 등)는 깨져 있으면 그 부분만 기본값으로 */
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
  const gameRecords: Record<string, GameRecord> = {};
  if (isObj(raw.gameRecords)) for (const [k, v] of Object.entries(raw.gameRecords).slice(0, 50)) { const c = cleanRecord(v, k); if (c) gameRecords[k] = c; }
  const unlocked = Array.isArray(raw.unlockedAvatarIds) ? raw.unlockedAvatarIds.filter((x): x is string => typeof x === 'string').slice(0, 100) : [];
  const inv = isObj(raw.inventory) ? raw.inventory : {};
  const owned = Array.from(new Set([...DEFAULT_OWNED, ...(Array.isArray(inv.owned) ? inv.owned.filter((x): x is string => typeof x === 'string' && x.length <= 40).slice(0, 200) : [])]));
  const eq = isObj(inv.equipped) ? inv.equipped : {};
  const equipped: Inventory['equipped'] = {};
  for (const k of ['frame', 'title', 'background'] as const) { const v = str(eq[k], 40); if (v && owned.includes(v)) equipped[k] = v; }
  const daily: DailyCounters = { dateKST: '', byGame: {} };
  if (isObj(raw.daily) && dateStr(raw.daily.dateKST)) {
    daily.dateKST = raw.daily.dateKST as string;
    if (isObj(raw.daily.byGame)) for (const [k, v] of Object.entries(raw.daily.byGame).slice(0, 20)) if (isObj(v)) daily.byGame[k] = { xp: num(v.xp, 1e6), coins: num(v.coins, 1e6), plays: num(v.plays, 1e6) };
  }
  const stats: Record<string, number> = {};
  if (isObj(raw.stats)) for (const [k, v] of Object.entries(raw.stats).slice(0, 60)) if (k.length <= 40) stats[k] = num(v);
  const coinLog: CoinTx[] = Array.isArray(raw.coinLog) ? raw.coinLog.filter(isObj).filter((t) => typeof t.txId === 'string' && typeof t.delta === 'number' && isIso(t.at)).slice(0, TUNING.coinLogMax) as unknown as CoinTx[] : [];
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
    settings: { bgm: raw.settings.bgm, vibration: raw.settings.vibration !== false, reduceMotion: raw.settings.reduceMotion === true },
    gameRecords,
    totalPlayCount: num(raw.totalPlayCount, 1e8),
    totalPlayTimeSec: num(raw.totalPlayTimeSec, 1e10),
    resultLedger: Array.isArray(raw.resultLedger) ? raw.resultLedger.filter((x): x is string => typeof x === 'string' && x.length <= 64).slice(-TUNING.ledgerMax) : [],
    daily,
    achievements: cleanStrMap(raw.achievements, 200),
    stats,
    missions: cleanMissions(raw.missions),
    inventory: { owned, equipped },
    codex: cleanStrMap(raw.codex, 300),
    coinLog,
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
