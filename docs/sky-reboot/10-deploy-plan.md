# 10 · 응가 테스트판 안전 배포 계획 (2026-11-18 재점검)

## 1. 지금 상태 (직접 확인한 값)
| 항목 | 값 | 확인 방법 |
|---|---|---|
| GoNa Pages 출처 | **legacy · 브랜치 sky-test** (11-16 09:37 마지막 확인) | 통합 워크플로 run 43841403389 의 검사 단계 로그 |
| GoNa main | `41851ee` — 통합 워크플로 `pages.yml` | `git ls-remote` |
| GoNa dev | `76c3657` — 같은 `pages.yml` | `git ls-remote` |
| GoNa sky-test | `daa4d72` — 옛 `pages-sky-test.yml` (통합본 커밋 `25f8196` 은 로컬에만, 미푸시) | `git ls-remote` · 로컬 clone |
| 11-16 이후 배포 | 없음 (main·dev 통합 워크플로 2회 모두 '출처가 GitHub Actions 아님' 검사에서 스스로 중단 → 사이트 변화 없음) | Actions 실행 목록 |
| 이 저장소 (-GONA-s-Game-Paradise) | 자체 `deploy.yml` (main 푸시 시만) — GoNa 사이트와 별개 | |

## 2. 위험이 남아 있는 이유
- sky-test 브랜치 루트에는 `.github/`, `README.md`, `sky-test/`, `sky-poop-test/` 만 있다 (Food Adventure 파일 없음).
- 출처가 legacy(sky-test) 인 상태에서 sky-test 에 푸시하면 GitHub 기본 빌드가 **브랜치 루트를 사이트 전체로** 올린다
  → `/GoNa/` (정식 Food Adventure)와 `/GoNa/dev/` 가 사라지고 테스트판 두 폴더만 남는다.
- 그래서 **지금은 sky-test 에 푸시하지 않는다** (sky-poop-test 갱신도 보류).

## 3. 해결 순서 (사용자가 GitHub 화면에서 1번만 하면 됨)
1. **GoNa 저장소 → Settings → Pages → Build and deployment → Source 를 "GitHub Actions" 로 변경**
   - 바꾸는 순간에는 아무것도 배포되지 않는다 (지금 사이트 그대로).
   - main·dev 에는 이미 같은 통합 워크플로가 있어서, 이후 어떤 브랜치에 푸시해도 네 경로(정식·dev·sky-test·sky-poop-test)를 **모두 함께** 다시 만든다 → 한쪽 업데이트가 다른 쪽을 지우지 못한다.
2. (권장) Settings → Environments → github-pages → Deployment branches 를 `main`, `dev`, `sky-test` 만 허용
   - `claude/dino-snack-game` 브랜치의 옛 `pages-test.yml` 이 사이트 전체를 덮어쓰는 경로를 막는다.
3. 변경했다고 알려 주면 Claude 가:
   1. Actions → "Pages (Food + dev + sky-test + sky-poop-test)" → Run workflow (입력 비움) 로 **변경 없는 재배포** 1회 — 검사 단계에서 출처가 workflow 로 바뀐 것을 확인하고, 네 경로가 지금과 같은 내용으로 올라가는지 확인 (정식·dev·sky-test 접속 확인)
   2. 그다음 sky-test 브랜치에 통합 워크플로 커밋(`25f8196`) + 새 응가 테스트판 빌드 커밋을 푸시 → 같은 워크플로가 네 경로를 함께 배포
   3. https://uipcjhj.github.io/GoNa/ · /dev/ · /sky-test/ · /sky-poop-test/ 네 주소를 모두 열어 확인 · 커밋 번호 보고
4. 문제가 생기면: Actions → 같은 워크플로 → Run workflow 에 `main_ref`·`dev_ref`·`sky_ref` 이전 커밋을 넣어 복구
   (정상 기준: main `41851ee`(=게임 내용은 `a907834`와 같음) · dev `76c3657` · sky-test `daa4d72`)

## 4. 준비해 둔 것 (푸시하지 않음)
- GoNa 로컬 clone(`/home/user/gona`, sky-test 브랜치)에 응가 테스트판 새 빌드를 `sky-poop-test/` 로 넣은 커밋 — 출처 변경 확인 뒤에만 푸시.
- 케이크 테스트판(`sky-test/`) 파일은 건드리지 않음. Food Adventure(main·dev) 파일도 건드리지 않음.

## 5. 그동안 테스트 방법 (배포 없이)
- 미리보기 링크(Claude 아티팩트, 비공개): 최신 응가 테스트 빌드를 그대로 올려 둠 — iPhone Safari 에서 열어 플레이 가능.
- 로컬: `npm run build:poop && python3 -m http.server 8767 -d dist-poop` → `http://<주소>:8767/?dev` (미리보기 링크는 끝에 `#dev`)
