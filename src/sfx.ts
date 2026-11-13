/** 짧은 레트로 효과음 (WebAudio 합성 · 파일 없음). 브라우저가 자동재생을 막으면 조용히 건너뜀. */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;

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

/** 사용자 터치 안에서 호출하면 iOS Safari 에서도 소리가 풀림 */
export function unlockAudio(): void {
  const c = ac();
  if (c && c.state === 'suspended') void c.resume();
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
  src.start(t);
}

/** 오프닝 2.4초: 발자국 통통통 → 슉 → 착지 뿅 + 딩동. 반환값은 중간에 끊는 함수 */
export function playOpeningSfx(): () => void {
  const c = ac();
  if (!c || muted() || c.state !== 'running') return () => undefined;
  const t0 = c.currentTime + 0.03;
  [0, 0.13, 0.26, 0.39].forEach((dt, i) => tone(c, t0 + dt, 190 + i * 25, 0.09, 'square', 0.09, 90));
  whoosh(c, t0 + 0.6, 0.6);
  tone(c, t0 + 1.2 + 0.3, 520, 0.16, 'triangle', 0.12, 1400); // 커지는 소리
  tone(c, t0 + 1.2 + 0.66, 330, 0.18, 'triangle', 0.2, 90); // 착지 뿅
  [659, 784, 1047].forEach((f, i) => tone(c, t0 + 1.2 + 0.78 + i * 0.07, f, 0.1, 'square', 0.07));
  return () => {
    master?.gain.setValueAtTime(0, c.currentTime);
    master?.gain.linearRampToValueAtTime(0.7, c.currentTime + 0.25);
  };
}

export function playStartSfx(): void {
  const c = ac();
  if (!c || muted() || c.state !== 'running') return;
  const t = c.currentTime + 0.01;
  [523, 659, 784, 1047].forEach((f, i) => tone(c, t + i * 0.055, f, 0.09, 'square', 0.07));
}
