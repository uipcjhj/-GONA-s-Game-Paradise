import { describe, expect, it } from 'vitest';
import { TowerGame, createGame, type TowerEvent } from './game';
import { difficulty, type TowerParams } from './logic';
import { PLATE_X, WORLD_W } from './physics';
import { lcg, play, supportX } from './bot';

const mk = (o: Partial<TowerParams> = {}, level = 1, seed = 7) => new TowerGame({ ...difficulty(level), ...o }, seed);
function run(g: TowerGame, ms: number) { const ev: TowerEvent[] = []; for (let t = 0; t < ms && !g.over; t += 1000 / 60) ev.push(...g.step(1000 / 60)); return ev; }
const types = (ev: TowerEvent[]) => ev.map((e) => e.type);

describe('TowerGame — 입력', () => {
  it('시작: 조준 단계, 접시 가운데, 예산 그대로, 미리보기 수만큼', () => {
    const g = createGame(1, 1);
    expect(g.phase).toBe('aim');
    expect(g.aimX).toBe(PLATE_X);
    expect(g.piecesLeft).toBe(g.params.budget);
    expect(g.next).toHaveLength(2);
    expect(createGame(5, 1).next).toHaveLength(1);
  });
  it('같은 시드 → 같은 조각 순서, 다른 시드 → 다름', () => {
    const seq = (seed: number) => { const g = createGame(5, seed); const out: string[] = []; for (let i = 0; i < 6; i++) { out.push(g.current.kind + g.rot); g.swap(); } return out.join(); };
    const order = (seed: number) => { const g = createGame(5, seed); return [g.current.kind, ...g.next].join(); };
    expect(order(3)).toBe(order(3));
    expect([1, 2, 3, 4, 5, 6].some((s) => order(s) !== order(1))).toBe(true);
    expect(seq(3)).toBe(seq(3));
  });
  it('조준은 월드 안으로 클램프(조각 폭만큼 여유)', () => {
    const g = createGame(1, 1);
    g.setAim(-500); expect(g.aimX).toBeGreaterThan(0); expect(g.aimX).toBeCloseTo(g.box.w / 2 + 2);
    g.setAim(999); expect(g.aimX).toBeCloseTo(WORLD_W - g.box.w / 2 - 2);
    g.setAim(PLATE_X); g.moveAim(10); expect(g.aimX).toBe(PLATE_X + 10);
  });
  it('회전: 0→1→2→3→0, 가로세로 바뀜, 회전해도 조준이 월드 안', () => {
    const g = mk({ pool: ['toast'] });
    const w0 = g.box.w, h0 = g.box.h;
    g.rotate(); expect(g.rot).toBe(1); expect(g.box.w).toBe(h0); expect(g.box.h).toBe(w0);
    g.rotate(); g.rotate(); g.rotate(); expect(g.rot).toBe(0);
    g.setAim(0); g.rotate(); expect(g.aimX).toBeGreaterThanOrEqual(g.box.w / 2);
  });
  it('교환: 현재↔다음 맞바꿈, 횟수 차감, 0 이면 거부', () => {
    const g = mk({ swaps: 1, pool: ['toast', 'cake'] }, 1, 3);
    const cur = g.current.kind, nxt = g.next[0];
    expect(g.swap()).toBe(true);
    expect(g.current.kind).toBe(nxt); expect(g.next[0]).toBe(cur); expect(g.swaps).toBe(0);
    expect(g.swap()).toBe(false);
    expect(g.current.kind).toBe(nxt);
  });
  it('놓기: 조각 수 차감 · 낙하 단계 · 낙하 중엔 조준/회전/교환/재놓기 불가', () => {
    const g = createGame(1, 1);
    const left = g.piecesLeft, x = g.aimX;
    expect(g.release()).toBe(true);
    expect(g.piecesLeft).toBe(left - 1);
    expect(g.phase).toBe('drop');
    expect(g.world.pieces.size).toBe(1);
    g.moveAim(20); expect(g.aimX).toBe(x);
    expect(g.rotate()).toBe(false); expect(g.swap()).toBe(false); expect(g.release()).toBe(false);
  });
  it('낙하 → 닿음 → 가라앉음 → 평가 → 다시 조준(이벤트 순서)', () => {
    const g = createGame(1, 1);
    g.release();
    const ev = run(g, 4000);
    const t = types(ev);
    expect(t[0]).toBe('drop');
    expect(t.indexOf('landed')).toBeGreaterThanOrEqual(0);
    expect(t.indexOf('placed')).toBeGreaterThan(t.indexOf('landed'));
    expect(g.phase).toBe('aim');
    expect(g.placed).toBe(1);
    expect(g.current).toBeTruthy();
  });
});

