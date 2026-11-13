/**
 * RoundEngine — 한 라운드의 공통 상태기계(React 와 무관한 순수 TS).
 * 타이머 · 점수/콤보 · 일시정지(탭 숨김 자동 정지) · 단일 프레임 루프 · 종료 보고를 담당합니다.
 *
 *  ready ─(READY_MS)→ playing ⇄ paused ─(resume)→ resuming ─(RESUME_MS)→ playing → done
 *
 * attach()/detach() 는 짝이며 반복 호출해도 안전합니다(React StrictMode 이중 실행 대비).
 */
import { Countdown, FrameLoop, browserEnv, type FrameEnv } from './clock';
import { Disposer } from './lifecycle';
import { comboMultiplier } from './scoring';
import type { FailReason, GameContext, GameResult, Outcome, SfxName } from './types';

export type Phase = 'ready' | 'playing' | 'paused' | 'resuming' | 'done';

export const READY_MS = 1200;
export const RESUME_MS = 3000;

export interface EngineSnapshot {
  phase: Phase;
  score: number;
  combo: number;
  limitMs: number | null;
  remainingMs: number | null;
  elapsedMs: number;
  /** READY / 재개 카운트다운에 표시할 숫자(초) */
  gateSec: number;
}

export interface RoundSummary {
  outcome: Outcome;
  reason: FailReason;
  /** 라운드 동안 쌓은 점수(콤보 배수 적용 후) */
  raw: number;
  remainingMs: number | null;
  elapsedMs: number;
  stats: Record<string, number>;
}

export interface EngineOptions {
  limitMs: number | null;
  onFinish: (s: RoundSummary) => void;
  sfx?: (name: SfxName) => void;
  readyMs?: number;
  resumeMs?: number;
  env?: FrameEnv;
  /** 탭 숨김 감지용(기본: document / window). 테스트에서 가짜 주입 */
  doc?: (EventTarget & { visibilityState?: string }) | null;
  win?: EventTarget | null;
}

export class RoundEngine {
  private phase: Phase = 'ready';
  private score = 0;
  private combo = 0;
  private gateMs: number;
  private readonly clock: Countdown;
  private readonly frameSubs = new Set<(dt: number) => void>();
  private readonly gameDisposer = new Disposer();
  private sysDisposer = new Disposer();
  private loop: FrameLoop | null = null;
  private readonly subs = new Set<() => void>();
  private snap: EngineSnapshot;
  private readonly readyMs: number;
  private readonly resumeMs: number;

  readonly ctx: GameContext;

  constructor(private readonly opts: EngineOptions) {
    this.readyMs = opts.readyMs ?? READY_MS;
    this.resumeMs = opts.resumeMs ?? RESUME_MS;
    this.gateMs = this.readyMs;
    this.clock = new Countdown(opts.limitMs);
    this.snap = this.makeSnap();
    this.ctx = {
      isPlaying: () => this.phase === 'playing',
      addScore: (base) => this.addScore(base),
      setCombo: (c) => {
        this.combo = Math.max(0, Math.floor(c));
        this.emit();
      },
      onFrame: (cb) => {
        this.frameSubs.add(cb);
        return () => void this.frameSubs.delete(cb);
      },
      listen: (target, type, fn, o) => this.gameDisposer.listen(target, type, fn, o),
      sfx: (n) => this.opts.sfx?.(n),
      finish: (r) => this.finish(r, 'game'),
    };
  }

  // ── React 연동 (useSyncExternalStore)
  subscribe = (fn: () => void) => {
    this.subs.add(fn);
    return () => void this.subs.delete(fn);
  };
  getSnapshot = () => this.snap;

  get currentPhase() {
    return this.phase;
  }

  /** 등록돼 있는 리스너·구독 수(누수 점검용). detach 후에는 0 이어야 함 */
  get liveHandles() {
    return this.gameDisposer.size + this.sysDisposer.size + this.frameSubs.size + (this.loop?.running ? 1 : 0);
  }

