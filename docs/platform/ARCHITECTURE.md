# 아키텍처 (ARCHITECTURE)

## 1. 현재 코드 분석
**Paradise** (React 19 + Vite + TS, `base:'./'`, main push 시 GitHub Pages 배포)
- `src/App.tsx` 화면 상태(title/map)와 지도 레이아웃(VIEW 크롭), `components/{Title,WorldMap,IslandPanel,BottomNav,InfoViews}`, `data/{islands,world}.ts`(섬 hit·경로, 이미지 좌표계), `services/player.ts`(자리표시 타입), `sfx.ts`(WebAudio).
- localStorage: `gona.openingSeen`, `gona.mute`.
**Food Adventure** (Phaser 4, `uipcjhj/GoNa`, 읽기 전용)
- `src/storage.ts` 래퍼(`STORAGE_PREFIX`), 키 `dino-snack-adventure.{best,muted,bestStage}`, `gona.checkpoint`, `gona.vibrate`, `gona.perf`.
- 점수는 `GameScene`의 `this.score += points`; 게임오버 `bus.emit(EV.gameOver, GameOverInfo{score,best,isNewBest,snacks,growthLevel,…,cleared?})`, 엔딩 `finishGame()`. 이벤트 버스 `src/events.ts` → 최소 침습 연동 지점이 이미 존재.
**제약**: 두 앱은 동일 출처 localStorage 공유(충돌·변조 위험), 현재 서버 없음.

## 2. 공통 구조 (Paradise 내부, `src/platform/*` 로직 / `src/screens/*` / `src/ui/*`)
모듈: Player System · Game Registry · Game Session · Score System · Leaderboard · Progression(XP/레벨/코인) · Achievement · Inventory · Missions · Settings · Persistence · Backend API.
```
UI(screens/ui) → 도메인 모듈 → Repository 인터페이스
                              ├ LocalRepository (localStorage, gp.v1.*, 스키마 버전 + 마이그레이션)
                              └ RemoteRepository (Workers API, 선택)   ← outbox 재시도, sessionId 멱등
```
- `interface Storage { get/set/remove/export/import }` 로 교체 가능. 손상 시 파싱 실패 → 백업본 복구 안내.
- 에러 처리: 네트워크 오류는 UI 상태(오류/재시도)로, 로컬 기능은 영향 없음.
- UI 컴포넌트(픽셀 디자인 시스템): PixelButton, PixelPanel, PixelModal, PlayerBadge, AvatarSelector, CoinCounter, XPBar, GameCard, LeaderboardRow, AchievementBadge, ToastNotification, BottomNavigation, ConfirmDialog.
- 내비게이션: 화면 스택/해시 라우트, 모달 1개 + 확인창, popstate로 최상단 닫기.
- 테스트: Vitest(닉네임 검증, 마이그레이션, XP/레벨, 랭킹 환산식, KST 주차) + Playwright e2e(393×636/390×844) + Miniflare 계약 테스트.

## 3. 무료 백엔드 비교
| 항목 | Cloudflare Workers + D1 | Supabase Free | Firebase Spark |
|---|---|---|---|
| 무료 한도 | D1: 일 500만 행 읽기·10만 행 쓰기, 계정 5GB(DB당 500MB). 2026-09-01부터 일일 한도 초과 시 00:00 UTC까지 쿼리 실패 | DB 500MB/프로젝트, MAU 5만, 프로젝트 2개, **1주 미사용 시 일시중지**(데이터 보존) | Firestore 일 읽기 5만·쓰기 2만, 초과 시 해당 월 제품 중지, Cloud Functions는 Spark 가용성 자료 상충(확인 필요) |
| 구축·유지 | 코드 직접 작성(Worker 1개), 난이도 중 | 대시보드 + RLS, 난이도 낮음~중 | SDK 쉬움, 보안 규칙·집계 복잡 |
| GitHub Pages 연동 | CORS만 설정, 쉬움 | 쉬움 | 쉬움 |
| 익명 플레이어 | **커스텀 토큰(자체 설계)** — 닉네임 전용에 가장 잘 맞음 | 익명 로그인 제공(MAU 계산) | 익명 인증 제공 |
| DB 보안 | 클라이언트가 DB에 직접 접근하지 않음(Worker 경유) | RLS 정책 실수 위험 | 규칙 실수 위험 |
| 점수 검증 | Worker 코드로 자유롭게 구현 | Edge Function 필요 | Functions 필요(요금제 확인) |
| 주간 집계 | Cron Trigger + SQL | pg_cron/SQL 뷰 | Functions 스케줄 |
| 중단·한도 위험 | 일일 한도 초과 시 랭킹만 중단(캐시로 완화) | 비활성 일시중지 → 랭킹 공백 가능 | 월 한도 초과 시 중지 |
출처: developers.cloudflare.com/d1/platform/{pricing,limits}, supabase.com/pricing, supabase.com/kb/faqs/platform/free-project-pausing, firebase.google.com/docs/firestore/quotas. Workers 무료 일일 요청 한도는 **착수 전 재확인 필요**.
**추천: Cloudflare Workers + D1**(+ 응답 캐시로 읽기 절감). 대안: Supabase. 실제 구현·계정 생성·키 등록은 **승인 후**.

## 4. 보안 / 부정 방지
- 신원: 서버 발급 `playerId` + 무작위 `playerToken`(서버는 해시만 저장). 닉네임·식별코드는 인증이 아님. playerId 단독도 인증이 아님.
- 복구: 고엔트로피 **비밀 복구 코드**(1회 표시, 해시+pepper 저장, 속도 제한, 사용 시 토큰 교체), 공개 식별코드와 분리.
- 점수: 서버 발급 세션 시작/종료 시각, 게임별 최대점·초당 최대점 검증, 속도 제한, 이상치 플래그(랭킹 숨김), 선택적 리플레이 로그 표본 검사. weekId는 서버가 `(now+9h)`로 KST 계산.
- 개인정보: 닉네임·식별코드·플레이 기록만 수집, 이메일/전화 없음. 고지 문구 필요(결정 D8).
- 로컬 모드의 한계(시계·저장값 조작)를 UI/문서에 명시.

## 5. 단계 전략
Phase 1–3은 **외부 서비스 없이** 로컬로 완결, Phase 4에서 백엔드 도입. 서버 도입 시에도 앱은 서버 없이 동작(어댑터 교체).
