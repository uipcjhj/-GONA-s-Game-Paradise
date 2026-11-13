/** 공통 플레이어 데이터 (로컬 저장). playerId·publicCode 는 보안 인증 수단이 아닙니다. */
export const SCHEMA_VERSION = 2;

export interface PlayerSettings {
  /** 배경음 선호(배경음 자체는 아직 없어 저장만 함). 효과음은 기존 `gona.mute` 키를 그대로 사용 */
  bgm: boolean;
  /** 진동 사용(지원 기기에서만 동작) */
  vibration: boolean;
  /** 움직임 줄이기 */
  reduceMotion: boolean;
}

export interface ScoreEntry {
  score: number;
  at: string;
}
export interface LastResult {
  score: number;
  stage?: number;
  cleared: boolean;
  at: string;
  resultId: string;
}
/** 게임 한 개(또는 Mini Game Land 안의 미니게임 한 개)의 기록 */
export interface GameRecord {
  gameId: string;
  bestScore: number;
  bestScoreAt: string;
  bestScoreSource: 'play' | 'import';
  bestStage?: number;
  bestStageLabel?: string;
  /** 끝까지 간 판 수(게임 오버 + 클리어) */
  plays: number;
  clears: number;
  firstPlayedAt: string;
  lastPlayedAt: string;
  totalPlayTimeSec: number;
  lastResult?: LastResult;
  /** 이 기기 안에서의 상위 점수(내림차순, 최대 10) — "이 기기 순위"에 사용. 실제 온라인 랭킹이 아님 */
  top: ScoreEntry[];
  /** 이번 주(KST 월요일 기준) 최고 */
  weekly?: { weekId: string; score: number; at: string };
  subGames?: Record<string, GameRecord>;
}

export interface DailyBucket {
  xp: number;
  coins: number;
  plays: number;
}
/** 일일 보상 상한 추적(KST 날짜가 바뀌면 초기화) */
export interface DailyCounters {
  dateKST: string;
  byGame: Record<string, DailyBucket>;
}

export interface MissionProgress {
  id: string;
  value: number;
  claimed: boolean;
}
export interface MissionState {
  dateKST: string;
  daily: MissionProgress[];
  weekId: string;
  weekly: MissionProgress[];
  /** 접속한 날짜(KST) 목록 — 이번 주 출석 일수 계산용(최근 14일) */
  days: string[];
  attendance: { streak: number; lastDateKST: string; claimedDateKST: string };
}

export interface Inventory {
  owned: string[];
  equipped: { frame?: string; title?: string; background?: string };
}

export interface CoinTx {
  txId: string;
  delta: number;
  reason: 'game' | 'mission' | 'attendance' | 'achievement' | 'purchase';
  at: string;
  refId?: string;
}

export interface PlayerData {
  schemaVersion: number;
  /** 내부 고유 ID (UUID v4) */
  playerId: string;
  nickname: string;
  /** 공개 식별코드 4자 (닉네임 중복 구분용 · 혼동 문자 제외) */
  publicCode: string;
  avatarId: string;
  createdAt: string;
  lastPlayedAt: string;
  playerLevel: number;
  totalXP: number;
  coinBalance: number;
  settings: PlayerSettings;
  gameRecords: Record<string, GameRecord>;
  totalPlayCount: number;
  totalPlayTimeSec: number;
  /** 최근 반영한 resultId (중복 방지의 최종 기준, 최대 100) */
  resultLedger: string[];
  daily: DailyCounters;
  /** 달성한 업적 id → 달성 시각 */
  achievements: Record<string, string>;
  /** 누적 카운터(업적·미션 계산용). 예: newBests, coinsEarned, missionsClaimed, purchases */
  stats: Record<string, number>;
  missions: MissionState | null;
  inventory: Inventory;
  /** 도감 해금 id → 시각 */
  codex: Record<string, string>;
  /** 코인 거래 최근 30건(총액은 coinBalance) */
  coinLog: CoinTx[];
  /** 해금형 아바타용 (현재 모든 아바타는 free) */
  unlockedAvatarIds: string[];
}

/** localStorage 와 같은 모양의 최소 인터페이스 (테스트에서 메모리 구현으로 교체) */
export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  /** 선택: 키 목록(메모리 저장소). localStorage 는 length/key(i) 를 사용 */
  keys?(): string[];
  readonly length?: number;
  key?(i: number): string | null;
}
