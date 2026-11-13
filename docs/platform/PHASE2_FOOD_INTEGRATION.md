# Phase 2 설계 — Food Adventure ↔ 게임천국 플레이 기록 연동

> 상태: **설계·시안 단계(코드 수정·배포 없음).** Food Adventure 의 게임 규칙·점수·캐릭터·사운드·오프닝·엔딩은 바꾸지 않는다.
> 시안: `prototype/phase2.html` (샘플 데이터) · 캡처: `screens/phase2/` · 공통 계약: [GAME_RESULT_CONTRACT.md](GAME_RESULT_CONTRACT.md)

## 1. Food Adventure 조사 결과 (읽기 전용, `uipcjhj/GoNa` main `a907834`)
| 항목 | 실제 동작 (파일) |
|---|---|
| 점수 | 점수는 **하나의 `GameScene.score`** 로 누적. ① 간식 먹기 `collect()` → `SNACKS` 점수(딸기 10·바나나 20·쿠키 30·별 젤리 50, `config.ts:81-86`) ② 몬스터 처치 점수 `addPoints(d.score)` (`GameScene.ts:1335`) ③ 보스 격파 보너스(뽀뽀괴물 300·킁카괴물 600, `game/boss.ts`) |
| 한 판 시작 | `startGame()` 이 `bus.emit(EV.start)` (`GameScene.ts:546`). 시작 인자 없음 |
| 게임 오버 | `die()` (`GameScene.ts:1515`): 즉시 Food 자체 최고점(`dino-snack-adventure.best`)·최고 단계(`…bestStage`) 저장 → **1.1초 뒤** `bus.emit(EV.gameOver, GameOverInfo)` |
| `GameOverInfo` | `{ score, best, isNewBest, snacks, growthLevel(1~4), growthName, bestGrowthLevel, growthLevels, bossRetry?, cleared? }` (`events.ts:125`) |
| 엔딩(클리어) | 최종 보스 격파 → `finishGame()` (`GameScene.ts:2208`): 체크포인트 삭제, 최고점 저장, `endingInfo{cleared:true}` 생성 → 1.2초 뒤 `startEnding()` → `bus.emit(EV.endingStart, endingInfo)`. (※ `EV.ending` 은 선언만 있고 **발행되지 않음**) |
| 엔딩 다시보기 | `EV.endingReplay` → `startEnding()` 이 **같은 `endingStart` 를 다시 발행** → 중복 기록 위험 지점 |
| 다시하기/이어하기 | `EV.restart` → `scene.restart({autoStart,…})` → 다시 `startGame()` → **새 `EV.start`**. 체크포인트(`gona.checkpoint`)·보스전 다시 도전은 **이전 점수를 이어서 시작**(`cp.score` / `retryCarry.score`) |
| 일시정지 | `EV.pause` / `EV.resume` 발행 |
| 저장 래퍼 | `storage.ts` — 키 접두사 `STORAGE_PREFIX`: 정식 `''`, 개발(`/GoNa/dev/`) `'gona-dev:'`. `?test=` 모드는 `readOnly` |
| 키 목록 | `dino-snack-adventure.best` / `.muted` / `.bestStage`, `gona.checkpoint`, `gona.vibrate`, `gona.perf` |
| 배포 | 정식 `/GoNa/`(main) · 개발 `/GoNa/dev/`(dev) — **같은 출처** `https://uipcjhj.github.io`. 개발→정식은 `RELEASE.md` 절차(승인 후 main) |
| URL 파라미터 | 이미 쓰는 것: `?test` `?boss` `?perf` `?dev` `?audiotest` `?debugAudio` (정식 빌드에서는 개발용 코드가 빠짐). `gp` 는 겹치지 않음 |

**핵심 결론**: 연동에 필요한 이벤트(`EV.start` / `EV.pause·resume` / `EV.gameOver` / `EV.endingStart`)와 데이터(점수·성장 단계·간식 수·클리어 여부)가 **모두 `bus` 로 이미 나온다 → `GameScene` 수정 불필요.**

