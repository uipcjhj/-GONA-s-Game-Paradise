# Sky Adventure · Mini Game Land 실연동 (Phase 5·6)

## 조사 결과 (정정)
이전 판은 "게임 저장소·브랜치가 없다"고 적었으나 **틀렸다.** 두 게임 코드는 이 저장소(`-GONA-s-Game-Paradise`)의 별도 원격 브랜치에 존재했고, 개발 브랜치 `claude/platform-full-development` 로 병합해 플랫폼 결과 파이프라인에 연결했다.

| 게임 | 위치 | gameId | 연동 방식 |
|---|---|---|---|
| GONA's Sky Adventure | `src/sky/` (앱 안 화면) | `sky-battle` | `SkyGame` 의 `onResult` → `reportInApp` 이 세션·inbox 봉투를 만들고 즉시 소비 |
| Mini Game Land | `src/mini-game-land/` (`mini-game-land/` 별도 진입점) | `minigame-paradise` + `subGameId`(sort·tower·toyroom·challenge) | `gp-sdk.js` `initGame` → `runStart/runEnd/report`, `?gp=<세션>` 일 때만 활성(없으면 no-op) |

## 연동 내용
- 결과 계약(`GAME_RESULT_CONTRACT.md`) 그대로 사용. Sky: 스테이지 1개, 클리어 가능. Mini: 클리어 가능, 하위 게임별 기록·랭킹 탭.
- 보상·업적(Sky: 첫 출격/클리어 등, Mini: 입문 등)·기록·중복 방지(원장)·새로고침 후 재반영 없음은 Food 와 같은 엔진.
- Mini 홈에 `[data-testid=back-hub]` 링크(세션의 돌아갈 주소). `?gp` 없는 단독 실행은 기록하지 않는다(회귀 테스트).

## 운영 안전장치 (변경 없음)
- 운영 기본 빌드에서 Sky·Mini 는 **COMING SOON**. 입장은 개발 게이트(`?dev` · `#sky` · `VITE_SKY_PREVIEW=1` · `VITE_TEST_GAMES`)에서만.
- 서버는 `ALLOW_TEST_GAMES=1` 이 아니면 출시 전 게임의 세션/제출을 거부.
- 모의 게임(`tools/mock-game/`)은 개발 테스트 전용이며 운영 번들에 없다.

## 검증 (로컬, Chromium 모바일 에뮬레이션 · 실기기 아님)
- `tools/sky-e2e.cjs` 28/28 (393×636 · 390×844): 운영 기본 COMING SOON, 실제 Sky 게임 오버·클리어 → 결과 화면, 기록·업적·보상 일관성, 새로고침 중복 없음.
- `tools/mini-e2e.cjs` 24/24: 실제 Mini 라운드 → 결과 1건 → 게임천국 결과 화면, 원장 1건, 단독 실행 회귀.
- `tools/platform-online-e2e.cjs` 36/36(크기별 18+18, 크기마다 새 DB): 모의 게임 SDK·서버 세션·온라인 랭킹 UI.
- 한계: Sky 의 실제 사람 플레이 점수 분포가 없어 `maxScore`/`maxScorePerSec` 은 잠정값(치트 도구로 만든 점수로는 한도 검증 불가).

## 새 게임을 추가하는 절차
1. `src/platform/games.ts` 등록(+ 서버 `backend/src/games.ts`, parity 테스트가 일치 확인) → `src/data/islands.ts` url.
2. 게임 브랜치에서 `gp-sdk.js` 호출 추가(게임 규칙·저장 키 불변).
3. 개발 사이트 실플레이 검증 → 승인 후 `link:'live'`.
