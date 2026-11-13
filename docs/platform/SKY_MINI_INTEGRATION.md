# Sky Battle · Mini Game Land 연동 준비 (Phase 5·6)

## 조사 결과
- 접근 가능한 저장소(`list_repos`): `uipcjhj/-GONA-s-Game-Paradise`, `uipcjhj/GoNa`(Food), `movex-marketing-dashboard`, `gpt` — **Sky Battle 과 Mini Game Land 의 게임 저장소·브랜치는 존재하지 않음.** Food 저장소에도 두 게임 코드는 없다.
- 따라서 실제 게임 연동(점수 구조·이벤트 분석, 패치, 단독 실행 회귀)은 **보류**했고, 두 게임을 새로 만들거나 디자인을 가정하지 않았다. 아래 "준비물"만 구현했다. 게임 저장소가 생기면 이 문서의 절차대로 연결한다.

## 구현한 준비물 (모두 테스트됨)
| 항목 | 위치 | 내용 |
|---|---|---|
| 게임 등록 | `src/platform/games.ts` · `src/data/islands.ts` | sky-battle / minigame-paradise 등록(점수 한도·단계·클리어 여부·가중치), 현재 `COMING SOON` |
| 공통 SDK | `docs/platform/sdk/gp-sdk.js` (+ `.d.ts`) | 의존성 없는 ES 모듈. `initGame → runStart/Pause/Resume/End`. 판당 1건·일시정지 제외·저장 실패 재시도·비활성 no-op. Food 패치와 같은 계약 |
| 결과 계약 | `GAME_RESULT_CONTRACT.md` | gameId·subGameId·sessionId·score·outcome(clearStatus)·stage·durationMs·endedAt·scoreSchemaVersion·gameVersion |
| Mini 하위 게임 | `GameRecord.subGames` · `MINI_GAMES` | 미니게임별 최고·플레이 횟수·마지막 플레이, 랭킹 탭(서버 `sub_game_id`), 프로필 표시 |
| 업적 | `content.ts` | Sky 3개(첫 출격·3스테이지·클리어), Mini 3개(첫 판·3종 플레이·20판) — 게임 연동 전에는 "COMING SOON" 표시, 진행 없음 |
| 보상 엔진 | `engine.ts` | 게임 무관 공통(기본 XP + 점수 + 클리어 + 신기록, 하루/세션 한도) |
| 결과 화면·다시 하기·월드맵 | `Result.tsx` | 게임 이름만 레지스트리에서 읽음 — 새 게임은 코드 변경 없이 사용 |
| 랭킹 | `Ranking.tsx` · 서버 | 게임별/미니게임별/주간/역대/종합 탭 |
| 모의 게임 | `tools/mock-game/` | **개발 테스트 전용**(운영 번들에 없음): SDK 로 시작→점수→게임 오버/클리어→돌아가기. Sky(단계 포함)·Mini(subGameId 선택) |
| 테스트 | `gameSdk.test.ts`, `tools/platform-online-e2e.cjs` | SDK↔수신 계약, 브라우저에서 모의 게임 전체 흐름(세션→SDK→결과 화면→업적→온라인 제출→랭킹) |

## 실제 게임을 연결하는 절차 (게임이 생겼을 때)
1. `src/platform/games.ts`: 게임 정보 확정(`status:'live'`, 점수 한도 실측 반영), `src/data/islands.ts` 에 `url` 지정. 서버 `backend/src/games.ts` 도 같은 값으로(`parity` 테스트가 일치 확인).
2. 게임 저장소의 **별도 브랜치**에서 `gp-sdk.js` 를 복사해 시작/종료 지점에 `runStart`/`runEnd` 호출(게임 규칙·점수·기존 저장 키는 건드리지 않음, `?gp` 없으면 no-op).
3. Food 와 같은 방식으로 개발 사이트에서 실제 플레이 검증(게임 오버/클리어/새로고침/이어하기·중복) → 승인 후 반영 → `link:'live'`.
4. Mini Game Land: 미니게임마다 `MINI_GAMES` 에 `{id,name}` 추가 + `runStart({subGameId})`.
5. 업적/도감/칭호/보상 수치는 `content.ts`·`balance.ts` 만 수정.

## 운영 안전장치
- `VITE_TEST_GAMES` 가 없는 빌드(운영 기본)에서는 두 게임이 `COMING SOON` 이며 모의 게임 주소·미니게임 목록이 번들에 연결되지 않는다.
- 서버는 `ALLOW_TEST_GAMES=1` 이 아니면 출시 전 게임의 세션/제출을 거부한다.
