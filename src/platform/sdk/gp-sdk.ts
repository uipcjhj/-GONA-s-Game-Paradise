/**
 * 게임천국 연동 SDK (gp-sdk) — 의존성 없는 한 파일. 게임 쪽에서 복사해 쓸 수 있게 외부 import 가 없다.
 * 계약: docs/platform/GAME_RESULT_CONTRACT.md
 *
 * - 게임천국이 PLAY 때 `?gp=<세션ID>` 와 함께 게임을 열고, 같은 출처 localStorage 에 세션 레코드를 만들어 둔다.
 * - 주소에 gp 가 있고, 세션이 실제로 있고(만료 전, gameId 일치)할 때만 활성(주소의 gp 만 신뢰 — 탭 기억 없음). 아니면 모든 메서드가 아무 일도 하지 않는다(no-op).
 * - 게임은 `gp.v1.inbox.<resultId>` 새 키만 쓴다. 게임천국의 플레이어 데이터(`gp.v1.player`)와 게임 자체 저장 키는 건드리지 않는다.
 * - runEnd 는 한 판(run)당 1번만 동작한다.
 */
export const GP_SDK_VERSION = 'gp-sdk/0.1';

interface Store {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}
interface SessionRec {
  sessionId: string;
  gameId: string;
  playerId: string;
  startedAt: string;
  expiresAt: string;
  returnUrl: string;
  version: number;
}
export interface RunEnd {
  outcome: 'cleared' | 'failed';
  score: number;
  stage?: number;
  stageLabel?: string;
  subGameId?: string;
  extra?: Record<string, number | string | boolean>;
  /** 지정하지 않으면 runStart~runEnd 에서 일시정지를 뺀 시간 */
  durationMs?: number;
}
export interface GPOptions {
  storage?: Store | null;
  /** 주소의 쿼리 문자열(기본 location.search) */
  search?: string;
  now?: () => number;
  uuid?: () => string;
  gameVersion?: string;
  /** (호환용, 사용 안 함) */
  session?: Store | null;
}

const SESSION_PREFIX = 'gp.v1.session.';
const INBOX_PREFIX = 'gp.v1.inbox.';
const MAX_PENDING = 20;

function defaultUuid(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  const h = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
  return `${h()}${h()}-${h()}-${h()}-${h()}-${h()}${h()}${h()}`;
}
function safeStore(kind: 'localStorage' | 'sessionStorage'): Store | null {
  try {
    const s = (globalThis as unknown as Record<string, Store>)[kind];
    return s ?? null;
  } catch {
    return null;
  }
}

export function createGP(opts: GPOptions = {}) {
  const store = opts.storage === undefined ? safeStore('localStorage') : opts.storage;
  const now = opts.now ?? (() => Date.now());
  const uuid = opts.uuid ?? defaultUuid;
  const version = opts.gameVersion ?? '1.0.0';
  let session: SessionRec | null = null;
  let gameId = '';
  let runStartAt = 0;
  let pausedAt = 0;
  let pausedTotal = 0;
  let running = false;
  const pending: { key: string; text: string }[] = [];

  function readSession(sid: string): SessionRec | null {
    try {
      const raw = store?.getItem(SESSION_PREFIX + sid);
      if (!raw) return null;
      const s = JSON.parse(raw) as SessionRec;
      return s && s.version === 1 && s.sessionId === sid ? s : null;
    } catch {
      return null;
    }
  }
  function flush(): void {
    for (let i = pending.length - 1; i >= 0; i--) {
      try {
        store?.setItem(pending[i].key, pending[i].text);
        pending.splice(i, 1);
      } catch {
        /* 다음 기회에 재시도 */
      }
    }
  }

  const api = {
    /** 세션 검증. 활성이면 true */
    init(id: string): boolean {
      gameId = id;
      session = null;
      try {
        const search = opts.search ?? (typeof location !== 'undefined' ? location.search : '');
        const sid = new URLSearchParams(search).get('gp');
        if (!sid || !/^[\w-]{8,64}$/.test(sid)) return false;
        const s = readSession(sid);
        if (!s || s.gameId !== id || Date.parse(s.expiresAt) < now()) return false;
        session = s;
        if (typeof document !== 'undefined') {
          document.addEventListener('visibilitychange', () => document.visibilityState !== 'visible' || flush());
          window.addEventListener('pagehide', flush);
        }
        return true;
      } catch {
        return false;
      }
    },
    get active(): boolean {
      return session !== null;
    },
    runStart(): void {
      if (!session) return;
      runStartAt = now();
      pausedAt = 0;
      pausedTotal = 0;
      running = true;
    },
    runPause(): void {
      if (running && !pausedAt) pausedAt = now();
    },
    runResume(): void {
      if (running && pausedAt) {
        pausedTotal += now() - pausedAt;
        pausedAt = 0;
      }
    },
    /** 한 판 종료. 반환: 결과를 기록했는지 */
    runEnd(r: RunEnd): boolean {
      if (!session) return false;
      const end = now();
      let dur = r.durationMs;
      let start: number;
      if (dur === undefined) {
        if (!running) return false; // runStart 없이 끝난 판은 기록하지 않음(중복 이벤트 방지)
        if (pausedAt) pausedTotal += end - pausedAt;
        dur = Math.max(0, end - runStartAt - pausedTotal);
        start = runStartAt;
      } else {
        dur = Math.max(0, Math.round(dur));
        start = end - dur;
      }
      running = false; // 같은 run 의 중복 runEnd 차단
      if (!Number.isFinite(r.score) || r.score < 0) return false;
      const resultId = uuid();
      const result: Record<string, unknown> = {
        resultId,
        sessionId: session.sessionId,
        gameId,
        gameVersion: version,
        scoreSchemaVersion: 1,
        outcome: r.outcome,
        score: Math.floor(r.score),
        startedAt: new Date(Math.max(start, Date.parse(session.startedAt))).toISOString(),
        endedAt: new Date(end).toISOString(),
        durationMs: Math.min(dur, end - Math.max(start, Date.parse(session.startedAt)) + 1000),
      };
      if (r.subGameId) result.subGameId = r.subGameId;
      if (r.stage !== undefined) result.stage = Math.max(0, Math.floor(r.stage));
      if (r.stageLabel) result.stageLabel = r.stageLabel.slice(0, 40);
      if (r.extra) result.extra = r.extra;
      const text = JSON.stringify({ kind: 'gp-result', v: 1, sdk: GP_SDK_VERSION, result });
      const key = INBOX_PREFIX + resultId;
      try {
        store?.setItem(key, text);
      } catch {
        pending.push({ key, text });
        if (pending.length > MAX_PENDING) pending.shift();
      }
      return true;
    },
    /** 한 번에 끝나는 판(시작 이벤트 없이 결과만 알 때): durationMs 필수 */
    report(r: RunEnd & { durationMs: number }): boolean {
      return api.runEnd(r);
    },
    /** 게임천국으로 돌아가는 주소(세션에 저장된 값만 사용). 비활성이면 null */
    returnUrl(): string | null {
      return session?.returnUrl ?? null;
    },
    /** 테스트용: 저장 실패로 보류 중인 결과 수 */
    pendingCount(): number {
      return pending.length;
    },
    retry: flush,
  };
  return api;
}
export type GPClient = ReturnType<typeof createGP>;
