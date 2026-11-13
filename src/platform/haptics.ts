/** 진동(지원 환경에서만) — 설정에서 끌 수 있음 */
export const canVibrate = (): boolean => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
export function buzz(enabled: boolean, ms = 25): void {
  if (!enabled || !canVibrate()) return;
  try {
    navigator.vibrate(ms);
  } catch {
    /* 무시 */
  }
}