  // ── 수명주기
  attach(): () => void {
    if (this.phase === 'done') return () => {};
    const doc = this.opts.doc === undefined ? (typeof document !== 'undefined' ? document : null) : this.opts.doc;
    const win = this.opts.win === undefined ? (typeof window !== 'undefined' ? window : null) : this.opts.win;
    const sys = new Disposer();
    this.sysDisposer = sys;
    const autoPause: EventListener = () => {
      if (!doc || doc.visibilityState !== 'hidden') return;
      this.pause();
    };
    if (doc) sys.listen(doc, 'visibilitychange', autoPause);
    if (win) {
      sys.listen(win, 'pagehide', () => this.pause());
      sys.listen(win, 'blur', () => this.pause());
    }
    this.loop = new FrameLoop((dt) => this.tick(dt), this.opts.env ?? browserEnv());
    if (this.phase !== 'paused') this.loop.start();
    return () => this.detach();
  }

  detach() {
    this.loop?.stop();
    this.loop = null;
    this.sysDisposer.dispose();
    this.gameDisposer.dispose();
    this.frameSubs.clear();
  }

  // ── 진행
  tick(dtMs: number) {
    switch (this.phase) {
      case 'ready':
      case 'resuming': {
        const before = Math.ceil(this.gateMs / 1000);
        this.gateMs -= dtMs;
        if (this.gateMs <= 0) {
          this.phase = 'playing';
          this.opts.sfx?.('start');
          this.emit();
        } else if (Math.ceil(this.gateMs / 1000) !== before) {
          if (this.phase === 'resuming') this.opts.sfx?.('tick');
          this.emit();
        }
        return;
      }
      case 'playing': {
        this.clock.tick(dtMs);
        for (const cb of [...this.frameSubs]) {
          cb(dtMs);
          if (this.phase !== 'playing') return;
        }
        if (this.clock.expired) {
          this.finish({ outcome: 'fail' }, 'timeout');
          return;
        }
        this.emit();
        return;
      }
      default:
        return;
    }
  }

  pause() {
    if (this.phase === 'done' || this.phase === 'paused') return;
    this.phase = 'paused';
    this.loop?.stop();
    this.opts.sfx?.('pause');
    this.emit();
  }

  resume() {
    if (this.phase !== 'paused') return;
    this.phase = 'resuming';
    this.gateMs = this.resumeMs;
    this.loop?.start();
    this.emit();
  }

  quit() {
    this.finish({ outcome: 'fail' }, 'quit');
  }

  finish(result: GameResult, reason: FailReason = 'game') {
    if (this.phase === 'done') return; // 멱등
    this.phase = 'done';
    this.loop?.stop();
    this.gameDisposer.dispose();
    this.sysDisposer.dispose(); // 종료 즉시 탭 숨김 감지 리스너도 해제
    this.frameSubs.clear();
    this.emit();
    this.opts.onFinish({
      outcome: result.outcome,
      reason: result.outcome === 'clear' ? 'game' : reason,
      raw: this.score,
      remainingMs: this.clock.remainingMs,
      elapsedMs: this.clock.elapsedMs,
      stats: result.stats ?? {},
    });
  }

  private addScore(base: number): number {
    if (this.phase !== 'playing' || !(base > 0)) return 0;
    const pts = Math.round(base * comboMultiplier(this.combo));
    this.score += pts;
    this.emit();
    return pts;
  }

  private makeSnap(): EngineSnapshot {
    return {
      phase: this.phase,
      score: this.score,
      combo: this.combo,
      limitMs: this.clock.limitMs,
      remainingMs: this.clock.remainingMs,
      elapsedMs: this.clock.elapsedMs,
      gateSec: Math.max(0, Math.ceil(this.gateMs / 1000)),
    };
  }

  private emit() {
    this.snap = this.makeSnap();
    for (const fn of [...this.subs]) fn();
  }
}
