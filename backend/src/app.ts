import { AVATAR_IDS, SERVER_GAMES, getServerGame, scoreLimit } from './games.ts';
import type { D1Like, Env } from './types.ts';
import { json, kstWeekEnd, kstWeekId, publicCode, randomToken, sha256hex, uuid } from './util.ts';

const NICK_RE = /^[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9]{2,10}$/u;
const BANNED = ['씨발', '시발', '병신', '지랄', '개새끼', '좆', '섹스', '자살', 'fuck', 'shit', 'bitch', 'sex'];
const RESERVED = ['운영자', '관리자', '관리인', 'admin', 'system', 'gm'];
const ID_RE = /^[\w-]{8,64}$/;
const SESSION_MS = 12 * 3600 * 1000;
const MAX_SUBMISSIONS_PER_SESSION = 40;

class HttpError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message ?? code);
  }
}
const bad = (status: number, code: string, message?: string): never => {
  throw new HttpError(status, code, message);
};

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const num = (v: unknown): number => Number(v ?? 0);

interface Player { player_id: string; nickname: string; public_code: string; avatar_id: string; title_id: string | null; flagged: number }

export function createApp(env: Env): (req: Request) => Promise<Response> {
  const db: D1Like = env.DB;
  const now = (): number => (env.NOW ? env.NOW() : Date.now());
  const allowTest = env.ALLOW_TEST_GAMES === '1';
  const minParticipants = Number(env.MIN_PARTICIPANTS ?? 20);

  const cors = (req: Request): Record<string, string> => {
    const origin = req.headers.get('origin');
    const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!origin || !(allowed.includes('*') || allowed.includes(origin))) return {};
    return { 'access-control-allow-origin': allowed.includes('*') ? '*' : origin, 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS', 'access-control-max-age': '600', vary: 'origin' };
  };

  /** 고정 윈도우 요청 제한. 초과하면 429 */
  async function limit(bucket: string, max: number, windowMs: number): Promise<void> {
    const w = Math.floor(now() / windowMs);
    const r = await db.prepare('INSERT INTO rate_limits (bucket, window, n) VALUES (?, ?, 1) ON CONFLICT(bucket, window) DO UPDATE SET n = n + 1 RETURNING n').bind(bucket, w).first<Row>();
    if (num(r?.n) > max) bad(429, 'rate-limit', '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.');
    if (Math.random() < 0.02) await db.prepare('DELETE FROM rate_limits WHERE window < ?').bind(w - 100).run(); // 오래된 윈도우 정리
  }

  async function auth(req: Request, required = true): Promise<Player | null> {
    const t = req.headers.get('authorization')?.match(/^Bearer ([\w-]{20,100})$/)?.[1];
    if (!t) return required ? bad(401, 'token', '인증이 필요해요.') : null;
    const hash = await sha256hex(`${t}:${env.TOKEN_PEPPER}`);
    const p = await db.prepare('SELECT player_id, nickname, public_code, avatar_id, title_id, flagged FROM players WHERE token_hash = ?').bind(hash).first<Player>();
    if (!p) return required ? bad(401, 'token', '인증 정보가 올바르지 않아요.') : null;
    return p;
  }

  const checkNick = (n: unknown): string => {
    if (typeof n !== 'string') return bad(422, 'nickname');
    const s = n.normalize('NFC');
    if (!NICK_RE.test(s)) return bad(422, 'nickname');
    const low = s.toLowerCase();
    if (BANNED.some((w) => low.includes(w)) || RESERVED.includes(low)) return bad(422, 'nickname');
    return s;
  };
  const checkAvatar = (a: unknown): string => (typeof a === 'string' && AVATAR_IDS.includes(a) ? a : bad(422, 'avatar'));
  const body = async (req: Request): Promise<Row> => {
    const len = Number(req.headers.get('content-length') ?? 0);
    if (len > 4096) bad(413, 'too-large');
    const text = await req.text();
    if (text.length > 4096) bad(413, 'too-large');
    try {
      const o = JSON.parse(text);
      return typeof o === 'object' && o !== null && !Array.isArray(o) ? o : bad(400, 'json');
    } catch {
      return bad(400, 'json');
    }
  };

  // ───────── 랭킹 조회 ─────────
  const where = (period: 'weekly' | 'all'): { table: string; extra: string } => (period === 'weekly' ? { table: 'best_week', extra: ' AND b.week_id = ?' } : { table: 'best_all', extra: '' });
  const params = (gameId: string, sub: string, period: 'weekly' | 'all', weekId: string): unknown[] => (period === 'weekly' ? [gameId, sub, weekId] : [gameId, sub]);

  async function rankOf(gameId: string, sub: string, period: 'weekly' | 'all', weekId: string, score: number, at: number): Promise<number> {
    const { table, extra } = where(period);
    const r = await db
      .prepare(`SELECT COUNT(*) c FROM ${table} b JOIN players p ON p.player_id = b.player_id WHERE b.game_id = ? AND b.sub_game_id = ?${extra} AND p.flagged = 0 AND (b.score > ? OR (b.score = ? AND b.achieved_at < ?))`)
      .bind(...params(gameId, sub, period, weekId), score, score, at)
      .first<Row>();
    return num(r?.c) + 1;
  }
  const entryOf = (r: Row, rank: number) => ({ rank, playerId: r.player_id as string, nickname: r.nickname as string, publicCode: r.public_code as string, avatarId: r.avatar_id as string, titleId: (r.title_id as string | null) ?? undefined, score: num(r.score), achievedAt: new Date(num(r.achieved_at)).toISOString() });

  async function rankings(url: URL, me: Player | null): Promise<Response> {
    const gameId = url.searchParams.get('gameId') ?? '';
    if (!getServerGame(gameId, allowTest)) bad(422, 'unknown-game');
    const sub = url.searchParams.get('subGameId') ?? '';
    if (sub && !/^[\w-]{1,40}$/.test(sub)) bad(422, 'sub-game');
    const period = url.searchParams.get('period') === 'all' ? 'all' : 'weekly';
    const t = now();
    const weekId = kstWeekId(t);
    const lim = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') ?? 50) || 50));
    const { table, extra } = where(period);
    const rows = await db
      .prepare(`SELECT b.player_id, b.score, b.achieved_at, p.nickname, p.public_code, p.avatar_id, p.title_id FROM ${table} b JOIN players p ON p.player_id = b.player_id WHERE b.game_id = ? AND b.sub_game_id = ?${extra} AND p.flagged = 0 ORDER BY b.score DESC, b.achieved_at ASC LIMIT ?`)
      .bind(...params(gameId, sub, period, weekId), lim)
      .all<Row>();
    const total = await db.prepare(`SELECT COUNT(*) c FROM ${table} b JOIN players p ON p.player_id = b.player_id WHERE b.game_id = ? AND b.sub_game_id = ?${extra} AND p.flagged = 0`).bind(...params(gameId, sub, period, weekId)).first<Row>();
    const entries = rows.results.map((r, i) => entryOf(r, i + 1)); // 동점은 먼저 달성한 기록이 위(순위는 1,2,3… 연속)
    let mine: ReturnType<typeof entryOf> | undefined;
    if (me && !me.flagged) {
      const r = await db.prepare(`SELECT b.player_id, b.score, b.achieved_at, p.nickname, p.public_code, p.avatar_id, p.title_id FROM ${table} b JOIN players p ON p.player_id = b.player_id WHERE b.player_id = ? AND b.game_id = ? AND b.sub_game_id = ?${extra}`).bind(me.player_id, ...params(gameId, sub, period, weekId)).first<Row>();
      if (r) mine = entryOf(r, await rankOf(gameId, sub, period, weekId, num(r.score), num(r.achieved_at)));
    }
    return json(200, { status: 'ok', gameId, subGameId: sub || undefined, period, weekId: period === 'weekly' ? weekId : undefined, weekEndsAt: period === 'weekly' ? new Date(kstWeekEnd(t)).toISOString() : undefined, total: num(total?.c), entries, me: mine, updatedAt: new Date(t).toISOString() });
  }

  /** 종합: 게임별 순위 → 백분위 p=1−(r−1)/N → 수축 p·N/(N+m) → 가중 평균. 참가자 부족 게임 제외, 2개 이상 게임 참여자만 */
  async function overall(url: URL, me: Player | null): Promise<Response> {
    const period = url.searchParams.get('period') === 'all' ? 'all' : 'weekly';
    const weekId = kstWeekId(now());
    const { table, extra } = where(period);
    const per = new Map<string, { sum: number; w: number; games: number }>();
    const used: string[] = [];
    for (const g of SERVER_GAMES.filter((x) => x.live || allowTest)) {
      const rows = await db.prepare(`SELECT b.player_id FROM ${table} b JOIN players p ON p.player_id = b.player_id WHERE b.game_id = ? AND b.sub_game_id = ''${extra.replace('?', '?')} AND p.flagged = 0 ORDER BY b.score DESC, b.achieved_at ASC LIMIT 5000`).bind(...(period === 'weekly' ? [g.gameId, weekId] : [g.gameId])).all<Row>();
      const N = rows.results.length;
      if (N < minParticipants) continue;
      used.push(g.gameId);
      rows.results.forEach((r, i) => {
        const p = (1 - i / N) * (N / (N + 20));
        const a = per.get(r.player_id as string) ?? { sum: 0, w: 0, games: 0 };
        a.sum += p * g.weight;
        a.w += g.weight;
        a.games += 1;
        per.set(r.player_id as string, a);
      });
    }
    const ranked = [...per.entries()].filter(([, a]) => a.games >= 2).map(([pid, a]) => ({ pid, score: Math.round((a.sum / a.w) * 1000), games: a.games })).sort((x, y) => y.score - x.score || (x.pid < y.pid ? -1 : 1));
    const top = ranked.slice(0, 50);
    const info = async (pid: string) => db.prepare('SELECT player_id, nickname, public_code, avatar_id, title_id FROM players WHERE player_id = ?').bind(pid).first<Row>();
    const entries = [];
    for (const [i, r] of top.entries()) {
      const p = await info(r.pid);
      if (p) entries.push({ rank: i + 1, playerId: r.pid, nickname: p.nickname, publicCode: p.public_code, avatarId: p.avatar_id, score: r.score, games: r.games });
    }
    const mi = me ? ranked.findIndex((x) => x.pid === me.player_id) : -1;
    return json(200, { status: 'ok', period, weekId: period === 'weekly' ? weekId : undefined, gamesUsed: used, minParticipants, total: ranked.length, entries, me: mi >= 0 ? { rank: mi + 1, score: ranked[mi].score, games: ranked[mi].games } : undefined, updatedAt: new Date(now()).toISOString() });
  }

  // ───────── 점수 제출 ─────────
  async function finish(req: Request, sid: string, me: Player): Promise<Response> {
    if (!ID_RE.test(sid)) bad(422, 'session');
    await limit(`finish:${me.player_id}`, 12, 60_000);
    const b = await body(req);
    const s = await db.prepare('SELECT session_id, player_id, game_id, started_at, expires_at, submissions FROM sessions WHERE session_id = ?').bind(sid).first<Row>();
    if (!s) return bad(422, 'session', '세션을 찾을 수 없어요.');
    if (s.player_id !== me.player_id) return bad(403, 'owner');
    const game = getServerGame(s.game_id as string, allowTest);
    if (!game) return bad(422, 'unknown-game');
    const t = now();
    if (t > num(s.expires_at)) bad(422, 'expired', '세션이 만료됐어요.');
    if (num(s.submissions) >= MAX_SUBMISSIONS_PER_SESSION) bad(429, 'session-cap');

    const resultId = b.resultId;
    if (typeof resultId !== 'string' || !ID_RE.test(resultId)) return bad(422, 'resultId');
    if (b.outcome !== 'cleared' && b.outcome !== 'failed') return bad(422, 'outcome');
    if (b.outcome === 'cleared' && !game.hasClear) return bad(422, 'outcome');
    const score = b.score;
    if (typeof score !== 'number' || !Number.isInteger(score) || score < 0) return bad(422, 'score');
    const dur = b.durationMs;
    if (typeof dur !== 'number' || !Number.isFinite(dur) || dur < 0) return bad(422, 'duration');
    if (b.scoreSchemaVersion !== game.scoreSchemaVersion) return bad(422, 'schema');
    if (typeof b.gameVersion !== 'string' || b.gameVersion.length > 30) return bad(422, 'version');
    const sub = b.subGameId === undefined ? '' : typeof b.subGameId === 'string' && /^[\w-]{1,40}$/.test(b.subGameId) ? b.subGameId : bad(422, 'sub-game');
    let stage: number | null = null;
    if (b.stage !== undefined) {
      if (typeof b.stage !== 'number' || !Number.isInteger(b.stage) || b.stage < 0 || b.stage > (game.stageCount ?? 99)) return bad(422, 'stage');
      stage = b.stage;
    }

    // 멱등: 같은 resultId 는 같은 내용이면 같은 응답, 다르면 409
    const prev = await db.prepare('SELECT * FROM scores WHERE result_id = ?').bind(resultId).first<Row>();
    const respond = async (flagged: boolean, reason: string | undefined, dup: boolean): Promise<Response> => {
      const weekId = kstWeekId(t);
      const all = flagged ? null : await db.prepare("SELECT score, achieved_at FROM best_all WHERE player_id = ? AND game_id = ? AND sub_game_id = ?").bind(me.player_id, game.gameId, sub).first<Row>();
      const wk = flagged ? null : await db.prepare("SELECT score, achieved_at FROM best_week WHERE player_id = ? AND game_id = ? AND sub_game_id = ? AND week_id = ?").bind(me.player_id, game.gameId, sub, weekId).first<Row>();
      return json(200, {
        accepted: true, duplicate: dup || undefined, flagged, reason: flagged ? undefined : reason, // 의심 사유는 사용자에게 알리지 않음
        bestAll: num(all?.score), bestWeek: num(wk?.score), weekId,
        rankAll: all ? await rankOf(game.gameId, sub, 'all', weekId, num(all.score), num(all.achieved_at)) : undefined,
        rankWeek: wk ? await rankOf(game.gameId, sub, 'weekly', weekId, num(wk.score), num(wk.achieved_at)) : undefined,
      });
    };
    if (prev) {
      if (prev.session_id === sid && num(prev.score) === score && prev.outcome === b.outcome && prev.sub_game_id === sub) return respond(num(prev.flagged) === 1, undefined, true);
      return bad(409, 'result-conflict');
    }

    // 서버가 잰 시간 기준 검증
    const elapsed = t - num(s.started_at);
    if (dur > elapsed + 3000) bad(422, 'duration', '플레이 시간이 서버가 잰 시간보다 길어요.');
    let flagged = false;
    let reason: string | undefined;
    if (score > scoreLimit(game, Math.min(dur, elapsed) / 1000)) {
      flagged = true;
      reason = 'implausible-score';
    }
    const weekId = kstWeekId(t);
    const stmts = [
      db.prepare('INSERT INTO scores (result_id, session_id, player_id, game_id, sub_game_id, score, stage, outcome, duration_ms, server_elapsed_ms, week_id, achieved_at, game_version, score_schema, flagged, reason) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(resultId, sid, me.player_id, game.gameId, sub, score, stage, b.outcome, Math.round(dur), elapsed, weekId, t, b.gameVersion, game.scoreSchemaVersion, flagged ? 1 : 0, reason ?? null),
      db.prepare('UPDATE sessions SET submissions = submissions + 1 WHERE session_id = ?').bind(sid),
    ];
    if (!flagged) {
      const subs = sub ? ['', sub] : [''];
      for (const sg of subs) {
        stmts.push(db.prepare('INSERT INTO best_all (player_id, game_id, sub_game_id, score, achieved_at) VALUES (?,?,?,?,?) ON CONFLICT(player_id, game_id, sub_game_id) DO UPDATE SET score = excluded.score, achieved_at = excluded.achieved_at WHERE excluded.score > best_all.score').bind(me.player_id, game.gameId, sg, score, t));
        stmts.push(db.prepare('INSERT INTO best_week (player_id, game_id, sub_game_id, week_id, score, achieved_at) VALUES (?,?,?,?,?,?) ON CONFLICT(player_id, game_id, sub_game_id, week_id) DO UPDATE SET score = excluded.score, achieved_at = excluded.achieved_at WHERE excluded.score > best_week.score').bind(me.player_id, game.gameId, sg, weekId, score, t));
      }
    }
    try {
      await db.batch(stmts);
    } catch {
      // 동시 요청으로 같은 resultId 가 먼저 들어간 경우 → 멱등 응답
      const again = await db.prepare('SELECT * FROM scores WHERE result_id = ?').bind(resultId).first<Row>();
      if (again && again.session_id === sid) return respond(num(again.flagged) === 1, undefined, true);
      throw new HttpError(500, 'internal');
    }
    return respond(flagged, reason, false);
  }

  // ───────── 라우팅 ─────────
  async function route(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const p = url.pathname.replace(/\/+$/, '') || '/';
    if (req.method === 'GET' && p === '/v1/health') return json(200, { ok: true, time: new Date(now()).toISOString() });

    if (req.method === 'POST' && p === '/v1/players') {
      const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for') ?? 'local';
      await limit(`reg:${await sha256hex(ip)}`, 20, 3600_000);
      const b = await body(req);
      const nickname = checkNick(b.nickname);
      const avatarId = checkAvatar(b.avatarId ?? 'gona');
      const token = randomToken(32);
      const tokenHash = await sha256hex(`${token}:${env.TOKEN_PEPPER}`);
      const playerId = uuid();
      const code = publicCode();
      const t = now();
      await db.prepare('INSERT INTO players (player_id, token_hash, nickname, public_code, avatar_id, created_at, last_seen) VALUES (?,?,?,?,?,?,?)').bind(playerId, tokenHash, nickname, code, avatarId, t, t).run();
      return json(201, { playerId, publicCode: code, token }); // 토큰은 이 응답에서만 한 번 전달 — 서버에는 해시만 남음
    }

    const me = await auth(req, false);
    if (req.method === 'GET' && p === '/v1/rankings') return rankings(url, me);
    if (req.method === 'GET' && p === '/v1/rankings/overall') return overall(url, me);
    if (!me) return bad(401, 'token', '인증이 필요해요.');

    if (req.method === 'PATCH' && p === '/v1/players/me') {
      await limit(`patch:${me.player_id}`, 20, 60_000);
      const b = await body(req);
      const nickname = b.nickname === undefined ? me.nickname : checkNick(b.nickname);
      const avatarId = b.avatarId === undefined ? me.avatar_id : checkAvatar(b.avatarId);
      const titleId = b.titleId === undefined ? me.title_id : typeof b.titleId === 'string' && /^[\w-]{1,30}$/.test(b.titleId) ? b.titleId : bad(422, 'title');
      await db.prepare('UPDATE players SET nickname = ?, avatar_id = ?, title_id = ?, last_seen = ? WHERE player_id = ?').bind(nickname, avatarId, titleId, now(), me.player_id).run();
      return json(200, { ok: true, playerId: me.player_id, publicCode: me.public_code });
    }
    if (req.method === 'GET' && p === '/v1/players/me') return json(200, { playerId: me.player_id, nickname: me.nickname, publicCode: me.public_code, avatarId: me.avatar_id, titleId: me.title_id });

    if (req.method === 'POST' && p === '/v1/sessions') {
      await limit(`sess:${me.player_id}`, 30, 60_000);
      const b = await body(req);
      const game = typeof b.gameId === 'string' ? getServerGame(b.gameId, allowTest) : undefined;
      if (!game) return bad(422, 'unknown-game');
      const sid = uuid();
      const t = now();
      await db.prepare('INSERT INTO sessions (session_id, player_id, game_id, started_at, expires_at) VALUES (?,?,?,?,?)').bind(sid, me.player_id, game.gameId, t, t + SESSION_MS).run();
      return json(201, { sessionId: sid, startedAt: new Date(t).toISOString(), expiresAt: new Date(t + SESSION_MS).toISOString() });
    }
    const fin = p.match(/^\/v1\/sessions\/([^/]+)\/finish$/);
    if (req.method === 'POST' && fin) return finish(req, fin[1], me);
    return bad(404, 'not-found');
  }

  return async (req: Request): Promise<Response> => {
    const c = cors(req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: c });
    try {
      const res = await route(req);
      for (const [k, v] of Object.entries(c)) res.headers.set(k, v);
      return res;
    } catch (e) {
      if (e instanceof HttpError) return json(e.status, { error: e.code, message: e.message }, c);
      console.error('internal error', e);
      return json(500, { error: 'internal', message: '서버에 문제가 생겼어요. 잠시 후 다시 시도해 주세요.' }, c);
    }
  };
}
