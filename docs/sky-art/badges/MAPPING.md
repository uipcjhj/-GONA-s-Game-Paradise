# 배지 32종 ↔ 게임 배지 ID 매핑 (2026-11-26 적용)

원본 시트: `art-src/sky-poop/badges-v2/badges-32-original.png` (사용자 제공 · 그대로 보존)
분리: `python3 tools/sky-badges/split.py <시트> public/assets/sky/v3-poop/badges` (명판 제거 · 원본 화소 · 152×152 투명 캔버스)
코드: `src/sky/badges.ts` (ID → 그림만 연결 · 획득 조건·기록은 records.ts 그대로)

- 분리한 배지: **32**
- 게임에 연결된 디자인: **23** (업적 32개 + 동료 클리어 18 + 난이도 ALL 3 + MASTER 1 = 화면 배지 54칸에 사용)
- 예비: **9** (6 · 11 · 12 · 15 · 16 · 23 · 28 · 31 · 32 — 같은 뜻의 기존 업적 없음)
- 같은 그림을 함께 쓰는 배지: 보스 격파 6개 → 14 · 보스별 추억 완성 6개 → 25 (보스별 전용 디자인이 시트에 없음)
- 획득일: 사진·완주 날짜가 남은 배지만 표시 (노미스·S랭크·부위 파괴·노폭탄·오늘의 영웅은 날짜 기록이 없어 "획득"만 표시)

| # | 디자인 | 파일 | 연결된 게임 배지 (ID · 화면) |
|---|---|---|---|
| 01 | EASY 정복 | `badges/badge-01.png` | easy · 난이도 ALL 도장 EASY · 사진 도장(EASY) |
| 02 | NORMAL 정복 | `badges/badge-02.png` | normal · ALL 도장 NORMAL · 사진 도장(NORMAL) |
| 03 | HARD 정복 | `badges/badge-03.png` | hard · ALL 도장 HARD · 사진 도장(HARD) |
| 04 | MASTER | `badges/badge-04.png` | MASTER (명예의 전당 · 배지 탭) |
| 05 | 스토리 클리어 | `badges/badge-05.png` | first |
| 06 | 추억 사냥 완료 | `badges/badge-06.png` | — 예비 (해당 업적 없음) |
| 07 | 오늘의 도전 | `badges/badge-07.png` | daily |
| 08 | S랭크 달성 | `badges/badge-08.png` | rankS |
| 09 | 노미스 클리어 | `badges/badge-09.png` | nomiss |
| 10 | 노폭탄 클리어 | `badges/badge-10.png` | nobomb1 |
| 11 | 올클리어 | `badges/badge-11.png` | — 예비 (해당 업적 없음) |
| 12 | 스테이지 완주 | `badges/badge-12.png` | — 예비 (해당 업적 없음) |
| 13 | 전 부위 파괴 | `badges/badge-13.png` | parts |
| 14 | 보스 정복 | `badges/badge-14.png` | boss1~boss6 |
| 15 | 고난도 도전 | `badges/badge-15.png` | — 예비 (해당 업적 없음) |
| 16 | 연속 클리어 | `badges/badge-16.png` | — 예비 (해당 업적 없음) |
| 17 | 엄마의 힘 | `badges/badge-17.png` | fam-mom · 엄마 클리어 배지 3 |
| 18 | 아빠의 워터포 | `badges/badge-18.png` | fam-dad · 아빠 클리어 배지 3 |
| 19 | 이모의 마법 | `badges/badge-19.png` | fam-imo · 이모 클리어 배지 3 |
| 20 | 삼촌의 발명 | `badges/badge-20.png` | fam-samchon · 삼촌 클리어 배지 3 |
| 21 | 할머니의 치유 | `badges/badge-21.png` | fam-halmeoni · 할머니 클리어 배지 3 |
| 22 | 할아버지의 수호 | `badges/badge-22.png` | fam-halabeoji · 할아버지 클리어 배지 3 |
| 23 | 고나의 용기 | `badges/badge-23.png` | — 예비 (해당 업적 없음) |
| 24 | 가족의 힘 | `badges/badge-24.png` | allfam (온 가족 출동) |
| 25 | 추억사진 수집 | `badges/badge-25.png` | bossall1~bossall6 (보스별 추억 완성) |
| 26 | 엽서 18장 완성 | `badges/badge-26.png` | runs (완주 엽서 18장) |
| 27 | 사진 108장 완성 | `badges/badge-27.png` | album (사진 108장) |
| 28 | 완전 수집 달성 | `badges/badge-28.png` | — 예비 (해당 업적 없음) |
| 29 | 난이도 전부 정복 | `badges/badge-29.png` | alldiff (난이도 마스터) |
| 30 | 전 캐릭터 정복 | `badges/badge-30.png` | hardall (전설의 가족 · 6명 HARD) |
| 31 | 하늘 왕국의 영웅 | `badges/badge-31.png` | — 예비 (해당 업적 없음) |
| 32 | 레전드 컴플리트 | `badges/badge-32.png` | — 예비 (해당 업적 없음) |
