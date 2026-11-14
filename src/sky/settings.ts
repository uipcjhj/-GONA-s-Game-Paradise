/**
 * 설정(로컬 저장) + 햅틱.
 *  - 화면 흔들림 세기: 0(끔) · 0.5(약하게) · 1(기본)
 *  - 진동: 표준 Vibration API(navigator.vibrate)가 있는 기기에서만 동작.
 *    iPhone Safari 는 이 API 를 제공하지 않으므로 자동으로 꺼지고(오류 없음), 화면 흔들림·히트스톱·사운드로 타격감을 대신함.
 *  - 성능 표시: FPS · 프레임 시간 · 객체 수 (실기기 측정용)
 */
export interface SkySettings {
  shake: number;
  vibrate: boolean;
  perf: boolean;
}

const KEY = 'gona.sky.settings';

export const canVibrate: boolean = typeof navigator !== 'undefined' && typeof (navigator as Navigator & { vibrate?: unknown }).vibrate === 'function';

function read(): SkySettings {
  const def: SkySettings = { shake: 1, vibrate: true, perf: /[?&]perf/.test(location.search) };
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<SkySettings>;
    return { ...def, ...s, perf: def.perf || !!s.perf };
  } catch {
    return def;
  }
}

export const settings: SkySettings = read();

export function saveSettings(p: Partial<SkySettings>): void {
  Object.assign(settings, p);
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* 무시 */
  }
}

let lastBuzz = 0;
/** 짧은 햅틱 (지원 기기에서만). 너무 잦은 진동을 막기 위해 최소 간격 유지 */
export function buzz(pattern: number | number[], minGap = 70): void {
  if (!canVibrate || !settings.vibrate) return;
  const now = performance.now();
  if (now - lastBuzz < minGap) return;
  lastBuzz = now;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* 무시 */
  }
}
