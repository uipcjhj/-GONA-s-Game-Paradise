# 스토리 이어하기 · CONTINUE / ARCADE (2026-11-26)

## 저장 방식 (`src/sky/story-save.ts`)
- 키: `gona.skyadv.story` (모험가 프로필마다 · 두 번째 프로필부터 `…story.<프로필id>`) · 같은 내용을 `.bak` 에 먼저 쓰고 본 저장
- 칸: 동료 6 × 난이도 3 = 18칸 `fam:diff` → `{ stage(다음 시작), score, hp, bombs, power, arcade, at, v }`
- 저장 시점: 보스 격파 후 스테이지 클리어 → '다음 스테이지' 버튼과 같은 값 (점수·아이템 복제 없음) · 스테이지 도중 상태는 저장 안 함
- 깨진 저장 → `.bak` 으로 복구 · 깨진 원본은 `.broken` 에 보관
- 백업 코드(내보내기/불러오기)에 포함 · 클라우드 동기화 묶음에는 아직 미포함 (서버 연결 후 추가)

## CONTINUE / ARCADE
| | ARCADE CLEAR | CONTINUE CLEAR |
|---|---|---|
| 시작 | STAGE 1 '새 모험' | 체크포인트 이어하기 · 게임 오버 후 이어하기 |
| 판정 | 이어하기·재개 없이 STAGE 6 까지 | 그 외 완주 |
| 로컬 보드 | `arcade:<diff>` (완주만) | `cont:<diff>` |
| 온라인 공식 랭킹 | 제출 대상 (서버 연결 시) | 제출 안 함 |
| 사진·배지·엽서 | 둘 다 그대로 저장 | |
- 일시정지·화면 잠금은 아무것도 바꾸지 않음 (판이 이어지면 ARCADE 유지) · 앱 종료 후 체크포인트 재개 = CONTINUE
- 예전 `run:<diff>` 기록은 연속 여부를 알 수 없어 ARCADE 로 옮기지 않음 → CONTINUE 탭에 '이전 기록'으로 표시
- MEMORY HUNT(`hunt:`) · 오늘의 도전(`daily:`) 점수는 그대로 따로

## 자동 검사 (`tools/sky-story-save-check.cjs`) 23/23 (393×636) · 22/22 (390×844, ARCADE 전체 완주 생략) PASS
