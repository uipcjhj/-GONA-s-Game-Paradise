# 스킨(겉모습) 교체 구조

현재 화면(파란 배경 · 사각형 캐릭터 · 기본 버튼)은 **임시 스킨(`temp`)** 입니다. 최종 디자인이 아니며, 최종 픽셀아트 UI 는 **스킨 하나를 추가**하는 것으로 교체합니다. 게임 로직·터치·점수·테스트는 건드리지 않습니다.

## 역할 분리
| | 담당 | 위치 |
| --- | --- | --- |
| **기반(base)** | 동작·판정·터치 영역(최소 44px)·레이아웃·애니메이션 타이밍·접근성 | `styles.css`, `games/*/*.css`, `games/*/View.tsx`, `ui/`, `modes/` |
| **스킨(skin)** | 보이는 모양: 색·도트·프레임·캐릭터·배경 | `skin/<이름>/` (슬롯 컴포넌트 + 토큰 + CSS) |

## 슬롯 (독립적으로 하나씩 교체 가능)
| 요구 | 슬롯 | 받는 값 |
| --- | --- | --- |
| 배경 | `ui.Background` | `scene: menu \| play \| result` |
| 버튼 | `ui.ButtonFace` | `variant: normal \| primary \| card`, `size: md \| lg \| sm \| icon` — `<button>` 자체는 기반이 렌더 |
| 패널(팝업·기록판) | `ui.Panel` | `tone: card \| popup \| board` |
| 점수판 | `ui.Scoreboard` | `view`(점수·콤보·남은 초·비율·경고·목숨·레벨, 계산 완료) + `pauseButton` |
| 목숨 | `ui.Lives` | `lives`, `max` |
| 캐릭터(고나·심판) | `ui.Mascot` | `pose: idle \| happy \| oops`, `scale` |
| **편가르기** 캐릭터 | `sort.Friend` | `card`(색·표정·특징). 크기는 토큰 `--sc-card-w/h` |
| **편가르기** 게임판 | `sort.StageFrame` · `sort.RulePanel` · `sort.BinFace` · `sort.InfoBar` · `sort.Feedback` · `sort.Announce` | 각 슬롯의 props 참고 (`games/sort/slots.ts`) |

새 게임(탑·장난감방)도 같은 방식으로 `games/<id>/slots.ts` 에 슬롯을 정의합니다.

## 스킨 만드는 법
```ts
// skin/pixel/index.tsx
const pixel: Skin = {
  id: 'pixel', name: '고나 픽셀 UI',
  extends: 'temp',                 // (선택) 일부만 교체할 때 — 나머지는 temp 그대로
  tokens: { '--sc-card-w': '96px', '--sc-card-h': '96px', '--mgl-page-bg': '#1dadfd' },
  ui: { Background, ButtonFace, Panel, Scoreboard, Lives, Mascot },
  sort: { Friend, RulePanel, StageFrame, BinFace, InfoBar, Feedback, Announce },
};
export default pixel;
// skin/skins.ts 의 SKIN_LOADERS 에 한 줄 추가:  pixel: () => import('./pixel'),
```
기본 스킨 변경은 `DEFAULT_SKIN` 한 줄. 점검은 `?skin=<id>`. 스킨은 선택된 것만 지연 로딩(CSS·에셋 포함).

## 스킨이 지켜야 할 계약 (기반이 읽는 `data-*` 는 기반이 렌더 → 스킨이 바꿔도 점검이 깨지지 않음)
- 슬롯은 부모 크기를 채우고 **입력을 받지 않음**(버튼·드래그 영역은 기반 소유). 장식 요소는 `pointer-events: none` 권장.
- `.sc-bins[data-hint]`(드래그 중 강조할 분류함 번호) · `data-locked` 로 상태 표현 가능.
- 아직 슬롯이 아닌 공통 요소(제목 글씨 · 큰 글씨 오버레이 · 결과 머리글 · 배지 · 인트로)는 현재 `skin/temp/temp.css` 의 `.mgl-*` 클래스가 모양을 줌 → 최종 스킨에서 **Callout / Badge / Title 슬롯으로 승격**하거나 해당 클래스를 스킨 CSS 에서 정의.
- 기반 점검 속성: `[data-testid=round]` (`data-phase/score/combo/time/lives/level`), `[data-testid=stage]` (`data-index/goal/mistakes/locked/rule`), `[data-testid=card]`, `[data-testid=bin-N]`.

## 교체 가능성 검증
- `skin/wireframe`(점검용): 배경·버튼·점수판·캐릭터·게임판 장식·분류함·카드 크기 토큰을 **일부만** 덮어쓰고, 같은 E2E(`tools/mgl-sort-check.cjs`)가 두 스킨 모두에서 통과.
- `skin/skin.test.ts`: 슬롯 단위 합성·extends 체인·순환/누락 검출·두 스킨의 완성도.
