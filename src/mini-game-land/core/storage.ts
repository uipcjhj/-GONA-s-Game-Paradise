/** 기록 저장 — 버전 있는 localStorage + 메모리 폴백(사생활 보호 모드·저장 차단 대비) */

export interface GameRecord {
  bestScore: number;
  /** 지금까지 클리어한 가장 높은 레벨 (다음 시작 가능 레벨 = bestLevel + 1) */
  bestLevel: number;
  plays: number;
}
export interface ChallengeRecord {
  bestScore: number;
  bestRound: number;
  plays: number;
}
export interface SaveData {
  v: 1;
  games: Record<string, GameRecord>;
  challenge: ChallengeRecord;
  settings: { muted: boolean };
}

export const STORAGE_KEY = 'gmgl.v1';

export const emptySave = (): SaveData => ({
  v: 1,
  games: {},
  challenge: { bestScore: 0, bestRound: 0, plays: 0 },
  settings: { muted: false },
});

const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0);

/** 손상·구버전 데이터에도 죽지 않도록 필드 단위로 검증 */
export function parseSave(raw: string | null): SaveData {
  const out = emptySave();
  if (!raw) return out;
  try {
    const d = JSON.parse(raw) as Record<string, unknown>;
    if (!d || typeof d !== 'object' || d.v !== 1) return out;
    const games = (d.games ?? {}) as Record<string, Record<string, unknown>>;
    for (const [id, g] of Object.entries(games)) {
      if (g && typeof g === 'object') out.games[id] = { bestScore: num(g.bestScore), bestLevel: num(g.bestLevel), plays: num(g.plays) };
    }
    const c = (d.challenge ?? {}) as Record<string, unknown>;
    out.challenge = { bestScore: num(c.bestScore), bestRound: num(c.bestRound), plays: num(c.plays) };
    const s = (d.settings ?? {}) as Record<string, unknown>;
    out.settings = { muted: s.muted === true };
  } catch {
    return emptySave();
  }
  return out;
}

export const gameRecord = (save: SaveData, id: string): GameRecord => save.games[id] ?? { bestScore: 0, bestLevel: 0, plays: 0 };

export interface RecordResult<T> {
  save: SaveData;
  record: T;
  newBestScore: boolean;
  newBestLevel?: boolean;
}

/** 자유 플레이 라운드 종료 시 호출. runScore = 이번 런 누적 점수 */
export function recordFreeRound(
  save: SaveData,
  gameId: string,
  r: { level: number; cleared: boolean; runScore: number },
): RecordResult<GameRecord> {
  const prev = gameRecord(save, gameId);
  const record: GameRecord = {
    bestScore: Math.max(prev.bestScore, r.runScore),
    bestLevel: r.cleared ? Math.max(prev.bestLevel, r.level) : prev.bestLevel,
    plays: prev.plays + 1,
  };
  return {
    save: { ...save, games: { ...save.games, [gameId]: record } },
    record,
    newBestScore: r.runScore > prev.bestScore,
    newBestLevel: r.cleared && r.level > prev.bestLevel,
  };
}

/** 챌린지 종료 시 호출 */
export function recordChallenge(save: SaveData, r: { score: number; rounds: number }): RecordResult<ChallengeRecord> {
  const prev = save.challenge;
  const record: ChallengeRecord = {
    bestScore: Math.max(prev.bestScore, r.score),
    bestRound: Math.max(prev.bestRound, r.rounds),
    plays: prev.plays + 1,
  };
  return { save: { ...save, challenge: record }, record, newBestScore: r.score > prev.bestScore };
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** 쓰기까지 되는 localStorage 만 사용. 아니면 null(메모리 전용) */
export function detectStorage(): StorageLike | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const k = `${STORAGE_KEY}.probe`;
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return localStorage;
  } catch {
    return null;
  }
}

export class SaveStore {
  private data: SaveData;
  /** false 면 이 기기에 영구 저장이 안 됨(앱을 닫으면 기록 사라짐) */
  persistent: boolean;

  constructor(
    private backend: StorageLike | null = detectStorage(),
    private key = STORAGE_KEY,
  ) {
    this.persistent = backend !== null;
    let raw: string | null = null;
    try {
      raw = backend ? backend.getItem(key) : null;
    } catch {
      this.persistent = false;
    }
    this.data = parseSave(raw);
  }

  get(): SaveData {
    return this.data;
  }

  set(next: SaveData) {
    this.data = next;
    if (!this.backend) return;
    try {
      this.backend.setItem(this.key, JSON.stringify(next));
    } catch {
      this.persistent = false; // 용량 초과·차단 → 메모리 폴백
    }
  }
}
