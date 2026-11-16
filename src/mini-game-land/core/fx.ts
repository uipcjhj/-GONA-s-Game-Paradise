/**
 * 효과 시간의 '단일 출처'. JS 타이머와 CSS 애니메이션이 같은 값을 쓰도록 CSS 변수(--mgl-fx-*)로도 주입됩니다.
 * 스킨은 효과의 '모양'(키프레임·스프라이트)은 바꿀 수 있지만 시간은 여기서만 정합니다
 * (스킨이 --mgl-fx-* 를 덮어써도 Shell 이 이 값을 최종 적용 → 타이머와 어긋나지 않음).
 */
export const FX = {
  // 템포 개선(측정: tools/fun-metrics.cjs): 시작 대기 1.2→0.7초, 재개 3→2초, 결과 전환 0.9→0.6초, 챌린지 인트로 1.4→1.0초·요약 1.8→1.2초
  round: { readyMs: 700, resumeMs: 2000, endOverlayMs: 600, introMs: 1000, summaryMs: 1200 },
  sort: { enterMs: 140, flyMs: 200, feedbackMs: 700, feedbackWrongMs: 2200, happyMs: 900 },
  tower: { shakeMs: 140, feedbackMs: 700, feedbackFellMs: 1500 },
  // 장난감방 이동 연출 합계 0.57→0.37초(입력 잠금 단축, 규칙 동일)
  toyroom: { liftMs: 60, popMs: 160, clearMs: 70, placeMs: 80, feedbackMs: 1100, feedbackWarnMs: 1400, selectMs: 80 },
  catch: { popMs: 520, moodMs: 450 },
} as const;

/** 타이머가 정리되기 직전에 CSS 애니메이션이 끝나도록 주는 여유 */
export const FX_CLEANUP_MARGIN_MS = 20;

/** CSS 변수로 내보낼 값(애니메이션 길이에 쓰이는 것만) */
export function fxCssVars(): Record<string, string> {
  return {
    '--mgl-fx-catch-pop': `${FX.catch.popMs}ms`,
    '--mgl-fx-sort-enter': `${FX.sort.enterMs}ms`,
    '--mgl-fx-sort-fly': `${FX.sort.flyMs}ms`,
    '--mgl-fx-tower-shake': `${FX.tower.shakeMs}ms`,
    '--mgl-fx-toy-select': `${FX.toyroom.selectMs}ms`,
    '--mgl-fx-toy-pop': `${FX.toyroom.popMs}ms`,
  };
}
