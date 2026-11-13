/** 저장 키. 플랫폼이 쓰는 키는 모두 `gp.v1.` 접두사 — Food Adventure 등 다른 게임 키와 겹치지 않음. */
export const PREFIX = 'gp.v1.';
export const KEYS = {
  player: `${PREFIX}player`,
  /** 직전 정상본 (손상 복구용) */
  backup: `${PREFIX}player.bak`,
  /** 손상된 원본 보관(수동 복구용) */
  corrupt: `${PREFIX}player.corrupt`,
  /** 등록 도중 새로고침 대비 임시 초안 (sessionStorage) */
  draft: `${PREFIX}regdraft`,
} as const;

/** 기존 키 — 초기화·복원이 절대 건드리지 않음 */
export const LEGACY_KEYS = { openingSeen: 'gona.openingSeen', mute: 'gona.mute' } as const;

/** 데이터 초기화가 지우는 키 목록(= 플랫폼 키만) */
export const RESETTABLE_KEYS: string[] = [KEYS.player, KEYS.backup, KEYS.corrupt];
/** 접두사로 지우는 연동 키(세션·inbox·보관) */
export const RESETTABLE_PREFIXES: string[] = [`${PREFIX}session.`, `${PREFIX}inbox.`, `${PREFIX}rejected.`];

/** 게임 연동 키 (v2) — 게임은 inbox.<resultId> 새 키만 씀 */
export const SESSION_PREFIX = `${PREFIX}session.`;
export const INBOX_PREFIX = `${PREFIX}inbox.`;
export const REJECTED_PREFIX = `${PREFIX}rejected.`;
export const sessionKey = (sid: string): string => `${SESSION_PREFIX}${sid}`;
export const inboxKey = (rid: string): string => `${INBOX_PREFIX}${rid}`;
