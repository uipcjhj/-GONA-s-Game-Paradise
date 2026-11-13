# Phase 1 구현 결과 (브랜치 `claude/platform-phase1`)

## 구현됨
- 닉네임 등록 3단계(이름 → 캐릭터 선택 → 환영), 실시간 검증, 등록 도중 새로고침 초안 복원, 뒤로가기 처리
- 로컬 플레이어(`gp.v1.player`): playerId(UUID v4) · 공개 식별코드 4자 · 스키마 검증 · 마이그레이션 체인 · 직전 정상본(.bak) 복구 · 손상 안내 화면
- 아바타 7종(고나 + 가족 6, 실제 Food 에셋 크롭) — 선택/변경이 등록·HUD·프로필·설정에 공통 반영
- 월드맵 HUD B안(헤더 좌 플레이어 버튼 · 우 코인) — **월드맵 영역·섬·터치 좌표 main 과 동일(측정 일치)**
- 하단 메뉴 WORLD / PROFILE / RANKING / MORE, MORE(업적·도감·미션·상점=준비 중, 설정=실제)
- 프로필(XP 진행률·코인·가입일·편집), 랭킹 준비 중(게임/기간 탭 구조, 가짜 데이터 없음), 설정(효과음·BGM(준비 중)·닉네임·아바타·백업·복원·초기화)
- 랭킹 인터페이스(`src/services/ranking.ts`) — 구현체 없음, Cloudflare 연결 없음

## 저장 범위
- 플랫폼 키: `gp.v1.player`, `gp.v1.player.bak`, `gp.v1.player.corrupt`, (sessionStorage) `gp.v1.regdraft`
- 보존(초기화·복원이 건드리지 않음): `gona.openingSeen`, `gona.mute`, 다른 게임 키(`dino-snack-adventure.*` 등)
- 효과음 on/off 는 기존 `gona.mute` 키를 그대로 사용, BGM 은 아직 없어 토글 비활성(설정값만 데이터에 있음)

## 테스트
- 단위 `npm test` (Vitest 5.1): 32개 — 닉네임, ID/코드, 저장·로드, 마이그레이션, 백업·복원, 초기화, 손상, 저장소 오류
- 브라우저 `tools/platform-e2e.cjs`: 393×636 · 390×844 각 50개(합계 100개) — 등록, 아바타, 월드맵, 재방문, 닉네임/아바타 변경, 프로필, 랭킹, 설정, 백업·복원, 초기화, 손상 복구, 섬 터치, Food 링크, 오프닝 회귀, 가로 스크롤·콘솔 오류
- 월드맵 회귀: `tools/mobile-shots.cjs`(수정 전 main vs 수정 후)

## 승인 대기
아바타 구성 확정(AVATAR_SURVEY.md) · 몬스터/보스 4종 포함 여부 · 최종 UI 디자인.
