/**
 * 온라인 랭킹 서버의 **모의 구현**(메모리) — API 계약(docs/platform/backend/API_CONTRACT.md)의 기준 구현이자 연결 테스트용 환경.
 * 실제 서버·계정·DB 와 무관하며 앱 번들에는 포함되지 않는다(테스트에서만 import).
 */
import { BALANCE } from '../platform/balance';
import { getGame, scoreLimit } from '../platform/games';
import { kstWeekId } from '../platform/kst';

export interface MockEntry { playerId: string; nickname: string; publicCode: string; avatarId: string; titleId?: string; score: number; at: number; weekId: string; gameId: string; flagged: boolean }
interface Player { playerId: string; tokenHash: string; nickname: string; publicCode: string; avatarId: string; titleId?: string }
interface Sess { sid: string; playerId: string; gameId: string; startedAt: number; subs: number }

const hash = (s: string): string => { let h = 5381; for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i); return String(h >>> 0); };

export class MockRankingServer {
  players = new Map<string, Player>();
  sessions = new Map<string, Sess>();
  results = new Map<string, { body: string; response: unknown }>();
  entries: MockEntry[] = []; // 제출 기록(최고 계산용)
  calls: Record<string, number[]> = {};
  seq = 0;
  constructor(public now: () => number = Date.now, public opts = { ratePerMinute: 10, minParticipants: 20, shrinkM: 20 }) {}
  private id(p: string): string { this.seq += 1; return `${p}-${String(this.seq).padStart(8, '0')}`; }

  private auth(req: Request): Player | null {
    const t = req.headers.get('authorization')?.replace(/^Bearer /, '');
    if (!t) return null;
    return [...this.players.values()].find((p) => p.tokenHash === hash(t)) ?? null;
  }
  private limited(p: Player): boolean {
    const m = Math.floor(this.now() / 60000);
    const arr = (this.calls[p.playerId] ??= []).filter((x) => x === m);
    arr.push(m);
    this.calls[p.playerId] = arr;
    return arr.length > this.opts.ratePerMinute;
  }
  private best(gameId: string, weekId?: string): MockEntry[] {
    const by = new Map<string, MockEntry>();
    for (const e of this.entries) {
      if (e.gameId !== gameId || e.flagged || (weekId && e.weekId !== weekId)) continue;
      const cur = by.get(e.playerId);
      if (!cur || e.score > cur.score || (e.score === cur.score && e.at < cur.at)) by.set(e.playerId, e); // 동점은 먼저 달성한 기록 우선
    }
    return [...by.values()].sort((a, b) => b.score - a.score || a.at - b.at);
  }
  /** 종합: 게임별 백분위 + 수축, 참가자 미달 게임 제외, 2개 이상 게임 참여 필요 */
  overall(period: 'weekly' | 'all', weekId: string, gameIds?: string[]): { playerId: string; nickname: string; score: number; games: number }[] {
    const live = gameIds ?? ['food-island', 'sky-battle', 'minigame-paradise'].filter((id) => getGame(id)?.status === 'live');
    const per = new Map<string, { sum: number; w: number; games: number }>();
    for (const g of live) {
      const list = this.best(g, period === 'weekly' ? weekId : undefined);
      const N = list.length;
      if (N < this.opts.minParticipants) continue;
      const w = getGame(g)!.rules.weight;
      list.forEach((e, i) => {
        const p = 1 - i / N;
        const shrunk = p * (N / (N + this.opts.shrinkM));
        const a = per.get(e.playerId) ?? { sum: 0, w: 0, games: 0 };
        a.sum += shrunk * w; a.w += w; a.games += 1;
        per.set(e.playerId, a);
      });
    }
    return [...per.entries()].filter(([, a]) => a.games >= 2).map(([pid, a]) => ({ playerId: pid, nickname: this.players.get(pid)?.nickname ?? '', score: Math.round((a.sum / a.w) * 1000), games: a.games })).sort((x, y) => y.score - x.score);
  }

