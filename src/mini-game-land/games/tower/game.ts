/**
 * TowerGame — 한 라운드의 진행 상태기계(React·DOM 무관, 헤드리스 테스트 가능).
 *
 *  aim(조각을 옮기는 중) ─release→ drop(낙하) ─닿음→ settle(흔들림 가라앉기) ─평가→ aim | hold(목표 도달, 버티기) → won
 *                                                                                    └→ lost (떨어뜨린 수 초과 · 조각 소진)
 */
import { mixSeed, mulberry32, type Rng } from '../../core/rng';
import { classify, difficulty, tiltOf, type Placement, type Quality, type TowerParams } from './logic';
import { PIECES, type PieceDef, type PieceKind } from './pieces';
import { FALL_Y, PLATE_X, STEP_MS, TowerWorld, WORLD_W, type Piece } from './physics';

export type Phase = 'aim' | 'drop' | 'settle' | 'hold' | 'won' | 'lost';

export type TowerEvent =
  | { type: 'drop'; id: number }
  | { type: 'landed'; id: number; impact: number }
  | { type: 'placed'; id: number; quality: Quality; placement: Placement }
  | { type: 'fall'; count: number; total: number }
  | { type: 'won' }
  | { type: 'lost'; reason: 'falls' | 'pieces' };

export const HOVER_GAP = 60;
const SETTLE_CALM_MS = 300;
const SETTLE_MAX_MS = 2600;
const DROP_MAX_MS = 3000;

export class TowerGame {
  readonly world: TowerWorld;
  phase: Phase = 'aim';
  aimX = PLATE_X;
  /** 0..3 (×90°) */
  rot = 0;
  current: PieceDef;
  /** 남은 조각(현재 조각 포함) */
  piecesLeft: number;
  placed = 0;
  falls = 0;
  /** 남은 조각 교환 횟수 */
  swaps: number;
  readonly queue: PieceKind[] = [];
  private rng: Rng;
  private activeId = 0;
  /** 지금 떨어지는(또는 방금 놓은) 조각 id — 화면 계산용 */
  get activeIdPublic(): number { return this.activeId; }
  private acc = 0;
  private phaseMs = 0;
  private calmMs = 0;
  private holdMs = 0;
  private snapshot = new Map<number, { x: number; y: number }>();
  /** 마지막 바람 세기(-1..1), 표시용 */
  windNow = 0;
  private timeMs = 0;
  private events: TowerEvent[] = [];

  constructor(readonly params: TowerParams, seed: number) {
    this.rng = mulberry32(mixSeed(seed, 0x7077e4));
    this.world = new TowerWorld({ plateW: params.plateW, frictionMul: params.frictionMul });
    this.world.onLanded((p, impact) => {
      if (p.id === this.activeId) this.events.push({ type: 'landed', id: p.id, impact });
    });
    this.piecesLeft = params.budget;
    this.swaps = params.swaps;
    for (let i = 0; i < params.preview + 1; i++) this.queue.push(this.randomKind());
    this.current = PIECES[this.queue.shift()!];
    this.queue.push(this.randomKind());
    this.rot = params.randomAngle ? this.randomRot() : 0;
  }

