# 우선 제작 에셋 요청서 — STAGE 1 + 가족 6명 (응가 대탈출 팩)

> 상태: **요청서**. 이 세션에는 이미지 생성 도구가 연결되어 있지 않아 아래 그림은 아직 한 장도 없다. 게임에는 기존 승인 원화와 단순 탄환 모양(물방울·프룬 구슬·세균 점)이 **임시**로 들어가 있다.
> 유료 도구·Higgsfield 사용 금지. ChatGPT 이미지 생성(1순위) → Google Nano Banana 무료 범위(2순위). 생성 시 **반드시 기존 원화(`public/assets/sky/v2/chars/<id>/illust.png`)를 함께 첨부**.

## 0. 공통 화풍 기준 (기존 원화 실측 기반)
- 가족 원화: 셀 애니 일러스트, 굵은 진한 외곽선, 2~3단 명암, 600~780×900 투명 PNG.
- 비행 스프라이트: 88×112 프레임 × 4칸 가로 시트(352×112), 게임 표시 44×56. 후방 3/4 탑다운.
- 얼굴 아이콘 160×160, 컷인 720×360 (배경 포함).
- 적·보스: 표시 크기의 2배 이상 원본, 투명 PNG, 굵은 외곽선, 6색 + 하이라이트.
- 얼굴·머리 모양·체형은 **기존 그대로** (다른 사람처럼 보이면 불합격).

공통 프롬프트 끝 문장:
> "Keep the exact face, hairstyle and body proportions of the attached reference. Cel-anime illustration, thick clean dark outlines, 2-3 step cel shading, same colors and line weight as the reference, transparent background, no text, no logo, original design not copying any existing game."

## 1. 가족 6명 (우선순위 1)
| 가족 | 파일 (`public/assets/sky/v3-poop/chars/<id>/`) | 디자인 핵심 | 프롬프트 추가 문장 |
|---|---|---|---|
| 엄마 | `illust.png` · `face.png` · `fly.png` · `cutin.png` · `fx-waterfall.png`(4프레임 160×320) | 목욕가운 물마법사, 물방울·거품 | "Mom as a cheerful bath-robe water mage: white fluffy bath robe with pink belt, soap bubbles and water droplets floating around, holding a glowing bath-sponge wand." |
| 아빠 | 같은 5종 + `fx-waterbeam.png`(세로 띠 32×320, 3프레임) | 소방관풍 물대포 전사 (판타지 아케이드) | "Dad as a fantasy arcade firefighter: brass helmet, red-and-yellow coat, a big brass water cannon on his shoulder, strong confident eyes, curly brown hair visible." |
| 이모 | 같은 5종 + `fx-prune.png`(구슬 16×16 2프레임 + 폭발 64×64 4프레임) | 프룬 보랏빛 요정, 낮은 쪽머리·좁은 선글라스 | "Aunt as a stylish purple prune fairy: narrow black sunglasses, low bun, small translucent fairy wings, a purple prune-shaped magic cannon, playful smile." |
| 할머니 | `face-angry.png`(160×160) · `fx-flame-heart.png`(64×64 6프레임) · `cutin.png` | 외형 그대로 + 필살기 때만 화난 표정, 불꽃·하트 | "Same grandma, suddenly angry comic expression, warm orange flames and pink hearts bursting around her, both hands in a belly-massage gesture." |
| 할아버지 | 같은 5종 + `fx-shield-dome.png`(96×96 4프레임) | 갑옷 축소, 거대 방패 중심, 유산균 문양 | "Grandpa as a guardian with a giant round shield painted with friendly probiotic symbols, lighter armor, white hair, stern but cute face." |
| 삼촌 | 같은 5종 + `probiotic-a/b/c.png`(각 32×32, 4프레임 시트) | 유산균 연구자·소환사 (안경·헝클어진 머리 유지) | "Uncle as a probiotic researcher-summoner: lab coat, round glasses, messy hair, holding a glowing probiotic bottle; three cute smiling microbe creatures (round, capsule, curly) with tiny faces." |

## 2. STAGE 1 이유식 왕국의 반란 (우선순위 2)
| 에셋 | 파일 (`public/assets/sky/v3-poop/stage1/`) | 원본 크기 | 프레임 | 표시 |
|---|---|---|---|---|
| 원경 L1 | `bg-far.png` | 360×640 (위·아래 이어짐) | 1 | 화면 전체, 0.3배 스크롤 |
| 중경 L2 | `bg-mid.png` | 360×640 투명 | 1 | 0.6배 |
| 근경 L3 | `prop-spoon.png` · `prop-bowl-castle.png` · `prop-rice-island.png` · `prop-veggie-island.png` | 각 128~200 | 1 | 1.0배 |
| 환경 L4 | `fx-steam.png`(이유식 김) · `fx-river.png`(이유식 강 물결) | 96×32 / 360×64 | 4 | 실시간 |
| 쌀알 병사 | `enemy-rice.png` | 64×64 | 2 | 27px |
| 당근 전투기 | `enemy-carrot.png` | 72×72 | 2 | 30px |
| 브로콜리 박쥐 | `enemy-broccoli.png` | 80×80 | 2 | 34px |
| 변형 1 수프 그릇 포탑 | `enemy-soupbowl.png` | 64×64 | 2 | 28px |
| 변형 2 냄비 수송선 | `enemy-potship.png` | 128×128 | 1 | 57px |
| 중간보스 이유식 냄비 장군 | `midboss-pot.png` | 200×200 ×2 | 2 (뚜껑 열림) | 80px |
| 보스 거대 쌀떡 골렘 | `boss-p1.png` · `boss-p2.png` · `boss-p3.png` · `boss-hit.png` | 440×440 | 페이즈별 1 + 파손 | 110px |

프롬프트 예 (쌀알 병사): "Top-down 16-bit arcade shooter enemy: a small angry rice-grain soldier wearing a rice-husk helmet and holding a tiny spoon spear, facing downward, 2-frame idle (arms up/down), 64x64 canvas," + 공통 문장.
배경 원경 예: "Vertical seamless-tiling top-down background of a golden baby-food kingdom: a creamy porridge river, giant spoon towers, bowl-shaped buildings, rice and vegetable floating islands, warm sunset sky, 360x640, top and bottom edges must tile seamlessly," + 공통 문장 (배경은 불투명).

## 3. 받은 뒤 적용 순서 (Claude 담당)
1. 크기·투명도·가장자리 잘림 검사 → 축소·트리밍·팔레트 정리
2. `assets.ts` 에 v3-poop 경로 추가 (케이크 v2 경로는 그대로 두고 응가 팩에서만 사용)
3. 393×636 · 390×844 스크린샷 전후 비교, 탄 가독성 확인
4. 임시 표시(※ 임시 그래픽) 제거는 **최종 에셋이 모두 들어간 스테이지에만**
