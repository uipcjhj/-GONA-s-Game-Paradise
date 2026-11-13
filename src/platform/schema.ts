import { isKnownAvatar, DEFAULT_AVATAR_ID } from './avatars';
import { BALANCE } from './balance';
import { DEFAULT_ITEMS, DEFAULT_TITLE, getItem, SHOP_SLOTS, TITLES } from './content';
import { CODE_RE } from './ids';
import { isDate } from './kst';
import { checkNickname } from './nickname';
import { SCHEMA_VERSION, type AttendanceState, type DailyState, type GameRecord, type Inventory, type PlayerData, type PlayerStats, type ShopSlot } from './types';

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const isIso = (v: unknown): v is string => typeof v === 'string' && v.length <= 40 && !Number.isNaN(Date.parse(v));
const nonNegInt = (v: unknown, max: number): number | null => (typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v) && v >= 0 && v <= max ? v : null);
const int = (v: unknown, max: number, dflt = 0): number => nonNegInt(v, max) ?? dflt;
const bool = (v: unknown, dflt: boolean): boolean => (typeof v === 'boolean' ? v : dflt);
const strArr = (v: unknown, max: number): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length <= 80).slice(0, max) : []);

/** 마이그레이션: 키 n 은 schema n → n+1 변환 */
export type Migration = (raw: Raw) => Raw;
export const MIGRATIONS: Record<number, Migration> = {
  // v1 → v2: 기록/진행/업적/도감/미션/출석/상점 구조 추가 (v1 은 이 값들이 모두 비어 있었음)
  1: (raw) => ({
    ...raw,
    settings: { ...(isObj(raw.settings) ? raw.settings : {}), vibration: true, reduceMotion: false },
    gameRecords: {},
    achievements: {},
    titleId: DEFAULT_TITLE,
  }),
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

export function emptyStats(): PlayerStats {
  return { totalPlayCount: 0, totalPlayTimeSec: 0, launches: 0, newBestCount: 0, totalCoinsEarned: 0, totalXpEarned: 0, missionsCompleted: 0, purchases: 0, checkins: 0 };
}
export function emptyDaily(dateKST: string): DailyState {
  return { dateKST, rewardedRuns: 0, clearBonuses: 0, missions: {}, visits: [], islandsOpened: [] };
}
export function emptyAttendance(): AttendanceState {
  return { streak: 0, longest: 0, total: 0 };
}
export function defaultInventory(): Inventory {
  return { owned: Object.values(DEFAULT_ITEMS), equipped: { ...DEFAULT_ITEMS }, history: [] };
}

function sanitizeRecord(raw: unknown, gameId: string, depth = 0): GameRecord | null {
  if (!isObj(raw)) return null;
  const at = isIso(raw.firstPlayedAt) ? raw.firstPlayedAt : null;
  const last = isIso(raw.lastPlayedAt) ? raw.lastPlayedAt : at;
  if (!at || !last) return null;
  const recent = Array.isArray(raw.recent)
    ? raw.recent
        .filter((r): r is Raw => isObj(r) && typeof r.resultId === 'string' && nonNegInt(r.score, 1e9) !== null && isIso(r.at))
        .slice(0, BALANCE.recentPlaysKept)
        .map((r) => ({ resultId: r.resultId as string, score: r.score as number, stage: nonNegInt(r.stage, 99) ?? undefined, cleared: r.cleared === true, at: r.at as string }))
    : [];
  const rec: GameRecord = {
    gameId,
    bestScore: int(raw.bestScore, 1e9),
    bestScoreAt: isIso(raw.bestScoreAt) ? raw.bestScoreAt : at,
    bestStage: int(raw.bestStage, 99),
    bestStageLabel: typeof raw.bestStageLabel === 'string' ? raw.bestStageLabel.slice(0, 40) : undefined,
    plays: int(raw.plays, 1e7),
    clears: int(raw.clears, 1e7),
    firstPlayedAt: at,
    lastPlayedAt: last,
    totalPlayTimeSec: int(raw.totalPlayTimeSec, 1e9),
    recent,
  };
  if (isObj(raw.weekly) && typeof raw.weekly.weekId === 'string' && isDate(raw.weekly.weekId) && nonNegInt(raw.weekly.score, 1e9) !== null && isIso(raw.weekly.at)) {
    rec.weekly = { weekId: raw.weekly.weekId, score: raw.weekly.score as number, at: raw.weekly.at };
  }
  if (depth === 0 && isObj(raw.subGames)) {
    const subs: Record<string, GameRecord> = {};
    for (const [k, v] of Object.entries(raw.subGames).slice(0, 50)) {
      const s = sanitizeRecord(v, k, 1);
      if (s) subs[k] = s;
    }
    if (Object.keys(subs).length) rec.subGames = subs;
  }
  return rec;
}

/** 구조 검증 + 안전한 값 정리. 핵심 값이 이상하면 null (= 손상). 부가 구간은 기본값으로 복구. */
export function validatePlayer(raw: unknown): PlayerData | null {
  if (!isObj(raw)) return null;
  if (raw.schemaVersion !== SCHEMA_VERSION) return null;
  const { playerId, nickname, publicCode } = raw;
  if (typeof playerId !== 'string' || !/^[\w-]{8,64}$/.test(playerId)) return null;
  if (typeof nickname !== 'string' || !checkNickname(nickname).ok) return null;
  if (typeof publicCode !== 'string' || !CODE_RE.test(publicCode)) return null;
  if (!isIso(raw.createdAt)) return null;
  const level = nonNegInt(raw.playerLevel, BALANCE.maxLevel);
  const xp = nonNegInt(raw.totalXP, 1e9);
  const coin = nonNegInt(raw.coinBalance, 1e9);
  if (level === null || level < 1 || xp === null || coin === null) return null;
  if (!isObj(raw.settings) || typeof raw.settings.bgm !== 'boolean') return null;

  const gameRecords: Record<string, GameRecord> = {};
  if (isObj(raw.gameRecords)) for (const [k, v] of Object.entries(raw.gameRecords).slice(0, 20)) { const r = sanitizeRecord(v, k); if (r) gameRecords[k] = r; }

  const st = isObj(raw.stats) ? raw.stats : {};
  const stats: PlayerStats = {
    totalPlayCount: int(st.totalPlayCount, 1e7), totalPlayTimeSec: int(st.totalPlayTimeSec, 1e9), launches: int(st.launches, 1e7), newBestCount: int(st.newBestCount, 1e7),
    totalCoinsEarned: int(st.totalCoinsEarned, 1e9), totalXpEarned: int(st.totalXpEarned, 1e9), missionsCompleted: int(st.missionsCompleted, 1e7), purchases: int(st.purchases, 1e7), checkins: int(st.checkins, 1e7),
  };

  const achievements: PlayerData['achievements'] = {};
  if (isObj(raw.achievements)) for (const [k, v] of Object.entries(raw.achievements).slice(0, 200)) if (isObj(v) && isIso(v.at)) achievements[k] = { at: v.at };
  const codex: PlayerData['codex'] = {};
  if (isObj(raw.codex)) for (const [k, v] of Object.entries(raw.codex).slice(0, 200)) if (isObj(v) && isIso(v.at)) codex[k] = { at: v.at };

  const d = isObj(raw.daily) ? raw.daily : {};
  const missions: DailyState['missions'] = {};
  if (isObj(d.missions)) for (const [k, v] of Object.entries(d.missions).slice(0, 20)) if (isObj(v)) missions[k] = { progress: int(v.progress, 1e6), claimed: v.claimed === true };
  const daily: DailyState = { dateKST: isDate(d.dateKST) ? d.dateKST : '1970-01-01', rewardedRuns: int(d.rewardedRuns, 1e4), clearBonuses: int(d.clearBonuses, 1e4), missions, visits: strArr(d.visits, 20), islandsOpened: strArr(d.islandsOpened, 20) };

  const a = isObj(raw.attendance) ? raw.attendance : {};
  const attendance: AttendanceState = { lastDate: isDate(a.lastDate) ? a.lastDate : undefined, maxSeenDate: isDate(a.maxSeenDate) ? a.maxSeenDate : undefined, streak: int(a.streak, 1e5), longest: int(a.longest, 1e5), total: int(a.total, 1e6) };

  // 상점: 존재하는 아이템만, 기본 아이템은 항상 보유, 장착은 보유 중인 같은 슬롯 아이템만
  const inv = isObj(raw.inventory) ? raw.inventory : {};
  const owned = Array.from(new Set([...Object.values(DEFAULT_ITEMS), ...strArr(inv.owned, 200).filter((id) => !!getItem(id))]));
  const equipped: Inventory['equipped'] = { ...DEFAULT_ITEMS };
  if (isObj(inv.equipped)) for (const s of SHOP_SLOTS) { const id = inv.equipped[s.id]; if (typeof id === 'string' && owned.includes(id) && getItem(id)?.slot === s.id) equipped[s.id as ShopSlot] = id; }
  const history = Array.isArray(inv.history) ? inv.history.filter((h): h is Raw => isObj(h) && typeof h.itemId === 'string' && nonNegInt(h.price, 1e7) !== null && isIso(h.at)).slice(-BALANCE.historyKept).map((h) => ({ itemId: h.itemId as string, price: h.price as number, at: h.at as string })) : [];

  const sr: Record<string, number> = {};
  if (isObj(raw.sessionRewarded)) for (const [k, v] of Object.entries(raw.sessionRewarded).slice(-50)) if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 1e4) sr[k] = v;

  const titleId = typeof raw.titleId === 'string' && TITLES.some((t) => t.id === raw.titleId) ? raw.titleId : DEFAULT_TITLE;
  const pinned = typeof raw.pinnedAchievement === 'string' && achievements[raw.pinnedAchievement] ? raw.pinnedAchievement : undefined;

  return {
    schemaVersion: SCHEMA_VERSION,
    playerId,
    nickname: nickname.normalize('NFC'),
    publicCode,
    avatarId: typeof raw.avatarId === 'string' && isKnownAvatar(raw.avatarId) ? raw.avatarId : DEFAULT_AVATAR_ID,
    createdAt: raw.createdAt,
    lastPlayedAt: isIso(raw.lastPlayedAt) ? raw.lastPlayedAt : raw.createdAt,
    playerLevel: level,
    totalXP: xp,
    coinBalance: coin,
    settings: { bgm: raw.settings.bgm, vibration: bool(raw.settings.vibration, true), reduceMotion: bool(raw.settings.reduceMotion, false) },
    unlockedAvatarIds: strArr(raw.unlockedAvatarIds, 100),
    gameRecords,
    stats,
    resultLedger: strArr(raw.resultLedger, BALANCE.ledgerKept),
    achievements,
    pinnedAchievement: pinned,
    titleId,
    codex,
    daily,
    attendance,
    levelRewardsGiven: int(raw.levelRewardsGiven, BALANCE.maxLevel),
    inventory: { owned, equipped, history },
    sessionRewarded: sr,
  };
}

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
