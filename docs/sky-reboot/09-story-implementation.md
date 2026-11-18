# 09 · 스토리 · 대화 · 빌런 · 엔딩 구현 현황 (응가 테마)

> 응가 테마(`VITE_SKY_THEME=poop`)에서만 동작. 케이크 테마는 대사·빌런 단계가 없어서 대본·엔진 동작이 그대로다.

## 1. 실제 게임 흐름
| 순간 | 구현 | 코드 |
|---|---|---|
| 프롤로그 | 첫 플레이 때 오프닝 6장(원화 정지 컷 + 자막, 스킵) — 기존 | `theme.ts` opening · `SkyGame.tsx` |
| 스테이지 시작 | 배너 직후 대화: 고나 1줄 + 선택 동료 1줄 (동료 6명 각각 다름) | `story.ts` start |
| 빌런 장난 | 뽀글이·꾸덕이가 내려와 대화 → 가스 방울 고리 + 쌀알 졸개 5기 → 웃으며 도망 | `engine.ts` updateVillain · `story.ts` prank |
| 중간보스 호출 | 빌런 대화 → 도망 → 중간보스 등장 | callMid |
| 중간보스 | 등장 대사 · 격파 대사 · 48초 버티면 도주 대사 | midIn · midDown · midFlee |
| 보스 호출 | 빌런이 보스를 부르며 도망 → WARNING → 보스 | callBoss |
| 보스 | 등장 대사(+동료 반응) · 2페이즈 · 3페이즈(FINAL은 가족 협력 대사) · 격파 대사 · 응가 열차 한 칸 전진 | bossIn · bossP2 · bossP3 · bossDown |
| 정산 | 응가 열차 진행도 (6칸) | `SkyGame.tsx` tally-train |
| 최종 엔딩 | 응가 열차 출발 → 하얀 화면 → 현실 · 고나 힘주기(흔들림) → 뿡! → 응가 성공 · 가족 6명 반응(말하는 사람 강조) → 포옹·하트 → 크레딧 | `PoopEnding.tsx` |

대화창 (`TalkBox.tsx`): 남색 창 + 금색 이중 테두리, 초상화 칸(가족·고나 = 얼굴 아이콘, 뽀글이·꾸덕이 = 표정 3종, 보스 = 그 순간 페이즈 그림, 응가 열차 = 열차 그림), 이름표, 한 글자씩 타이핑, 터치(찍는 중이면 한 번에 표시 → 다음 줄), SKIP(대화 전체), 키보드 Enter/Space/Z · Esc.
대화 중에는 엔진이 완전히 멈추고(탄·적·타이머 정지, 입력 무시), 끝나면 재개 + 0.8초 무적. 같은 순간에 대사가 겹치면 대기열로 차례대로.

## 2. 그래픽 (이번 작업 · Higgsfield 5장 = 누적 20 크레딧 상한 도달)
| 에셋 | 파일 | 상태 |
|---|---|---|
| 뽀글이·꾸덕이 비행 4프레임 × 2 + 표정 초상화 3종 × 2 | `v3-poop/villain/duo.png` · `bbo-face.png` · `kku-face.png` | 신규 |
| STAGE 1 보스 거대 쌀떡 골렘 (3페이즈) | `v3-poop/stage1/boss.png` | 신규 |
| STAGE 1 중간보스 이유식 냄비 장군 (닫힘/열림) | `v3-poop/stage1/midboss.png` | 신규 |
| STAGE 1 일반 몹 5종 | `v3-poop/stage1/enemy-*.png` | 신규 |
| STAGE 1 배경 이유식 왕국 (세로 반복) | `v3-poop/stage1/bg-backdrop.png` | 신규 (옛 소품 끔) |
| 응가 열차 | `v3-poop/ending/train.png` | 신규 (엔딩 · 정산 · 대화 초상화) |

## 3. 남은 임시 에셋 (크레딧 상한으로 이번에 못 만든 것)
| 항목 | 지금 쓰는 것 |
|---|---|
| STAGE 2~6 배경·몹·중간보스·보스 | 케이크 STAGE 1 그림의 색변환본 (화면에 '※ 임시 그래픽' 표시) |
| 엔딩 전용 컷 (힘주는 고나 · 기저귀 확인 · 포옹 일러스트) | 승인된 고나·가족 원화 배치 + CSS 흔들림·김·하트 |
| 오프닝 컷 | 기존 원화 정지 컷 + 자막 |
| 타이틀 로고 | 케이크 로고 + 부제 텍스트 |
| 아이템(쿠키·딸기·바나나·별) · 적 탄 모양 | 케이크 버전 그대로 |
| 고나 전투 스프라이트 | 승인본 (최종 후보) |

다음에 만들 우선순위 (스테이지마다 4장 = 배경 1 · 몹 시트 1 · 중간보스 1 · 보스 1): STAGE 2 버섯가스 숲 → 3 소화 공장 → 4 수분의 바다 → 5 딱딱 응가 성문 → FINAL 변비마왕성.
같은 방식으로 `tools/sky-art-import.py` (boss/midboss `--auto-split`, grid `--main-blob`, bg `--fix-seam`) 와 manifest 의 `partDx/partDy/weakDy/bullet/noProps` 로 적용.

## 4. 검수
```
npm run build:poop && python3 -m http.server 8767 -d dist-poop
NODE_PATH=$(npm root -g) node tools/sky-story-check.cjs "http://localhost:8767/?skytest" shots 393 636 mom 1-6
#   스테이지 1→6 자동 진행(엔진 sim + 자동 조종 + 무적) · 대화창이 뜨면 기록·캡처·터치로 진행 · 엔딩 장면별 캡처 → 크레딧
#   마지막 줄 '열린 대화 키' 로 스테이지별 10개 대화가 모두 열렸는지 확인
```
