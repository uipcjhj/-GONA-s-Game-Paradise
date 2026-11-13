/**
 * [미적용 · 미검증] GONA's Food Adventure(uipcjhj/GoNa) 용 게임천국 연동 어댑터 제안.
 * - 이 저장소(게임천국)에서는 Food 코드를 수정하지 않는다(CLAUDE.md). Food 저장소 패치는 명시 승인 후 별도 브랜치에서 적용.
 * - 사용: Food 의 `src/platform/gp-sdk.ts` 로 복사(gp-sdk.ts) + 이 파일을 `src/platform/paradise.ts` 로 추가 + `main.ts` 에서 `initParadise()` 1줄 호출.
 * - 읽기만: bus 이벤트 구독(EV.start / EV.pause / EV.resume / EV.gameOver / EV.endingStart). GameScene·점수·저장 키는 건드리지 않는다.
 * - `?gp=` 가 없거나 세션이 없으면 아무 것도 구독하지 않는 완전한 no-op.
 * 아래 `bus`/`EV` import 경로와 GameOverInfo 필드는 docs/platform/PHASE2_FOOD_INTEGRATION.md §1 조사 기준이며, 패치 시 실제 코드에 맞춰 확인해야 한다.
 */
import { bus, EV } from './events'; // ← Food 쪽 실제 경로에 맞출 것
import { createGP } from './gp-sdk';

export function initParadise(): void {
  const gp = createGP({ gameVersion: '1.0.0' });
  if (!gp.init('food-island')) return; // 단독 실행: 완전한 no-op
  bus.on(EV.start, () => gp.runStart());
  bus.on(EV.pause, () => gp.runPause());
  bus.on(EV.resume, () => gp.runResume());
  bus.on(EV.gameOver, (i: { score: number; growthLevel: number; growthName: string; snacks: number; bossRetry?: boolean }) =>
    gp.runEnd({ outcome: 'failed', score: i.score, stage: i.growthLevel, stageLabel: i.growthName, extra: { snacks: i.snacks } }),
  );
  bus.on(EV.endingStart, (i: { score: number; growthLevel: number; growthName: string; snacks: number }) =>
    gp.runEnd({ outcome: 'cleared', score: i.score, stage: i.growthLevel, stageLabel: i.growthName, extra: { snacks: i.snacks } }),
  ); // 엔딩 다시보기는 같은 이벤트를 다시 내지만 runEnd 가 run 당 1번만 동작
}
// 게임천국 복귀: gp.returnUrl() 이 null 이 아니면 '🏝 게임천국으로' 버튼을 게임 오버/엔딩 화면에 추가(선택, 별도 승인).
