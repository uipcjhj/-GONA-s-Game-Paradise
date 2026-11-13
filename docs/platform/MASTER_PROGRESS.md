# 게임천국 홈 플랫폼 — MASTER PROGRESS

> 작업 브랜치 `claude/platform-home` (기반: `claude/platform-phase2-design` ae7e11d = main 84919a1 + Phase 2 설계). main 병합·배포 없음.
> 세션이 끊겨도 이 문서와 `git log` 만 보고 이어갈 수 있게 단계마다 갱신·커밋합니다.

## 저장소·브랜치 역할 (보존 대상)
| 대상 | 역할 | 상태 |
|---|---|---|
| `main` (84919a1) | 승인·배포된 게임천국 + Phase 1(닉네임·HUD·프로필·설정·백업) | 수정 금지 |
| `claude/platform-phase2-design` (ae7e11d) | Phase 2 설계 문서(결과 계약 등) | 이 브랜치의 기반(문서 그대로 보존) |
| `claude/elegant-ritchie-0djg0u` (c44cfb2) | Mini Game Land M1~M4 — **기준점 유지**, 수정 안 함 | Phase 7 에서 **의도적으로 한 번만** 홈 브랜치에 병합(별도 커밋) |
| `claude/platform-home` | 이번 작업(홈 플랫폼 Phase 1~7) | 진행 중 |
| `uipcjhj/GoNa` (Food Adventure) | 별도 저장소 | **수정 안 함** (CLAUDE.md 규칙). 연동 SDK 패치는 이 저장소에 파일로 준비, 적용은 승인 필요 |

## 범위 결정 (정직하게)
- **로컬로 완성 가능**: 플레이어·기록·XP/레벨/코인·업적·미션/출석·도감·상점/꾸미기·설정·백업/복원·결과 계약·세션·inbox·마이그레이션·"이 기기 기록 순위".
- **서버가 필요(미구현·차단)**: 실제 공유 랭킹(주간/역대/종합). 인터페이스(`services/ranking.ts`)만 있고 가짜 이용자 기록은 **표시하지 않음**. 승인 필요: Cloudflare 계정/서비스 개설.
- **타 저장소 승인 필요**: Food Adventure SDK 패치(`docs/platform/food-patch/`에 준비).
- **게임 신규 콘텐츠·M5·Food 스토리 변경·최종 픽셀아트**: 제외.
- XP/코인/한도 수치는 **임시 설계값**(`platform/tuning.ts` 표 하나) — 운영 전 승인 필요(D7).

## Phase 진행률
| Phase | 내용 | 상태 | 진행 |
|---|---|---|---|
| 1 | 플레이어·닉네임·HUD·프로필·설정·백업 | main 에 이미 구현(재개발 안 함) | 100% |
| 2 | 결과 계약·세션·inbox·기록·결과 화면·PLAY 연동·가져오기 | **구현·테스트 완료**(Food 쪽 SDK 적용은 승인 대기) | 90% |
| 3 | XP·레벨·코인·일일 상한 | 구현·테스트 완료(수치는 임시, 운영 전 승인) | 100% |
| 4 | 랭킹: 이 기기 순위(주간/역대) + 서버 인터페이스 | 로컬 완료 / **공유 랭킹은 서버 필요(차단)** | 50% |
| 5 | 업적·칭호·일일/주간 미션·출석 | 구현·테스트 완료 | 100% |
| 6 | 도감·상점·꾸미기(테두리/배경/칭호) | 구현·테스트 완료(임시 CSS 모양, 최종 에셋 보류) | 100% |
| 7 | Mini Game Land 연동(병합·SDK) · Sky 등록 준비 · 전체 회귀 | 진행 예정 | 0% |

테스트: `npm test`(단위 70) · `tools/platform-e2e.cjs`(Phase 1, 100) · `tools/platform-e2e2.cjs`(Phase 2~6, 78) — 393×636 · 390×844.

## 다음 작업
1. Phase 7: Mini Game Land 병합(의도적 1회) + SDK(`src/platform/sdk`) + 섬 활성화 + E2E
2. Food 패치 파일 준비(`docs/platform/food-patch/`) — 적용은 승인 대기
3. 전체 회귀 · 문서 · 최종 보고

## 차단 사항 (승인 필요)
- 온라인 랭킹 서버(Cloudflare 등) 개설·연결
- Food Adventure 저장소 패치 적용(별도 저장소, CLAUDE.md 금지 규칙과 충돌 → 명시 확인 필요)
- 최종 디자인/신규 에셋, 실제 iOS Safari 검증(미검증으로 표시)

## 작업 기록
- (시작) 브랜치 생성, 기존 문서·코드 확인
- Phase 2~6 코어+UI: 스키마 v2/마이그레이션, 결과 검증, 기록·보상·업적·도감·미션·상점, 세션/inbox, 결과 화면, 이 기기 순위, 설정·가져오기
- 버그 수정: 뒤로가기 스택이 `history.back()` 비동기 이동 중 `pushState` 하면 앱 밖으로 한 번 더 이탈(backStack 대기열로 수정)
