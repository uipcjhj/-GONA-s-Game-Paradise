/**
 * 공통 플레이어 데이터 v2 — **게임천국의 모든 상태(기록·XP·코인·업적·칭호·도감·미션·출석·상점)는 이 객체 하나**에 있고,
 * 한 번의 저장(`gp.v1.player`)으로 원자적으로 갱신된다. 코인/XP/업적/구매가 서로 어긋나지 않는 이유.
 * playerId·publicCode 는 보안 인증 수단이 아니다. 로컬 데이터는 사용자가 조작할 수 있다(온라인 검증 아님).
 */
export const SCHEMA_VERSION = 2;

export interface PlayerSettings {
  /** 배경음 선호(Paradise 에 BGM 이 아직 없어 저장만). 효과음은 기존 `gona.mute` 키 사용 */
  bgm: boolean;
  vibration: boolean;
  reduceMotion: boolean;
}

export interface RecentPlay {
  resultId: string;
  score: number;
  stage?: number;
  cleared: boolean;
  at: string;
}

export interface GameRecord {
  gameId: string;
  bestScore: number;
  bestScoreAt: string;
  bestStage: number;
  bestStageLabel?: string;
  plays: number;
  clears: number;
  firstPlayedAt: string;
  lastPlayedAt: string;
  totalPlayTimeSec: number;
  recent: RecentPlay[];
  /** 이번 주(KST 월~일) 최고 */
  weekly?: { weekId: string; score: number; at: string };
  /** Mini Game Land: 개별 미니게임 기록 */
  subGames?: Record<string, GameRecord>;
}

export interface PlayerStats {
  totalPlayCount: number;
  totalPlayTimeSec: number;
  launches: number;
  newBestCount: number;
  totalCoinsEarned: number;
  totalXpEarned: number;
  missionsCompleted: number;
  purchases: number;
  checkins: number;
}

export interface MissionState {
  progress: number;
  claimed: boolean;
}
export interface DailyState {
  dateKST: string;
  rewardedRuns: number;
  clearBonuses: number;
  missions: Record<string, MissionState>;
  /** 오늘 방문한 화면 종류 / 열어 본 섬 */
  visits: string[];
  islandsOpened: string[];
}
export interface AttendanceState {
  lastDate?: string;
  /** 지금까지 본 가장 늦은 한국 날짜(시계를 뒤로 돌려도 출석 중복 불가) */
  maxSeenDate?: string;
  streak: number;
  longest: number;
  total: number;
}

export type ShopSlot = 'frame' | 'nameplate' | 'titleStyle' | 'background' | 'avatarDeco';
export interface Purchase {
  itemId: string;
  price: number;
  at: string;
}
export interface Inventory {
  owned: string[];
  equipped: Partial<Record<ShopSlot, string>>;
  history: Purchase[];
}

export interface PlayerData {
  schemaVersion: number;
  playerId: string;
  nickname: string;
  publicCode: string;
  avatarId: string;
  createdAt: string;
  lastPlayedAt: string;
  playerLevel: number;
  totalXP: number;
  coinBalance: number;
  settings: PlayerSettings;
  unlockedAvatarIds: string[];

  gameRecords: Record<string, GameRecord>;
  stats: PlayerStats;
  /** 이미 반영한 결과 ID (최근 N개) — 중복 반영 차단의 최종 기준 */
  resultLedger: string[];
  achievements: Record<string, { at: string }>;
  pinnedAchievement?: string;
  titleId: string;
  codex: Record<string, { at: string }>;
  daily: DailyState;
  attendance: AttendanceState;
  /** 레벨 보상을 이미 지급한 최고 레벨 */
  levelRewardsGiven: number;
  inventory: Inventory;
  /** 세션별 보상 판 수 (세션당 상한용) */
  sessionRewarded: Record<string, number>;
}

/** localStorage 와 같은 모양의 최소 인터페이스 (테스트에서 메모리 구현으로 교체) */
export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  /** 선택: 접두사 키 나열(초기화·inbox 처리용) */
  keys?(): string[];
}
