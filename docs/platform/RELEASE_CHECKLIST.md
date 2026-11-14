# 출시 체크리스트 — `claude/platform-release-candidate`

> 이 문서는 **출시 준비**입니다. main 병합·운영 배포·Cloudflare 생성은 아직 하지 않았고, 아래 "사용자 결정/승인" 항목이 정리된 뒤 "승인, 배포해" 를 받아야 진행합니다.

## A. 코드·테스트 (자동화 — 이 브랜치 HEAD 에서 모두 통과해야 함)
| 항목 | 명령 | 기준 |
|---|---|---|
| 타입 · 빌드 | `npm run typecheck` · `npm run build` | 오류 0 |
| 단위/통합 | `npx vitest run` | 전부 통과 |
| 플랫폼 e2e (운영 빌드) | `tools/platform-e2e.cjs` · `platform-e2e-full.cjs` | 100/100 · 116/116 |
| Sky · Mini | `tools/sky-e2e.cjs` · `tools/mini-e2e.cjs` | 28/28 · 24/24 |
| 온라인 랭킹(로컬 테스트 서버) | `backend/scripts/dev-server.ts` + `tools/platform-online-e2e.cjs` | 크기별 새 DB 18/18 |
| Food 실플레이(개발 빌드) | `tools/live-e2e.cjs` (over/refresh/standalone/clear) · `tools/live-boss-e2e.cjs` | 전부 통과 |
| 세 게임 통합 + 스트레스 | `tools/rc-integration-e2e.cjs` | 두 크기 20/20 |
| UI 감사 | `tools/ui-audit.cjs` | 경고 0 (두 크기 · 24개 화면) |
> 실제 결과 수치는 `RELEASE_CANDIDATE_REPORT.md` 참고.

## B. 운영 빌드 안전 점검 (배포 직전 반드시)
- [ ] 운영 빌드는 환경변수 없이 `npm run build` — 아래가 **설정되지 않았는지** 확인: `VITE_TEST_GAMES` · `VITE_MOCK_GAME_URL` · `VITE_DEV_SIM` · `VITE_SKY_PREVIEW` · `VITE_FOOD_LINK`(Food 정식 배포 전까지) · `VITE_RANKING_API`(서버 준비 전까지)
- [ ] 번들에 모의 게임 주소(`/mock/`)·`TOKEN_PEPPER`·`localhost` 문자열이 없는지 `grep -r` (e2e 가 일부 자동 확인)
- [ ] Food 운영 빌드에 테스트 메뉴·`__gona`가 없는지(`기능 테스트 메뉴` 문자열 0건 — Food `tools/verify-site.cjs` 가 CI 에서 확인)
- [ ] 월드맵 이미지·타이틀·오프닝·섬 좌표가 main 과 동일한지(`platform-e2e` 의 기하 비교 항목)

## C. 사용자 결정/승인이 필요한 항목
1. **Sky · Mini 공개 여부**: 지금 운영은 COMING SOON. 공개하려면 `src/platform/games.ts` 와 `src/data/islands.ts` 의 상태를 `live` 로 바꾸고, 서버 `backend/src/games.ts` 도 같은 값으로(parity 테스트가 확인). **공개할 때 `?dev` 로 열리는 개발 게이트(`SKY_DEV`)는 제거**할 것 — 지금은 운영 주소에 `?dev` 만 붙여도 두 게임이 열린다(기록은 로컬에만 저장, 온라인 제출은 서버가 거부).
2. **Food 기록 연동 켜기**: Food 패치(`claude/paradise-link`)를 Food main 에 반영·배포한 **뒤에** Paradise 의 `FOOD_LINK` 조건(`games.ts`: 운영 주소 `PROD_FOOD_URL` 에서는 `live` 가 되지 않도록 막혀 있음)을 수정. 순서는 `DEPLOY_ORDER.md`.
3. **보상·한도 수치(D7)**: 점수 한도(120/초·2,000,000·이월 60,000)는 **봇 데이터뿐이라 잠정값**. 실제 사람 플레이 후 조정.
4. **복구 코드(D8)**: 현재는 백업 파일 방식만(설정 > 백업, 이번에 가입 화면에서도 복원 가능). 계정/복구 코드 방식은 미정.
5. **몬스터·악당 아바타**: 정식 PNG 없음(`AVATAR_ASSET_SPEC.md`). 임시 그림 없이 잠금 상태로 출시.
6. **온라인 랭킹**: Cloudflare 계정·D1 생성은 승인 후(`CLOUDFLARE_SETUP.md`). 서버가 없으면 앱은 "온라인 랭킹 준비 중"을 보이고 가짜 순위를 만들지 않는다.
7. **실제 iPhone 확인**: `IPHONE_CHECKLIST.md` — 자동 테스트는 Chromium 모바일 에뮬레이션이라 대체 불가.

## D. 알려진 한계 (숨기지 않고 기록)
- Food 보스 재도전은 개발 진입(`?test=`)으로 검증했고, 정식 빌드의 정상 진행 경로로는 사람이 한 번 확인해야 함.
- Sky 점수 한도는 실제 사람 플레이 분포 없이 정함. Sky 의 장시간 방치·앱 전환 시나리오는 에뮬레이션 수준.
- 두 브랜치 중 `platform-home` 의 화면 꾸밈(9-slice 틀·리본·효과음·Mini 픽셀 스킨)은 **디자인 변경이라 이식하지 않음**(승인 디자인 보존). 필요하면 별도 디자인 검수 후 선택 이식.
- 구 `platform-home` 저장 데이터와 이 브랜치 저장 데이터는 필드 구성이 달라 **호환되지 않음**(같은 브라우저에서 두 빌드를 번갈아 열지 말 것). 운영 사용자는 main(Phase 1) 데이터 → 이 브랜치로의 마이그레이션 테스트(`migration.test.ts`)로 이어짐.
