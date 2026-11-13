/**
 * 물리 래퍼 — matter-js 를 이 파일 안에만 가둡니다(다른 코드는 matter 를 모름).
 *
 * ★ 안정화 설정은 필수입니다(spike 검증): 기본 설정은 높은 탑이 무너지고,
 *   서브스텝 3 + 반복 10/8 이면 18개가 모두 멈춰 섭니다. 바람이 없을 때는 슬립(sleeping)도 켜서 더 안정.
 */
import Matter from 'matter-js';
import { PIECES, type PieceDef, type PieceKind } from './pieces';

const { Engine, Bodies, Body, Composite, Events, Sleeping } = Matter;

export const WORLD_W = 180;
export const PLATE_X = WORLD_W / 2;
export const PLATE_H = 12;
/** 이 아래로 내려가면 '떨어짐' */
export const FALL_Y = 46;
export const STEP_MS = 1000 / 60;
export const SUBSTEPS = 3;
const BASE_DENSITY = 0.002;

export interface Piece {
  id: number;
  kind: PieceKind;
  def: PieceDef;
  body: Matter.Body;
  /** 처음 다른 물체와 닿았는지 */
  landed: boolean;
}

export interface WorldOpts {
  plateW: number;
  /** 마찰 배율(미끄러운 레벨 < 1) */
  frictionMul: number;
}

export class TowerWorld {
  readonly engine: Matter.Engine;
  readonly plate: Matter.Body;
  readonly pieces = new Map<number, Piece>();
  private nextId = 1;
  /** 바람 세기(부호 = 방향). 탑이 아니라 '떨어지는 조각'만 날림 → 슬립 유지(안정성 핵심) */
  wind = 0;
  /** 바람을 받는 조각 id (0 = 없음) */
  windTarget = 0;
  private onLand: ((p: Piece, impact: number) => void) | null = null;

  constructor(readonly opts: WorldOpts) {
    this.engine = Engine.create({ enableSleeping: true, positionIterations: 10, velocityIterations: 8, constraintIterations: 2 });
    this.engine.gravity.y = 1.1;
    this.plate = Bodies.rectangle(PLATE_X, PLATE_H / 2, opts.plateW, PLATE_H, { isStatic: true, friction: 0.9 * opts.frictionMul, frictionStatic: 1.5, slop: 0.01, label: 'plate' });
    Composite.add(this.engine.world, this.plate);
    Events.on(this.engine, 'collisionStart', (e) => {
      for (const pair of e.pairs) {
        const a = this.byBody(pair.bodyA); const b = this.byBody(pair.bodyB);
        const impact = Math.hypot(pair.bodyA.velocity.x - pair.bodyB.velocity.x, pair.bodyA.velocity.y - pair.bodyB.velocity.y);
        for (const p of [a, b]) if (p && !p.landed) { p.landed = true; this.onLand?.(p, impact); }
      }
    });
  }

  private byBody(body: Matter.Body): Piece | undefined {
    const id = (body as unknown as { pieceId?: number }).pieceId;
    return id ? this.pieces.get(id) : undefined;
  }

  onLanded(cb: (p: Piece, impact: number) => void) { this.onLand = cb; }

  spawn(kind: PieceKind, x: number, y: number, angle: number): Piece {
    const def = PIECES[kind];
    const verts = def.points.map(([px, py]) => ({ x: px, y: py }));
    const body = Bodies.fromVertices(x, y, [verts], {
      density: BASE_DENSITY * def.density, friction: def.friction * this.opts.frictionMul, frictionStatic: 1.3, restitution: 0, slop: 0.01, frictionAir: 0.004,
    });
    Body.setAngle(body, angle);
    const piece: Piece = { id: this.nextId++, kind, def, body, landed: false };
    (body as unknown as { pieceId: number }).pieceId = piece.id;
    this.pieces.set(piece.id, piece);
    Composite.add(this.engine.world, body);
    return piece;
  }

  remove(id: number) {
    const p = this.pieces.get(id);
    if (!p) return;
    Composite.remove(this.engine.world, p.body);
    this.pieces.delete(id);
  }

  /** 1/60 초 진행(서브스텝으로 안정화) */
  step() {
    for (let i = 0; i < SUBSTEPS; i++) {
      const t = this.windTarget ? this.pieces.get(this.windTarget) : undefined;
      if (this.wind && t && !t.landed) { if (t.body.isSleeping) Sleeping.set(t.body, false); Body.applyForce(t.body, t.body.position, { x: this.wind * t.body.mass, y: 0 }); }
      Engine.update(this.engine, STEP_MS / SUBSTEPS);
    }
  }

  /** 가장 높은 조각의 윗면(음수 = 위). 조각이 없으면 0 */
  topY(exclude?: number): number {
    let top = 0;
    for (const p of this.pieces.values()) if (p.id !== exclude && p.body.position.y < FALL_Y) top = Math.min(top, p.body.bounds.min.y);
    return top;
  }
  height(exclude?: number): number { return -this.topY(exclude); }

  /** 조각 전체의 무게중심 x (없으면 null) */
  comX(exclude?: number): number | null {
    let m = 0, mx = 0;
    for (const p of this.pieces.values()) if (p.id !== exclude && p.body.position.y < FALL_Y) { m += p.body.mass; mx += p.body.mass * p.body.position.x; }
    return m ? mx / m : null;
  }

  /** 그 x 범위 아래에서 가장 높은 윗면 y (없으면 판 윗면 0) — 낙하 안내선·'완벽' 판정용 */
  surfaceBelow(x0: number, x1: number, aboveY: number, exclude?: number): { y: number; centerX: number } {
    let y = 0, cx = PLATE_X;
    for (const p of this.pieces.values()) {
      if (p.id === exclude) continue;
      const b = p.body.bounds;
      if (b.max.x < x0 || b.min.x > x1 || b.min.y > aboveY + 1) continue;
      if (b.min.y < y) { y = b.min.y; cx = p.body.position.x; }
    }
    return { y, centerX: cx };
  }

  /** 모든 조각이 멈췄는지 (바닥 밖으로 떨어진 것은 제외) */
  isCalm(speedEps = 0.1, angEps = 0.006): boolean {
    for (const p of this.pieces.values()) {
      if (p.body.isSleeping) continue;
      if (p.body.position.y > FALL_Y) continue;
      if (p.body.speed > speedEps || Math.abs(p.body.angularSpeed) > angEps) return false;
    }
    return true;
  }

  fallen(): Piece[] {
    return [...this.pieces.values()].filter((p) => p.body.position.y > FALL_Y);
  }
}
