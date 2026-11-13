import type { RankingEntry, RankingProvider, RankingQuery, RankingResult } from './ranking';

/** 온라인 랭킹 조회 어댑터 (API 계약 구현). fetch 를 주입받아 로컬 서버/모의 환경으로 테스트한다. 어떤 오류도 로컬 기록에는 영향을 주지 않는다. */
export class HttpRankingProvider implements RankingProvider {
  readonly connected = true;
  constructor(private baseUrl: string, private token: string | null, private fetchImpl: typeof fetch = (...a) => fetch(...a), private timeoutMs = 6000) {}

  async getRanking(q: RankingQuery): Promise<RankingResult> {
    try {
      const u = new URL(q.gameId === 'overall' ? '/v1/rankings/overall' : '/v1/rankings', this.baseUrl);
      if (q.gameId !== 'overall') u.searchParams.set('gameId', q.gameId);
      if (q.subGameId) u.searchParams.set('subGameId', q.subGameId);
      u.searchParams.set('period', q.period === 'weekly' ? 'weekly' : 'all');
      u.searchParams.set('limit', String(q.limit ?? 50));
      const res = await this.fetchImpl(u.toString(), { headers: this.token ? { authorization: `Bearer ${this.token}` } : {}, signal: AbortSignal.timeout(this.timeoutMs) });
      if (res.status === 503 || res.status === 429) return { status: 'unavailable' };
      if (!res.ok) return { status: 'error', message: `HTTP ${res.status}` };
      const b = (await res.json()) as { entries?: RankingEntry[]; me?: RankingEntry; updatedAt?: string; total?: number; weekEndsAt?: string; weekId?: string; gamesUsed?: string[] };
      if (!Array.isArray(b.entries)) return { status: 'error', message: '응답 형식 오류' };
      return { status: 'ok', entries: b.entries, me: b.me, updatedAt: b.updatedAt ?? new Date().toISOString(), total: b.total, weekEndsAt: b.weekEndsAt, weekId: b.weekId, gamesUsed: b.gamesUsed };
    } catch (e) {
      return { status: 'error', message: e instanceof Error ? e.message : '네트워크 오류' };
    }
  }
}
