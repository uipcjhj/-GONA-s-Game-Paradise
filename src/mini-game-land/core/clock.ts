/** 공통 타이머(순수)와 단일 프레임 루프 */

/** 제한시간 카운트다운. limitMs=null 이면 무제한(경과만 측정). */
export class Countdown {
  elapsedMs = 0;
  constructor(readonly limitMs: number | null) {}

  tick(dtMs: number) {
    if (dtMs > 0) this.elapsedMs += dtMs;
  }
  get remainingMs(): number | null {
    return this.limitMs == null ? null : Math.max(0, this.limitMs - this.elapsedMs);
  }
  get expired() {
    return this.limitMs != null && this.elapsedMs >= this.limitMs;
  }
}

export interface FrameEnv {
  raf: (cb: (t: number) => void) => number;
  caf: (id: number) => void;
  now: () => number;
}

export const browserEnv = (): FrameEnv => ({
  raf: (cb) => requestAnimationFrame(cb),
  caf: (id) => cancelAnimationFrame(id),
  now: () => performance.now(),
});

/** 한 라운드에 rAF 는 이것 하나. dt 는 100ms 로 제한(탭 복귀 시 시간 점프 방지). */
export class FrameLoop {
  private id: number | null = null;
  private last = 0;
  static readonly MAX_DT = 100;

  constructor(
    private readonly onTick: (dtMs: number) => void,
    private readonly env: FrameEnv = browserEnv(),
  ) {}

  get running() {
    return this.id !== null;
  }

  start() {
    if (this.id !== null) return; // 중복 시작 방지
    this.last = this.env.now();
    const step = () => {
      const now = this.env.now();
      const dt = Math.min(FrameLoop.MAX_DT, Math.max(0, now - this.last));
      this.last = now;
      this.id = this.env.raf(step);
      this.onTick(dt);
    };
    this.id = this.env.raf(step);
  }

  stop() {
    if (this.id === null) return;
    this.env.caf(this.id);
    this.id = null;
  }
}
