/** 테스트·난이도 측정용 헤드리스 봇(앱 코드에서는 쓰지 않음). 실제 물리로 끝까지 플레이. */
import type { TowerGame } from './game';
import { PLATE_X } from './physics';
import { WIND_TO_DRIFT } from './logic';

export interface BotOpts {
  /** 조준 흔들림(±월드 단위) */
  jitter?: number;
  /** 평평한 면이 아래로 가게 돌리고 바람을 미리 보정 */
  smart?: boolean;
  /** 위험한 모양(쐐기·콘·도넛)이면 다음 조각과 교환 */
  useSwap?: boolean;
  maxMs?: number;
}
const HAZARD = new Set(['slice', 'cone', 'donut']);

/** 바닥 지지폭이 가장 넓어지는 회전(0..3) */
export function bestRot(game: TowerGame): number {
  let best = 0, bestW = -1;
  for (let r = 0; r < 4; r++) {
    const a = (r * Math.PI) / 2, c = Math.cos(a), s = Math.sin(a);
    const ys = game.current.points.map(([x, y]) => x * s + y * c), xs = game.current.points.map(([x, y]) => x * c - y * s);
    const maxY = Math.max(...ys);
    const bottom = xs.filter((_, i) => ys[i] > maxY - 1.5);
    const w = Math.max(...bottom) - Math.min(...bottom) - (Math.max(...ys) - Math.min(...ys)) * 0.01;
    if (w > bestW) { bestW = w; best = r; }
  }
  return best;
}

/** 가장 높은 조각의 중심 x (없으면 접시 중심) */
export function supportX(game: TowerGame): number {
  let tx = PLATE_X, top = 0;
  for (const p of game.pieces()) if (p.body.bounds.min.y < top && p.body.position.y < 40) { top = p.body.bounds.min.y; tx = p.body.position.x; }
  return tx;
}

export const lcg = (seed: number) => () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;

export function play(game: TowerGame, rnd: () => number, o: BotOpts = {}) {
  const { jitter = 0, smart = false, useSwap = false, maxMs = 400000 } = o;
  let t = 0;
  const events: string[] = [];
  while (!game.over && t < maxMs) {
    if (game.phase === 'aim') {
      if (useSwap && HAZARD.has(game.current.kind) && game.next[0] && !HAZARD.has(game.next[0])) game.swap();
      if (smart) { const want = bestRot(game); for (let i = 0; i < 4 && game.rot !== want; i++) game.rotate(); }
      else if (game.box.w < game.box.h && game.current.w !== game.current.h) game.rotate();
      const comp = smart ? -game.windNow * game.params.wind * WIND_TO_DRIFT : 0;
      game.setAim(supportX(game) + comp + (rnd() - 0.5) * 2 * jitter);
      game.release();
    }
    for (const e of game.step(1000 / 60)) events.push(e.type);
    t += 1000 / 60;
  }
  return { phase: game.phase, placed: game.placed, falls: game.falls, left: game.piecesLeft, height: game.height, ms: t, events };
}
