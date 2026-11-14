# 병렬 개발 브랜치 비교: `claude/platform-home` ↔ `claude/platform-full-development`

> 같은 플랫폼 기능을 **서로 다른 세션이 독립적으로** 구현한 두 브랜치입니다. 둘 다 `claude/platform-phase2-design`(ae7e11d)/main(84919a1)에서 갈라졌고, 어느 쪽도 main 에 병합·배포되지 않았습니다.
> 병합 시험(`git merge --no-commit`, 저장소 변경 없음) 결과: **29개 파일 충돌**(대부분 `src/platform/*`, `src/screens/*`, `PlayerContext`, `pixel.css` 의 add/add) → 기계적 병합은 불가능, **한쪽을 기준으로 다른 쪽 기능을 이식**해야 합니다.

## 한눈에 보기
| 영역 | `platform-home` (52b7098) | `platform-full-development` (이 브랜치) |
|---|---|---|
| 데이터 v2·결과 계약·세션/inbox | ✅ (자체 구현, 단위 310) | ✅ (자체 구현, 단위 167+백엔드 23) — **계약은 같은 설계서 기반이라 개념 동일, 코드·세부 필드는 다름** |
| XP·레벨·코인·업적·칭호·도감·미션·출석·상점 | ✅ | ✅ (업적 26·칭호 9·도감 16·상점 23) |
| **Mini Game Land 실제 게임** (편가르기·탑·장난감방) 편입 | ✅ `src/mini-game-land` 통합 + 섬 활성화 + e2e3(36) | ❌ (연동 준비물·모의 게임만) → **이 브랜치의 누락** |
| **Food 실연동 검증** | 로컬 Food 클론에 패치 적용 후 e2e4(52). Food 저장소 푸시는 정책으로 차단됐다고 기록 | ✅ Food 저장소 **개발 브랜치 `claude/paradise-link`(1598c5d) 푸시 완료** + 실제 터치 봇 실게임 e2e(게임 오버·신기록·복귀·단독 회귀) |
| **온라인 랭킹 서버**(Workers+D1·익명 인증·검증·주간/종합·요청 제한) | ❌ (인터페이스만, 서버 없음) | ✅ `backend/` + 로컬 SQLite 통합 테스트 23 + 프런트 클라이언트·시상대 UI → **platform-home 의 누락** |
| 몬스터·보스 아바타 해금 구조 | ❌ | ✅ (정식 에셋 전 잠금, 규격·프롬프트 문서) |
| 공통 게임 SDK | ✅ `src/platform/sdk` | ✅ `docs/platform/sdk/gp-sdk.js` (+계약 테스트) |
| UI 완성도(9-slice 틀·리본·결과 카운트업·레벨업 도장·반짝이·UI 효과음) | ✅ | ❌ (기본 노치 스타일) → **이 브랜치의 누락** |
| Food 기존 기록 가져오기 | ✅ (가져오기 다이얼로그) | ❌ 의도적 제외(사용자 결정: 신규 연동 기록부터 집계) |
| Sky Adventure | 게임 없음으로 판단·등록 준비만 | 이 문서 작성 시점에 **`claude/gonas-sky-adventure-dev-ow01sy` 에 실제 게임(stage 1)이 있음을 발견**, 이 브랜치에 병합·연동(아래 참고) |
| 뒤로가기 버그 수정 | `history.back()` 비동기 중 pushState 시 이탈 → 대기열로 수정 | 결과→'다시 도전' 이동이 history.back() 에 취소되던 버그 수정(화면을 닫지 않고 이동) |

## 충돌/위험 지점
1. `src/platform/{types,schema,engine,inbox,result,session,keys,store,progression,kst}.ts`, `PlayerContext.tsx` — 양쪽이 같은 파일명으로 서로 다른 구조를 가짐(필드명·함수 시그니처 불일치).
2. `src/screens/*`(Result·Profile·Ranking·Settings·Shop·Codex·Missions·Achievements·More), `src/ui/pixel.css`, `App.tsx`, `IslandPanel.tsx`, `islands.ts`.
3. 데이터 호환: 둘 다 `schemaVersion: 2` 이지만 **필드 구성이 달라서** 한쪽 v2 저장본을 다른 쪽이 읽으면 검증 실패(손상 안내)가 날 수 있음 → 하나로 통일하기 전에는 같은 브라우저에서 두 빌드를 번갈아 열지 말 것.
4. 두 브랜치 모두 Food 패치 파일(`docs/platform/food-patch/paradise.ts`)을 가지며 내용이 다름(이 브랜치는 `#ui` pointer-events 수정 포함).

## 권장 통합 방식 (승인 필요, 아직 실행하지 않음)
- **새 통합 브랜치**(예: `claude/platform-integrated`)를 만들어 한쪽을 기준으로 삼고 다른 쪽의 고유 기능만 이식:
  - **옵션 A (platform-home 기준)**: UI 완성도·Mini 편입을 그대로 쓰고, 이 브랜치의 **고립된 모듈**을 이식 — `backend/`(독립 폴더), `src/services/online.ts`·`rankingHttp.ts`·`Podium`, 몬스터 아바타 해금(`avatars.ts`), Food 실게임 e2e 도구(`tools/food-bot.cjs`·`live-e2e.cjs`), 문서. 이식 지점은 `PlayerContext`(온라인 동기화)·`Ranking.tsx` 정도라 범위가 작음.
  - **옵션 B (full-development 기준)**: `src/mini-game-land` 와 UI 효과/9-slice 를 이식(충돌 지점이 `pixel.css`·`App.tsx` 등 여러 곳).
  - 추천은 **옵션 A**. 단 두 브랜치의 규칙 수치(보상·한도)·업적 목록·저장 키를 하나로 정하는 결정이 먼저 필요합니다.
- 어느 쪽이든 Food 패치/실게임 검증 결과(이 브랜치)와 Mini 실게임 통합 결과(platform-home)는 **둘 다 보존**해야 합니다.

## 통합 결과 (실행됨)
`claude/platform-release-candidate` 는 full-development 를 기준으로 platform-home 의 **기능**(뒤로가기 스택 수정)만 이식했고, 화면·소리 꾸밈은 디자인 승인 전이라 이식하지 않았다. 상세: `RELEASE_CANDIDATE_REPORT.md` 1절.
