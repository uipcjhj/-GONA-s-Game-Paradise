/**
 * Cloudflare Worker 골격 (초안) — 배포·계정·DB 생성 없음, 빌드 대상 아님(tsconfig 밖).
 * 로직의 기준 구현은 `src/services/rankingMock.ts`(테스트 통과) — 이 파일은 같은 흐름을 D1 에 옮기는 자리.
 */
interface Env { DB: unknown; TOKEN_PEPPER: string }

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    // 1) 인증: Authorization: Bearer <token> → sha256(token + env.TOKEN_PEPPER) 를 players.token_hash 와 비교
    // 2) 라우팅: POST /v1/players · POST /v1/sessions · POST /v1/sessions/:sid/finish · GET /v1/rankings · GET /v1/rankings/overall
    // 3) finish: 세션 소유자/경과 시간/점수 한도/속도 제한/멱등(result_id) 검증 → scores 삽입 → 최고 갱신 시에만 best_all/best_week upsert
    // 4) GET: Cache API 로 30~60초 캐시, KST 주차(월~일)는 서버가 계산
    void env;
    return new Response(JSON.stringify({ error: 'not-implemented', path: url.pathname }), { status: 501, headers: { 'content-type': 'application/json' } });
  },
};
