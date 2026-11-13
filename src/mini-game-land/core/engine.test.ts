import { describe, expect, it } from 'vitest';
import { RoundEngine, type RoundSummary } from './engine';
import type { FrameEnv } from './clock';

type Doc = EventTarget & { visibilityState?: string };

function setup(limitMs: number | null = 10_000, over: Partial<ConstructorParameters<typeof RoundEngine>[0]> = {}) {
  const finished: RoundSummary[] = [];
  const sfx: string[] = [];
  let t = 0;
  let id = 0;
  const q = new Map<number, (t: number) => void>();
  const env: FrameEnv = { raf: (cb) => (q.set(++id, cb), id), caf: (i) => void q.delete(i), now: () => t };
  const doc: Doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  const win = new EventTarget();
  const engine = new RoundEngine({ limitMs, readyMs: 1000, resumeMs: 3000, onFinish: (s) => finished.push(s), sfx: (n) => sfx.push(n), env, doc, win, ...over });
  const frame = (ms: number) => {
    t += ms;
    const cbs = [...q.values()];
    q.clear();
    cbs.forEach((cb) => cb(t));
  };
  const toPlaying = () => engine.tick(1000);
  return { engine, finished, sfx, doc, win, frame, pending: () => q.size, toPlaying };
}

describe('RoundEngine', () => {
  it('READY 동안은 시간이 가지 않고 입력 불가 → 이후 플레이', () => {
    const { engine, toPlaying } = setup();
    expect(engine.getSnapshot().phase).toBe('ready');
    expect(engine.ctx.isPlaying()).toBe(false);
    engine.tick(500);
    expect(engine.getSnapshot().elapsedMs).toBe(0);
    toPlaying();
    expect(engine.ctx.isPlaying()).toBe(true);
    expect(engine.getSnapshot().elapsedMs).toBe(0);
  });

  it('시간 경과 → 만료 시 timeout 실패 보고(한 번만)', () => {
    const { engine, finished, toPlaying } = setup(2000);
    toPlaying();
    engine.tick(1500);
    expect(finished).toHaveLength(0);
    engine.tick(600);
    expect(finished).toHaveLength(1);
    expect(finished[0]).toMatchObject({ outcome: 'fail', reason: 'timeout', remainingMs: 0 });
    engine.tick(1000);
    expect(finished).toHaveLength(1);
  });

  it('점수는 콤보 배수 적용, 플레이 중에만 증가', () => {
    const { engine, toPlaying } = setup();
    expect(engine.ctx.addScore(100)).toBe(0); // READY 중
    toPlaying();
    expect(engine.ctx.addScore(100)).toBe(100);
    engine.ctx.setCombo(5);
    expect(engine.ctx.addScore(100)).toBe(150);
    engine.ctx.setCombo(50);
    expect(engine.ctx.addScore(100)).toBe(200);
    expect(engine.getSnapshot().score).toBe(450);
    expect(engine.ctx.addScore(-5)).toBe(0);
  });

  it('finish 는 멱등: 클리어 보고 후 추가 호출·타임아웃 무시', () => {
    const { engine, finished, toPlaying } = setup(1000);
    toPlaying();
    engine.ctx.finish({ outcome: 'clear', stats: { hits: 3 } });
    engine.ctx.finish({ outcome: 'fail' });
    engine.tick(5000);
    expect(finished).toHaveLength(1);
    expect(finished[0]).toMatchObject({ outcome: 'clear', stats: { hits: 3 } });
    expect(engine.ctx.addScore(100)).toBe(0);
  });

  it('일시정지: 시간·프레임 콜백 정지, 재개는 카운트다운 후', () => {
    const { engine, toPlaying } = setup(10_000);
    toPlaying();
    let frames = 0;
    engine.ctx.onFrame(() => frames++);
    engine.tick(100);
    expect(frames).toBe(1);
    engine.pause();
    engine.tick(5000);
    expect(frames).toBe(1);
    expect(engine.getSnapshot().elapsedMs).toBe(100);
    engine.resume();
    expect(engine.getSnapshot().phase).toBe('resuming');
    expect(engine.getSnapshot().gateSec).toBe(3);
    engine.tick(2000);
    expect(engine.ctx.isPlaying()).toBe(false);
    engine.tick(1100);
    expect(engine.ctx.isPlaying()).toBe(true);
    expect(engine.getSnapshot().elapsedMs).toBe(100); // 카운트다운 동안 시간 안 감
  });

  it('탭 숨김·pagehide·blur 시 자동 일시정지', () => {
    for (const trigger of ['hidden', 'pagehide', 'blur'] as const) {
      const s = setup();
      s.engine.attach();
      s.toPlaying();
      if (trigger === 'hidden') {
        s.doc.visibilityState = 'hidden';
        s.doc.dispatchEvent(new Event('visibilitychange'));
      } else s.win.dispatchEvent(new Event(trigger));
      expect(s.engine.getSnapshot().phase).toBe('paused');
      expect(s.pending()).toBe(0); // 정지 중에는 rAF 도 멈춤
    }
  });

  it('보이는 상태의 visibilitychange 는 정지시키지 않음', () => {
    const s = setup();
    s.engine.attach();
    s.toPlaying();
    s.doc.dispatchEvent(new Event('visibilitychange'));
    expect(s.engine.getSnapshot().phase).toBe('playing');
  });

  it('나가기(quit)는 reason=quit 실패', () => {
    const { engine, finished, toPlaying } = setup();
    toPlaying();
    engine.quit();
    expect(finished[0]).toMatchObject({ outcome: 'fail', reason: 'quit' });
  });

  it('누수 방지: attach/detach 반복·StrictMode 이중 실행에도 핸들 0, rAF 하나', () => {
    const s = setup();
    const ownListener = () => {};
    const t = new EventTarget();
    for (let i = 0; i < 3; i++) {
      const off = s.engine.attach();
      s.engine.ctx.listen(t, 'x', ownListener);
      s.engine.ctx.onFrame(() => {});
      expect(s.pending()).toBe(1);
      off();
      expect(s.engine.liveHandles).toBe(0);
      expect(s.pending()).toBe(0);
    }
    // StrictMode: attach → detach → attach
    const off1 = s.engine.attach();
    off1();
    const off2 = s.engine.attach();
    expect(s.pending()).toBe(1);
    off2();
    expect(s.engine.liveHandles).toBe(0);
  });

  it('프레임 루프 통합: 실제 rAF 흐름으로 READY → 플레이 → 타임아웃', () => {
    const s = setup(500);
    s.engine.attach();
    for (let i = 0; i < 100 && s.finished.length === 0; i++) s.frame(16);
    expect(s.finished).toHaveLength(1);
    expect(s.finished[0].reason).toBe('timeout');
    expect(s.pending()).toBe(0);
    expect(s.engine.liveHandles).toBe(0);
  });

  it('무제한 라운드는 시간 만료 없음', () => {
    const { engine, finished, toPlaying } = setup(null);
    toPlaying();
    engine.tick(99_000);
    expect(finished).toHaveLength(0);
    expect(engine.getSnapshot().remainingMs).toBeNull();
  });

  it('구독자에게 상태 변경 통지·해제', () => {
    const { engine, toPlaying } = setup();
    let n = 0;
    const off = engine.subscribe(() => n++);
    toPlaying();
    engine.ctx.addScore(10);
    expect(n).toBeGreaterThan(0);
    const before = n;
    off();
    engine.ctx.addScore(10);
    expect(n).toBe(before);
  });
});
