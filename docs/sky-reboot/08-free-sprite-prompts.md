# 08 · 비행 스프라이트 무료 생성 프롬프트 (확정 원화 6장 기준)

## 어디서 생성하나 (무료만)
- **Claude chat 또는 Claude Cowork + Higgsfield 연결** → Higgsfield 무제한 생성 (Claude Code 에서는 2026-11-16 재확인 결과 여전히 차단: "현재 Claude Code 환경에서 … 무제한 생성을 이용할 수 없어요").
  - 생성 전에 반드시 무제한 사용으로 선택했는지 확인 (크레딧 차감 표시가 나오면 중단).
  - 추천 모델: `gpt_image_2_6` (투명 배경 지원 — `background: transparent`) 또는 `nano_banana_pro` (참고 이미지에 강함, 흰 배경으로 받아도 됨).
- **ChatGPT** 이미지 생성 (무료 범위)

참고로 이 작업 환경에서 같은 생성을 크레딧으로 하면 (견적만 확인, 실행 안 함): GPT Image 2.6 high 2k 투명 2.75 · medium 2k 1 · Nano Banana Pro 2k 2 · Nano Banana 2 1k 1.5 크레딧 / 장.

## 첨부할 것 (캐릭터마다 2장)
1. 확정 원화: `art-src/sky-poop/master/<id>.png`
2. 기존 비행 스프라이트 기준 시트: `docs/sky-reboot/ref/ref-<id>.png` (크기 · 외곽선 · 픽셀 밀도 참고용 — 외형은 1번을 따름)

## 요청 형식
- 비율 **21:9** (가로로 넓게) · 투명 배경 (안 되면 단색 흰 배경)
- 한 줄에 캐릭터 4개, 서로 떨어지게 (칸 간격은 고르지 않아도 됨 — 변환기가 자동 분리)
- 받은 PNG 를 그대로 보내 주면 됨

## 공통 프롬프트 (앞부분)
> Pixel art sprite sheet for a late-1990s Japanese arcade vertical shoot'em up. Exactly 4 separate frames of the SAME character in one horizontal row, spaced apart, transparent background. The character is the attached reference illustration — keep the exact face, hair, outfit, colors and weapon; do not redesign. View: from behind at a 3/4 top-down angle, flying upward (toward the top of the image), back of the head, shoulders and back visible, face only partly visible in profile. Frame 1 and 2: idle flight loop (cloth, hair and accessories move between the two frames). Frame 3 and 4: attack pose, two different moments of the same attack. Same size and same scale in all 4 frames. Crisp 16-bit pixel art, thick dark outline, limited palette, no anti-aliasing blur, no text, no logo, no frame borders.

## 캐릭터별 추가 문장
| 캐릭터 | 붙일 문장 |
|---|---|
| 엄마 | Mom: high side ponytail of brown hair with a pink scrunchie, white fluffy bathrobe with light-blue trim and a blue sash bow, pink striped towel on her shoulders, blue fluffy slippers with hearts, holding a blue-and-white shower-head staff with small gold wings. Frames 1–2: robe hem and ponytail swing in the wind. Frames 3–4: she points the shower staff forward (up the screen) and sprays water — 3 starts the spray, 4 full spray with droplets and bubbles. |
| 아빠 | Dad: brown curly hair under a red firefighter helmet with a gold water-drop badge and goggles, red-and-yellow fantasy firefighter coat, white baggy pants, big water-tank backpack, holding a large red-and-blue water cannon with both hands. Frames 1–2: coat tails and the white back flag flutter. Frames 3–4: he fires the water cannon straight forward — 3 aim with the barrel braced, 4 firing with recoil pushing his shoulders back and a straight water jet. |
| 이모 | Aunt: black hair in a low bun, narrow black sunglasses, purple beret decorated with prunes and white flowers, purple cape with gold trim, cream striped sweater, cream baggy pants, purple gloves and boots, golden prune-juice blaster with star charms. Frames 1–2: cape and beret ribbon flutter. Frames 3–4: she shoots the blaster forward — 3 aim, 4 fire with a purple juice splash. |
| 할머니 | Grandma: short wavy brown hair, round gold glasses, big purple-and-pink witch hat with a pink bow and yellow flower, pink floral shawl, orange dress with white swirl pattern, white apron with a pink heart, small round body, holding a golden staff topped with a pink heart gem. Frames 1–2: shawl and dress hem sway, cheerful. Frames 3–4: she throws a small pink potion bottle forward — 3 wind-up, 4 throw with sparkles. |
| 할아버지 | Grandpa: short gray-black hair, navy-and-white feathered cap with a green cross badge, white-and-navy tunic with green leaf trim, green scarf, brown gloves, a LARGE blue crystal shield with a green cross emblem held in front, short winged spear. No water cannon, no shower. Frames 1–2: flying with the shield raised in front, scarf flutters. Frames 3–4: he thrusts the shield forward releasing a blue hexagon shockwave — 3 brace, 4 push. |
| 삼촌 | Uncle: messy curly brown hair, round glasses, brass goggles on his head, white-and-blue hat, teal jacket with a white fur-trimmed coat, yellow scarf, white baggy pants, blue boots, probiotic tank backpack, holding a staff topped with a winged glass orb containing a cute smiling microbe. Frames 1–2: coat tails flutter, orb bobs. Frames 3–4: he raises the staff and launches a glowing probiotic bubble forward — 3 charge, 4 release. |

추가로 삼촌 유산균 생물 3종 (필살기 소환용): "3 separate cute round probiotic creatures with smiling faces and tiny antennae (one round, one capsule-shaped, one cloud-shaped), white and pale blue, each with 4 small idle-bounce frames, pixel art, transparent background, no machines."

## 받은 뒤 (Claude 가 실행)
```
python3 tools/sky-art-import.py fly 받은시트.png --id mom --auto-split [--remove-bg]
```
- 자동 분리 → 칸 88×112 아래 가운데 정렬 → 시트 공통 팔레트(≤150색) · 외곽선 #1a1226 → 움직임 검사(복제 프레임이면 저장 거부, 실루엣이 크게 다르면 경고) → 게임 적용 → 393×636 · 390×844 실제 플레이 화면으로 원화와 비교.