  private randomKind(): PieceKind {
    const { pool, weights } = this.params;
    const w = pool.map((k) => weights[k] ?? 1);
    let r = this.rng() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r < 0) return pool[i]; }
    return pool[pool.length - 1];
  }
  private randomRot(): number { return Math.floor(this.rng() * 4); }

  /** 미리 보기(다음 조각들) */
  get next(): PieceKind[] { return this.queue.slice(0, this.params.preview); }
  get angle(): number { return this.rot * (Math.PI / 2); }

  /** 회전 후 경계 상자 */
  get box(): { w: number; h: number } {
    const odd = this.rot % 2 === 1;
    return { w: odd ? this.current.h : this.current.w, h: odd ? this.current.w : this.current.h };
  }
  /** 조각 중심의 낙하 시작 높이 */
  get hoverY(): number { return this.world.topY() - HOVER_GAP - this.box.h / 2; }
  get height(): number { return this.world.height(this.activeId || undefined); }
  get canAim(): boolean { return this.phase === 'aim'; }
  get over(): boolean { return this.phase === 'won' || this.phase === 'lost'; }

  clampAim(x: number): number {
    const half = this.box.w / 2 + 2;
    return Math.min(WORLD_W - half, Math.max(half, x));
  }
  setAim(x: number) { if (this.canAim) this.aimX = this.clampAim(x); }
  moveAim(dx: number) { this.setAim(this.aimX + dx); }
  rotate(): boolean {
    if (!this.canAim) return false;
    this.rot = (this.rot + 1) % 4;
    this.aimX = this.clampAim(this.aimX);
    return true;
  }

  /** 현재 조각을 다음 조각과 맞바꿈(횟수 제한) — 까다로운 조각·바람 대응용 */
  swap(): boolean {
    if (!this.canAim || this.swaps <= 0 || this.queue.length === 0) return false;
    const incoming = PIECES[this.queue[0]];
    this.queue[0] = this.current.kind;
    this.current = incoming;
    this.swaps--;
    this.aimX = this.clampAim(this.aimX);
    return true;
  }

  /** 손을 떼면 낙하 */
  release(): boolean {
    if (!this.canAim || this.piecesLeft <= 0) return false;
    this.snapshot = new Map([...this.world.pieces.values()].map((p) => [p.id, { x: p.body.position.x, y: p.body.position.y }]));
    const piece = this.world.spawn(this.current.kind, this.aimX, this.hoverY, this.angle);
    this.activeId = piece.id;
    this.world.windTarget = piece.id;
    this.piecesLeft--;
    this.phase = 'drop';
    this.phaseMs = 0;
    this.events.push({ type: 'drop', id: piece.id });
    return true;
  }

  private nextPiece() {
    this.current = PIECES[this.queue.shift()!];
    this.queue.push(this.randomKind());
    this.rot = this.params.randomAngle ? this.randomRot() : this.rot;
    this.aimX = this.clampAim(this.aimX);
    this.activeId = 0;
  }

  /** 시간 진행(ms). 고정 스텝으로 쪼개 물리를 돌리고 이벤트를 모아 돌려줌 */
  step(dtMs: number): TowerEvent[] {
    if (this.over) return [];
    this.acc += Math.min(dtMs, 100);
    let guard = 0;
    while (this.acc >= STEP_MS && guard++ < 6) {
      this.acc -= STEP_MS;
      this.tick();
      if (this.over) break;
    }
    const out = this.events;
    this.events = [];
    return out;
  }

  private tick() {
    this.timeMs += STEP_MS;
    const p = this.params;
    if (p.wind) {
      const swing = Math.sin((this.timeMs / p.windPeriodMs) * Math.PI * 2);
      const gust = Math.max(0, Math.abs(swing) - 0.3) / 0.7; // 간헐적으로 부는 돌풍
      this.windNow = Math.sign(swing) * gust;
      this.world.wind = this.windNow * p.wind;
    }
    this.world.step();
    this.phaseMs += STEP_MS;

    if (this.phase === 'drop') {
      const piece = this.world.pieces.get(this.activeId);
      if (!piece || piece.landed || this.phaseMs > DROP_MAX_MS || piece.body.position.y > FALL_Y) { this.phase = 'settle'; this.phaseMs = 0; this.calmMs = 0; this.world.windTarget = 0; }
    } else if (this.phase === 'settle') {
      this.calmMs = this.world.isCalm() ? this.calmMs + STEP_MS : 0;
      if (this.calmMs >= SETTLE_CALM_MS || this.phaseMs >= SETTLE_MAX_MS) this.evaluate();
    } else if (this.phase === 'hold') {
      this.holdMs = this.world.isCalm() ? this.holdMs + STEP_MS : 0;
      this.checkFallen();
      if (this.world.height() < p.goalH * 0.97) { this.phase = 'aim'; this.holdMs = 0; this.nextIfNeeded(); }
      else if (this.holdMs >= p.holdMs) { this.phase = 'won'; this.events.push({ type: 'won' }); }
    }
    if (this.phase === 'hold' || this.phase === 'aim') this.checkFallen();
  }

  private nextIfNeeded() { if (this.activeId !== 0) this.nextPiece(); }

  /** 떨어진 조각 정리·집계. 새로 떨어진 개수 반환 */
  private checkFallen(): number {
    const gone = this.world.fallen();
    for (const f of gone) this.world.remove(f.id);
    if (gone.length) {
      this.falls += gone.length;
      this.events.push({ type: 'fall', count: gone.length, total: this.falls });
      if (this.falls >= this.params.maxFalls && this.phase !== 'won') { this.phase = 'lost'; this.events.push({ type: 'lost', reason: 'falls' }); }
    }
    return gone.length;
  }

  private evaluate() {
    const active = this.world.pieces.get(this.activeId);
    const fallsBefore = this.falls;
    this.checkFallen();
    if (this.phase === 'lost') return;
    const fellNow = this.falls > fallsBefore;
    // 다른 조각이 얼마나 움직였나
    let shake = 0;
    for (const [id, was] of this.snapshot) {
      const pc = this.world.pieces.get(id);
      if (pc) shake = Math.max(shake, Math.hypot(pc.body.position.x - was.x, pc.body.position.y - was.y));
    }
    let offset = 0, tilt = 0;
    if (active) {
      const b = active.body.bounds;
      const below = this.world.surfaceBelow(b.min.x, b.max.x, b.max.y - 2, active.id);
      offset = Math.abs(active.body.position.x - below.centerX);
      tilt = tiltOf(active.body.angle);
    }
    const placement: Placement = { fell: fellNow, shake, offset, tilt };
    const quality = classify(placement);
    this.placed += active ? 1 : 0;
    this.events.push({ type: 'placed', id: this.activeId, quality, placement });
    this.nextPiece();
    if (this.world.height() >= this.params.goalH) { this.phase = 'hold'; this.holdMs = 0; }
    else if (this.piecesLeft <= 0) { this.phase = 'lost'; this.events.push({ type: 'lost', reason: 'pieces' }); }
    else this.phase = 'aim';
  }

  /** 접시 위 조각들의 현재 상태(렌더·테스트용) */
  pieces(): Piece[] { return [...this.world.pieces.values()]; }
}

export const createGame = (level: number, seed: number) => new TowerGame(difficulty(level), seed);
