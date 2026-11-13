# Food Adventure 최소 패치 (준비본 — **Food 저장소에는 적용하지 않음**)

게임천국의 플레이 기록 연동을 켜기 위해 Food 쪽에 필요한 최소 변경입니다. **승인 전에는 Food 저장소를 수정하지 않습니다.**

## 변경 범위
| 파일 | 변경 |
|---|---|
| `src/platform/paradise.ts` (신규) | `docs/platform/food-patch/paradise.ts` 를 그대로 복사 (~170줄, Food 모듈 import 없음) |
| `src/main.ts` | import 1줄 + `initParadise({ bus, EV, parent: ui })` 호출 1줄 (`food-main.patch`) |
| 그 밖 | **없음** — `GameScene.ts`, 점수·성장·보스·사운드·오프닝·엔딩·기존 저장 키·기존 UI 모두 그대로 |

## 동작 보장
- 주소에 `?gp=` 가 없거나, 게임천국이 만든 세션이 없거나 만료·다른 게임·다른 출처면 **이벤트를 하나도 구독하지 않고 DOM 도 만들지 않는다**(단독 플레이는 이전과 동일). — `src/platform/foodPatch.test.ts` 로 검증.
- 쓰는 키는 `gp.v1.inbox.<resultId>` 새 키뿐. Food 의 기존 키(`dino-snack-adventure.*`, `gona.*`)는 읽지도 쓰지도 않는다. — 테스트로 검증.
- 한 판당 1건: `EV.start` 마다 새 판, 끝 이벤트(`EV.gameOver`/`EV.endingStart`)는 판당 1번만 처리 → **엔딩 다시보기(`endingStart` 재발행)로 중복 기록 안 됨**.
- 일시정지 시간(`EV.pause`/`EV.resume`) 제외한 플레이 시간 측정, 저장 실패 시 메모리 보관 후 재시도.
- "🏝 게임천국으로 돌아가기" 버튼(선택): `?gp` 활성일 때만, 게임 오버/엔딩 마지막 화면에서만 화면 아래쪽 가운데에 표시, 시작/다시하기 때 숨김. 기존 버튼·레이아웃은 건드리지 않는다. **버튼이 겹치면 `parent` 를 넘기지 않으면 버튼 없이** 동작(브라우저 뒤로가기/탭 복귀로 결과 반영).

## 적용 방법 (승인 후, Food 저장소에서)
```bash
cp <paradise>/docs/platform/food-patch/paradise.ts src/platform/paradise.ts   # 디렉터리 없으면 mkdir -p src/platform
git apply <paradise>/docs/platform/food-patch/food-main.patch
npm run build && npm run build:dev
```
1. `dev` 브랜치에 푸시 → 개발 사이트(`/GoNa/dev/`)에서 검증 (게임천국 쪽도 같은 출처의 개발용 빌드로 `?gp=` 세션을 만들어 테스트)
2. Food 의 기존 봇(`tools/playtest-bot.cjs`, `tools/fullrun-bot.cjs`)으로 실제 게임 오버·엔딩까지 → 게임천국에 1건씩 반영 확인
3. 모바일에서 돌아가기 버튼 위치가 Food 게임 오버/엔딩 버튼과 겹치는지 확인(겹치면 `bottom` 값 조정 또는 버튼 제거)
4. 승인 후 `main` 반영(Food `RELEASE.md` 절차) → 게임천국 `src/platform/games.ts` 의 `FOOD_LINK` 를 `'live'` 로 바꿔 배포

## 게임천국 쪽 켜는 스위치
`src/platform/games.ts`: `export const FOOD_LINK = 'pending'` → 패치가 정식 배포되면 `'live'`.
- `pending`: PLAY 는 세션 없이 기존 주소로만 열고, 화면에는 **"기록 연동 준비 중"** 을 표시(가짜 연동 표시 없음).
- `live`: PLAY 가 세션을 만들어 `?gp=<세션>` 으로 연다.
