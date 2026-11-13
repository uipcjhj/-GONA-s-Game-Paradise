/**
 * 짧은 레트로 효과음(오프닝 2개뿐) (WebAudio 합성 · 파일 없음).
 * - 소리 소스를 모두 추적해서 재생 중에 다시 호출하면 이전 것을 먼저 끊음 → 중복·겹침 방지
 * - 브라우저(특히 iPhone Safari)는 사용자 터치 전에는 소리를 막음 → 첫 터치에서 unlockAudio() 로 해제.
 *   막혀 있으면 조용히 건너뜀(오프닝 자동 재생은 첫 터치 전까지 무음일 수 있음).
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const active = new Set<AudioScheduledSourceNode>();

function ac(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.7;
      master.connect(ctx.destination);
    }
    return ctx;
  } catch {
    return null;
  }
}

export function muted(): boolean {
  try {
    return localStorage.getItem('gona.mute') === '1';
  } catch {
    return false;
  }
}

export function unlockAudio(): void {
  const c = ac();
  if (c && c.state === 'suspended') void c.resume();
}

/** 예약된 소리까지 포함해 지금 재생·예약 중인 모든 소리를 즉시 끊음 */
export function stopAllSfx(): void {
  active.forEach((n) => {
    try {
      n.stop();
    } catch {
      /* 이미 끝난 소리 */
    }
  });
  active.clear();
}

function track(n: AudioScheduledSourceNode): void {
  active.add(n);
  n.onended = () => active.delete(n);
}

function tone(c: AudioContext, t: number, freq: number, dur: number, type: OscillatorType, vol: number, to?: number): void {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master!);
  track(o);
  o.start(t);
  o.stop(t + dur + 0.02);
}

/** 오프닝 2초: 효과음은 딱 두 번 — 고나 점프(0.5초) · 로고 착지(약 1.64초) */
export function playOpeningSfx(): void {
  stopAllSfx();
  const c = ac();
  if (!c || muted() || c.state !== 'running') return;
  const t0 = c.currentTime + 0.03;
  tone(c, t0 + 0.52, 330, 0.14, 'square', 0.09, 760); // 폴짝
  tone(c, t0 + 1.64, 300, 0.16, 'triangle', 0.2, 90); // 통
}

/** 효과음 켜기/끄기 (기존 `gona.mute` 키 그대로 사용 — 플랫폼 데이터 초기화와 무관) */
export function setMuted(m: boolean): void {
  try {
    if (m) localStorage.setItem('gona.mute', '1');
    else localStorage.removeItem('gona.mute');
  } catch {
    /* 저장 불가 환경: 이번 접속에서만 적용되지 않음 */
  }
  if (m) stopAllSfx();
}

/**
 * 게임천국 UI 효과음 (오리지널 합성음 · 파일 없음). `gona.mute` 를 따르고, 같은 소리를 짧은 시간에 겹쳐 내지 않음.
 * 사용자 터치 이후에만 소리가 남(iOS Safari). 배경음은 없음.
 */
export type UiCue = 'tap' | 'tab' | 'open' | 'close' | 'coin' | 'buy' | 'equip' | 'claim' | 'achieve' | 'levelup' | 'fanfare' | 'over' | 'error';
const lastCue: Partial<Record<UiCue, number>> = {};
export function playUi(cue: UiCue): void {
  const c = ac();
  if (!c || muted()) return;
  if (c.state === 'suspended') void c.resume();
  if (c.state !== 'running') return;
  const now = c.currentTime;
  if ((lastCue[cue] ?? -1) > now - 0.06) return; // 연타 겹침 방지
  lastCue[cue] = now;
  const t = now + 0.01;
  const seq = (notes: [number, number, number][], type: OscillatorType = 'square', vol = 0.07) => notes.forEach(([f, at, d]) => tone(c, t + at, f, d, type, vol));
  switch (cue) {
    case 'tap': tone(c, t, 880, 0.04, 'square', 0.05); break;
    case 'tab': tone(c, t, 660, 0.05, 'square', 0.05, 990); break;
    case 'open': tone(c, t, 440, 0.08, 'square', 0.05, 880); break;
    case 'close': tone(c, t, 700, 0.07, 'square', 0.045, 350); break;
    case 'coin': seq([[988, 0, 0.06], [1319, 0.06, 0.14]]); break;
    case 'buy': seq([[784, 0, 0.06], [988, 0.06, 0.06], [1319, 0.12, 0.16]]); break;
    case 'equip': seq([[523, 0, 0.05], [784, 0.05, 0.09]], 'triangle', 0.12); break;
    case 'claim': seq([[784, 0, 0.06], [1047, 0.07, 0.06], [1319, 0.14, 0.18]]); break;
    case 'achieve': seq([[659, 0, 0.08], [784, 0.08, 0.08], [988, 0.16, 0.08], [1319, 0.24, 0.26]], 'square', 0.06); break;
    case 'levelup': seq([[523, 0, 0.08], [659, 0.08, 0.08], [784, 0.16, 0.08], [1047, 0.24, 0.08], [1319, 0.32, 0.3]], 'square', 0.065); break;
    case 'fanfare': seq([[784, 0, 0.1], [784, 0.12, 0.08], [1047, 0.22, 0.32]], 'square', 0.07); seq([[392, 0, 0.1], [392, 0.12, 0.08], [523, 0.22, 0.32]], 'triangle', 0.1); break;
    case 'over': seq([[523, 0, 0.12], [440, 0.13, 0.12], [349, 0.26, 0.3]], 'triangle', 0.12); break;
    case 'error': tone(c, t, 196, 0.12, 'square', 0.06, 150); break;
  }
}
/** 진동(설정이 켜져 있고 지원 기기일 때만) */
export function buzz(on: boolean, ms = 18): void {
  if (!on) return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* 미지원 */
  }
}