  async handle(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const j = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    const path = url.pathname;
    if (req.method === 'POST' && path === '/v1/players') {
      const b = (await req.json()) as { nickname?: string; avatarId?: string };
      if (!b.nickname || !/^[가-힣A-Za-z0-9]{2,10}$/.test(b.nickname)) return j(422, { error: 'nickname' });
      const token = `tok-${this.id('t')}-${Math.floor(this.now()).toString(36)}`;
      const p: Player = { playerId: this.id('pl'), tokenHash: hash(token), nickname: b.nickname, publicCode: `K${String(this.seq).padStart(3, '0')}`.slice(0, 4), avatarId: b.avatarId ?? 'gona' };
      this.players.set(p.playerId, p);
      return j(201, { playerId: p.playerId, publicCode: p.publicCode, token });
    }
    const me = this.auth(req);
    if (req.method === 'POST' && path === '/v1/sessions') {
      if (!me) return j(401, { error: 'token' });
      const b = (await req.json()) as { gameId?: string };
      if (!b.gameId || !getGame(b.gameId)) return j(422, { error: 'unknown-game' });
      const s: Sess = { sid: this.id('sess'), playerId: me.playerId, gameId: b.gameId, startedAt: this.now(), subs: 0 };
      this.sessions.set(s.sid, s);
      return j(201, { sessionId: s.sid, startedAt: new Date(s.startedAt).toISOString() });
    }
    const fin = path.match(/^\/v1\/sessions\/([\w-]+)\/finish$/);
    if (req.method === 'POST' && fin) {
      if (!me) return j(401, { error: 'token' });
      if (this.limited(me)) return j(429, { error: 'rate-limit' });
      const s = this.sessions.get(fin[1]);
      if (!s) return j(422, { error: 'session' });
      if (s.playerId !== me.playerId) return j(403, { error: 'owner' });
      const text = await req.text();
      const b = JSON.parse(text) as { resultId: string; score: number; stage?: number; outcome: string; durationMs: number; subGameId?: string; gameVersion?: string };
      const prev = this.results.get(b.resultId);
      if (prev) return prev.body === text ? j(200, prev.response) : j(409, { error: 'result-conflict' }); // 멱등
      const g = getGame(s.gameId)!;
      const elapsed = this.now() - s.startedAt;
      if (s.subs >= BALANCE.caps.perSessionRewardedRuns * 4) return j(429, { error: 'session-cap' });
      let flagged = false;
      let reason = '';
      if (!Number.isInteger(b.score) || b.score < 0) return j(422, { error: 'score' });
      if (b.durationMs > elapsed + 2000) return j(422, { error: 'duration' }); // 서버가 잰 시간보다 긴 플레이 시간 주장
      if (b.score > scoreLimit(g, Math.min(b.durationMs, elapsed) / 1000)) { flagged = true; reason = 'implausible-score'; }
      s.subs += 1;
      const weekId = kstWeekId(this.now());
      this.entries.push({ playerId: me.playerId, nickname: me.nickname, publicCode: me.publicCode, avatarId: me.avatarId, titleId: me.titleId, score: b.score, at: this.now(), weekId, gameId: s.gameId, flagged });
      const all = this.best(s.gameId);
      const wk = this.best(s.gameId, weekId);
      const resp = { accepted: true, flagged, reason: flagged ? undefined : reason || undefined, bestAll: all.find((e) => e.playerId === me.playerId)?.score ?? 0, bestWeek: wk.find((e) => e.playerId === me.playerId)?.score ?? 0, rankAll: flagged ? undefined : all.findIndex((e) => e.playerId === me.playerId) + 1, rankWeek: flagged ? undefined : wk.findIndex((e) => e.playerId === me.playerId) + 1, weekId };
      this.results.set(b.resultId, { body: text, response: resp });
      return j(200, resp);
    }
    if (req.method === 'GET' && path === '/v1/rankings') {
      const gameId = url.searchParams.get('gameId') ?? '';
      if (!getGame(gameId)) return j(422, { error: 'unknown-game' });
      const period = url.searchParams.get('period') === 'all' ? 'all' : 'weekly';
      const weekId = url.searchParams.get('weekId') ?? kstWeekId(this.now());
      const list = this.best(gameId, period === 'weekly' ? weekId : undefined);
      const limit = Math.min(100, Number(url.searchParams.get('limit') ?? 50));
      const toRow = (e: MockEntry, i: number) => ({ rank: i + 1, playerId: e.playerId, nickname: e.nickname, publicCode: e.publicCode, avatarId: e.avatarId, titleId: e.titleId, score: e.score, achievedAt: new Date(e.at).toISOString() });
      const mine = me ? list.findIndex((e) => e.playerId === me.playerId) : -1;
      return j(200, { status: 'ok', entries: list.slice(0, limit).map(toRow), me: mine >= 0 ? toRow(list[mine], mine) : undefined, updatedAt: new Date(this.now()).toISOString() });
    }
    if (req.method === 'GET' && path === '/v1/rankings/overall') {
      const period = url.searchParams.get('period') === 'all' ? 'all' : 'weekly';
      const o = this.overall(period, kstWeekId(this.now()));
      return j(200, { status: 'ok', entries: o.map((e, i) => ({ rank: i + 1, ...e })), updatedAt: new Date(this.now()).toISOString() });
    }
    return j(404, { error: 'not-found' });
  }
}
