/** 한국 시간(KST, UTC+9) 날짜 계산. 기기 시계 기준이라 조작될 수 있음(문서 참고). */
const KST_MS = 9 * 3600 * 1000;
const DAY = 86400000;

/** 'YYYY-MM-DD' (한국 날짜) */
export function kstDate(ms: number): string {
  return new Date(ms + KST_MS).toISOString().slice(0, 10);
}
export function dayNumber(date: string): number {
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY);
}
export function isDate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}
/** a → b 로 며칠 지났는지 (b 가 더 나중이면 양수) */
export function daysBetween(a: string, b: string): number {
  return dayNumber(b) - dayNumber(a);
}
/** 한국 기준 그 주 월요일 날짜 = 주차 ID (주간 랭킹용: 월 00:00 ~ 일 23:59:59 KST) */
export function kstWeekId(ms: number): string {
  const d = new Date(ms + KST_MS);
  const dow = (d.getUTCDay() + 6) % 7; // 월=0
  return new Date(ms + KST_MS - dow * DAY).toISOString().slice(0, 10);
}
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
