# 몬스터·보스 아바타 — 정식 에셋 제작 규격 (Phase 4)

> 이 문서는 **제작 요청서**입니다. 신규 이미지는 승인 없이 생성하지 않았습니다. 정식 PNG 가 없는 캐릭터는 운영 화면에 그림이 나오지 않고 "제작 중" 잠금 카드로만 보입니다.

## 1. 조사: 기존 캐릭터와 임시 도트 (Food Adventure `src/art/*.ts` 에서 코드로 그린 도트)
| 캐릭터 | Food 내 구분 | 임시 도트 크기 | 특징 | 비교 이미지 |
|---|---|---|---|---|
| 뽀뽀괴물 | 보스 1 (44×44) | 44×44 px | 분홍 둥근 몸, 위에 하트 2개, 두꺼운 입술, 눈 2개 | `avatar-compare.png` |
| 킁카괴물(냄새괴물) | 최종 보스 (48×46) | 48×46 px | 초록 둥근 몸, 위에 풀잎 같은 삐죽 머리, 갈색 큰 코 | 〃 |
| 화학과안경잽이 | 일반 몬스터 | 20×20 px | 보라 동글이, 커다란 동그란 안경, 잘난 척 눈썹 | 〃 |
| 방구할배 | 일반 몬스터(배불뚝이 아저씨) | 24×24 px | 볼록 나온 배, 짧은 머리, 처진 눈, 작은 콧수염 | 〃 |
- Food 코드 주석에도 "정식 PNG 가 들어오면 교체"(임시 도트)라고 적혀 있고, 크기가 20~48px 라 가족 아바타(128×128 크롭, 머리~어깨 초상)와 **해상도·스타일·구도가 맞지 않음**(확대하면 흐림·블록 불일치). 그래서 운영 아바타로 쓰지 않는다.
- 가족 7종 아바타는 변경하지 않는다.

## 2. 정식 에셋 규격 (캐릭터당 PNG 2장)
| 파일 | 크기 | 용도 |
|---|---|---|
| `public/assets/avatars/<id>.png` | **128×128**, 투명 배경, RGBA | 선택 카드·프로필·결과 화면 (표시는 CSS 64px 이하 → 2x 기기에서 1:1) |
| `public/assets/avatars/<id>-s.png` | **64×64**, 128 을 Lanczos 축소 | 헤더 HUD(28px)·목록(36px) |
- `<id>` = `kiss` · `sniff` · `glasses` · `farter`
- 구도: **얼굴(눈·입)이 캔버스 가로 중앙, 세로 42~52% 위치**, 머리~어깨/상체 초상, 가장자리 여백 6~8px, 외곽선 포함. 가족 초상과 같은 눈높이로 맞춰서 카드에 나란히 놓았을 때 얼굴 위치가 일정해야 함.
- 스타일: 승인된 **GONA 도트 스타일**(굵은 어두운 갈색/보라 외곽선, 따뜻한 파스텔, 부드러운 8~16비트 도트, 밝지만 바랜 레트로 색감), 가족 초상과 같은 선 굵기·도트 크기. Food 의 실제 캐릭터 설정(색·표정·특징 위 표)을 유지.
- 하지 말 것: 새 디자인으로 바꾸기(특징 변경), 글자 포함, 배경 포함, 그라데이션·부드러운 그림자, 확대로 흐려진 이미지.
- 검수 체크리스트: ① 128×128·투명 ② 얼굴 위치 규칙 ③ 외곽선/도트 크기가 가족 초상과 같은 느낌 ④ Food 원본 특징 보존 ⑤ 64px 로 줄였을 때 눈·입이 보임 ⑥ 393×636 선택 화면 스크린샷 확인.

## 3. 교체 방법 (코드 변경 1줄)
1. 위 두 PNG 를 `public/assets/avatars/` 에 넣는다.
2. `src/platform/avatars.ts` 에서 해당 캐릭터의 `asset: 'pending'` → `'ready'`.
3. 끝 — 해금된 플레이어는 즉시 선택 가능, 미해금자는 "잠금 + 해금 조건" 카드로 보임, 해금 순간 🎭 알림. (테스트 `avatars.test.ts` 가 이 전환을 검증하며, `ready` 가 아닌 캐릭터의 PNG 가 운영 폴더에 없는지도 검사한다.)

## 4. 해금 조건 (임시 — 확정 필요)
| 캐릭터 | 해금 업적 | 이유 |
|---|---|---|
| 뽀뽀괴물 | 「두 발로 걷다」(Food 성장 3단계) | 뽀뽀괴물을 물리쳐야 3단계 |
| 킁카괴물 | 「첫 클리어」 | 최종 보스를 물리쳐야 엔딩 |
| 화학과안경잽이 | 「단골 모험가」(누적 10판) | 3단계부터 등장 → 꾸준히 플레이 |
| 방구할배 | 「간식 사냥꾼」(Food 5,000점) | 〃 |
조건은 `AVATARS[].unlock` 한 줄씩이라 바꾸기 쉽다(업적/레벨 조건).

## 5. 제작용 프롬프트 (이미지 생성 도구용 — **실행하지 않음, 승인 후 사용**)
공통 접두:
> "Cute 16-bit pixel art character portrait, head and shoulders, chunky dark-brown outline, warm pastel retro colors, soft faded vintage palette, 128x128 canvas, transparent background, centered face with eyes at the vertical middle, same style as a Korean family-game cast (matching an existing set of chibi family portraits), no text, no background, no gradient, crisp square pixels."

- 뽀뽀괴물: "…a round pink blob monster with two small pink hearts on top of its head, thick glossy red lips (kissing pucker), two small round eyes with white highlights, friendly mischievous look."
- 킁카괴물: "…a round green swamp monster with a spiky leaf-like tuft on top, a big brown round nose in front with two dark nostrils, heavy sleepy eyes, sniffing expression."
- 화학과안경잽이: "…a small round purple monster with huge round glasses (pale blue lenses with a glint), smug raised eyebrows, short purple legs, nerdy chemistry-student vibe."
- 방구할배: "…a pot-bellied old man monster in a white undershirt and blue trousers, short dark hair with a small mustache, droopy eyes, round belly, slightly embarrassed face."
- 후처리: Lanczos 로 64×64 (`-s`) 생성, 얼굴 위치 규칙 확인.
- 비용: 캐릭터당 후보 3안 × 4캐릭터 = 12장 생성 예상. **크레딧 비용을 먼저 확인·승인받은 뒤** 진행.
