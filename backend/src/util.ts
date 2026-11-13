const KST_MS = 9 * 3600 * 1000;
const DAY = 86400000;

/** 한국 시간 기준 그 주 월요일('YYYY-MM-DD') — 주간 랭킹의 주차 ID (월 00:00 ~ 일 23:59:59 KST) */
export function kstWeekId(ms: number): string {
  const d = new Date(ms + KST_MS);
  const dow = (d.getUTCDay() + 6) % 7;
  return new Date(ms + KST_MS - dow * DAY).toISOString().slice(0, 10);
}
/** 다음 주 월요일 00:00 KST (주간 종료 시각, ms) */
export function kstWeekEnd(ms: number): number {
  const start = Date.parse(`${kstWeekId(ms)}T00:00:00Z`) - KST_MS;
  return start + 7 * DAY;
}

export const json = (status: number, body: unknown, extra: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra } });

export async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export function randomToken(bytes = 32): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export const uuid = (): string => crypto.randomUUID();

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function publicCode(): string {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  let out = '';
  for (const x of b) if (x < 248 && out.length < 4) out += CODE_ALPHABET[x % CODE_ALPHABET.length];
  return out.length === 4 ? out : publicCode();
}
