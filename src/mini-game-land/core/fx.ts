/**
 * 효과 시간의 '단일 출처'. JS 타이머와 CSS 애니메이션이 같은 값을 쓰도록 CSS 변수(--mgl-fx-*)로도 주입됩니다.
 * 스킨은 효과의 '모양'(키프레임·스프라이트)은 바꿀 수 있지만 시간은 여기서만 정합니다
 * (스킨이 --mgl-fx-* 를 덮어써도 Shell 이 이 값을 최종 적용 → 타이머와 어긋나지 않음).
 */
export const FX = {
  round: { readyMs: 1200, resumeMs: 3000, endOverlayMs: 900, introMs: 1400, summaryMs: 1800 },
  sort: { enterMs: 140, flyMs: 200, feedbackMs: 700, feedbackWrongMs: 2200, happyMs: 900 },
  tower: { shakeMs: 140, feedbackMs: 700, feedbackFellMs: 1500 },
  toyroom: { liftMs: 90, popMs: 240, clearMs: 110, placeMs: 120, feedbackMs: 1100, feedbackWarnMs: 1400, selectMs: 80 },
} as const;

/** 타이머가 정리되기 직전에 CSS 애니메이션이 끝나도록 주는 여유 */
export const FX_CLEANUP_MARGIN_MS = 20;

/** CSS 변수로 내보낼 값(애니메이션 길이에 쓰이는 것만) */
export function fxCssVars(): Record<string, string> {
  return {
    '--mgl-fx-sort-enter': `${FX.sort.enterMs}ms`,
    '--mgl-fx-sort-fly': `${FX.sort.flyMs}ms`,
    '--mgl-fx-tower-shake': `${FX.tower.shakeMs}ms`,
    '--mgl-fx-toy-select': `${FX.toyroom.selectMs}ms`,
    '--mgl-fx-toy-pop': `${FX.toyroom.popMs}ms`,
  };
}
