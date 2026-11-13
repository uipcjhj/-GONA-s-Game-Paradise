# 온라인 랭킹 API 계약 (초안 — Cloudflare Workers + D1 우선 후보)

> **연결하지 않음.** 계정·DB·키 생성 없음. 이 문서·`schema.sql`·`worker/index.ts`·모의 서버(`src/services/rankingMock.ts`)는 연결 전 설계/테스트 환경이다.
> 앱은 서버가 없어도 완전히 동작하고(로컬 기록), 서버가 없으면 "온라인 랭킹 준비 중"만 표시한다(가짜 순위 금지).

## 신원 (회원가입 없음, 닉네임 전용 유지)
- `POST /v1/players` {nickname, avatarId} → {playerId, publicCode, token} — 서버가 발급. 서버에는 `token` 의 **해시**만 저장. 닉네임·식별코드는 인증이 아님.
- 이후 모든 요청은 `Authorization: Bearer <token>`. 토큰 분실 = 새 플레이어(복구 코드는 백엔드 구축 단계에서 별도 결정 — D8).

## 점수 제출 (서버가 시간을 잰다)
1. `POST /v1/sessions` {gameId} → {sessionId, startedAt(서버 시각)}
2. 게임 종료 후 `POST /v1/sessions/{sid}/finish` {resultId, outcome, score, stage, durationMs, gameVersion, scoreSchemaVersion, subGameId?}
   - 서버 검증: 토큰·세션 소유자 / `now - startedAt` 로 측정한 경과 시간 ≥ 주장한 durationMs(± 오차) / `score ≤ maxScorePerSec × 경과 + carryAllowance`, `≤ maxScore` / 게임 버전·점수 규칙 버전 / 한 세션 최대 제출 수 / 플레이어당 분당 제출 제한(속도 제한) / `resultId` 멱등(같은 resultId 재전송은 같은 응답).
   - 의심 점수는 **랭킹에서 숨김**(`flagged=1`), 사용자에게는 "기록은 저장됐지만 랭킹에는 반영되지 않았어요"(사유 비공개).
   - `weekId` 는 **서버가 KST(UTC+9) 월요일 기준**으로 계산(클라이언트 값 무시).
3. 응답 {accepted, flagged, bestAll, bestWeek, rankAll?, rankWeek?}

## 조회
- `GET /v1/rankings?gameId=&period=weekly|all&weekId=&limit=50` → {entries[{rank, nickname, publicCode, avatarId, titleId, score, at}], me?, updatedAt, weekEndsAt?}
  - 주간: 월 00:00 ~ 일 23:59:59 KST. 역대: 개인 최고, **동점은 먼저 달성한 기록 우선**.
  - 응답은 엣지 캐시(30~60초)로 D1 읽기 한도를 보호.
- `GET /v1/rankings/overall?period=` → 종합 랭킹(아래 정규화).

## 종합 랭킹(정규화 — 원점수 합산 금지)
게임 g 에서 참가자 수 N_g, 내 순위 r_g 라면 백분위 `p = 1 − (r−1)/N_g`. 소규모/신규 게임이 불리·유리하지 않도록 수축 `p' = p · N_g/(N_g+m)` (m=20). 참가자 수가 `minParticipants`(기본 20) 미만인 게임은 **종합에서 제외**, 출시 전·미참여 게임은 0 점이 아니라 대상 아님, 종합은 **2개 이상 게임 참여** 시에만 계산. 종합 점수 = Σ w_g p'_g / Σ w_g × 1000. (로컬 참고용 지수 `overallIndex` 는 순위가 아닌 내 지표.)

## 에러
401 토큰 / 403 세션 소유자 불일치 / 409 resultId 충돌(내용 다름) / 422 검증 실패(사유 코드) / 429 속도 제한 / 503 일일 한도(D1 무료 한도) — 앱은 어떤 오류에서도 로컬 기록을 유지하고 outbox 로 재시도.

## 한계 (정직한 표기)
클라이언트가 보내는 점수는 조작 가능하다. 서버의 세션 시간 측정·최대 점수/속도 제한·이상치 숨김은 **단순 조작과 실수를 줄이는 방어**이지 결심한 조작자를 완전히 막지 못한다. 리플레이 로그 표본 검사 등은 이후 단계.

## 무료 한도 (착수 전 재확인 필요)
D1 무료: 일 500만 행 읽기 / 10만 행 쓰기, 계정 5GB — 2026-09-01 부터 일일 한도 초과 시 00:00 UTC 까지 쿼리 실패. Workers 무료 일일 요청 한도는 별도 확인 필요. → 설계: 응답 캐시, `best_all`/`best_week` 비정규화 테이블로 읽기 행 수 최소화, 제출은 최고 갱신 때만 best 테이블 쓰기.
