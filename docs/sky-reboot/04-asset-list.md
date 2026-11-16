# 04 · 에셋 목록

규격 기준 (기존 에셋 실측 · 엔진 렌더 기준)
- 논리 화면 180×320, 캔버스 2배 표시 → **원본은 표시 크기의 2배** 이상.
- 저장 경로: `public/assets/sky/v3-poop/…` (케이크 `v2/` 는 건드리지 않음).
- 투명 PNG (배경 L1 만 불투명). 스프라이트 시트는 **가로 한 줄 프레임**.
- 우선순위: **P0** = Stage 1 수직 슬라이스 필수 · **P1** = Stage 1 품질 향상 · **P2** = Stage 2~6

## A. 캐릭터 (7명)
| 에셋 | 파일 | 원본 규격 | 프레임 | 표시 | 아트 | 우선 |
|---|---|---|---|---|---|---|
| 선택화면 원화 ×6 | `chars/<id>/illust.png` | 높이 900 (폭 600~780) | 1 | 선택화면 | 셀애니 일러스트 (의상 리디자인) | P0 |
| 얼굴 아이콘 ×7 | `chars/<id>/face.png` | 160×160 | 1 | 로스터·필살 버튼 | 셀애니 | P0 |
| 필살기 컷인 ×7 | `chars/<id>/cutin.png` | 720×360 | 1 | 필살기 발동 | 셀애니 + 집중선 | P0 |
| 동료 비행 스프라이트 ×6 | `chars/<id>/fly.png` | 88×112 × 4 = 352×112 | 4 (대기2·공격2) | 44×56 | 픽셀아트 후방 3/4 | P0 |
| 고나 전투 스프라이트 | `chars/gona/sprite.png` | 96×96 × 4열 × 10행 (기존 규격) | 기존 | 48 | 픽셀아트 | 재사용 (P2 리터치) |
| 할머니 화난 얼굴 | `chars/halmeoni/face-angry.png` | 160×160 | 1 | 필살기 | 셀애니 | P1 |
| 유산균 3종 | `chars/samchon/probiotic-<a,b,c>.png` | 32×32 × 4 | 4 | 16 | 픽셀아트 | P0 |

## B. 공격 이펙트 (픽셀아트 · 가족별)
| 에셋 | 파일 | 원본 | 프레임 | 우선 |
|---|---|---|---|---|
| 엄마 물방울탄 · 물줄기 | `fx/mom-drop.png` · `fx/mom-stream.png` | 16×16 · 24×64 | 2 · 3 | P1 (현재 단순 도형 임시) |
| 엄마 목욕 폭포 | `fx/mom-waterfall.png` | 160×320 | 4 | P1 |
| 아빠 물대포탄 · 수압 빔 | `fx/dad-shot.png` · `fx/dad-beam.png` | 12×24 · 32×320 | 2 · 3 | P1 |
| 이모 프룬탄 · 프룬 폭발 | `fx/imo-prune.png` · `fx/imo-burst.png` | 16×16 · 64×64 | 2 · 4 | P1 (현재 단순 도형 임시) |
| 할머니 불꽃·하트 | `fx/halmeoni-flame.png` | 64×64 | 6 | P1 (현재 입자 + 기존 하트 임시) |
| 할아버지 방패 돔 | `fx/halabeoji-dome.png` | 96×96 | 4 | P1 (현재 점 입자 임시) |
| 근접 공격 슬래시 ×6 | `fx/melee-<id>.png` | 64×64 | 4 | P1 |

## C. Stage 1 — 이유식 왕국
| 에셋 | 파일 (`stage1/…`) | 원본 | 프레임 | 표시 | 우선 |
|---|---|---|---|---|---|
| L1 원경 | `bg-far.png` | 360×640 세로 이음 | 1 | 전체 | P0 |
| L2 중경 (이유식 강·쌀알 섬) | `bg-mid.png` | 360×640 투명, 세로 이음 | 1 | 전체 | P0 |
| L3 근경 소품 ×4 | `prop-spoon.png` · `prop-bowl-castle.png` · `prop-rice-island.png` · `prop-veggie-island.png` | 128~200 | 1 | 40~100 | P0 |
| L4 김·강 물결 | `fx-steam.png` · `fx-river.png` | 96×32 · 360×64 | 4 | — | P1 |
| 쌀알 병사 | `enemy-rice.png` | 64×64 | 2 | 27 | P0 |
| 당근 전투기 | `enemy-carrot.png` | 72×72 | 2 | 30 | P0 |
| 브로콜리 박쥐 | `enemy-broccoli.png` | 80×80 | 2 | 34 | P0 |
| 완두콩 포탑 | `enemy-pea.png` | 64×64 | 2 | 28 | P0 |
| 감자 방패병 | `enemy-potato.png` | 72×72 | 2 | 32 | P1 |
| 냄비 수송선 | `enemy-potship.png` | 128×128 | 1 + 파손 1 | 57 | P0 |
| 중간보스 이유식 냄비 장군 | `midboss-pot.png` | 200×200 | 2 (뚜껑) + 파손 1 | 80 | P0 |
| 보스 거대 쌀떡 골렘 | `boss-p1.png` · `boss-p2.png` · `boss-p3.png` | 440×440 | 페이즈별 1 | 110 | P0 |
| 보스 파손·격파 | `boss-break.png` | 440×440 | 2 | 110 | P1 |
| 보스 부품(그릇 포탑) | `boss-part-bowl.png` | 80×80 | 2 | 20 | P0 |
| 적 탄 세트 | `bullets-stage1.png` | 16×16 × 6종 | 2 | 6~10 | P1 (현재 엔진 탄 재사용) |
| 드롭 아이템 | `items-stage1.png` (숟가락 P · 쌀알 금화 · 젖병 폭탄 · 딸기) | 24×24 × 4 | 2 | 12 | P1 |
| 폭발·파편 | `fx-explosion-stage1.png` | 320×80 (80×80 × 4) | 4 | — | 재사용 가능 |

## D. UI · 컷신
| 에셋 | 파일 | 원본 | 우선 |
|---|---|---|---|
| 타이틀 키아트 (응가 대탈출) | `title/keyart-poop.jpg` | 688×1024 | P0 |
| 타이틀 로고 "The Great Poo Escape!" | `title/logo-poop.png` | 640×430 | P0 |
| 대화창 프레임 | `ui/dialog-frame.png` | 360×96 (9-slice) | P0 |
| 대화 얼굴 (표정 3종 × 7명) | `chars/<id>/talk-<normal,happy,shock>.png` | 128×128 | P1 |
| 오프닝 컷 9장 | `cutscene/op-01..09.png` | 720×540 | P0 (1·4·7·8 우선) |
| 엔딩 컷 7장 | `cutscene/ed-01..07.png` | 720×540 | P2 |
| 응가 열차 진행 표시 | `ui/train-map.png` | 360×80 | P1 |
| WARNING 배너 | 엔진 텍스트 재사용 | — | 재사용 |

## E. Stage 2~6 (P2)
각 스테이지: 배경 L1·L2 + 근경 소품 4 + 일반 몹 5 + 중간보스 1 + 보스 3페이즈 + 적 탄 세트 + 드롭 아이템. 목록·디자인은 `03-stage-bible.md`.