## 2. 게임천국 쪽 현황 (Phase 1)
- `playerId`(UUID v4)·`publicCode`·`gp.v1.player`(스키마 v1, 검증·마이그레이션·`.bak` 복구)·백업 JSON·초기화(`gp.v1.*`만 삭제).
- `PlayerData.gameRecords: Record<gameId, GameRecordSummary>` 자리만 있고 비어 있음(옵션 필드 `bestScore/bestStage/plays/lastPlayedAt`). 섬 `Island.id` = gameId (`food-island` …), Food URL 은 `islands.ts` 의 `https://uipcjhj.github.io/GoNa/`.
- PLAY 는 현재 단순 링크 `<a href>` (`IslandPanel.tsx`).

## 3. 전체 흐름 (같은 탭 이동)
```
게임천국  PLAY 탭
  1. 세션 생성  gp.v1.session.<sid> = {sid, gameId, playerId, startedAt, expiresAt, returnUrl}
  2. location → …/GoNa/?gp=<sid>
Food(패치 후, gp 있을 때만 활성)
  3. 세션 검증(존재·만료·gameId) → 활성
  4. EV.start → runId 생성          (한 판마다 새 runId)
  5. EV.gameOver / EV.endingStart → 결과 봉투를 gp.v1.inbox.<resultId> 에 기록 (runId 당 1번)
  6. Food 기존 게임 오버/엔딩 화면 그대로 + (활성일 때만) "🏝 게임천국으로" 버튼
게임천국으로 복귀 (버튼 / 브라우저 뒤로가기 / 탭 복귀 / 다음 접속)
  7. consumeInbox(): 검증 → 플레이어 데이터에 적용 → 1회 저장 → inbox 삭제
  8. 결과 화면 표시 (점수·신기록·단계·내 기록·다시 도전)
```
돌아오는 시점은 **네 가지 모두 같은 함수**가 처리: 앱 시작, `pageshow`(bfcache 복귀 포함), `visibilitychange`(탭 복귀), `storage` 이벤트(다른 탭에서 기록됨).

## 4. 안전한 결과 전달 (같은 출처 localStorage)
- **게임은 `gp.v1.inbox.<resultId>` 새 키만 쓴다.** 게임천국이 `gp.v1.player` 의 **유일한 작성자**. Food 의 기존 키(`dino-snack-adventure.*`, `gona.*`)는 읽지도 쓰지도 않는다.
- 결과마다 **별도 키** → 읽고-고치고-쓰기(RMW) 경합 없음(두 탭에서 동시에 끝나도 서로 안 덮어씀).
- **세션 레코드가 게임 활성화 열쇠**: `?gp=` 만으로는 아무 일도 일어나지 않고, 게임천국이 만든 세션이 실제로 존재해야 SDK 가 켜진다. 정식/개발 빌드가 같은 출처라도 의도치 않게 기록이 섞이지 않는다(개발 테스트는 개발용 Paradise 세션으로만).
- 돌아갈 주소는 **세션에 저장된 `returnUrl` 만** 사용(주소창에 `ret` 를 받지 않음 → 열린 리다이렉트 없음).
- 한계(솔직히): 같은 출처의 누구나 localStorage 를 읽고 쓸 수 있으므로 결과는 **조작 가능한 로컬 기록**(`verified:'local'`)이다. 온라인 랭킹에는 쓰지 않으며, Phase 4 에서 서버가 세션을 검증하는 별도 경로로 대체한다. 지금 단계의 방어는 **형식·범위·시간·세션·플레이어 일치 검증**으로 "실수와 단순 조작"만 걸러내는 수준.
- 교차 출처(향후 커스텀 도메인) 대비: 같은 봉투를 `returnUrl#gpr=<base64url>` 로 전달하는 폴백을 SDK 가 지원할 수 있게 봉투를 자기완결형으로 설계(이번엔 미구현).

