# 안전한 배포 순서 (Food · 플랫폼) — 모든 단계는 사용자 승인("승인, 배포해") 후

현재 배포 구조: Paradise 는 `main` push → GitHub Actions(`deploy.yml`) → GitHub Pages. Food(`uipcjhj/GoNa`)는 `pages.yml` 이 `main`(운영)과 `dev`(**`/dev/` 경로로 공개**)를 함께 빌드·게시하고 `verify-site.cjs` 로 "운영 빌드에 개발 도구 없음"을 검사한다. → Food 의 `dev` 브랜치에 푸시하면 개발 사이트가 공개되므로 **이번 작업에서는 `claude/paradise-link` 만 사용하고 `dev` 는 건드리지 않았다.**

## 0. 사전 (배포 전)
1. 이 브랜치의 모든 테스트 통과 확인(`RELEASE_CANDIDATE_REPORT.md`), `IPHONE_CHECKLIST.md` 수동 확인 완료.
2. 사용자 결정(`RELEASE_CHECKLIST.md` C): Sky/Mini 공개 여부, 보상 수치, 온라인 랭킹 시점.

## 1. 단계적 배포 (되돌리기 쉬운 순서)
| 단계 | 내용 | 확인 | 되돌리기 |
|---|---|---|---|
| ① 플랫폼 단독 | `platform-release-candidate` → main 병합 → Pages 배포. **`FOOD_LINK` 는 여전히 pending**(Food 패치 미반영), Sky/Mini COMING SOON, 온라인 서버 없음 | 운영 URL 에서 가입→월드맵→홈탭 전 화면, 기존 Phase 1 사용자 데이터 마이그레이션(기존 계정으로 접속해 기록 유지) | main 을 직전 커밋(84919a1)으로 되돌려 재배포 |
| ② Food 패치 | Food `claude/paradise-link` → Food main(운영) 병합 → `pages.yml` 이 `verify-site` 통과 후 배포. 패치는 `?gp=<세션>` 이 있을 때만 활성이라 **단독 실행에는 영향 없음** | Food 단독 플레이 회귀(`live-e2e standalone`), 운영 번들에 테스트 메뉴/`__gona` 없음 | Food main 되돌리기(패치는 `paradise.ts` 1개 + `main.ts` 2줄) |
| ③ 기록 연동 켜기 | Paradise 의 `FOOD_LINK` 조건에서 `PROD_FOOD_URL` 제외를 풀고(`games.ts`) 재배포 | 운영 Paradise → 운영 Food → 한 판 → 결과 화면(실제 기기) | ③ 커밋만 되돌려 재배포(기록은 로컬이라 손실 없음) |
| ④ 온라인 랭킹 | `CLOUDFLARE_SETUP.md` 절차로 Worker/D1 생성 → 서버 점검 → `VITE_RANKING_API` 를 넣어 Paradise 재배포 | 등록·점수 제출·랭킹 표시, 레이트 리밋, 무료 한도 모니터링 | `VITE_RANKING_API` 제거 후 재배포(앱은 "준비 중" 표시로 복귀) |
| ⑤ Sky · Mini 공개 | 상태 `live` + `SKY_DEV`(`?dev`) 게이트 제거 + 서버 `games.ts` 동기화 | 두 게임 실제 기기 확인 | 상태를 COMING SOON 으로 되돌려 재배포 |

원칙: 한 번에 한 단계, 각 단계 후 운영 URL 직접 확인, 문제 시 해당 단계만 되돌린다. ③ 은 ② 가 운영에서 확인된 **뒤에만**. 권한·브랜치 보호로 직접 배포가 안 되면 성공이라고 보고하지 말고 필요한 조치를 알린다(CLAUDE.md).