describe('TowerGame — 점수·평가', () => {
  it('접시 한가운데에 평평하게 놓으면 완벽', () => {
    const g = mk({ pool: ['toast'] });
    g.setAim(PLATE_X); g.release();
    const placed = run(g, 4000).find((e) => e.type === 'placed');
    expect(placed && placed.type === 'placed' && placed.quality).toBe('perfect');
  });
  it('가운데에서 어긋나게(기울기 없이) 놓으면 안정', () => {
    const g = mk({ pool: ['toast'] });
    g.setAim(PLATE_X + 14); g.release();
    const placed = run(g, 4000).find((e) => e.type === 'placed');
    expect(placed && placed.type === 'placed' && placed.quality).toBe('stable');
  });
  it('접시 밖으로 떨어지면 fall + placed(fell), 조각은 제거되고 낙하 수 증가', () => {
    const g = mk({ plateW: 60, pool: ['toast'] });
    g.setAim(PLATE_X + 70); g.release();
    const ev = run(g, 4000);
    expect(types(ev)).toContain('fall');
    const placed = ev.find((e) => e.type === 'placed');
    expect(placed && placed.type === 'placed' && placed.quality).toBe('fell');
    expect(g.falls).toBe(1);
    expect(g.world.pieces.size).toBe(0);
    expect(g.phase).toBe('aim');
  });
  it('이미 쌓인 탑을 무너뜨리면 여러 조각이 한꺼번에 떨어진 것으로 집계', () => {
    const g = mk({ plateW: 50, pool: ['toast'], maxFalls: 99, budget: 20 });
    for (let i = 0; i < 4; i++) { g.setAim(PLATE_X); g.release(); run(g, 4000); }
    expect(g.falls).toBe(0);
    g.setAim(PLATE_X + 40); g.release(); // 가장자리에 걸쳐 놓아 균형 붕괴 유도
    run(g, 5000);
    expect(g.falls).toBeGreaterThanOrEqual(1);
  });
});