## 5. 기록 구조 (스키마 v2)
```ts
interface GameRecord {
  gameId: string;
  bestScore: number;  bestScoreAt: string;          // 동점이면 먼저 달성한 기록 유지
  bestScoreSource: 'play' | 'import';               // 가져온 이전 기록이면 'import'
  bestStage?: number; bestStageLabel?: string;
  plays: number;                                    // 끝난 판 수(게임 오버 + 클리어)
  clears: number;                                   // 클리어(엔딩) 횟수
  firstPlayedAt: string; lastPlayedAt: string;
  totalPlayTimeSec: number;
  lastResult: { score: number; stage?: number; cleared: boolean; at: string; resultId: string };
  subGames?: Record<string, GameRecord>;            // Mini Game Land 용 (Phase 7)
}
interface PlayerData { /* v1 필드 … */ gameRecords: Record<string, GameRecord>; totalPlayCount: number; totalPlayTimeSec: number; resultLedger: string[]; /* 최근 100 resultId */ }
```
- **스키마 v1 → v2 마이그레이션**: `totalPlayCount=0`, `totalPlayTimeSec=0`, `resultLedger=[]`, 기존 `gameRecords`(비어 있음)는 새 형식으로 변환. v1 백업 파일도 불러오면 자동 변환(기존 `migrate()` 체인에 1단계 추가).
- 표시하지 않는 값은 만들지 않는다: 기록이 없으면 "아직 기록이 없어요"(임의 숫자 금지).
- "플레이 횟수"의 정의: **끝까지 간 판**(게임 오버/클리어) 수. 시작만 하고 닫은 판은 세지 않음.
- Food 체크포인트로 이어한 판의 점수는 Food 규칙대로 **이전 점수 포함**이라 그대로 기록(Food 자체 최고점과 같은 기준). 필요하면 `extra.resumed` 로 표시(후순위).
- **기존 Food 최고 기록 가져오기(선택, 승인 필요)**: 첫 연동 때 Food 정식 키 `dino-snack-adventure.best/.bestStage` 를 **읽기만** 해서 "가져올까요?"(시안 10). 동의하면 `bestScoreSource:'import'` 로 1회만 저장, 이후 랭킹 등에는 쓰지 않음. 거절하면 아무것도 안 함.

## 6. 돌아오는 UX (시안 1~6, 9, 10)
- **결과 화면(게임천국)**: 헤더 HUD 유지 + `RESULT` → 게임 카드 → 큰 점수(신기록이면 `★ NEW BEST!` + 이전 최고 대비 증가량, 클리어면 `★ CLEAR!`) → 단계/간식/플레이 시간 → **내 기록 4칸**(최고·플레이·클리어·마지막 플레이) → `▶ 다시 도전`(새 세션 발급) / `월드맵으로` / 랭킹(준비 중, 비활성).
- 결과 화면은 **한 번만**: 기록 반영 직후 한 번 표시하고, 새로고침하면 월드맵으로(같은 결과를 다시 띄우지 않음). 이후 확인은 프로필·섬 팝업의 "내 기록".
- 한 번에 여러 판이 쌓여 있으면(Food 안에서 연속 플레이) 가장 최근 판을 보여주고 "N판 기록됨"을 함께 표시, 신기록 판정은 합산한 뒤의 최고 기준.
- 상태 화면: **저장 중**(스피너) · **저장 실패**(점수는 보여주되 "아직 반영되지 않았어요" + 다시 시도, 결과는 inbox 에 그대로 남아 재시도 가능) · **이미 반영됨**(중복 입력 안내).
- 프로필 "게임 기록"과 섬 팝업에 같은 기록 표시(시안 7, 8). Sky/Mini 는 COMING SOON.
- **Food 쪽 돌아가기 버튼**(시안 9, 개념도): 게임천국에서 실행했을 때만 작은 `🏝 게임천국으로 돌아가기` 버튼 1개를 게임 오버/엔딩 종료 화면에 추가(세션의 `returnUrl` 로 이동). 이 버튼이 없어도 뒤로가기·탭 복귀로 결과가 반영되므로 **선택 사항**(UI 추가는 별도 승인).

