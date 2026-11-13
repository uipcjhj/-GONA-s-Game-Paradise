# 🦖 GONA's Game Paradise · 고나 게임천국

아기 공룡 **고나**가 사는 바다 위 섬들 — 섬 하나가 게임 하나입니다.
카드 목록이 아니라 월드맵을 탐험하듯 게임을 고르는 16비트 픽셀아트 포털이에요.

모바일 웹 우선(세로 화면), PC에서도 자연스럽게 표시됩니다.
**React + Vite + TypeScript** · 그림은 모두 코드로 그려서 별도 이미지 에셋이 거의 없고, 유료 API/서버/키는 없습니다.

## 실행

```bash
npm install
npm run dev        # 개발 서버 (같은 Wi-Fi 폰에서 Network 주소로 접속)
npm run build      # dist/ 에 정적 파일 생성 (타입 검사 포함)
npm run preview
```

## 새 게임(섬) 추가하기 — 기존 게임 코드는 건드리지 않습니다

`src/data/islands.ts` 의 배열에 항목 하나만 추가하세요. 배치는 아래→위 지그재그로 자동입니다.

```ts
{
  id: 'my-game',
  theme: 'puzzle',            // 섬 그림 (src/art/painters.ts 의 PAINTERS 키, 없으면 기본 섬)
  name: '마이 아일랜드',
  gameTitle: '내 게임',
  tagline: '한 줄 소개',
  status: 'open',             // 'open' | 'soon'
  url: 'https://…',           // 이 주소로 이동. 비어 있으면 입장 버튼이 잠김
}
```

새 섬 그림이 필요하면 `painters.ts` 에 painter 함수를 만들어 `PAINTERS` 에 등록합니다.
각 게임은 독립 프로젝트로 두고 URL 로만 연결합니다.

### ⚠️ 해야 할 일
- **GONA's Food Adventure 배포 주소**는 확인 전이라 비워 두었습니다 (`url: undefined`).
  확인되면 `src/data/islands.ts` 의 `food-adventure` 에 `url` 만 넣으면 입장 버튼이 열립니다.

## 구조

| 경로 | 역할 |
| --- | --- |
| `src/data/islands.ts` | 게임(섬) 목록 — **데이터** |
| `src/data/layout.ts` | 월드 좌표 · 자동 배치 |
| `src/art/` | 코드로 그리는 도트 그림 (섬 · 구름 · 비행선 · 바다) |
| `src/components/` | 월드맵 · 패널 · 하단 메뉴 · 프로필/랭킹 화면 |
| `src/services/player.ts` | 닉네임/플레이어 ID · 최고 점수 · 주간·역대·통합 랭킹 · 업적/배지의 **타입만** 준비 (구현 없음) |

월드는 가로 120도트 고정이고 화면에서는 **정수 배율**로 확대합니다 → 도트가 항상 선명하고 가로 스크롤이 생기지 않아요.

## 1차 범위
- 온라인 랭킹 서버 · 데이터베이스 없음. 가짜 랭킹도 표시하지 않고 "준비 중"으로 정직하게 안내합니다.
- 폰트: [Galmuri](https://github.com/quiple/galmuri) (SIL OFL). 고나 이미지는 기존 Food Adventure 의 캐릭터를 복사해 사용했습니다 (원본 저장소는 수정하지 않음).

## GitHub Pages 배포
`.github/workflows/deploy.yml` 이 포함되어 있습니다.
1. 저장소 **Settings → Pages → Build and deployment → Source** 를 **GitHub Actions** 로 설정
2. `main` 에 푸시(또는 병합)하면 자동 배포 → `https://uipcjhj.github.io/-GONA-s-Game-Paradise/`

`base: './'` 설정이라 하위 경로에서도 그대로 동작합니다.
