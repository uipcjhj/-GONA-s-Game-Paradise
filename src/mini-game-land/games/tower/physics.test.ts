import { describe, expect, it } from 'vitest';
import { FALL_Y, PLATE_X, SUBSTEPS, TowerWorld, WORLD_W } from './physics';
import { WIND_BASE, WIND_TO_DRIFT } from './logic';

const run = (w: TowerWorld, ms: number) => { for (let t = 0; t < ms; t += 1000 / 60) w.step(); };
const world = (plateW = 110) => new TowerWorld({ plateW, frictionMul: 1 });

describe('물리 래퍼 — 안정화 설정(spike 검증값) 보호', () => {
  it('서브스텝 3 · 슬립 켬 · 반복 10/8 (이 설정이 아니면 높은 탑이 무너짐)', () => {
    const w = world();
    expect(SUBSTEPS).toBe(3);
    expect(w.engine.enableSleeping).toBe(true);
    expect(w.engine.positionIterations).toBe(10);
    expect(w.engine.velocityIterations).toBe(8);
  });

  it('가운데 정렬로 16개를 쌓으면 모두 멈춰 서 있음(쓰러지지 않음)', () => {
    const w = world();
    let top = 0;
    const ids: number[] = [];
    for (let i = 0; i < 16; i++) {
      const p = w.spawn(i % 2 ? 'toast' : 'pudding', PLATE_X + (i % 3) - 1, top - 40, 0);
      ids.push(p.id); run(w, 900);
      top = w.topY();
    }
    run(w, 2500);
    expect(w.fallen()).toHaveLength(0);
    expect(w.isCalm()).toBe(true);
    expect(w.height()).toBeGreaterThan(150);
  });

  it('무게중심이 접시 밖에 있는 무거운 조각은 떨어짐, 안쪽이면 버팀(실제 물리)', () => {
    const out = world(80);
    out.spawn('cake', PLATE_X + 40 + 22, -30, 0); // 접시 가장자리(40) 밖에 무게중심
    run(out, 3000);
    expect(out.fallen().length).toBe(1);
    const inn = world(80);
    inn.spawn('cake', PLATE_X + 20, -30, 0);
    run(inn, 3000);
    expect(inn.fallen()).toHaveLength(0);
    expect(inn.isCalm()).toBe(true);
  });

  it('떨어진 조각은 FALL_Y 아래로 가고 remove 로 정리됨', () => {
    const w = world(60);
    const p = w.spawn('toast', PLATE_X + 70, -30, 0);
    run(w, 2500);
    expect(p.body.position.y).toBeGreaterThan(FALL_Y);
    expect(w.fallen().map((x) => x.id)).toEqual([p.id]);
    w.remove(p.id);
    expect(w.pieces.size).toBe(0);
  });

  it('바람은 지정한 낙하 조각에만 작용하고 쌓인 탑은 건드리지 않음', () => {
    const w = world();
    const rest = w.spawn('toast', PLATE_X, -20, 0);
    run(w, 1500);
    const x0 = rest.body.position.x;
    const fall = w.spawn('macaron', PLATE_X, -90, 0);
    w.wind = 0.0002; w.windTarget = fall.id;
    run(w, 400);
    expect(Math.abs(rest.body.position.x - x0)).toBeLessThan(0.05);
    expect(Math.abs(fall.body.position.x - PLATE_X)).toBeGreaterThan(1);
  });

  it('바람 세기 → 휨 환산(WIND_TO_DRIFT)이 실제 물리와 맞고, 기준 바람은 약 6 단위', () => {
    const drift = (wind: number) => {
      const w = world(); const p = w.spawn('toast', PLATE_X, -80, 0);
      w.wind = wind; w.windTarget = p.id;
      let t = 0; while (!p.landed && t < 300) { w.step(); t++; }
      return p.body.position.x - PLATE_X;
    };
    expect(drift(WIND_BASE)).toBeGreaterThan(4);
    expect(drift(WIND_BASE)).toBeLessThan(8);
    expect(drift(WIND_BASE)).toBeCloseTo(WIND_BASE * WIND_TO_DRIFT, 0);
    expect(drift(-WIND_BASE)).toBeLessThan(0);
    expect(drift(0)).toBeCloseTo(0, 5);
  });

  it('같은 입력이면 항상 같은 결과(결정적)', () => {
    const once = () => { const w = world(); for (let i = 0; i < 8; i++) { w.spawn('toast', PLATE_X + (i % 2 ? 6 : -5), -20 - i * 22, 0); run(w, 400); } run(w, 2000); return [...w.pieces.values()].map((p) => `${p.body.position.x.toFixed(6)},${p.body.position.y.toFixed(6)},${p.body.angle.toFixed(6)}`).join(';'); };
    expect(once()).toBe(once());
  });

  it('성능: 조각 18개 쌓인 상태에서 600스텝이 1.5초 이내(서버 기준, 모바일 여유)', () => {
    const w = world(); let top = 0;
    for (let i = 0; i < 18; i++) { w.spawn('toast', PLATE_X, top - 30, 0); run(w, 500); top = w.topY(); }
    const t0 = performance.now();
    for (let i = 0; i < 600; i++) w.step();
    expect(performance.now() - t0).toBeLessThan(1500);
  });

  it('월드 폭 상수와 접시 위치', () => {
    expect(WORLD_W).toBe(180);
    expect(PLATE_X).toBe(90);
  });

  it('첫 접촉 때만 landed 콜백(충격 크기 포함)', () => {
    const w = world(); const hits: number[] = [];
    w.onLanded((_p, impact) => hits.push(impact));
    const p = w.spawn('toast', PLATE_X, -60, 0);
    run(w, 1500);
    expect(p.landed).toBe(true);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toBeGreaterThan(1);
  });
});
