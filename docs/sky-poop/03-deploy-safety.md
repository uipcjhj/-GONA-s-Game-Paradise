# GoNa Pages 배포 구조 (2026-11-16 통합) · 재발 방지

## 확인된 설정 (워크플로가 직접 읽은 값)
- `GET repos/uipcjhj/GoNa/pages` → **build_type = legacy, source.branch = sky-test** (2026-11-16 09:37 UTC, Actions 로그)
- 즉 Pages 출처가 아직 "Deploy from a branch: sky-test" — `sky-test` 에 푸시할 때마다 GitHub 기본 빌드(pages-build-deployment)가 브랜치 루트를 사이트 전체로 올린다. 이것이 사고 원인.

## 배포 워크플로 (단일 구조)
| 브랜치 | 파일 | 상태 |
|---|---|---|
| main | `.github/workflows/pages.yml` (통합본) | 커밋 `41851ee` |
| dev | `.github/workflows/pages.yml` (같은 통합본) | 커밋 `76c3657` |
| sky-test | `.github/workflows/pages.yml` (같은 통합본) + 옛 `pages-sky-test.yml` 삭제 | 로컬 커밋 `25f8196` — **Pages 출처가 바뀐 뒤에만 푸시** |

통합본 동작:
1. main · dev · sky-test 어느 쪽 푸시든 같은 워크플로 실행 → 네 경로(정식·dev·sky-test·sky-poop-test)를 각 브랜치 최신에서 **모두 다시 만들어 한 번에** 배포.
2. `concurrency: pages` (진행 중 취소 안 함) → 한 번에 하나씩, 마지막 결과는 항상 최신.
3. 배포 전 검사: Pages 출처가 GitHub Actions 가 아니면 **즉시 중단** · 정식/개발 필수 파일(verify-site) · 두 테스트판 존재 · 각 경로 js/css 참조 확인. 실패하면 배포 없음 → 현재 사이트 유지.
4. 복구: Actions → "Pages (Food + dev + sky-test + sky-poop-test)" → Run workflow 에서 `main_ref` · `dev_ref` · `sky_ref` 에 이전 커밋 입력.
   - 통합 전 정상 상태: main `a907834` · dev `a907834` · sky-test `daa4d72`
   - (태그로도 남기려 했으나 이 작업 환경의 git 프록시가 태그 푸시·브랜치 삭제를 막아 커밋 번호로 기록)

## 다른 배포 경로 (남아 있는 위험)
- `pages-test.yml` ("Test deploy") — `claude/dino-snack-game` 브랜치에 있음. 그 브랜치에 푸시하면 사이트 전체를 그 빌드로 덮어쓸 수 있음 (마지막 실행 11-11). 승인 범위(main·dev)를 넘어서 수정하지 않음.
  → 해결: Settings → Environments → github-pages → Deployment branches 를 `main`, `dev`, `sky-test` 만 허용.
- 게임 저장 데이터: 각 사용자 브라우저 localStorage (저장 키: 정식 `gona.*`, 개발 `gona-dev:*`, 케이크 테스트 `gona.skybeta.*`, 응가 테스트 `gona.skypoop.*`). 배포로 지워지지 않음.
