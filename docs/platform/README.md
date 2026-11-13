# 플랫폼 설계 문서 (설계 단계 — 개발 없음)
- [MASTER_PLAN](MASTER_PLAN.md) · [ARCHITECTURE](ARCHITECTURE.md) · [DATA_MODEL](DATA_MODEL.md) · [GAME_SDK_CONTRACT](GAME_SDK_CONTRACT.md) · [ROADMAP](ROADMAP.md)
- 시안: `prototype/index.html` (브라우저에서 열기, 우상단 ☰ 로 화면 이동, `?clean` 은 시안 메뉴 숨김) · 캡처: `screens/`

## 승인이 필요한 결정
- D1 HUD 배치: A) 기존 로고 헤더 아래 한 줄(시안, 393×636에서 지도 약간 축소) / B) 헤더를 HUD로 대체
- D2 아바타 알·별 신규 도트 에셋 제작 승인 여부(현재 임시 도트)
- D3 닉네임 규칙(2~10자, 중복 허용, #식별코드 4자)
- D4 백엔드 선택(추천 Cloudflare Workers+D1) 및 계정 생성 승인
- D5 출처/도메인 전략(현 동일 출처 접두사 분리 vs 커스텀 도메인)
- D6 Food 저장소 최소 패치(~80줄) 허용 여부
- D7 XP·코인 수치, 일일 상한, 종합 랭킹 가중치
- D8 비밀 복구 코드 형식, 개인정보 고지 문구