## 7. Food 최소 패치 범위 (제안 — 이번 단계 수정 없음)
| 구분 | 내용 | 규모 |
|---|---|---|
| 신규 | `src/platform/paradise.ts` — SDK + Food 어댑터(`bus` 구독 4개) | ~90줄 |
| 수정 | `src/main.ts` 에 `initParadise()` 호출 1줄 + import 1줄 | 2줄 |
| 선택 | 돌아가기 버튼(DOM 1개 + CSS) — `gp` 활성 때만 생성 | ~25줄 |
| **수정 안 함** | `GameScene.ts`, `config.ts`, 점수·성장·보스·사운드·오프닝·엔딩·기존 저장 키·UI(활성 때 버튼 외) | 0 |
- 단독 플레이(주소에 `gp` 없음/세션 없음): 이벤트 구독조차 하지 않는 **완전한 no-op** → 기존과 동일(번들 크기 +~2KB).
- 정식 빌드만이 아니라 개발 빌드(`gona-dev:`)에서도 같은 코드가 돌지만, 세션 레코드가 없으면 비활성.
- Food 쪽 배포는 기존 절차(`RELEASE.md`: dev 푸시 → 개발 사이트 테스트 → 승인 → main). **Food 패치는 별도 승인 후에만.**

## 8. 중복·새로고침·비정상 종료·충돌 방지
| 상황 | 처리 |
|---|---|
| 같은 판이 두 번 전달 (엔딩 다시보기, 이벤트 중복) | SDK: runId 당 `runEnd` 1회 · 게임천국: `resultLedger`(resultId) 로 재차 차단 |
| 저장 성공 후 삭제 전 앱 종료 | 다음 실행 때 원장에 있으므로 반영 건너뛰고 inbox 만 삭제 |
| 결과 화면에서 새로고침 | 이미 반영 완료 → 결과 화면은 다시 안 뜨고 월드맵 (기록은 그대로) |
| Food 에서 새로고침 / 탭 강제 종료 / 배터리 방전 | 끝나지 않은 판은 결과 없음 → 기록 안 됨. 게임 오버 직후(결과 기록 후) 종료됐다면 inbox 에 남아 다음에 반영 |
| 게임 오버 연출 1.1초 중 종료 | `die()` 는 Food 자체 기록만 저장하고 이벤트가 안 나감 → 게임천국엔 기록 안 됨(허용, 한 판 누락) |
| 저장 공간 부족/차단 | SDK 가 메모리 보관 후 재시도, 게임천국은 "저장 실패" 화면 + 다시 시도 · 백업 권유 |
| 두 탭이 동시에 inbox 처리 | Web Locks 로 직렬화(+ 원장이 최종 방어), 저장 직전에 최신 플레이어 데이터를 다시 읽음 |
| 결과 도착 시 플레이어 변경/초기화 | 세션의 playerId 가 다르면 폐기(다른 플레이어에게 반영하지 않음). 초기화는 `gp.v1.session/inbox/rejected.*` 도 삭제 |
| 백업 복원 | 복원 후 inbox 에 남은 결과는 원장 기준으로 그대로 처리(복원본에 이미 있으면 건너뜀) |
| 기존 Food 데이터와 충돌 | 키 공간 분리(`gp.v1.*` vs `dino-snack-adventure.*`/`gona.*`), Food 키는 읽기만(가져오기 동의 시에도) |
| 버전 불일치 | 모르는 `v`/`scoreSchemaVersion` → 삭제하지 않고 보류, 필드 추가는 무시(앞으로 호환) |
| 시계 조작/비정상 시각 | 세션 시간대 밖 `endedAt`·음수/과대 `durationMs` 는 거부(로컬 모드의 한계 명시) |
| 점수 이상치 | `maxScore`/`maxScorePerSec` 초과 → 반영하지 않고 rejected 로 보관 |

## 9. 시안 (393×636 · 390×844) — `screens/phase2/`
01 결과·게임 오버 · 02 결과·신기록 · 03 결과·엔딩 클리어 · 04 저장 중 · 05 저장 실패 · 06 이미 반영됨 · 07 섬 팝업 내 기록 · 08 프로필 게임 기록 · 09 Food 쪽 돌아가기 버튼(개념도) · 10 기존 기록 가져오기. 숫자는 모두 **샘플**이며 화면에 표시를 달았다. 아이콘·배지는 기존 승인 에셋과 코드 UI 만 사용(신규 이미지 없음).

