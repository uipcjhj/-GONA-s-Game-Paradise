# 3 — 신규 아트 납품 규격 (ChatGPT 제작분 → 게임 적용용)

원화·게임용 에셋은 ChatGPT에서 제작하고, 최종 승인된 파일을 받으면 그때 게임에 적용합니다. **그 전까지 게임 그래픽은 바꾸지 않습니다.**
(ChatGPT 이미지는 픽셀이 정확히 맞지 않는 경우가 많습니다. 납품 후 슬라이스·정수 배율 정리·팔레트 정리는 제가 해 드릴 수 있습니다. 가능하면 아래 규격에 가깝게 요청해 주세요.)

## 폴더와 파일명
`public/assets/sky/v2/chars/<id>/` — id: `gona mom dad imo halmeoni halabeoji samchon`
| 파일 | 규격 |
|---|---|
| `illust.png` | 선택 화면 전신 원화, 세로 ≥1024×1536, 투명 배경 |
| `cutin.png` | 필살기 컷인, 가로 ≥1200×600 |
| `portrait.png` | 얼굴 아이콘 128×128 |
| `sprite.png` | 게임용 스프라이트 시트 (아래) |
원화 원본(작업 파일)은 `art-src/sky/illust/<id>/` 에 보관 (원화와 스프라이트는 별개 에셋).

## 스프라이트 시트
- 투명 PNG, 셀 **96×96** (할아버지 비행선은 128×112), 가로 4칸 × 세로 8행, 항상 같은 순서·같은 중심점
- 행 순서와 프레임 수: ① fly 4 ② bankL 2 ③ bankR 2 ④ shoot 3 ⑤ charge 3 ⑥ bomb 3 ⑦ hurt 2 ⑧ win 2 (남는 칸은 투명)
- 도트는 정수 배율(1:1), 안티앨리어싱 없이 또렷하게, 외곽선·광원(좌상단) 통일
- 의상·무기·얼굴·대표 색상은 승인된 원화와 일치

## 그 밖의 에셋 (이후 단계)
- 적/보스 시트: `public/assets/sky/v2/enemies/<id>.png` (규격은 별도 협의)
- 배경 레이어: `public/assets/sky/v2/bg/stage1-<layer>.png` (세로 반복 타일)
- 내부 해상도(270×480) 전환은 에셋 도착 후 함께 진행

## 검수
`python3 tools/check-sky-assets.py [id ...]` — 파일 유무, 크기, 시트 격자, 빈 프레임, 투명 배경 확인.
코드 쪽 규격과 로더: `src/sky/data/artManifest.ts` (현재 어디에서도 호출하지 않음)
