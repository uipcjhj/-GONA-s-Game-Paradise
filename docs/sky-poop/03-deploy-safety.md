# 배포 구조 · 재발 방지 점검 (GoNa Pages)

## 네 주소
| 주소 | 출처 | 배포 방법 |
|---|---|---|
| `/GoNa/` | GoNa `main` | `pages.yml`(main·dev 푸시) 또는 `pages-sky-test.yml`(sky-test) 가 매번 새로 빌드 |
| `/GoNa/dev/` | GoNa `dev` | 위와 같음 |
| `/GoNa/sky-test/` | `sky-test` 브랜치의 `sky-test/` (미리 빌드) | `pages-sky-test.yml` 만 포함 |
| `/GoNa/sky-poop-test/` | `sky-test` 브랜치의 `sky-poop-test/` (미리 빌드) | `pages-sky-test.yml` 만 포함 |

## 사고 원인 (2026-11-16)
- `sky-test` 에 푸시할 때마다 GitHub 기본 "pages build and deployment"(브랜치 기반 Jekyll 빌드)가 함께 실행되어, 브랜치 루트(README)를 사이트 전체로 올렸다. 늦게 끝난 쪽이 이김.

## 점검 결과
- 다른 브랜치(`pages-probe-tmp`) 푸시: 기본 빌드 **실행 안 됨**.
- Source 를 GitHub Actions 로 바꿨다는 안내 뒤에도 `sky-test` 푸시(09:20) 때 기본 빌드가 **다시 실행됨** → 배포 전에 취소함 (사이트 영향 없음 확인). 즉 설정상 여전히 `sky-test` 브랜치가 Pages 출처로 남아 있을 가능성이 높다.

## 남은 위험
1. `sky-test` 푸시 → 기본 빌드가 계속 실행되면 같은 사고 재발 가능 (설정 재확인 필요).
2. GoNa `main`·`dev` 푸시 → `pages.yml` 은 두 Sky 테스트 폴더를 모르므로 **두 테스트판이 사라짐** (정식·개발판은 정상). 복구: Actions 에서 "Pages + Sky tests" 를 수동 실행. 영구 해결은 `main`·`dev` 의 `pages.yml` 수정이 필요해 별도 승인 대상.

## 안전한 배포 절차 (설정 확인 전까지)
1. `sky-test` 푸시 직후 Actions 목록에서 "pages build and deployment" 가 생기면 즉시 취소.
2. 우리 워크플로 완료 후 네 주소 HTTP 200 · 정식판 JS 해시 · 두 테스트판 콘솔 오류 확인.
3. 이상 시 "Pages + Sky tests" 를 workflow_dispatch 로 다시 실행 (푸시가 아니므로 기본 빌드가 생기지 않음).
