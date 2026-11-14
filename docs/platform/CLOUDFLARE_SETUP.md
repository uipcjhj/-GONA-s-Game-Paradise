# Cloudflare 온라인 랭킹 설정 절차 · 비용/한도 확인 항목

> **상태: 계정·D1·Worker 를 만들지 않았다(승인 대기).** 이 문서는 승인 후 따라 할 절차와, 그 전에 사람이 확인해야 할 비용·한도 항목이다. 서버 코드는 `backend/`, 로컬 검증은 SQLite 에뮬레이터(`backend/src/node-sqlite-d1.ts`)로 했다 — **로컬 테스트 서버(`localhost:8787`)는 운영 서버가 아니다.**

## 1. 로컬 서버 vs 운영 서버 (혼동 방지)
| | 로컬 테스트 서버 | 운영 서버 |
|---|---|---|
| 주소 | `http://localhost:8787` (`backend/scripts/dev-server.ts`) | (미생성) Workers URL |
| DB | 메모리/파일 SQLite 에뮬레이터 | Cloudflare D1 |
| 출시 전 게임(Sky/Mini) 제출 | `ALLOW_TEST_GAMES=1` 로 허용(테스트용) | **거부**(기본) |
| 앱 연결 | 빌드 시 `VITE_RANKING_API=http://localhost:8787` (개발·테스트 빌드만) | 운영 빌드에 `VITE_RANKING_API=<Workers URL>` 을 넣을 때만 |
| 테스트 데이터 | e2e 가 만든 "시드…" 테스트 플레이어 | 없음(가짜 순위를 만들지 않는다) |
운영 빌드에 `VITE_RANKING_API` 가 없으면 앱은 "온라인 랭킹 준비 중"만 보이고 서버 호출을 하지 않는다(e2e 로 확인).

## 2. 승인 후 설정 절차
1. Cloudflare 계정(무료 플랜) 로그인, `backend/` 에서 `npm i -D wrangler`
2. `wrangler d1 create gona-paradise` → 출력된 `database_id` 를 `backend/wrangler.toml`(= `wrangler.example.toml` 복사)에 기입
3. `wrangler d1 migrations apply gona-paradise --remote`
4. 비밀값: `wrangler secret put TOKEN_PEPPER`(길고 무작위, 커밋 금지) · `ALLOWED_ORIGINS` 는 실제 게임천국 주소(`https://uipcjhj.github.io`)
5. `wrangler deploy` → `GET <Workers URL>/v1/health`(또는 README 의 점검 경로) 확인
6. 운영 서버 스모크 테스트: 등록 → 세션 → 제출 → 랭킹 조회, 레이트 리밋(429), 허용 외 출처 CORS 거부 — **운영 DB 에 테스트 플레이어가 남지 않게** 점검용 닉네임 사용 후 정리 방법을 정해 둘 것
7. 게임천국 운영 빌드에 `VITE_RANKING_API` 지정 후 재배포(`DEPLOY_ORDER.md` ④)
8. 서버 `backend/src/games.ts` 에서 Sky/Mini 를 live 로 바꾸는 시점은 각 게임 공개와 함께
되돌리기: 앱 쪽 `VITE_RANKING_API` 제거 후 재배포(서버는 그대로 두어도 무해), 문제가 크면 Worker 비활성화.

## 3. 비용 · 무료 한도 확인 항목 (배포 직전 공식 문서로 재확인)
조사 시점(2026-11-14) 검색 결과 기준이며 **정책은 바뀌므로 배포 직전에 공식 페이지에서 다시 확인**한다.
- Workers Free: 하루 100,000 요청(UTC 자정 초기화), 분당 1,000 요청 한도, 요청당 CPU 10ms · 하위 요청 50개 — [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- D1 Free: 하루 읽기 5,000,000행 · 쓰기 100,000행, 저장 5GB(일일 카운터 UTC 00:00 초기화) — [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- **2026-09-01 부터 무료 플랜에서 D1 일일 읽기/쓰기 한도를 넘으면 쿼리가 실패**한다 — [변경 공지](https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/). 한도 초과 시 랭킹/제출이 멈추므로 앱이 서버 실패에서도 게임 진행·로컬 기록에 영향이 없는지(이미 e2e 로 확인)와 사용자 안내 문구를 함께 점검.
확인할 숫자(내부 추정은 부하 테스트가 아니라 **계산**이다):
- 점수 제출 1건 ≈ 쓰기 수 행(세션·제출·best 테이블 갱신)과 읽기 수 행. 하루 제출 N건이면 쓰기 한도(100,000행)까지 대략 `100,000 / 행수` 건 — 실제 행수는 `backend/src/app.ts` 쿼리로 산출해 표로 만들 것
- 랭킹 조회는 읽기 행이 큼 → 응답 캐시(30~60초)와 상위 N 제한 검토
- 유료 플랜(Workers Paid 등) 전환 기준과 월 비용 상한을 사용자가 정한다(자동 과금 방지: 지출 알림/한도 설정 확인)
- 개인정보: 닉네임·아바타·식별코드만 저장(이메일/전화 없음), IP 는 요청 제한용 해시 버킷 — 개인정보 처리 안내 문구 필요 여부 확인
