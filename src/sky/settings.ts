/**
 * 설정(로컬 저장) + 햅틱.
 *  - 화면 흔들림 세기: 0(끔) · 0.5(약하게) · 1(기본)
 *  - 진동: 표준 Vibration API(navigator.vibrate)가 있는 기기(안드로이드 크롬 등)에서 동작.
 *    iPhone Safari 는 이 API 가 없음 → iOS 18 이상에서는 숨긴 '스위치' 체크박스를 눌러 시스템 햅틱(짧은 '톡')을 냄.
 *    (진동 세기·길이는 조절 불가 · 패턴은 '톡' 횟수로 표현) 그보다 낮은 iOS 는 진동 없음 — 화면 흔들림·히트스톱·사운드로 대신함.
 *  - 성능 표시: FPS · 프레임 시간 · 객체 수 (실기기 측정용)
 */
import { NS } from './ns';

export interface SkySettings {
  shake: number;
  vibrate: boolean;
  perf: boolean;
  /** 근접 공격 자동 발동 (적이 근접 범위에 들어오면) */
  autoMelee: boolean;
}

const KEY = `${NS}.settings`;

const hasVibrateApi: boolean = typeof navigator !== 'undefined' && typeof (navigator as Navigator & { vibrate?: unknown }).vibrate === 'function';
/** iOS (iPadOS 포함) 의 Safari/웹뷰 */
const isIOS = typeof navigator !== 'undefined' && (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
const iosVer = (() => { const m = typeof navigator !== 'undefined' ? navigator.userAgent.match(/OS (\d+)_/) : null; return m ? +m[1] : 0; })();
/** iOS 18+ 스위치 햅틱 사용 여부 */
export const iosHaptic = isIOS && !hasVibrateApi && iosVer >= 18;
/** 이 기기에서 진동(햅틱)을 낼 수 있는지 */
export const canVibrate: boolean = hasVibrateApi || iosHaptic;
let hapLabel: HTMLLabelElement | null = null;
/** iOS 18+: 화면 밖에 숨긴 스위치(input switch)를 라벨로 눌러 시스템 햅틱 한 번 */
function iosTick(): void {
  try {
    if (!hapLabel) {
      const inp = document.createElement('input');
      inp.type = 'checkbox';
      inp.setAttribute('switch', '');
      inp.id = 'sky-haptic';
      inp.tabIndex = -1;
      inp.setAttribute('aria-hidden', 'true');
      inp.style.cssText = 'position:fixed;left:-100px;top:0;opacity:0;pointer-events:none;width:1px;height:1px';
      const lb = document.createElement('label');
      lb.htmlFor = 'sky-haptic';
      lb.setAttribute('aria-hidden', 'true');
      lb.style.cssText = 'position:fixed;left:-100px;top:0;opacity:0;pointer-events:none;width:1px;height:1px';
      document.body.append(inp, lb);
      hapLabel = lb;
    }
    hapLabel.click();
  } catch {
    /* 무시 */
  }
}

function read(): SkySettings {
  const def: SkySettings = { shake: 1, vibrate: true, perf: /[?&]perf/.test(location.search), autoMelee: true };
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
  if (!hasVibrateApi) {
    // iOS: 패턴의 '진동' 칸마다 톡 한 번 (최대 3번)
    const arr = Array.isArray(pattern) ? pattern : [pattern];
    let t = 0;
    let n = 0;
    for (let i = 0; i < arr.length && n < 3; i++) {
      if (i % 2 === 0) { if (t === 0) iosTick(); else window.setTimeout(iosTick, t); n++; }
      t += arr[i];
    }
    return;
  }
  try {
    navigator.vibrate(pattern);
  } catch {
    /* 무시 */
  }
}
