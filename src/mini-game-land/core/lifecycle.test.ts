import { describe, expect, it } from 'vitest';
import { Disposer } from './lifecycle';
import { Countdown, FrameLoop, type FrameEnv } from './clock';

describe('Disposer', () => {
  it('리스너 등록·일괄 해제, dispose 는 멱등', () => {
    const t = new EventTarget();
    let n = 0;
    const d = new Disposer();
    d.listen(t, 'x', () => n++);
    t.dispatchEvent(new Event('x'));
    expect(n).toBe(1);
    expect(d.size).toBe(1);
    d.dispose();
    d.dispose();
    t.dispatchEvent(new Event('x'));
    expect(n).toBe(1);
    expect(d.size).toBe(0);
  });
  it('개별 해제 함수는 한 번만 동작', () => {
    const d = new Disposer();
    let c = 0;
    const off = d.add(() => c++);
    off();
    off();
    d.dispose();
    expect(c).toBe(1);
  });
});

describe('Countdown', () => {
  it('제한시간 경과·만료', () => {
    const c = new Countdown(1000);
    c.tick(400);
    expect(c.remainingMs).toBe(600);
    expect(c.expired).toBe(false);
    c.tick(700);
    expect(c.remainingMs).toBe(0);
    expect(c.expired).toBe(true);
  });
  it('무제한은 만료되지 않음, 음수 dt 무시', () => {
    const c = new Countdown(null);
    c.tick(99999);
    c.tick(-50);
    expect(c.expired).toBe(false);
    expect(c.remainingMs).toBeNull();
    expect(c.elapsedMs).toBe(99999);
  });
});

function fakeEnv() {
  let t = 0;
  let id = 0;
  const q = new Map<number, (t: number) => void>();
  const env: FrameEnv = {
    raf: (cb) => (q.set(++id, cb), id),
    caf: (i) => void q.delete(i),
    now: () => t,
  };
  return {
    env,
    pending: () => q.size,
    advance(ms: number) {
      t += ms;
      const cbs = [...q.values()];
      q.clear();
      cbs.forEach((cb) => cb(t));
    },
  };
}

describe('FrameLoop', () => {
  it('rAF 는 하나만 예약, 중복 start 무시, stop 으로 해제', () => {
    const f = fakeEnv();
    const dts: number[] = [];
    const loop = new FrameLoop((dt) => dts.push(dt), f.env);
    loop.start();
    loop.start();
    expect(f.pending()).toBe(1);
    f.advance(16);
    f.advance(17);
    expect(dts).toEqual([16, 17]);
    expect(f.pending()).toBe(1);
    loop.stop();
    expect(f.pending()).toBe(0);
    expect(loop.running).toBe(false);
  });
  it('긴 정지(탭 복귀) 후에도 dt 는 100ms 로 제한', () => {
    const f = fakeEnv();
    const dts: number[] = [];
    const loop = new FrameLoop((dt) => dts.push(dt), f.env);
    loop.start();
    f.advance(5000);
    expect(dts).toEqual([100]);
  });
});
