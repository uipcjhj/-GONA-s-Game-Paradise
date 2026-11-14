/**
 * WebAudio 합성 효과음 — 파일·외부 서비스 없음. 첫 터치에서 unlock(iOS Safari 정책).
 * ※ M1 은 공통 뱅크. 게임별 독자 뱅크는 각 게임 단계에서 추가.
 */
import type { SfxName } from './types';

interface Tone {
  f: number;
  d: number;
  t?: OscillatorType;
  v?: number;
  /** 시작 지연(초) */
  at?: number;
  /** 끝 주파수(슬라이드) */
  to?: number;
}

export const SFX: Record<SfxName, Tone[]> = {
  tap: [{ f: 660, d: 0.05, t: 'square', v: 0.05 }],
  good: [
    { f: 660, d: 0.06, t: 'square', v: 0.06 },
    { f: 990, d: 0.09, t: 'square', v: 0.06, at: 0.06 },
  ],
  bad: [{ f: 200, d: 0.18, t: 'sawtooth', v: 0.06, to: 110 }],
  clear: [523, 659, 784, 1047].map((f, i) => ({ f, d: 0.12, t: 'square' as const, v: 0.06, at: i * 0.1 })),
  fail: [392, 330, 262, 196].map((f, i) => ({ f, d: 0.16, t: 'triangle' as const, v: 0.1, at: i * 0.14 })),
  tick: [{ f: 880, d: 0.04, t: 'triangle', v: 0.08 }],
  pause: [{ f: 440, d: 0.08, t: 'triangle', v: 0.08 }],
  lifeup: [660, 880, 1320].map((f, i) => ({ f, d: 0.1, t: 'square' as const, v: 0.06, at: i * 0.08 })),
  start: [{ f: 784, d: 0.12, t: 'square', v: 0.06 }],
  drop: [{ f: 520, d: 0.14, t: 'triangle', v: 0.06, to: 260 }],
  thud: [{ f: 150, d: 0.09, t: 'square', v: 0.09, to: 70 }],
};

export class AudioSystem {
  private ctx: AudioContext | null = null;
  muted = false;

  /** 사용자 제스처 안에서 호출. 여러 번 호출해도 안전 */
  unlock() {
    try {
      if (!this.ctx) {
        const AC = typeof window !== 'undefined' ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined;
        if (!AC) return;
        this.ctx = new AC();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
  }

  play(name: SfxName) {
    const ctx = this.ctx;
    if (!ctx || this.muted || ctx.state !== 'running') return;
    const t0 = ctx.currentTime;
    for (const n of SFX[name]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = t0 + (n.at ?? 0);
      osc.type = n.t ?? 'square';
      osc.frequency.setValueAtTime(n.f, start);
      if (n.to) osc.frequency.linearRampToValueAtTime(n.to, start + n.d);
      gain.gain.setValueAtTime(n.v ?? 0.06, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + n.d);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + n.d + 0.02);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    }
  }

  dispose() {
    void this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}
