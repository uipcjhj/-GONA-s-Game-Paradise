/**
 * 오리지널 칩튠 BGM (직접 작곡 · WebAudio 합성 · 음원 파일/외부 서비스 없음).
 * - 페이지당 하나(싱글턴). 같은 곡을 다시 요청하면 무시 → 중복 재생 없음.
 * - iOS Safari: 사용자 터치 안에서 unlock() 을 불러야 소리가 남. 그 전에는 조용히 대기.
 * - 탭이 숨겨지면 멈추고(잔류 재생 방지), 다시 보이면 이어서. pagehide 에서 완전히 정지.
 * - 음소거/BGM 끄기(setEnabled(false))면 즉시 정지.
 * 효과음과 겹쳐도 거슬리지 않게 BGM 은 작은 음량(마스터 0.35)으로만 재생.
 */
export type TrackId = 'home' | 'mini' | 'play';
type Voice = { wave: OscillatorType | 'noise'; vol: number; notes: [number | null, number][] };
interface Track { bpm: number; voices: Voice[] }

const NOTE: Record<string, number> = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const hz = (n: string): number => {
  const m = /^([A-G]#?)(\d)$/.exec(n);
  if (!m) return 0;
  return 440 * Math.pow(2, (NOTE[m[1]] + (Number(m[2]) + 1) * 12 - 69) / 12);
};
/** "C5:2 E5:2 -:4" → [[주파수|null(쉼표), 16분음표 길이]] */
const seq = (s: string): [number | null, number][] =>
  s.trim().split(/\s+/).map((t) => {
    const [n, d] = t.split(':');
    return [n === '-' ? null : hz(n), Number(d)];
  });
const rep = (s: string, n: number) => Array(n).fill(s).join(' ');
const bassLine = (roots: string[], len = 4) => roots.map((r) => rep(`${r}:${len}`, 16 / len)).join(' ');

export const TRACKS: Record<TrackId, Track> = {
  // 게임천국 홈: 밝고 느긋한 C 장조 (132bpm, 8마디)
  home: {
    bpm: 132,
    voices: [
      { wave: 'square', vol: 0.045, notes: seq('C5:2 E5:2 G5:2 E5:2 A5:4 G5:4 F5:2 E5:2 D5:2 E5:2 C5:8 D5:2 F5:2 A5:2 F5:2 B5:4 A5:4 G5:2 F5:2 E5:2 D5:2 G5:8 C5:2 E5:2 G5:2 E5:2 A5:4 G5:4 F5:2 E5:2 D5:2 F5:2 E5:4 C5:4 D5:2 D5:2 E5:2 F5:2 G5:4 B4:4 C5:8 -:8') },
      { wave: 'triangle', vol: 0.11, notes: seq(['C3:4 G3:4 C3:4 G3:4', 'F2:4 C3:4 F2:4 C3:4', 'D3:4 A3:4 D3:4 A3:4', 'G2:4 D3:4 G2:4 D3:4', 'C3:4 G3:4 C3:4 G3:4', 'F2:4 C3:4 F2:4 C3:4', 'G2:4 D3:4 G2:4 D3:4', 'C3:4 G3:4 C3:8'].join(' ')) },
      { wave: 'noise', vol: 0.018, notes: seq(rep('X:4', 32)) },
    ],
  },
  // Mini Game Land 메뉴: 통통 튀는 G 장조 (152bpm, 4마디)
  mini: {
    bpm: 152,
    voices: [
      { wave: 'square', vol: 0.042, notes: seq('G5:2 B5:2 D6:2 B5:2 G5:2 B5:2 D6:4 C6:2 B5:2 A5:2 G5:2 A5:8 F#5:2 A5:2 C6:2 A5:2 F#5:2 A5:2 C6:4 B5:2 A5:2 G5:2 F#5:2 G5:8') },
      { wave: 'triangle', vol: 0.11, notes: seq(bassLine(['G2', 'C3', 'D3', 'G2'], 2)) },
      { wave: 'noise', vol: 0.016, notes: seq(rep('X:2 -:2', 16)) },
    ],
  },
  // 게임 중: 멜로디 없이 아르페지오+베이스만(효과음·집중 방해 최소) A 단조 (168bpm)
  play: {
    bpm: 168,
    voices: [
      { wave: 'square', vol: 0.026, notes: seq([rep('A4:2 C5:2 E5:2 C5:2', 2), rep('F4:2 A4:2 C5:2 A4:2', 2), rep('G4:2 B4:2 D5:2 B4:2', 2), rep('E4:2 G#4:2 B4:2 G#4:2', 2)].join(' ')) },
      { wave: 'triangle', vol: 0.1, notes: seq(bassLine(['A2', 'F2', 'G2', 'E2'], 8)) },
    ],
  },
};
// 'X' 는 노이즈(주파수 무관) — hz('X') = 0 이라 null 이 아닌 0 으로 남음

class BgmPlayer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private timer: number | null = null;
  private track: TrackId | null = null;
  private wanted: TrackId | null = null;
  private enabled = true;
  private pos: { i: number; t: number }[] = [];
  private bound = false;

  /** 사용자 터치 안에서 호출(여러 번 안전) */
  unlock(): void {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.35;
        this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate * 0.05;
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
    this.bindPage();
    this.sync();
  }
  setEnabled(on: boolean): void {
    this.enabled = on;
    this.sync();
  }
  /** 원하는 곡(또는 null=정지). 같은 곡이면 아무 일도 안 함 */
  play(id: TrackId | null): void {
    this.wanted = id;
    this.sync();
  }
  get playing(): TrackId | null {
    return this.track;
  }
  private bindPage(): void {
    if (this.bound) return;
    this.bound = true;
    document.addEventListener('visibilitychange', () => (document.hidden ? this.halt() : this.sync()));
    window.addEventListener('pagehide', () => this.halt());
  }
  private sync(): void {
    const want = this.enabled && !document.hidden ? this.wanted : null;
    if (want === this.track) return;
    this.halt();
    if (!want || !this.ctx || this.ctx.state !== 'running') return;
    this.track = want;
    const tr = TRACKS[want];
    const t0 = this.ctx.currentTime + 0.08;
    this.pos = tr.voices.map(() => ({ i: 0, t: t0 }));
    const tick = () => this.schedule(tr);
    tick();
    this.timer = window.setInterval(tick, 40);
  }
  private halt(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.track = null;
    // 예약된 음은 마스터를 잠깐 0 으로 → 잔류 재생 없이 즉시 조용해짐
    if (this.ctx && this.master) {
      const g = this.master.gain;
      g.cancelScheduledValues(this.ctx.currentTime);
      g.setValueAtTime(0, this.ctx.currentTime);
      g.setValueAtTime(0.35, this.ctx.currentTime + 0.2);
      const old = this.master;
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      window.setTimeout(() => old.disconnect(), 300);
    }
  }
  private schedule(tr: Track): void {
    const c = this.ctx;
    if (!c || !this.master) return;
    const step = 60 / tr.bpm / 4;
    const until = c.currentTime + 0.25;
    tr.voices.forEach((v, k) => {
      const p = this.pos[k];
      while (p.t < until) {
        const [f, len] = v.notes[p.i];
        const dur = len * step;
        if (f !== null) this.note(v, f, p.t, dur);
        p.t += dur;
        p.i = (p.i + 1) % v.notes.length;
      }
    });
  }
  private note(v: Voice, f: number, t: number, dur: number): void {
    const c = this.ctx!;
    const g = c.createGain();
    g.gain.setValueAtTime(v.vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.04, dur * (v.wave === 'noise' ? 0.3 : 0.9)));
    g.connect(this.master!);
    let src: AudioScheduledSourceNode;
    if (v.wave === 'noise') {
      const b = c.createBufferSource();
      b.buffer = this.noise;
      src = b;
    } else {
      const o = c.createOscillator();
      o.type = v.wave;
      o.frequency.setValueAtTime(f, t);
      src = o;
    }
    src.connect(g);
    src.start(t);
    src.stop(t + dur);
    src.onended = () => {
      src.disconnect();
      g.disconnect();
    };
  }
}
export const bgm = new BgmPlayer();
