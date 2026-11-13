# NIGHTLY PROGRESS (야간 자율 개발)

## 규칙 요약
승인 범위: Food 저장소 `uipcjhj/GoNa` 의 **기록 연동 최소 패치**(별도 브랜치 `claude/paradise-integration`), 플랫폼 브랜치 `claude/platform-home`.
금지: main 병합 · 운영 배포 · Cloudflare 실서비스 · 유료 API · 신규 이미지 · 승인 에셋 변경 · Food 규칙 변경 · Sky Battle 원본 수정 · 사용자 저장 데이터 삭제.

## 작업 목록 (우선순위)
| # | 작업 | 상태 |
|---|---|---|
| 1 | Food 실연동 | 진행 중 (패치 작성·빌드 완료, E2E4 디버깅) |
| A | 게임천국 전체 버그 수정 | 대기 |
| B | 모바일 UX | 대기 |
| C | UI 완성도 | 대기 |
| D | 보상 밸런스 | 대기 |
| E | 온라인 랭킹 서버 코드(로컬 Workers+D1) | 대기 |
| F | Sky Battle 연동 준비 | 대기 |
| G | 성능·품질 | 대기 |

## 재개 방법
- Food: `/home/user/gona` (브랜치 `claude/paradise-integration`), 빌드 `npx vite build --outDir /tmp/food-prod` / `VITE_CHANNEL=dev npx vite build --outDir /tmp/food-dev`
- 게임천국: `npm run build && cp -r /tmp/food-prod dist/GoNa && cp -r /tmp/food-dev dist/GoNaDev && npx vite preview --port 4173 &` → `NODE_PATH=$(npm root -g) node tools/platform-e2e4.cjs http://127.0.0.1:4173/ shots-p4`

## 기록
- (시작) Food 클론, 패치(`src/platform/{gp-sdk,paradise}.ts`, `main.ts` 2줄) 작성, `result.ts` 에 extra.carry(이어하기 점수) 반영
