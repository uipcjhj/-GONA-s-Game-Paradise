# 게임 연동 계약 (Game SDK Contract)

## 수명주기
`launch → start → (pause/resume) → end → submit → return-to-map`

## 이벤트 페이로드
| 필드 | 설명 |
|---|---|
| gameId, gameVersion, scoreSchemaVersion | 게임 식별/버전 |
| playerId, sessionId | 플랫폼이 발급 (sessionId로 멱등 제출) |
| score, stage, clearStatus | 결과 (`cleared`/`failed`/`quit`) |
| playDuration, completedAt | 플레이 시간(초), 완료 시각 |

## 실행 방식 (동일 출처 localStorage 충돌 회피)
- Paradise와 Food는 같은 출처(`https://uipcjhj.github.io`)이므로 **키 접두사 분리**(`gp.v1.` 등) 필수. 같은 출처의 어떤 저장소든 서로의 키를 읽고 쓸 수 있으므로 localStorage는 **보안 저장소가 아니다**.
- 실행: `…/GoNa/?gp=1&gid=food&sid=<sessionId>&pid=<playerId>&ret=<돌아올URL>&v=1`
- 결과 전달 우선순위: ① 동일 출처 outbox 키(`gp.v1.outbox`) ② URL fragment `#gp_result=<base64url>` ③ 서버 직접 제출(세션 토큰). 향후 커스텀 도메인 등 **교차 출처**에서도 ②③으로 동작하도록 설계.
- 단독 실행(`gp` 파라미터 없음)이면 SDK는 no-op — 기존 게임 동작 불변.

## Food 최소 패치안 (승인 필요, 지금은 수정하지 않음)
`src/platform/paradise.ts` ~80줄. `bus`의 `EV.start` / `EV.gameOver` / 엔딩(`finishGame`)을 구독해 결과를 outbox에 기록. 점수 계산·기존 저장 키(`dino-snack-adventure.*`, `gona.*`) 변경 없음. 게임 오버 화면에 "월드맵으로" 버튼은 `ret` 있을 때만 노출.
Paradise는 Food의 기존 로컬 최고점을 **1회 가져오기(미검증·로컬 전용 표기)** 가능.

## 신규 게임 등록 (최소 정보)
`gameId, name, image, url, status, scoreRule, ranking 사용 여부, achievement 정의` → Game Registry(JSON)에 한 항목 추가 + 섬 좌표(월드맵 hit) 지정. 코드 변경 없이 팝업/랭킹/업적에 반영.

## 점수 신뢰 한계
클라이언트가 보낸 점수는 조작 가능. 서버는 세션 발급/종료 시간, 게임별 최대점·초당 최대점 검증, 속도 제한, 이상치 숨김 처리로 **현실적 방어**만 한다. 결심한 조작자를 완전히 막을 수는 없다(문서·UI에서 과장 금지).
