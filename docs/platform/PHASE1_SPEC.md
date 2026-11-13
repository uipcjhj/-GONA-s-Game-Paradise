# Phase 1 확정 명세 — 플레이어 기반 (구현 전 최종 확인용)

> 상태: **명세만 확정, 구현 시작 전.** 승인 후 새 브랜치에서 개발. 이번 단계는 디자인 시안까지.

## 목표
닉네임으로 시작하는 로컬 플레이어를 만들고, 월드맵 HUD(안 B)와 프로필·설정(로컬 백업/복원)까지 연결한다. 서버·점수·XP·Food 연동은 **포함하지 않는다.**

## 구현할 기능 (정확한 범위)
1. **플레이어 생성**: 타이틀의 기존 "탭해서 시작" 이후, 저장된 플레이어가 없으면 등록 화면(3단계: 닉네임 → 아바타 → 환영)으로. 있으면 바로 월드맵. 타이틀 화면의 디자인·연출 변경 없음.
2. **닉네임 규칙(D3)**: 한글·영문·숫자 2~10자, 공백·특수문자 불가, 부적절 표현 사전 검사(초기 목록은 설정 파일로 분리), **중복 허용**. 내부 `playerId`(UUID v4, `crypto.randomUUID` + 폴백)로 식별, 표시용 `shortCode` 4자(혼동 문자 0·O·1·I·L 제외) 로컬 생성. 닉네임 변경 시 playerId·기록 유지.
3. **아바타**: 고나·딸기·쿠키 선택 가능, 알·별은 "준비 중" 잠금 슬롯(ASSETS.md). 나중에 프로필에서 변경.
4. **로컬 저장**: 키 `gp.v1.player`(+ 직전 정상본 `gp.v1.player.bak`), `gp.v1.meta`(schemaVersion). 마이그레이션 함수 체인 틀. 파싱/검증 실패 시 `.bak` 복구 시도 → 실패하면 타이틀 이후 "저장 기록을 읽을 수 없어요" 안내(백업 복원 / 새로 시작). 기존 `gona.openingSeen`·`gona.mute` 키는 그대로.
5. **월드맵 HUD(안 B)**: 로고 헤더 좌측 플레이어 버튼(아바타·닉·LV·XP), 우측 코인칩(Phase 1은 0 표시). 지도·고나·터치 좌표·이동 로직 변경 없음. 버튼 탭 → 프로필.
6. **프로필(최소)**: 아바타·닉네임·#코드·가입일·LV1·칭호 없음 표시, 아바타/닉네임 변경. 통계·업적 영역은 "준비 중".
7. **설정(최소)**: 닉네임·아바타 변경, **로컬 백업(JSON 파일 내보내기)/복원(가져오기, 형식·버전 검증)**, 저장 데이터 초기화(확인창), 저장 한계 안내. BGM/효과음은 기존 `gona.mute` 연동 토글.
8. **하단 메뉴**: WORLD / PROFILE / RANKING / MORE. RANKING은 "온라인 랭킹 준비 중" 화면(가짜 순위 없음), MORE는 설정 + 나머지 항목 "준비 중".
9. **UI 부품(최소)**: PixelButton, PixelPanel, PixelModal, ConfirmDialog, PlayerButton, CoinChip, AvatarSelector, Toast.

## 포함하지 않음
서버/Cloudflare 연결, 세션·점수 기록, XP/코인 획득, 업적·미션·도감·상점, 랭킹 데이터, Food Adventure 수정/연동, 신규 이미지 생성, 새 외부 서비스·키.

## 파일 변경 범위
- **수정**: `src/App.tsx`(화면 상태 title/register/map/profile/…, 등록 분기), `src/components/WorldMap.tsx`(헤더 HUD 슬롯), `src/components/BottomNav.tsx`(탭 연결), `src/components/InfoViews.tsx`(준비 중 화면 정리), `src/services/player.ts`(자리표시 타입 → 실제 타입), `src/types.ts`, 전역 CSS 일부(HUD·공통 UI), `package.json`(Vitest devDependency 추가 시 — **승인 필요**).
- **신규**: `src/platform/{storage,player,nickname,migrate,backup,ids}.ts`, `src/screens/{Register,Profile,Settings,RankingPlaceholder}.tsx`, `src/ui/{PixelButton,PixelPanel,PixelModal,ConfirmDialog,PlayerButton,CoinChip,AvatarSelector,Toast}.tsx`, `src/ui/pixel.css`, `public/assets/avatars/{strawberry,cookie}.png`(복사), `src/platform/*.test.ts`, `tools/platform-shots.cjs`.
- **수정 금지**: `public/assets/gona-world-map.png`, 타이틀/로고 에셋, `src/data/world.ts` 좌표, Food 저장소 전체.

## 테스트 항목
- 단위: 닉네임 검증(길이·문자·금지어·공백), shortCode 생성, 마이그레이션 체인, 손상 JSON 복구, 백업 가져오기 검증.
- E2E(393×636, 390×844): 첫 실행 → 등록 → 월드맵 HUD, 재방문 자동 인식, 저장 삭제 후 재등록, 손상 안내, 섬 선택·고나 이동·터치 좌표·팝업 회귀, 프로필 변경, 백업/복원 왕복, 콘솔 오류 없음.
- `npm run typecheck` / `npm run build` 통과, 타이틀·월드맵 전후 스크린샷 비교(디자인 변경 없음 확인).

## 위험
iOS Safari 저장 삭제(안내·백업으로 완화), 헤더 별 장식 대체(안 B 승인 필요, 후퇴안 C), localStorage 동일 출처 공유(접두사 `gp.v1.`로 분리), 금지어 목록 오탐, 모바일 키보드가 등록 화면을 가림(스크롤·viewport 처리 테스트).

## 완료 기준
재방문 시 닉네임 자동 인식 · 저장 손상 시 앱이 죽지 않고 복구 안내 · 백업→초기화→복원으로 동일 상태 · 월드맵 기존 동작/좌표 불변 · 타이틀 시각 변화 0 · 모바일 스크린샷 승인 후에만 main.
