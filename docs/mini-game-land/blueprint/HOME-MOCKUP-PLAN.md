# 홈 화면 고품질 시안 — 생성 계획 (대기 중: 생성 도구·단가 확인 불가)

상태: **생성 안 함.** 이 세션에서 Higgsfield 서버가 연결은 되지만 생성·잔액·단가 도구를 제공하지 않고, 대안(Canva generate-image)은 승인된 20크레딧 기준과 단가를 확인할 수 없어 사용하지 않았습니다. 승인 조건("단가 확인 불가 시 생성하지 말고 보고")에 따라 중단.

## 도구가 복구되면 순서
1. `balance`(잔액) → `models_explore`(모델·제약) 로 **모델과 1장당 차감 크레딧 확인** → 20크레딧 초과 가능성 있으면 생성하지 않고 보고.
2. 참고 이미지 2장 업로드(승인된 에셋에서만): `ref-gona.png`(고나 ×8 정수 확대, 얼굴·머리카락 한 가닥·연두 슈트 기준), `ref-island.png`(월드맵 미니게임천국 섬 — 놀이공원 스타일 기준).
3. **1장만** 생성(9:16 세로) → 차감량(`transactions`)·모델·결과 보고. 추가 생성은 별도 승인.

## 프롬프트 초안 (영문, 모델용)
> Vertical 9:16 mobile game HOME SCREEN mockup, crisp 16-bit pixel art, warm and refined like Stardew Valley but with a retro arcade + amusement-park mood, NOT childish. Top: a wooden marquee sign with navy panel and gold light bulbs reading "GONA's Mini Game Land" with a small coral ribbon "고나의 미니게임천국". Middle: a sunny plaza with a ferris wheel and striped tents behind, a cute baby dinosaur-suit character (reference image 1: keep its exact face, single strand of hair, lime-green dinosaur suit, same colors and outline) standing and waving in front, big readable. Bottom: a cream ticket-board panel with two tab buttons (coral "자유 플레이", mint "랜덤 챌린지"), three striped-awning game booths (one active, two locked "COMING SOON"), a large golden start button, small footer buttons. Palette: cream #fff1d0, mint #a8e6cf, coral #ef845b, wood #b57b4e, butter #f9e49a, sky-blue accent #1dadfd only as accent, UI outlines navy #173073, character outlines brown #3b2419. Thick clean pixel outlines, 1px-dot grid consistency, no anti-aliasing, no gradients, no blur, no photorealism, no 3D. Match reference image 2 (the "Mini Game Land" island of the world map) for style.

## 후처리 (PIL, 크레딧 없음)
생성본 → 논리 해상도 196×318(×2 = 393×636)로 최근접·격자 정렬 축소 → 팔레트 양자화(위 팔레트 + 고나 색) → 정수 배율 확대 → 텍스트 영역(한글·숫자)은 Galmuri 폰트로 재합성(생성형은 한글 글자를 깨뜨림).

## 에셋 전환 가능성(예상)
- 배경(하늘·대관람차·텐트·잔디): 생성본에서 분리해 B1 에셋으로 사용 가능성 높음.
- 고나: **생성본을 쓰지 않고 승인된 `gona.png` 사용**(외형 일관성). 포즈 추가분만 별도 제작 필요.
- 버튼·패널·간판: 생성본은 방향 참고용, 실제 UI 조각은 9-slice 로 PIL 제작이 안전.
