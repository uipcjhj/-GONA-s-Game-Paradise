# 07 · 비행 스프라이트 · 컷인 생성 요청서 (확정 원화 기준)

> 기준: 사용자가 확정한 **가족 6명 마스터 원화** (받으면 `art-src/sky-poop/master/<id>.png` 에 원본 그대로 보관).
> 원화를 줄이거나 잘라서 비행 스프라이트로 쓰지 않는다. 비행 4프레임은 **새로 그린 픽셀아트**여야 하고, 프레임마다 실제 동작 차이가 있어야 한다.
> 생성 도구: 무료 생성만 (ChatGPT / Claude chat·Cowork 의 Higgsfield 무제한 등). 이 작업 환경(Claude Code)에서 Higgsfield 무제한은 막혀 있고, 일반 생성은 크레딧이 들어 실행하지 않음.

## 엔진 규격 (실측 · 변경 없음)
- 1프레임 **88×112**, 가로 4프레임, 전체 **352×112**, 투명 배경, 화면 표시 44×56 (논리 해상도 180×320 의 2배 캔버스에 1:1).
- 엔진 동작: 프레임 0·1 = 평상시 날갯짓을 번갈아 (초당 6장), 프레임 2·3 = 공격할 때 번갈아 (초당 10장). 동료는 고나 옆 32px 에서 따라다니며 위아래로 살짝 흔들림.
- 픽셀아트: 반투명 없음 · 시트 전체 150색 이하 · 외곽선 #1a1226 (변환기가 자동 정리).

## 생성 요청 형식 (모든 캐릭터 공통)
- 크기: **가로 1536 × 세로 512** (4칸, 칸마다 같은 크기), 투명 배경 PNG (배경이 생겨도 변환기 `--remove-bg` 로 제거 가능)
- 시점: **후방 3/4 탑다운** — 뒤통수·등·어깨가 보이고 화면 위쪽으로 날아가는 모습, 얼굴은 옆얼굴 일부만
- 4칸 모두 **같은 크기·같은 위치·같은 비율**, 칸 1·2 = 기본 비행(날갯짓/옷자락 차이), 칸 3·4 = 공격 동작 1·2
- 첨부: 마스터 원화 + `docs/sky-reboot/ref/ref-<id>.png` (기존 비행 스프라이트 크기·외곽선 기준)

공통 프롬프트:
> "Pixel art sprite sheet for a 1990s Japanese arcade vertical shoot'em up. 4 frames in one row, equal cells, transparent background. The character is the attached reference — keep the exact face, hair, outfit, colors and weapon. Seen from behind at a 3/4 top-down angle, flying upward. Frames 1–2: idle flight loop with small cloth/hair movement. Frames 3–4: attack pose. Thick dark outline, crisp pixels, limited palette, no text, no logo, original design."

## 캐릭터별 프레임 설명
| 캐릭터 | 칸 1·2 (기본 비행) | 칸 3·4 (공격) | 필살기 컷인 (720×360) |
|---|---|---|---|
| 엄마 | 목욕가운 자락·포니테일이 바람에 날림 (1 위로, 2 아래로) | 샤워기 지팡이를 앞으로 → 물줄기 뿜기 시작 (4 에서 물방울) | 얼굴 크게 · 손을 들어 올려 쏟아지는 샤워 폭포, 물방울·거품 |
| 아빠 | 소방복 자락·물통 흔들림 | 물대포 겨눔 → 반동으로 어깨가 뒤로 밀림 | 물을 꿀꺽 마신 뒤 굵은 직선 수압 빔 |
| 이모 | 보라 망토·쪽머리 흔들림, 선글라스 반짝 | 프룬주스 마법총 겨눔 → 보라 과즙 발사 | 선글라스 반사 + 보라 과즙 폭발 |
| 할머니 | 둥근 몸 · 앞치마 흔들림, 방글 웃음 | 포션 병 던지는 팔 동작 1·2 | **화난 얼굴** + 불꽃 + 하트 퍼짐 |
| 할아버지 | 대형 방패를 앞에 들고 비행 (방패 무늬 보이게) | 방패를 앞으로 밀기 → 충격파 | 방패를 크게 펼치고 푸른 육각형 보호막 (물대포·샤워기 등 다른 무기 금지) |
| 삼촌 | 실험복 자락 · 안경 반짝, 유산균 장비 | 유산균 병/장비 들어 쏘기 1·2 | 유산균 3마리가 튀어나오는 장면 |

추가 (삼촌): **유산균 생물 3종** 각각 32×32 × 4프레임 (동글이·캡슐이·꼬불이, 표정 있음, 기계 아님) → `chars/samchon/probiotic-a|b|c.png`

## 받은 뒤 적용 (한 줄씩)
```
python3 tools/sky-art-import.py illust 마스터원화.png --id mom --remove-bg
python3 tools/sky-art-import.py face   마스터원화.png --id mom --remove-bg --box 0.30,0.04,0.40,0.30   # 얼굴 위치에 맞춰 조정
python3 tools/sky-art-import.py fly    비행시트.png  --id mom --remove-bg
python3 tools/sky-art-import.py cutin  컷인.png      --id mom
```
검수 (최종 표시 전 필수): 프레임 4장 얼굴·형태 일치 · 프레임 간 실제 변화 · 원화와 의상·무기·색 일치 · 393×636 / 390×844 게임 화면 스크린샷.
