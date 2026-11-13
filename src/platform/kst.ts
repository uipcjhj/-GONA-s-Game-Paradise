/** 한국 표준시(KST, UTC+9) 기준 날짜·주차. 기기 시계를 따르므로 오프라인 보상은 소액·무가치 재화만 다룸 */
const KST_MS = 9 * 3600 * 1000;
export function dateKST(now: Date | number): string {
  const t = (typeof now === 'number' ? now : now.getTime()) + KST_MS;
  return new Date(t).toISOString().slice(0, 10);
}
/** 해당 날짜가 속한 주의 월요일 날짜(KST) = 주차 id (예: 2026-11-09) */
export function weekIdKST(now: Date | number): string {
  const d = dateKST(now);
  const t = Date.parse(`${d}T00:00:00Z`);
  const dow = new Date(t).getUTCDay(); // 0=일
  const back = (dow + 6) % 7;
  return new Date(t - back * 86400000).toISOString().slice(0, 10);
}
export function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
}
export function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}
