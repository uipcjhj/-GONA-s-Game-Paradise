# Food Adventure 연동 패치 (준비만 — 미적용)
- `gp-sdk.ts`: 게임천국 SDK(= `src/platform/sdk/gp-sdk.ts` 사본, 의존성 없음). 이 저장소에서 단위 테스트됨(`gp-sdk.test.ts`).
- `paradise.ts`: Food 의 `bus` 이벤트에 붙는 어댑터 제안(~25줄). **Food 코드로 검증하지 않았음.**
- 적용 절차(승인 후): Food 저장소 별도 브랜치 → 두 파일 추가 + `main.ts` 1줄 → `dev` 사이트에서 봇(`playtest-bot`, `fullrun-bot`)으로 게임 오버·엔딩 확인 → 게임천국에서 `islands.ts` 의 Food `sdk: 'pending'` → `'live'`.
- 게임천국은 이미 결과를 받을 준비가 끝나 있어 Food 를 패치하지 않아도 아무 문제가 없다(세션만 생기고 결과가 없음 → "기록 연동 준비 중" 표시).