## 10. 테스트 계획
**단위(Vitest)**: 결과 봉투 검증(형식·범위·시간·세션·플레이어 불일치·크기·미지원 버전) · `applyResult`(최고점/동점/클리어/플레이 횟수/단계/마지막 날짜) · 원장 중복 차단 · 한 번에 여러 결과 · v1→v2 마이그레이션 · v1 백업 복원 · inbox 처리 중 크래시 시뮬레이션(저장 후 삭제 전 throw) · 저장 실패 시 inbox 보존 · 초기화 시 inbox/세션 정리 · 가져오기 1회성.
**계약 테스트**: 픽스처 봉투(정상/중복/이상치/구버전/신버전/깨진 JSON)를 SDK·게임천국이 공유.
**브라우저(Playwright, 393×636·390×844)**: 가짜 게임 페이지(같은 출처 `fake-food.html`)로 PLAY→세션→결과 기록→복귀→결과 화면→프로필/섬 팝업 갱신 · 신기록/클리어/동점 · 새로고침(결과 화면·게임 중) · 뒤로가기 복귀 · 두 탭 동시 · 저장 실패 · 중복 · 초기화/백업 복원 후 동작 · 모바일 레이아웃(가로 스크롤·잘림·콘솔 오류 0).
**Food 실게임(개발 사이트 `/GoNa/dev/`)**: Food 의 기존 봇(`tools/playtest-bot.cjs`, `fullrun-bot.cjs`)으로 실제 게임 오버·엔딩 도달 → 결과가 게임천국에 1건씩 반영되는지, 엔딩 다시보기·이어하기·보스전 재도전에서 중복/누락이 없는지.
**회귀**: Food 단독 실행(주소에 `gp` 없음)에서 키 목록·점수·사운드·엔딩이 패치 전과 동일 · 게임천국 오프닝/월드맵/Phase 1 e2e 100개 유지.
**수동(iPhone)**: 인앱 브라우저·Safari 에서 PLAY→플레이→돌아가기 버튼/스와이프 뒤로가기→결과 확인.

## 11. 개발 단계 (제안)
| 단계 | 내용 | 외부/타 저장소 영향 |
|---|---|---|
| **P2-1** | 게임천국: 스키마 v2·`GameRecord`·원장·`applyResult`·검증 + 단위 테스트 | 없음 |
| **P2-2** | 게임천국: inbox 수신(`consumeInbox`, Web Locks, 이벤트 트리거) + 결과 화면 + 프로필/섬 팝업 기록 | 없음 (가짜 게임 페이지로 e2e) |
| **P2-3** | 게임천국: PLAY → 세션 발급 후 이동, 기존 기록 가져오기 다이얼로그 | 없음 |
| **P2-4** | **(승인 필요)** Food 패치(§7) → `dev` 브랜치 → 개발 사이트에서 봇·실기기 검증 | Food 저장소 수정 |
| **P2-5** | 게임천국 배포 → 확인 → **(승인 후)** Food `main` 반영. 순서: **게임천국 먼저**(수신만 있고 송신이 없으면 무해), Food 나중 | 두 저장소 배포 |
| 롤백 | Food 패치 되돌리기만으로 원상복구(게임천국은 inbox 가 비어 있으면 아무 일 없음) · 게임천국 롤백은 이전 main 커밋 | |

## 12. 승인이 필요한 결정
1. Food 저장소 최소 패치(§7, ~90줄 + main.ts 2줄) 허용 시점 — P2-4 에서 다시 확인 요청
2. "돌아가기" 버튼(Food UI 추가) 포함 여부 — 없어도 동작
3. 기존 Food 최고 기록 가져오기 기능 포함 여부(Food 키를 **읽기만**)
4. 이상치 한도(`maxScore 5,000,000`, `maxScorePerSec 600`)는 임시값 — 실제 플레이 데이터로 조정 후 확정
5. 결과 화면을 같은 탭 화면 전환으로 할지(권장) / 모달로 할지
6. 같은 탭 이동(권장) vs 새 탭으로 Food 열기(새 탭이면 복귀 시 원래 탭이 자동 갱신되지만 iOS 인앱 브라우저에서 탭 관리가 불편)
