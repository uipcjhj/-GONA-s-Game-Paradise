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
/** 온라인 랭킹 신원(서버 발급 토큰)과 제출 대기열 — 백업 파일에는 포함하지 않는다(토큰은 비밀값) */
export const ONLINE_KEYS = { identity: `${PREFIX}online`, outbox: `${PREFIX}outbox` } as const;
export const RESETTABLE_KEYS: string[] = [KEYS.player, KEYS.backup, KEYS.corrupt, ONLINE_KEYS.identity, ONLINE_KEYS.outbox];

/** 게임 연동용 키: 세션(게임천국이 씀) · 결과 inbox(게임이 씀) · 거부된 결과 보관 */
export const SESSION_PREFIX = `${PREFIX}session.`;
export const INBOX_PREFIX = `${PREFIX}inbox.`;
export const REJECTED_PREFIX = `${PREFIX}rejected.`;
/** 초기화 때 함께 지우는 접두사 (gp.v1.* 만 — 다른 게임/기존 gona.* 키는 절대 건드리지 않음) */
export const KEY_PREFIXES_TO_RESET: string[] = [SESSION_PREFIX, INBOX_PREFIX, REJECTED_PREFIX];
