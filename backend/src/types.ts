/** Cloudflare D1 의 최소 인터페이스 (로컬 테스트는 node:sqlite 로 같은 모양을 흉내 냄) */
export interface D1Stmt {
  bind(...v: unknown[]): D1Stmt;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta?: { changes?: number } }>;
}
export interface D1Like {
  prepare(sql: string): D1Stmt;
  batch(stmts: D1Stmt[]): Promise<unknown[]>;
  exec?(sql: string): Promise<unknown>;
}

export interface Env {
  DB: D1Like;
  /** 토큰 해시용 비밀값(wrangler secret). 프론트엔드에 절대 노출하지 않음 */
  TOKEN_PEPPER: string;
  /** 허용 출처(쉼표 구분). 개발용 '*' */
  ALLOWED_ORIGINS?: string;
  /** 종합 랭킹 최소 참가자 수(기본 20) */
  MIN_PARTICIPANTS?: string;
  /** '1' 이면 출시 전 게임(sky/mini)도 제출 허용 — 로컬 테스트 전용 */
  ALLOW_TEST_GAMES?: string;
  /** 시계 주입(테스트) */
  NOW?: () => number;
}
