# 06 · 그림 제작 · 게임 적용 규격 (ChatGPT PNG → 게임 에셋)

## 0. 확정 사항 (2026-11-16)
1. 악역 2인조 **뽀글이 · 꾸덕이** 유지 — 케이크 버전 뽀뽀괴물·킁카괴물과 별개.
2. 스테이지 이름은 **짧은 이름** (이유식 왕국 · 버섯가스 숲 · 소화 공장 · 수분의 바다 · 딱딱 응가 성문 · 변비마왕성). 긴 이름은 스토리 문구로 (게임 반영 완료).
3. 가족 얼굴·헤어·체형 유지, 의상·무기·스킬 이펙트만 신규.
4. 할머니 필살기 = 하트 1칸 회복, 보호막 없음 (게임 반영 완료).
5. 아빠 직선 물대포 = 적탄 삭제 없음 (게임 반영 완료).
6. 화풍: 원화 = 기존 90년대 셀애니 원화, 인게임 = 기존 픽셀아트와 통일.
7. 제작 순서: **가족 원화 → STAGE 1 배경 → 일반 적 → 중간보스 → 최종보스**.

## 1. 기존 에셋 실측 (엔진 렌더 기준)
엔진은 논리 180×320 을 2배 캔버스(360×640)에 그린다. **인게임 픽셀아트 파일 크기 = 화면 픽셀 1:1** (보스·중간보스만 원본 2배, k=0.5).

| 용도 | 파일 | 실측 | 화면 | 성질 |
|---|---|---|---|---|
| 선택·컷신 원화 | `chars/<id>/illust.png` | 434~779 × 900 | 선택화면 | 셀애니 · 안티앨리어싱(반투명 6~14%) · 1.4~2.2만 색 · 외곽선 짙은 갈색 #15100d · **여백 0 (잘림 원인)** |
| 얼굴 아이콘 | `chars/<id>/face.png` | 160×160 | 로스터 56px · 필살 버튼 | 원화에서 자른 것 (테두리에 닿음) |
| 컷인 | `chars/<id>/cutin.jpg` (고나 png) | 720×360 | 필살기 띠 | 배경 포함 |
| 동료 비행 | `chars/<id>/fly.png` | 88×112 × 4칸 | 44×56 | 픽셀아트 · 반투명 0 · 약 140색 · 외곽선 **#1a1226** · 칸 안 여백 5~7px · 0·1 대기 / 2·3 공격 |
| 고나 전투 | `chars/gona/sprite.png` | 96×96 × 4열 × 10행 | 48×48 | 픽셀아트 · 33색 · 행: 0 비행 · 1·2 좌우 기울기 · 3 정지 대기 · 4 사격 · 5 차지 · 6 폭탄 · 7 피격 · 8 패배 · 9 승리 |
| 일반 적 | `stage1/enemy-*.png` | 54×43 ~ 114×111 | 1:1 | 픽셀아트 · 약 32색 · 외곽선 #1a1226 · 꽉 맞게 트림 · **1프레임** (엔진이 회전·흔들기) |
| 보스 | `stage1/boss.png` | 219×232 × 2 | 약 110px (k 0.5) | 픽셀아트 · 108색 · 정상/파손 |
| 배경 | `stage1/bg-backdrop.png` | 360×640 | 화면 전체 | 세로 반복 스크롤(초당 9) · 엔진이 보라색으로 덮음 · **현재 위아래 이음 어긋남 (차이 21 vs 평소 4)** |
| 소품 | `stage1/island-*.png` 등 | 90~200 | 레이어 배율 ×0.64 / ×1 / ×1.2 | 픽셀아트 · 약 49색 |

기준 자료 그림 (ChatGPT 에 첨부): `docs/sky-reboot/ref/ref-<id>.png` (7명) · `ref-stage1.png` — `python3 tools/sky-ref-sheets.py` 로 다시 만들 수 있음.

