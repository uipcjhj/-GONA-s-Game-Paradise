# 온라인 랭킹 서버 (Cloudflare Workers + D1)

> **상태: 코드·스키마·테스트 완료 / 배포·계정·DB 생성은 하지 않음(승인 대기).** 프런트엔드는 `VITE_RANKING_API` 가 없으면 완전한 로컬 모드이며, 서버가 없을 때 순위가 있는 것처럼 표시하지 않는다.

## 구성
| 경로 | 내용 |
|---|---|
| `src/app.ts` | 모든 API 라우트·인증·점수 검증·랭킹·요청 제한 (Workers 와 Node 에서 같은 코드가 동작) |
| `src/index.ts` | Workers 진입점 (`export default { fetch }`) |
| `src/games.ts` | 서버 쪽 게임 규칙(점수 한도 등) — 앱의 `src/platform/games.ts` 와 일치함을 테스트가 검사 |
| `migrations/0001_init.sql` | D1(SQLite) 스키마 |
| `src/node-sqlite-d1.ts` | **D1 에뮬레이터**: Node 내장 SQLite 로 D1 호출 모양을 흉내 내어 실제 SQL·마이그레이션을 로컬에서 그대로 실행 |
| `scripts/dev-server.ts` | 로컬 모의 서버(http, 메모리/파일 DB) — 브라우저 테스트가 사용 |
| `test/api.test.ts` | API 통합 테스트 23개 |
| `wrangler.example.toml`, `.dev.vars.example` | 배포 설정 예시(자리표시자) |

## API (자세한 규칙은 `docs/platform/backend/API_CONTRACT.md`)
`POST /v1/players` 익명 등록 · `PATCH /v1/players/me` 프로필 동기화 · `POST /v1/sessions` 서버 세션(시작 시각을 서버가 잼) · `POST /v1/sessions/:id/finish` 점수 제출 · `GET /v1/rankings` 게임별(주간/역대/미니게임) · `GET /v1/rankings/overall` 종합 · `GET /v1/health`.

## 보안 설계 (구현됨 · 테스트로 검증)
- **서버 발급 인증 토큰**: 등록 응답에서만 한 번 전달, 서버는 `sha256(token:pepper)` 만 저장. `TOKEN_PEPPER` 는 서버 secret 이며 프런트엔드에 없음(번들 검사 테스트).
- **playerId·공개 식별코드는 인증 수단이 아님**: 모든 쓰기는 토큰 필요. playerId 를 토큰처럼 보내도 401, 다른 사람 세션으로 제출하면 403.
- **닉네임 중복 허용**, 개인정보는 닉네임·아바타·식별코드뿐(이메일·전화·IP 저장 없음 — IP 는 요청 제한용 해시 버킷에만 사용).
- **제출 경로 한정**: 서버가 만든 세션으로만 제출 가능. 기존 로컬 기록을 서버에 올리는 API/동작 없음(앱도 서버 세션이 있는 새 판만 제출).
- **점수 검증**: 서버가 잰 경과 시간보다 긴 플레이 시간 거부, 시간 기반 최대 점수·절대 최대 점수 초과는 **랭킹에서 숨김(flagged)**, 점수 규칙/단계/형식 검증, 세션 만료 12시간·세션당 40회, 멱등 resultId(같은 판 재전송 방지, 내용이 다르면 409).
- **요청 횟수 제한**: 제출 분당 12회·세션 발급 30회·프로필 변경 20회(플레이어별), 등록 같은 IP 시간당 20회 → 429. 본문 4KB 제한.
- **입력은 모두 바인딩 쿼리**(SQL 주입 테스트), CORS 는 허용 출처만, 서버 오류는 내부 정보 없이 500 JSON.
- 주간 랭킹은 **서버가 한국 시간(KST) 월요일 00:00** 기준으로 계산(클라이언트 값 무시), 동점은 먼저 달성한 기록 우선.
- 종합 랭킹: 게임별 백분위 + 수축, 참가자 부족 게임 제외, 2개 이상 게임 참여자만(원점수 합산 아님).

## 한계 (정직한 표기)
클라이언트가 보내는 점수는 조작할 수 있다. 서버의 시간 측정·한도·속도 제한·이상치 숨김은 **단순 조작과 실수를 줄이는 방어**이지 결심한 조작자를 완전히 막지 못한다(리플레이 로그 표본 검사·행동 분석 등은 후속). 토큰 분실 = 새 플레이어(복구 코드는 D8 결정 후). 같은 토큰을 가진 사람은 그 플레이어로 행동할 수 있다(비밀번호 없는 익명 계정의 본질적 한계).

## 로컬 실행·테스트 (외부 연결 없음)
```bash
npm test                               # 앱 + 서버 단위/통합 테스트 (백엔드는 backend/test)
node backend/scripts/dev-server.ts     # http://localhost:8787 모의 서버(메모리 DB, ALLOW_TEST_GAMES=1)
VITE_RANKING_API=http://localhost:8787 npm run dev    # 프런트를 모의 서버에 연결
```
Node 22.18+ 의 타입 스트립을 사용한다(`node:sqlite` 는 실험적 기능 경고가 출력됨 — 운영 코드(Workers)에는 영향 없음).

## 향후 설정 절차 (승인 후, 지금은 하지 않음)
1. Cloudflare 계정 확인(무료 플랜), `npm i -D wrangler` (backend/)
2. `wrangler d1 create gona-paradise` → 출력된 `database_id` 를 `wrangler.toml` 에 기입(`wrangler.example.toml` 복사)
3. `wrangler d1 migrations apply gona-paradise --remote`
4. `wrangler secret put TOKEN_PEPPER` (긴 무작위 값) · `ALLOWED_ORIGINS` 를 실제 게임천국 주소로
5. `wrangler deploy` → Workers URL 확인 → `GET /v1/health`
6. 게임천국 빌드에 `VITE_RANKING_API=<Workers URL>` 을 지정해 배포(운영 배포는 별도 승인)
7. 무료 한도 재확인(D1 일 읽기 500만/쓰기 10만 행, Workers 일 요청 한도) — 랭킹 응답 캐시(30~60초) 추가 고려
8. 서버 규칙(`src/games.ts`)에서 Sky/Mini 를 `live: true` 로 전환하는 시점은 각 게임 출시와 함께
