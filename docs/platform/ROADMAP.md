# 단계별 로드맵 (ROADMAP)

공통: 별도 작업 브랜치 → 테스트·typecheck·build → 393×636/390×844 캡처·전후 비교 → 미리보기 → "승인, 배포해" 이후에만 main/배포.
의존성 재검토: **최소 Progression(XP/코인 표시)을 Phase 3에 포함**해 허브 HUD가 실제 값을 보이도록 함.

| Phase | 목표 | 주요 기능 | 수정 파일 | 신규 파일 | 외부 서비스 | 위험 | 테스트 | 완료 기준 |
|---|---|---|---|---|---|---|---|---|
| 1 플레이어 기반 | 닉네임 등록·로컬 저장 | 3단계 등록, 검증, 아바타, 마이그레이션, 손상 복구 안내 | `App.tsx`, `Title.tsx`(훅만), `services/player.ts` | `platform/{player,persistence,migrate}.ts`, `screens/Register.tsx`, `ui/*` | 없음 | iOS 저장 삭제, 타이틀 오염 | Vitest(검증·마이그레이션), e2e 등록 | 재방문 자동 인식, 타이틀 시각 변화 없음 |
| 2 월드맵 허브 | HUD·팝업·하단메뉴 | 플레이어 정보, 섬 팝업 확장, MORE | `App.tsx`, `WorldMap`, `IslandPanel`, `BottomNav` | `ui/PlayerBadge`, `CoinCounter`, `screens/Profile` | 없음 | 393×636 가림 | 스크린샷 비교, 좌표 테스트 | 섬/고나 미가림, 기존 이동·터치 동일 |
| 3 공통 기록·Food 연동 | 게임 세션·점수·최소 XP | Registry, Session, outbox, Food 결과 수신, 신규 게임 등록 규격 | `data/islands.ts`, `services/*` | `platform/{registry,session,score,progression}.ts` | 없음 (Food 패치는 별도 승인) | 동일 출처 키 충돌, 변조 | 계약 테스트, Food 단독 회귀 | Food 1판이 Paradise 프로필에 기록 |
| 4 온라인 랭킹 | 주간/역대/종합 | Workers+D1, 세션 검증, 캐시 | `services/backend` | `backend/worker/*`, `screens/Ranking` | **Cloudflare(승인·계정 필요)** | 한도·부정 점수 | Miniflare 계약, 부하·한도 | 서버 끊겨도 앱 정상, 미연결 상태 표시 |
| 5 진행·보상 | XP/레벨/코인/업적/칭호/미션 | 일일 상한, 출석 | `progression`, `screens` | `achievement.ts`, `missions.ts` | 없음 | 시계 조작, 인플레이션 | 상한·멱등 테스트 | 중복 보상 0 |
| 6 도감·상점·꾸미기 | 수집·꾸미기 | 도감, 상점, 아바타/테두리 | `inventory` | `codex.ts`, `shop.ts` + **신규 이미지(승인 후)** | 없음 | 에셋 비용 | e2e 구매 흐름 | 잔액 음수 불가 |
| 7 Sky/Mini 연동 | 신규 게임 편입 | 섬 활성화, 랭킹/업적 등록 | registry | 게임별 SDK 어댑터 | 없음 | 게임별 점수 규칙 | 계약 테스트 | 등록만으로 팝업·랭킹 반영 |