## 2. ChatGPT 에 요청할 그림 형식 (용도별)
| 용도 | 요청 크기 · 형식 | 배치 | 첨부할 기준 |
|---|---|---|---|
| 원화 | 세로 1024×1536 이상 · **투명 배경 PNG** | 전신 · 머리·발·무기·망토 모두 안쪽, 사방 여백 | `chars/<id>/illust.png` + `ref-<id>.png` |
| 얼굴 | 정사각 1024×1024 · 투명 | 머리 전체 + 어깨, 모자·머리카락이 잘리지 않게 | 같은 원화 |
| 컷인 | 가로 2:1 (1536×768) · 배경 포함 | 상반신 · 대각선 집중선 · 오른쪽 향함 | 고나 컷인 `chars/gona/cutin.png` 구도 |
| 비행 스프라이트 | 가로 4칸 한 줄 · 투명 (예 2048×640) | 칸마다 같은 크기, 후방 3/4 탑다운, 0·1 대기 날갯짓 / 2·3 공격 자세 | `ref-<id>.png` 의 비행 줄 |
| 일반 적 | 정사각 1024 · 투명 · **1장** | 위에서 내려다본 모습, 기수가 아래(플레이어 쪽) | `ref-stage1.png` |
| 중간보스 | 가로 N칸 (상태별) · 투명 | 칸마다 같은 크기 | `ref-stage1.png` 보스 |
| 최종보스 | 가로 3칸 (페이즈 1·2·3) · 투명 | 같은 크기·같은 중심, 페이즈마다 외형 변화 | `ref-stage1.png` 보스 |
| 배경 | 세로 1024×1820 이상 · 불투명 | **위아래가 이어지는 세로 반복 그림**, 가운데는 비교적 단순(탄 가독성) | `ref-stage1.png` 배경 |

공통 프롬프트 끝 문장:
> "Keep the exact face, hairstyle and body proportions of the attached reference. Same art style, line weight and color grading as the reference: 1990s Japanese arcade cel-anime for illustrations / crisp 16-bit arcade pixel art with thick dark outline for in-game sprites. Transparent background, no text, no logo, original design not copying any existing game."

## 3. 게임 적용 (받은 PNG → 한 줄 명령)
```
python3 tools/sky-art-import.py illust  받은그림.png --id mom
python3 tools/sky-art-import.py face    받은그림.png --id mom
python3 tools/sky-art-import.py cutin   받은그림.png --id mom
python3 tools/sky-art-import.py fly     받은그림.png --id mom          # 4칸 시트
python3 tools/sky-art-import.py bg      받은그림.png --fix-seam --tint 0.3
python3 tools/sky-art-import.py enemy   받은그림.png --slot drone      # 쌀알 병사
python3 tools/sky-art-import.py midboss 받은그림.png --frames 2
python3 tools/sky-art-import.py boss    받은그림.png --frames 3
#   --final : 승인된 최종 그림으로 표시   --dry-run : 저장 없이 검사만
```
변환기가 하는 일: 용도별 규격 변환 · 투명/여백/색 수/이음 검사 · 픽셀아트 정리(반투명 제거, 시트 공통 팔레트, 아주 어두운 색 → 외곽선 #1a1226) · 원본 보관(`art-src/sky-poop/`) · `public/assets/sky/v3-poop/manifest.json` 갱신. **확대는 하지 않는다** (작은 원본은 경고 → 다시 요청).

적 이름 ↔ 엔진 자리 (움직임·탄막은 기존 그대로): 쌀알 병사 = `drone` · 당근 전투기 = `fighter` · 브로콜리 박쥐 = `wyvern` · 완두콩 포탑 = `orb` · 냄비 수송선 = `gunship`.

## 4. 게임 구조 (이번에 준비한 코드 — 응가 테마에서만 동작)
- `src/sky/artpack.ts`: 응가 테마일 때만 `v3-poop/manifest.json` 을 읽고, **목록에 있는 그림만** 새 파일로, 나머지는 기존 그림으로. 케이크 테마는 목록을 읽지도 않음.
- 선택화면·로스터·필살 버튼·타이틀·오프닝/엔딩 슬라이드 그림 경로가 모두 팩을 먼저 확인.
- 보스: 프레임 3장 이상이면 **페이즈 1·2·3 마다 다른 그림** (충돌 판정 모양도 같은 프레임). 2장이면 기존처럼 정상/파손.
- 중간보스: 팩에 `<stage>/midboss.png` 가 있으면 전용 그림 사용 (없으면 기존처럼 건십 그림).
- 배경 덮개: 팩 배경은 `tint` 값으로 덜 덮을 수 있음 (황금빛 이유식 왕국이 보라색으로 죽지 않게).

검증 (임시 시험 그림으로 실제 확인 후 시험 파일 삭제): 응가 빌드가 팩 파일 4종을 `v3-poop/` 에서 읽음 · 보스 3프레임이 페이즈 1→0, 2→1, 3→2, 격파→2 · 배경 덮개 0.3 · 케이크 빌드는 팩 요청 0건 · 보스 2프레임 동작 그대로 · 콘솔 오류 0.

## 5. 배포
`/GoNa/sky-poop-test/` 반영은 **GitHub Pages 출처가 GitHub Actions 로 바뀐 뒤**에만 (현재 build_type=legacy · source=sky-test, `docs/sky-poop/03-deploy-safety.md`).
