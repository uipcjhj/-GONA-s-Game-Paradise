# 플랫폼 설계 문서 (설계 단계 — 개발 없음)
- [MASTER_PLAN](MASTER_PLAN.md) · [ARCHITECTURE](ARCHITECTURE.md) · [DATA_MODEL](DATA_MODEL.md) · [GAME_SDK_CONTRACT](GAME_SDK_CONTRACT.md) · [ROADMAP](ROADMAP.md)
- 시안: `prototype/index.html` (브라우저에서 열기, 우상단 ☰ 로 화면 이동, `?clean` 은 시안 메뉴 숨김) · 캡처: `screens/`

## 결정 현황
- D1 확정: 월드맵·로고 헤더 유지, 작은 플레이어 버튼 중심 → [HUD_OPTIONS](HUD_OPTIONS.md) (A/B/C 비교, **B 추천**, 최종 선택 대기)
- D2 확정: 알·별은 정식 픽셀 에셋으로 교체 예정, 지금 이미지 생성 금지 → [ASSETS](ASSETS.md)
- D3 확정: 한글·영문·숫자 2~10자, 중복 허용, playerId 식별
- D4: Cloudflare Workers + D1 우선 후보. 무료 한도·보안 확인 전 연결 금지
- D5 확정: 현재 GitHub Pages 도메인·기존 게임 주소 유지
- D6: Food 최소 연동 패치는 추후 허용, 이번 단계 수정 금지
- D7: XP·코인·종합 랭킹 수치는 임시 설계값, 운영 전 별도 승인
- D8: 초기 로컬 백업·복원, 온라인 복구 코드는 백엔드 단계에서 결정
- UI 디자인은 **최종 승인 전**(시안 수정 중)

추가 문서: [PHASE1_SPEC](PHASE1_SPEC.md) (Phase 1 확정 명세) · [HUD_OPTIONS](HUD_OPTIONS.md) · [ASSETS](ASSETS.md)

## Phase 2 설계 (Food Adventure 플레이 기록 연동)
- [PHASE2_FOOD_INTEGRATION](PHASE2_FOOD_INTEGRATION.md) · [GAME_RESULT_CONTRACT](GAME_RESULT_CONTRACT.md) · 시안 `prototype/phase2.html` / `screens/phase2/`
