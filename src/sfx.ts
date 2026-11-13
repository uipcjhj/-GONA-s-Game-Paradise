/**
 * 짧은 레트로 효과음 (WebAudio 합성 · 파일 없음).
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

function whoosh(c: AudioContext, t: number, dur: number): void {
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 2.5;
  f.frequency.setValueAtTime(350, t);
  f.frequency.exponentialRampToValueAtTime(2600, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.35, t + dur * 0.5);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master!);
  track(src);
  src.start(t);
}

/** 오프닝 2.4초: 발자국 통통통(0~0.6) → 슉(0.6~1.2) → 커지는 소리 · 착지 뿅 · 딩동(1.2~2.4) */
export function playOpeningSfx(): void {
  stopAllSfx();
  const c = ac();
  if (!c || muted() || c.state !== 'running') return;
  const t0 = c.currentTime + 0.03;
  [0, 0.15, 0.3, 0.45].forEach((dt, i) => tone(c, t0 + dt, 190 + i * 28, 0.09, 'square', 0.09, 90));
  whoosh(c, t0 + 0.6, 0.6);
  tone(c, t0 + 1.2 + 0.25, 520, 0.2, 'triangle', 0.12, 1400);
  tone(c, t0 + 1.2 + 0.66, 330, 0.18, 'triangle', 0.2, 90);
  [659, 784, 1047].forEach((f, i) => tone(c, t0 + 1.2 + 0.78 + i * 0.07, f, 0.1, 'square', 0.07));
}

export function playStartSfx(): void {
  stopAllSfx();
  const c = ac();
  if (!c || muted() || c.state !== 'running') return;
  const t = c.currentTime + 0.01;
  [523, 659, 784, 1047].forEach((f, i) => tone(c, t + i * 0.055, f, 0.09, 'square', 0.07));
}