describe('TowerGame — 종료 조건', () => {
  it('떨어뜨린 수가 maxFalls 에 닿으면 즉시 실패(reason=falls)', () => {
    const g = mk({ plateW: 50, pool: ['toast'], maxFalls: 2, budget: 10 });
    const all: TowerEvent[] = [];
    for (let i = 0; i < 4 && !g.over; i++) { g.setAim(PLATE_X + 80); g.release(); all.push(...run(g, 4000)); }
    expect(g.phase).toBe('lost');
    const lost = all.find((e) => e.type === 'lost');
    expect(lost && lost.type === 'lost' && lost.reason).toBe('falls');
    expect(g.step(16)).toEqual([]); // 끝난 뒤에는 아무 일도 없음
  });
  it('조각을 다 쓰고도 목표에 못 닿으면 실패(reason=pieces)', () => {
    const g = mk({ pool: ['macaron'], budget: 2, goalH: 200 });
    for (let i = 0; i < 2; i++) { g.setAim(PLATE_X); g.release(); run(g, 4000); }
    expect(g.phase).toBe('lost');
    expect(g.piecesLeft).toBe(0);
    expect(g.release()).toBe(false);
  });
  it('목표 높이 도달 → 버티기(hold) → 정확히 holdMs 이상 버틴 뒤에만 성공', () => {
    const g = mk({ pool: ['toast'], goalH: 12, holdMs: 1200 });
    g.setAim(PLATE_X); g.release();
    let t = 0, holdAt = -1, wonAt = -1;
    const ev: TowerEvent[] = [];
    while (!g.over && t < 8000) {
      ev.push(...g.step(1000 / 60)); t += 1000 / 60;
      if (g.phase === 'hold' && holdAt < 0) holdAt = t;
      if (g.phase === 'won' && wonAt < 0) wonAt = t;
    }
    expect(holdAt).toBeGreaterThan(0);
    expect(g.phase).toBe('won');
    expect(types(ev)).toContain('won');
    expect(wonAt - holdAt).toBeGreaterThanOrEqual(1200 - 40);
    expect(g.height).toBeGreaterThanOrEqual(12);
  });
  it('버티는 중에는 새 조각을 놓을 수 없음(조준 불가)', () => {
    const g = mk({ pool: ['toast'], goalH: 12, holdMs: 1200 });
    g.setAim(PLATE_X); g.release();
    let t = 0; while (g.phase !== 'hold' && t < 6000) { g.step(1000 / 60); t += 1000 / 60; }
    expect(g.phase).toBe('hold');
    expect(g.release()).toBe(false);
    expect(g.rotate()).toBe(false);
  });
});

describe('TowerGame — 레벨 규칙·결정성', () => {
  it('정확한 봇은 L1~L3 를 클리어', () => {
    for (const lvl of [1, 2, 3]) {
      const g = createGame(lvl, 11 + lvl);
      const r = play(g, lcg(5), { smart: true });
      expect(r.phase, `L${lvl}`).toBe('won');
      expect(r.falls).toBe(0);
      expect(r.events).toContain('won');
    }
  });
  it('같은 시드·같은 입력 → 같은 결과(조각 위치까지)', () => {
    const once = () => { const g = createGame(4, 21); play(g, lcg(3), { smart: true, jitter: 3 }); return g.pieces().map((p) => `${p.kind}:${p.body.position.x.toFixed(4)},${p.body.position.y.toFixed(4)}`).join('|') + g.phase + g.falls; };
    expect(once()).toBe(once());
  });
  it('바람은 L8+ 에서 불고, 떨어지는 조각만 날림(같은 조건에서 바람 없을 때와 착지 위치가 다름)', () => {
    const land = (wind: number) => {
      const g = mk({ ...difficulty(8), wind, pool: ['toast'], randomAngle: false }, 8, 5);
      let t = 0; while (Math.abs(g.windNow) < 0.5 && t < 20000) { g.step(1000 / 60); t += 1000 / 60; } // 돌풍이 가장 센 때까지
      // 같은 순간의 상태를 비교하기 위해 바람 유무 각각 새로 만들어 동일 시각에 놓음
      const h = mk({ ...difficulty(8), wind, pool: ['toast'], randomAngle: false }, 8, 5);
      for (let s = 0; s < t / (1000 / 60); s++) h.step(1000 / 60);
      h.setAim(PLATE_X); h.release(); run(h, 1500);
      return { x: [...h.world.pieces.values()][0]?.body.position.x ?? NaN, wind: h.windNow };
    };
    const a = land(difficulty(8).wind), b = land(0);
    expect(Math.abs(a.wind)).toBeGreaterThan(0.3);
    expect(b.wind).toBe(0);
    expect(Math.abs(a.x - b.x)).toBeGreaterThan(1);
  });
  it('supportX: 조각이 없으면 접시 가운데, 있으면 가장 높은 조각의 x', () => {
    const g = mk({ pool: ['toast'] });
    expect(supportX(g)).toBe(PLATE_X);
    g.setAim(PLATE_X + 10); g.release(); run(g, 4000);
    expect(supportX(g)).toBeGreaterThan(PLATE_X + 5);
  });
});
