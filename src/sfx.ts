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
