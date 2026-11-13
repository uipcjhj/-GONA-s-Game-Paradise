/**
 * 고나 게임천국 공통 게임 SDK (의존성 없는 ES 모듈 한 파일) — Sky Battle · Mini Game Land 등 새 게임이 그대로 복사해 쓴다.
 * 계약: docs/platform/GAME_RESULT_CONTRACT.md
 *
 *   import { initGame } from './gp-sdk.js';
 *   const gp = initGame({ gameId: 'sky-battle', gameVersion: '1.0.0' });   // 게임천국에서 ?gp=<세션> 으로 실행했을 때만 gp.active
 *   gp.runStart();                                  // 한 판 시작
 *   gp.runPause(); gp.runResume();                  // 일시정지(플레이 시간에서 제외)
 *   gp.runEnd({ outcome: 'cleared'|'failed', score, stage, stageLabel, extra }); // 한 판 끝 — 판당 1번만 기록
 *   gp.returnUrl                                    // '게임천국으로 돌아가기' 링크 주소(없으면 null)
 *
 * 비활성(주소에 gp 없음 / 세션 없음·만료·다른 게임 / 다른 출처 returnUrl)이면 아무 것도 기록하지 않는 no-op 이다.
 * 쓰는 곳은 `gp.v1.inbox.<resultId>` 새 키 하나뿐(결과 1판 = 키 1개). 게임의 기존 저장 키는 읽지도 쓰지도 않는다.
 * Mini Game Land 는 runStart({ subGameId }) 로 개별 미니게임을 구분한다.
 */
const SESSION_PREFIX = 'gp.v1.session.';
const INBOX_PREFIX = 'gp.v1.inbox.';

function readSession(storage, sid, gameId, now, origin) {
  if (!/^[\w-]{8,64}$/.test(sid)) return null;
  try {
    const raw = storage.getItem(SESSION_PREFIX + sid);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || s.version !== 1 || s.sessionId !== sid || s.gameId !== gameId) return null;
    if (Date.parse(s.expiresAt) < now) return null;
    if (new URL(s.returnUrl).origin !== origin) return null; // 같은 출처(게임천국)만
    return s;
  } catch {
    return null;
  }
}
const rnd = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`);

export function initGame(opts) {
  const noop = { active: false, returnUrl: null, runStart() {}, runPause() {}, runResume() {}, runEnd() {}, flush() {} };
  const storage = opts.storage !== undefined ? opts.storage : (() => { try { return window.localStorage; } catch { return null; } })();
  const search = opts.search ?? (typeof window !== 'undefined' ? window.location.search : '');
  const origin = opts.origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  const now = opts.now ?? Date.now;
  const uuid = opts.uuid ?? rnd;
  const sid = new URLSearchParams(search).get('gp');
  if (!sid || !storage) return noop;
  const session = readSession(storage, sid, opts.gameId, now(), origin);
  if (!session) return noop;

  let run = null;
  const pending = [];
  const flush = () => {
    for (let i = pending.length - 1; i >= 0; i--) {
      try { storage.setItem(pending[i][0], pending[i][1]); pending.splice(i, 1); } catch { /* 다음 기회에 재시도 */ }
    }
  };
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush());
    window.addEventListener('pagehide', flush);
  }
  return {
    active: true,
    returnUrl: session.returnUrl,
    runStart(info = {}) {
      run = { startedAt: now(), pausedMs: 0, pauseAt: null, done: false, subGameId: info.subGameId };
    },
    runPause() { if (run && run.pauseAt === null) run.pauseAt = now(); },
    runResume() { if (run && run.pauseAt !== null) { run.pausedMs += now() - run.pauseAt; run.pauseAt = null; } },
    /** 한 판 끝. 같은 판에서 여러 번 불러도 한 번만 기록된다. 점수는 0 이상 정수만 허용 */
    runEnd(r) {
      if (!run || run.done) return null;
      run.done = true;
      const end = now();
      const paused = run.pausedMs + (run.pauseAt !== null ? end - run.pauseAt : 0);
      const resultId = uuid();
      const result = {
        resultId, sessionId: session.sessionId, gameId: opts.gameId, ...(run.subGameId ? { subGameId: run.subGameId } : {}),
        gameVersion: opts.gameVersion || '1.0.0', scoreSchemaVersion: opts.scoreSchemaVersion || 1,
        outcome: r.outcome === 'cleared' ? 'cleared' : 'failed', score: Math.max(0, Math.floor(r.score)),
        ...(r.stage !== undefined ? { stage: r.stage } : {}), ...(r.stageLabel ? { stageLabel: r.stageLabel } : {}),
        startedAt: new Date(run.startedAt).toISOString(), endedAt: new Date(end).toISOString(), durationMs: Math.max(0, end - run.startedAt - paused),
        ...(r.extra ? { extra: r.extra } : {}),
      };
      pending.push([INBOX_PREFIX + resultId, JSON.stringify({ kind: 'gp-result', v: 1, sdk: 'gp-sdk/1', result })]);
      flush();
      return resultId;
    },
    flush,
  };
}
