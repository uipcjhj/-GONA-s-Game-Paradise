# GONA's Sky Adventure — 외부 이미지 제작 요청서

Higgsfield 사용은 중단했어요. 신규 원화는 ChatGPT 이미지 생성(1순위)이나 Google Nano Banana 무료 범위(2순위)로 만들고, Claude 는 정리·검수·게임 적용만 합니다.
이 세션에는 두 도구 모두 연결되어 있지 않아서, 필요한 에셋을 아래 형식으로 정리해 둡니다.

## 공통 규칙 (모든 요청에 적용)
- **참고 이미지**: 해당 캐릭터의 승인 원화 `public/assets/sky/v2/chars/<id>/illust.png` 를 ChatGPT 에 함께 첨부
- **일관성**: 승인 원화와 같은 셀 애니 화풍·두꺼운 외곽선·의상·얼굴·헤어. 고나 = 연두색 공룡 후드, 갈색 머리 한 가닥, 주황 날개, 빨간 스카프, 고글
- **팔레트**: 슈팅게임 전용 — 어둡고 대비 강한 90년대 아케이드 톤(슬레이트 블루·청회색·노을 앰버·주황/빨강 폭발·남색+금색 UI)
- **금지**: 건버드 등 기존 게임 캐릭터·로고 복제, 글자·워터마크
- **전달 방법**: 생성한 PNG 를 채팅에 첨부 → Claude 가 해상도·투명도·가장자리 잘림을 검수한 뒤 축소·정리해서 적용

## 요청 양식 (새 에셋마다 작성)
| 항목 | 내용 |
|---|---|
| 에셋명 · 목적 | |
| 일관성 기준 | |
| 프롬프트 | |
| 사용 시점 · 동작 | |
| 규격 · 투명 배경 | |
| 게임 표시 크기 | |
| 파일명 · 경로 | |

---

## 현재 교체 후보 (사용자가 고르면 진행 · 아직 요청 안 함)

현재 게임에는 아래 항목이 **기존 원화를 잘라 쓰거나 코드로 그린 임시 표현**으로 들어가 있어요. 새 규칙 기준으로는 정식 원화로 바꾸는 게 맞는 항목들이에요.

### A. 가족 필살기 컷인 6종 (우선순위 높음)
| 항목 | 내용 |
|---|---|
| 에셋명 · 목적 | `cutin-<id>` — 가족 필살기 발동 시 0.6초 지나가는 가로 띠 컷인 (엄마·아빠·이모·할머니·할아버지·삼촌) |
| 현재 상태 | 선택 화면 원화 윗부분을 잘라 코드로 그린 집중선 위에 얹은 임시본 |
| 일관성 기준 | 고나 컷인 `chars/gona/cutin.png` 과 같은 구도·연출(대각선 집중선, 상반신 클로즈업, 역동적 포즈) |
| 프롬프트 (엄마 예시) | "Wide 2:1 action cut-in banner for a 1990s Japanese arcade shoot'em up special attack, cel-anime illustration in exactly the same style, face, hair, outfit and colors as the attached reference character (Mom, a cheerful witch with a purple hat with a heart jewel, brown ponytail, pink cape, heart wand). Upper-body close-up, dynamic diagonal pose casting a giant pink heart magic spell toward the right, intense radial speed lines and sparkling hearts in the background in pink and magenta, bold thick outlines, high contrast, no text, no logo." |
| 다른 가족 바꿀 부분 | 아빠: 황동 로켓 주먹 + 증기 레이저 발사, 파랑·청록 집중선 / 이모: 선글라스 + 보라 별 대포 발사, 보라·금색 / 할머니: 초록 물약을 높이 들고 금빛 치유 빛, 초록·금색 / 할아버지: 은빛 갑옷 + 파란 탑 방패를 앞으로, 파랑·은색 / 삼촌: 둥근 안경 + 발명 메카 조종 레버·전기 불꽃, 노랑·청록 |
| 사용 시점 · 동작 | 필살 버튼을 누른 순간, 오른쪽에서 들어와 멈췄다 왼쪽으로 빠짐 (정지 그림 1장) |
| 규격 · 투명 배경 | 1440×720 이상, 배경 포함(투명 불필요) |
| 게임 표시 크기 | 논리 180×90 (화면 폭 전체) |
| 파일명 · 경로 | `public/assets/sky/v2/chars/<id>/cutin.png` |

### B. 가족 얼굴 아이콘 6종 + 고나 (중간)
| 항목 | 내용 |
|---|---|
| 에셋명 · 목적 | `face-<id>` — 선택 화면 하단 로스터 · 필살 버튼 초상화 |
| 현재 상태 | 승인 원화에서 얼굴 부분을 잘라낸 임시본 |
| 프롬프트 (공통) | "Square character portrait icon, cel-anime style identical to the attached reference, head and shoulders, full head including hat/hair visible with small margin, facing slightly toward the viewer, happy confident expression, plain transparent background, thick clean outline, no text." |
| 규격 · 투명 배경 | 512×512, 투명 배경 PNG |
| 게임 표시 크기 | 약 56×56 px (로스터), 64×52 px (필살 버튼) |
| 파일명 · 경로 | `public/assets/sky/v2/chars/<id>/face.png` |

### C. 엄마 선택 원화 오른쪽 하트 잘림 보정 (낮음)
| 항목 | 내용 |
|---|---|
| 목적 | 원화 파일 자체에서 오른쪽 끝 하트가 잘려 있음 → 캔버스를 넓혀 하트만 완성 |
| 프롬프트 | "Extend the canvas of the attached image to the right by about 15% and complete the cut-off pink heart on the right edge. Do not change the character at all. Keep the transparent background." |
| 규격 | 원본과 같은 높이(900px), 투명 배경 PNG |
| 파일명 · 경로 | `public/assets/sky/v2/chars/mom/illust.png` (원본은 `art-src/` 에 보관 후 교체) |

### D. 적 기체 애니메이션 프레임 (낮음)
| 항목 | 내용 |
|---|---|
| 목적 | 드론·전투기·와이번·크리스탈 포탑·증기 건십이 현재 정지 그림 1장 → 프로펠러·날개 2~4프레임 |
| 일관성 기준 | `public/assets/sky/v2/stage1/enemy-*.png` 의 모양·색 그대로, 같은 픽셀 밀도 |
| 프롬프트 (드론 예시) | "Pixel art sprite sheet, 4 frames in a single row, of exactly the attached enemy drone seen from top-down, only the propellers rotate between frames, identical body in every frame, 16-bit arcade shooter style, thick dark outline, transparent background, no text." |
| 규격 | 프레임당 원본과 같은 크기, 가로 4칸, 투명 배경 |
| 파일명 · 경로 | `public/assets/sky/v2/stage1/enemy-<name>-anim.png` |

## 코드 제작 허용 범위 (요청서 불필요)
HUD · 체력바 · 충돌 판정 · 탄막 패턴 · 단순 이펙트(스파크·충격파·파편·연기·머즐 플래시·탄환 모양) — `tools/build-sky-fx.py` 와 엔진 코드로 유지.
