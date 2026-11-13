# 🦖 GONA's Game Paradise · 고나 게임천국

아기 공룡 **고나**가 사는 바다 위 섬들 — 섬 하나가 게임 하나입니다.
카드 목록이 아니라 월드맵을 탐험하듯 게임을 고르는 16비트 픽셀아트 포털이에요.

모바일 웹 우선(세로 화면), PC에서도 자연스럽게 표시됩니다.
**React + Vite + TypeScript** · 유료 API/서버/키는 없습니다.

## 실행

```bash
npm install
npm run dev        # 개발 서버 (같은 Wi-Fi 폰에서 Network 주소로 접속)
npm run build      # dist/ 에 정적 파일 생성 (타입 검사 포함)
npm run preview
```

## 월드맵 구조

확정 디자인 이미지 `public/assets/gona-world-map.png`(1086×1448)를 **원본 그대로** 배경으로 쓰고, 그 위에 고나·터치 영역·팝업을 별도 레이어로 얹습니다.
이미지·고나·터치 영역이 모두 **이미지 픽셀 좌표계**(`src/data/world.ts`)를 쓰고 통째로 scale 되므로 화면 크기가 바뀌어도 좌표가 어긋나지 않습니다. 비율은 항상 유지(왜곡 없음).

- 고나 스프라이트: `public/assets/gona.png` (Food Adventure 원본 캐릭터, 투명 PNG)
- 섬을 누르면 고나가 광장 → 다리의 꺾임(`map.path`)을 따라 3번 통통 뛰며(0.6~0.9초) 이동, 착지마다 별 파티클, 도착하면 섬이 반짝이고 작은 팝업이 뜹니다. 이동 중 연타하면 마지막 선택만 기억해 도착 직후 이어서 이동합니다.

## 새 게임(섬) 추가하기 — 기존 게임 코드는 건드리지 않습니다

`src/data/islands.ts` 의 배열에 항목을 추가하세요. 새 섬이 월드맵 이미지에 그려져 있다면 `map.hit`(터치 영역)과 `map.path`(광장→섬 다리 경로)를 이미지 좌표로 적으면 됩니다.

```ts
{
  id: 'my-game', name: '마이 아일랜드', gameTitle: '내 게임', tagline: '한 줄 소개',
  status: 'open',          // 'open' | 'soon'
  url: 'https://…',        // 이 주소로 이동. 비어 있으면 입장 버튼이 잠김
  map: { hit: { x, y, w, h }, path: [PLAZA, …, 도착점] },
}
```

### 현재 연결
- 푸드 아일랜드 → `https://uipcjhj.github.io/GoNa/` (개발 환경의 네트워크 제한으로 접속 확인은 못 했음 — 배포 후 직접 확인 필요)
- 스카이 배틀 · 미니게임천국 → COMING SOON (팝업에서만 안내)

## 구조

| 경로 | 역할 |
| --- | --- |
| `src/data/islands.ts` | 게임(섬) 목록 · 터치 영역 · 이동 경로 — **데이터** |
| `src/data/world.ts` | 월드맵 이미지 · 광장 · 고나 크기 |
| `src/components/WorldMap.tsx` | 배경 + 터치 영역 + 고나 이동 애니메이션 + 효과 |
| `src/components/IslandPanel.tsx` | 선택 팝업 |
| `src/services/player.ts` | 닉네임/플레이어 ID · 최고 점수 · 랭킹 · 업적/배지의 **타입만** 준비 (구현 없음) |

## 1차 범위
- 온라인 랭킹 서버 · 데이터베이스 없음. 가짜 랭킹도 표시하지 않고 "준비 중"으로 정직하게 안내합니다.
- 폰트: [Galmuri](https://github.com/quiple/galmuri) (SIL OFL). 고나 이미지는 기존 Food Adventure 의 캐릭터를 복사해 사용했습니다 (원본 저장소는 수정하지 않음).

## GitHub Pages 배포
`.github/workflows/deploy.yml` 이 포함되어 있습니다.
1. 저장소 **Settings → Pages → Build and deployment → Source** 를 **GitHub Actions** 로 설정
2. `main` 에 푸시(또는 병합)하면 자동 배포 → `https://uipcjhj.github.io/-GONA-s-Game-Paradise/`

`base: './'` 설정이라 하위 경로에서도 그대로 동작합니다.
