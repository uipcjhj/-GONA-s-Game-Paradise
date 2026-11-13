/** 공통 플레이어 데이터 (Phase 1: 로컬 저장). playerId·publicCode 는 보안 인증 수단이 아닙니다. */
export const SCHEMA_VERSION = 1;

export interface PlayerSettings {
  /** 배경음 선호(Phase 1 에는 배경음 자체가 없어 저장만 함). 효과음은 기존 `gona.mute` 키를 그대로 사용 */
  bgm: boolean;
}

/** 향후 게임별 기록 연결용 자리 — Phase 1 에서는 비어 있음(임의 숫자 표시 금지) */
export interface GameRecordSummary {
  bestScore?: number;
  bestStage?: number;
  plays?: number;
  lastPlayedAt?: string;
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
  gameRecords: Record<string, GameRecordSummary>;
  achievements: string[];
  /** 해금형 아바타용 (현재 모든 아바타는 free) */
  unlockedAvatarIds: string[];
}

/** localStorage 와 같은 모양의 최소 인터페이스 (테스트에서 메모리 구현으로 교체) */
export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}
