/**
 * GONA's Sky Adventure — 건버드 스타일 세로 스크롤 슈팅 엔진 (독립 모듈 · 기존 게임천국 코드와 무관)
 * 논리 해상도 180×320 (9:16) 도트 → 정수 배율로 캔버스에 그림 (image-rendering: pixelated)
 */
import { type Assets, type Sheet, type ImgName, whiteOf, sfx, startBgm, stopBgm } from './assets';

export const W = 180;
export const H = 320;
export type FamilyId = 'mom' | 'dad' | 'imo' | 'halmeoni' | 'halabeoji';

export interface EndInfo {
  won: boolean;
  score: number;
  time: number;
  maxCombo: number;
  hp: number;
}

export interface HudInfo {
  hp: number;
  paused: boolean;
}

// ───────────── 작은 도구 ─────────────
const rand = (a: number, b: number): number => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;

interface PBullet {
  x: number; y: number; vx: number; vy: number; r: number; dmg: number;
  kind: 'gona' | 'charge' | 'heart' | 'imo';
  pierce: boolean; hit: Set<Enemy>; life: number; scale: number;
}
interface EBullet {
  x: number; y: number; vx: number; vy: number; r: number; kind: 'flask' | 'smell' | 'heart' | 'wave'; age: number; spin: number;
}
type EKind = 'glasses' | 'uncle' | 'boss';
interface Enemy {
  kind: EKind; pat: string; x: number; y: number; x0: number; vx: number; vy: number;
  hp: number; max: number; age: number; flash: number; fire: number; dir: number; hr: number; score: number; dead: boolean; ph: number; burst: number;
}
interface Item { x: number; y: number; kind: 'cookie' | 'strawberry' | 'banana' | 'star'; age: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; col: string; size: number; g: number }
interface Pop { x: number; y: number; age: number; big: boolean }
interface Float { x: number; y: number; text: string; age: number; col: string }
interface Beam { follow: boolean; x: number; t: number; max: number; tick: number }

interface BossState {
  mode: 'enter' | 'idle' | 'atk' | 'dying';
  atk: string; at: number; rest: number; last: string; phase: 1 | 2 | 3; n: number; tx: number; sub: number; minion: number; dyingT: number;
}

const FAMILY_NAME: Record<FamilyId, string> = { mom: '엄마', dad: '아빠', imo: '이모', halmeoni: '할머니', halabeoji: '할아버지' };
export const FAMILY_INFO: Record<FamilyId, { name: string; skill: string; desc: string }> = {
  mom: { name: FAMILY_NAME.mom, skill: '하트 광역 공격', desc: '사방으로 퍼지는 하트 폭죽!' },
  dad: { name: FAMILY_NAME.dad, skill: '강력한 직선 공격', desc: '적 탄을 지우는 굵은 광선' },
  imo: { name: FAMILY_NAME.imo, skill: '유도 마법탄', desc: '적을 쫓아가는 마법 구슬' },
  halmeoni: { name: FAMILY_NAME.halmeoni, skill: '체력 회복', desc: '주기적으로 하트 1칸 회복' },
  halabeoji: { name: FAMILY_NAME.halabeoji, skill: '보호막', desc: '탄 1발을 막아 주는 방패' },
};

const MAX_HP = 5;
const BOSS_WARN_T = 54;
const BOSS_T = 57.5;

type Spawn = { t: number; fn: () => void };

export class SkyEngine {
  private g: CanvasRenderingContext2D;
  private S = 2;
  private raf = 0;
  private last = 0;
  private alive = true;
  paused = false;
  private over = false;
  private endT = 0;

  private t = 0;
  private scroll = 0;
  private shake = 0;
  private flashWhite = 0;
  private banner: { text: string; sub?: string; t: number; col: string } | null = null;

  // 플레이어
  private px = W / 2;
  private py = H - 90;
  private pvx = 0;
  private hp = MAX_HP;
  private inv = 0;
  private hurtT = 0;
  private atkT = 0;
  private bombs = 3;
  private bombT = 0;
  private bombHit = false;
  private power = 1;
  private fireT = 0;
  private charge = 0;
  private charging = false;
  private score = 0;
  private combo = 0;
  private comboT = 0;
  private maxCombo = 0;
  private shield = 0;

  // 동료
  private cx = W / 2 + 24;
  private cy = H - 80;
  private cCd = 1.5;
  private cN = 0;
  private cKick = 0;

  private pb: PBullet[] = [];
  private eb: EBullet[] = [];
  private en: Enemy[] = [];
  private items: Item[] = [];
  private parts: Particle[] = [];
  private pops: Pop[] = [];
  private floats: Float[] = [];
  private beams: Beam[] = [];
  private clouds: { x: number; y: number; v: number; i: number }[] = [];
  private boss: Enemy | null = null;
  private bs: BossState | null = null;
  private bossSpawned = false;
  private warned = false;
  private bossHitSfx = 0;
  private timeline: Spawn[] = [];
  private tlIdx = 0;

  // 입력
  private dragId: number | null = null;
  private dragX = 0;
  private dragY = 0;
  private dragPx = 0;
  private dragPy = 0;
  private keys = new Set<string>();

  constructor(
    private canvas: HTMLCanvasElement,
    private a: Assets,
    private fam: FamilyId,
    private onEnd: (r: EndInfo) => void,
    private onHud: (h: HudInfo) => void,
  ) {
    this.g = canvas.getContext('2d')!;
    this.resize();
    for (let i = 0; i < 6; i++) this.clouds.push({ x: rand(0, W), y: rand(-40, H), v: rand(14, 30), i: i % 3 });
    this.buildTimeline();
    this.cCd = fam === 'halmeoni' ? 5 : fam === 'halabeoji' ? 1 : 1.2;
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onUp);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKeyUp);
    this.banner = { text: 'STAGE 1', sub: '구름 위 장난꾸러기들', t: 2.6, col: '#fff7dc' };
    sfx('start');
    startBgm();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  // ───────────── 외부 제어 ─────────────
  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.S = Math.max(1, Math.floor((rect.width * dpr) / W));
    this.canvas.width = W * this.S;
    this.canvas.height = H * this.S;
  }
  destroy(): void {
    this.alive = false;
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('pointercancel', this.onUp);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKeyUp);
    stopBgm();
  }
  setPaused(p: boolean): void {
    this.paused = p;
    this.charging = false;
    this.onHud({ hp: this.hp, paused: p });
  }
  holdCharge(down: boolean): void {
    if (this.paused || this.over) return;
    this.setCharging(down);
  }
  useBomb(): void {
    if (this.paused || this.over || this.bombs <= 0 || this.bombT > 0) return;
    this.bombs--;
    this.bombT = 1.7;
    this.bombHit = false;
    this.inv = Math.max(this.inv, 2.4);
    this.flashWhite = 0.5;
    this.shake = 0.6;
    sfx('special');
    this.banner = { text: 'FAMILY BOMB!', t: 1.0, col: '#ffd0e0' };
    // 별 폭죽
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * TAU;
      this.parts.push({ x: this.px, y: this.py, vx: Math.cos(a) * rand(80, 170), vy: Math.sin(a) * rand(80, 170), life: 1.1, max: 1.1, col: i % 2 ? '#ffe34a' : '#ff9ec0', size: 3, g: 0 });
    }
  }
  /** 디버그·테스트용 상태 (자동 검수 스크립트에서 사용) */
  debug(): Record<string, number | string> {
    return { t: +this.t.toFixed(1), hp: this.hp, score: this.score, enemies: this.en.length, ebullets: this.eb.length, pbullets: this.pb.length, boss: this.boss ? this.boss.hp : -1, power: this.power, over: this.over ? 1 : 0, px: Math.round(this.px), py: Math.round(this.py) };
  }
  cheat(cmd: string): void {
    if (cmd === 'boss') this.t = Math.max(this.t, BOSS_WARN_T - 0.2);
    if (cmd === 'power') this.power = 4;
    if (cmd === 'god') this.hp = 99;
    if (cmd === 'hp1') this.hp = 1;
    if (cmd === 'killboss' && this.boss) this.boss.hp = 1;
  }

  // ───────────── 입력 ─────────────
  private onDown = (e: PointerEvent): void => {
    if (this.paused || this.over) return;
    if (this.dragId !== null) return;
    this.dragId = e.pointerId;
    this.canvas.setPointerCapture?.(e.pointerId);
    this.dragX = e.clientX;
    this.dragY = e.clientY;
    this.dragPx = this.px;
    this.dragPy = this.py;
    e.preventDefault();
  };
  private onMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.dragId) return;
    const rect = this.canvas.getBoundingClientRect();
    const k = (W / rect.width) * 1.45; // 손가락보다 살짝 더 멀리 움직이는 감도
    this.targetX = this.dragPx + (e.clientX - this.dragX) * k;
    this.targetY = this.dragPy + (e.clientY - this.dragY) * k;
    this.hasTarget = true;
  };
  private onUp = (e: PointerEvent): void => {
    if (e.pointerId === this.dragId) {
      this.dragId = null;
      this.hasTarget = false;
    }
  };
  private targetX = 0;
  private targetY = 0;
  private hasTarget = false;
  private onKey = (e: KeyboardEvent): void => {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'z', 'x'].includes(k)) e.preventDefault();
    if (e.repeat) return;
    this.keys.add(k);
    if (k === 'x') this.useBomb();
    if (k === ' ' || k === 'z') this.setCharging(true);
    if (k === 'p' || k === 'escape') this.setPaused(!this.paused);
  };
  private onKeyUp = (e: KeyboardEvent): void => {
    const k = e.key.toLowerCase();
    this.keys.delete(k);
    if (k === ' ' || k === 'z') this.setCharging(false);
  };
  private setCharging(on: boolean): void {
    if (on === this.charging) return;
    this.charging = on;
    if (!on) this.releaseCharge();
  }

  // ───────────── 스테이지 타임라인 ─────────────
  private buildTimeline(): void {
    const at = (t: number, fn: () => void): void => void this.timeline.push({ t, fn });
    const row = (t: number, n: number, pat: string, kind: EKind = 'glasses', gap = 0.35, x0 = 30, x1 = 150, dir = 1): void => {
      for (let i = 0; i < n; i++) at(t + i * gap, () => this.spawn(kind, n === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / (n - 1), -14, pat, dir, i));
    };
    row(1.5, 5, 'sine', 'glasses', 0.3);
    row(6, 4, 'strafe', 'glasses', 0.6, 0, 0, 1);
    row(10, 4, 'strafe', 'glasses', 0.6, 0, 0, -1);
    at(14, () => this.spawn('uncle', 90, -20, 'uncle', 1, 0));
    for (let i = 0; i < 6; i++) at(18 + i * 0.5, () => this.spawn('glasses', i % 2 ? 150 : 30, -14, 'dive', 1, i));
    at(24, () => this.spawn('uncle', 48, -20, 'uncle', 1, 0));
    at(24.8, () => this.spawn('uncle', 132, -20, 'uncle', -1, 1));
    row(29, 7, 'sine', 'glasses', 0.28, 20, 160);
    row(33, 6, 'swarm', 'glasses', 0.3, 20, 160);
    at(38, () => this.spawn('uncle', 90, -20, 'uncle', 1, 0));
    for (let i = 0; i < 5; i++) at(39 + i * 0.5, () => this.spawn('glasses', 20 + i * 35, -14, 'dive', 1, i));
    row(44, 5, 'strafe', 'glasses', 0.5, 0, 0, 1);
    row(44.2, 5, 'strafe', 'glasses', 0.5, 0, 0, -1);
    row(49, 9, 'swarm', 'glasses', 0.22, 15, 165);
    this.timeline.sort((p, q) => p.t - q.t);
  }

  private spawn(kind: EKind, x: number, y: number, pat: string, dir: number, idx: number): void {
    const glasses = kind === 'glasses';
    let sx = x;
    let sy = y;
    if (pat === 'strafe') {
      sx = dir > 0 ? -14 : W + 14;
      sy = 34 + idx * 16;
    }
    this.en.push({
      kind, pat, x: sx, y: sy, x0: x, vx: 0, vy: 0, hp: glasses ? 3 : 18, max: glasses ? 3 : 18, age: 0, flash: 0, fire: rand(0.8, 2.2), dir,
      hr: glasses ? 8 : 10, score: glasses ? 100 : 500, dead: false, ph: idx * 0.7, burst: 0,
    });
  }

  // ───────────── 메인 루프 ─────────────
  private loop = (now: number): void => {
    if (!this.alive) return;
    const dt = Math.min(0.033, (now - this.last) / 1000);
    this.last = now;
    if (!this.paused) this.update(dt);
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  };

  private update(dt: number): void {
    this.t += dt;
    this.scroll = (this.scroll + dt * 38) % H;
    this.shake = Math.max(0, this.shake - dt * 1.6);
    this.flashWhite = Math.max(0, this.flashWhite - dt * 1.8);
    if (this.banner && (this.banner.t -= dt) <= 0) this.banner = null;
    for (const c of this.clouds) {
      c.y += c.v * dt;
      if (c.y > H + 20) {
        c.y = -30;
        c.x = rand(-10, W - 20);
        c.i = Math.floor(rand(0, 3));
      }
    }

    if (this.over) {
      this.endT += dt;
      this.updateFx(dt);
      this.updateEnemies(dt);
      return;
    }

    // 타임라인
    while (this.tlIdx < this.timeline.length && this.timeline[this.tlIdx].t <= this.t) this.timeline[this.tlIdx++].fn();
    if (!this.warned && this.t >= BOSS_WARN_T) {
      this.warned = true;
      sfx('warn');
      this.banner = { text: 'WARNING!', sub: '뽀뽀괴물이 다가온다!', t: 3.2, col: '#ff7a8a' };
    }
    if (!this.bossSpawned && this.t >= BOSS_T) this.spawnBoss();

    this.updatePlayer(dt);
    this.updateWeapons(dt);
    this.updateCompanion(dt);
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updateItems(dt);
    this.updateFx(dt);
    this.collide(dt);

    this.comboT -= dt;
    if (this.comboT <= 0) this.combo = 0;
    if (this.inv > 0) this.inv -= dt;
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.atkT > 0) this.atkT -= dt;
    if (this.bombT > 0) this.updateBomb(dt);
  }

  // ───────────── 플레이어 ─────────────
  private updatePlayer(dt: number): void {
    const prev = this.px;
    const slow = this.charging ? 0.6 : 1;
    if (this.hasTarget) {
      const k = Math.min(1, dt * 22);
      this.px += (this.targetX - this.px) * k;
      this.py += (this.targetY - this.py) * k;
    }
    const kx = (this.keys.has('arrowright') || this.keys.has('d') ? 1 : 0) - (this.keys.has('arrowleft') || this.keys.has('a') ? 1 : 0);
    const ky = (this.keys.has('arrowdown') || this.keys.has('s') ? 1 : 0) - (this.keys.has('arrowup') || this.keys.has('w') ? 1 : 0);
    if (kx || ky) {
      this.px += kx * 120 * slow * dt;
      this.py += ky * 120 * slow * dt;
      this.targetX = this.px;
      this.targetY = this.py;
    }
    this.px = clamp(this.px, 14, W - 14);
    this.py = clamp(this.py, 40, H - 66);
    if (this.hasTarget) {
      this.targetX = clamp(this.targetX, 14, W - 14);
      this.targetY = clamp(this.targetY, 40, H - 66);
    }
    const v = (this.px - prev) / Math.max(dt, 0.001);
    this.pvx += (v - this.pvx) * Math.min(1, dt * 10);
    if (this.charging) this.charge = Math.min(1.2, this.charge + dt);
  }

  private updateWeapons(dt: number): void {
    if (this.charging || this.bombT > 0.9) return;
    this.fireT -= dt;
    if (this.fireT > 0) return;
    this.fireT = 0.105;
    this.atkT = 0.09;
    const p = this.power;
    const add = (dx: number, vx: number, dmg: number): void => {
      this.pb.push({ x: this.px + dx, y: this.py - 14, vx, vy: -300, r: 3, dmg, kind: 'gona', pierce: false, hit: new Set(), life: 1.2, scale: 1 });
    };
    if (p === 1) add(0, 0, 1.2);
    else if (p === 2) { add(-4, 0, 1.1); add(4, 0, 1.1); }
    else if (p === 3) { add(0, 0, 1.3); add(-6, -26, 1); add(6, 26, 1); }
    else { add(-3, 0, 1.2); add(3, 0, 1.2); add(-8, -42, 1); add(8, 42, 1); add(-12, -90, 0.9); add(12, 90, 0.9); }
  }

  private releaseCharge(): void {
    const c = this.charge;
    this.charge = 0;
    if (c < 0.35 || this.over || this.paused) return;
    const f = Math.min(1, c / 1.0);
    this.pb.push({ x: this.px, y: this.py - 20, vx: 0, vy: -230, r: 6 + f * 8, dmg: 10 + f * 26, kind: 'charge', pierce: true, hit: new Set(), life: 1.8, scale: 1 + f * 1.4 });
    this.atkT = 0.3;
    this.shake = Math.max(this.shake, 0.2 + f * 0.2);
    sfx('throw', 0.8);
    for (let i = 0; i < 10; i++) this.parts.push({ x: this.px, y: this.py - 18, vx: rand(-60, 60), vy: rand(-80, -20), life: 0.4, max: 0.4, col: '#fff8d0', size: 2, g: 0 });
  }

  private hurtPlayer(): void {
    if (this.inv > 0 || this.bombT > 0 || this.over) return;
    if (this.shield > 0) {
      this.shield = 0;
      this.inv = 0.9;
      this.cCd = 8;
      sfx('shield');
      this.floatText(this.px, this.py - 24, 'BLOCK!', '#cdefff');
      return;
    }
    this.hp--;
    this.inv = 1.8;
    this.hurtT = 0.6;
    this.shake = 0.5;
    this.combo = 0;
    this.power = Math.max(1, this.power - 1);
    sfx('hit', 0.8);
    this.onHud({ hp: this.hp, paused: this.paused });
    for (let i = 0; i < 16; i++) this.parts.push({ x: this.px, y: this.py, vx: rand(-90, 90), vy: rand(-90, 90), life: 0.6, max: 0.6, col: i % 2 ? '#fff' : '#ff6f9f', size: 2, g: 80 });
    // 근처 탄 정리 (연속 피격 방지)
    this.eb = this.eb.filter((b) => (b.x - this.px) ** 2 + (b.y - this.py) ** 2 > 45 * 45);
    if (this.hp <= 0) this.finish(false);
  }

  private updateBomb(dt: number): void {
    this.bombT -= dt;
    const prog = 1 - this.bombT / 1.7;
    // 적 탄 소거
    for (const b of this.eb) {
      if (Math.hypot(b.x - this.px, b.y - this.py) < prog * 420) this.starFrom(b.x, b.y);
    }
    this.eb = this.eb.filter((b) => Math.hypot(b.x - this.px, b.y - this.py) >= prog * 420);
    if (!this.bombHit && prog > 0.2) {
      this.bombHit = true;
      for (const e of this.en) this.damage(e, e.kind === 'boss' ? 22 : 12, true);
    }
    // 하트·별 소나기 연출
    if (Math.random() < 0.8) this.parts.push({ x: rand(0, W), y: -4, vx: rand(-10, 10), vy: rand(120, 220), life: 1.4, max: 1.4, col: Math.random() < 0.5 ? '#ff9ec0' : '#ffe34a', size: 3, g: 0 });
  }

  // ───────────── 동료 ─────────────
  private updateCompanion(dt: number): void {
    const side = this.px > W - 56 ? -1 : 1;
    const tx = this.px + side * 38;
    const ty = this.py + 10 + Math.sin(this.t * 3) * 2;
    this.cx += (tx - this.cx) * Math.min(1, dt * 7);
    this.cy += (ty - this.cy) * Math.min(1, dt * 7);
    this.cKick = Math.max(0, this.cKick - dt * 4);
    if (this.bombT > 0.9) return;
    this.cCd -= dt;
    const f = this.fam;
    if (f === 'halabeoji') {
      if (this.shield > 0) this.shield -= dt;
      if (this.shield <= 0 && this.cCd <= 0) {
        this.shield = 6;
        this.cCd = 99;
        this.cKick = 1;
        sfx('shield');
        this.floatText(this.cx, this.cy - 30, 'SHIELD', '#cdefff');
      }
      if (this.shield <= 0 && this.cCd > 50) this.cCd = 7; // 방패가 끝났거나 깨졌으면 재충전
      return;
    }
    if (this.cCd > 0) return;
    this.cKick = 1;
    if (f === 'mom') {
      this.cN++;
      const n = this.cN % 3 === 0 ? 20 : 11;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + this.t;
        this.pb.push({ x: this.cx, y: this.cy - 10, vx: Math.cos(a) * 100, vy: Math.sin(a) * 100, r: 4, dmg: 2.4, kind: 'heart', pierce: true, hit: new Set(), life: 1.25, scale: 1 });
      }
      sfx('puff', 0.5);
      this.cCd = 1.45;
    } else if (f === 'dad') {
      this.beams.push({ follow: true, x: this.cx, t: 0.6, max: 0.6, tick: 0 });
      sfx('special', 0.45);
      this.shake = Math.max(this.shake, 0.25);
      this.cCd = 2.5;
    } else if (f === 'imo') {
      this.cN++;
      for (const s of [-1, 1]) {
        const a = -Math.PI / 2 + s * 0.7;
        this.pb.push({ x: this.cx, y: this.cy - 14, vx: Math.cos(a) * 130, vy: Math.sin(a) * 130, r: 3.5, dmg: 1.7, kind: 'imo', pierce: false, hit: new Set(), life: 2.4, scale: 1 });
      }
      this.cCd = 0.5;
    } else if (f === 'halmeoni') {
      if (this.hp < MAX_HP) {
        this.hp++;
        this.onHud({ hp: this.hp, paused: this.paused });
        sfx('pickup10');
        this.floatText(this.px, this.py - 26, 'HP +1', '#ff9ec0');
        for (let i = 0; i < 14; i++) this.parts.push({ x: this.px + rand(-12, 12), y: this.py + rand(-10, 14), vx: rand(-10, 10), vy: rand(-50, -20), life: 0.9, max: 0.9, col: '#ff9ec0', size: 2, g: 0 });
        this.cCd = 8.5;
      } else this.cCd = 1.5; // 가득 차 있으면 곧 다시 확인
    }
  }

  // ───────────── 적 ─────────────
  private spawnBoss(): void {
    this.bossSpawned = true;
    const e: Enemy = { kind: 'boss', pat: 'boss', x: W / 2, y: -40, x0: W / 2, vx: 0, vy: 0, hp: 420, max: 420, age: 0, flash: 0, fire: 0, dir: 1, hr: 20, score: 5000, dead: false, ph: 0, burst: 0 };
    this.en.push(e);
    this.boss = e;
    this.bs = { mode: 'enter', atk: '', at: 0, rest: 1, last: '', phase: 1, n: 0, tx: W / 2, sub: 0, minion: 5, dyingT: 0 };
  }

  private updateEnemies(dt: number): void {
    for (const e of this.en) {
      e.age += dt;
      if (e.flash > 0) e.flash -= dt;
      if (e.kind === 'boss') {
        this.updateBoss(e, dt);
        continue;
      }
      const tgt = { x: this.px, y: this.py };
      switch (e.pat) {
        case 'sine':
          e.y += 36 * dt;
          e.x = e.x0 + Math.sin(e.age * 2.1 + e.ph) * 26;
          break;
        case 'strafe':
          e.x += e.dir * 46 * dt;
          e.y += Math.sin(e.age * 2.5) * 10 * dt;
          break;
        case 'swarm':
          e.y += 74 * dt;
          e.x = e.x0 + Math.sin(e.age * 4 + e.ph) * 14;
          break;
        case 'dive': {
          if (e.age < 0.9) {
            e.y += 40 * dt;
            e.x += Math.sin(e.age * 6) * 14 * dt;
          } else {
            if (e.vy === 0) {
              const a = Math.atan2(tgt.y - e.y, tgt.x - e.x);
              e.vx = Math.cos(a) * 104;
              e.vy = Math.sin(a) * 104;
            }
            e.x += e.vx * dt;
            e.y += e.vy * dt;
          }
          break;
        }
        case 'uncle': {
          if (e.y < 62) e.y += 26 * dt;
          else {
            e.y += 3 * dt;
            e.x += Math.sin(e.age * 0.9) * 22 * dt * e.dir;
          }
          if (e.age > 16) e.y -= 60 * dt; // 오래 남으면 위로 도망
          break;
        }
        default:
          break;
      }
      // 발사
      if (e.y > 6 && e.y < H - 90 && this.bombT <= 0) {
        e.fire -= dt;
        if (e.fire <= 0) {
          if (e.kind === 'glasses' && e.pat !== 'dive' && e.pat !== 'swarm') {
            const a = Math.atan2(this.py - e.y, this.px - e.x);
            for (let i = -1; i <= 1; i++) this.eb.push({ x: e.x, y: e.y + 6, vx: Math.cos(a + i * 0.22) * 64, vy: Math.sin(a + i * 0.22) * 64, r: 3.5, kind: 'flask', age: 0, spin: 0 });
            e.fire = rand(2.0, 3.0);
          } else if (e.kind === 'uncle') {
            e.burst++;
            const n = 10;
            for (let i = 0; i < n; i++) {
              const a = (i / n) * TAU + e.burst * 0.31;
              this.eb.push({ x: e.x, y: e.y + 4, vx: Math.cos(a) * 42, vy: Math.sin(a) * 42 + 8, r: 4, kind: 'smell', age: 0, spin: 0 });
            }
            e.fire = 2.4;
          } else e.fire = 9;
        }
      }
      if (e.x < -40 || e.x > W + 40 || e.y > H + 30 || e.y < -60) e.dead = true;
    }
    this.en = this.en.filter((e) => !e.dead);
  }

  private bossSay(text: string, col = '#ff9ec0'): void {
    this.banner = { text, t: 1.3, col };
  }

  private updateBoss(e: Enemy, dt: number): void {
    const b = this.bs!;
    const frac = e.hp / e.max;
    if (b.mode === 'dying') {
      b.dyingT += dt;
      e.x += Math.sin(b.dyingT * 50) * 0.6;
      if (Math.random() < 0.35) this.pop(e.x + rand(-20, 20), e.y + rand(-20, 20), true);
      if (b.dyingT > 2.4) {
        e.dead = true;
        this.boss = null;
        this.score += 5000;
        for (let i = 0; i < 40; i++) {
          const a = (i / 40) * TAU;
          this.parts.push({ x: e.x, y: e.y, vx: Math.cos(a) * rand(60, 200), vy: Math.sin(a) * rand(60, 200), life: 1.2, max: 1.2, col: i % 3 ? '#ff9ec0' : '#fff8d0', size: 3, g: 0 });
        }
        this.flashWhite = 1;
        sfx('bossDown');
        for (let i = 0; i < 8; i++) this.items.push({ x: e.x + rand(-30, 30), y: e.y + rand(-20, 10), kind: i % 3 === 0 ? 'strawberry' : 'cookie', age: 0 });
        this.finish(true);
      }
      return;
    }
    // 단계 전환
    const phase: 1 | 2 | 3 = frac > 0.66 ? 1 : frac > 0.33 ? 2 : 3;
    if (phase !== b.phase && b.mode !== 'enter') {
      b.phase = phase;
      b.mode = 'idle';
      b.rest = 1.4;
      b.atk = '';
      for (const eb of this.eb) this.starFrom(eb.x, eb.y);
      this.eb = [];
      sfx('warn');
      this.shake = 0.6;
      this.bossSay(phase === 2 ? '뽀뽀괴물이 화났다!' : '뽀뽀괴물 폭주!!', '#ff7a8a');
    }
    const fast = b.phase === 3 ? 1.25 : 1;
    if (b.mode === 'enter') {
      e.y += (74 - e.y) * Math.min(1, dt * 1.6) + 10 * dt;
      if (e.y > 70) {
        b.mode = 'idle';
        b.rest = 1;
        this.bossSay('뽀뽀괴물 등장!', '#ff9ec0');
      }
      return;
    }
    if (b.mode === 'idle') {
      e.x = W / 2 + Math.sin(e.age * 0.9) * 50;
      e.y += (74 + Math.sin(e.age * 1.7) * 5 - e.y) * Math.min(1, dt * 4);
      b.rest -= dt;
      if (b.minion > 0) b.minion -= dt;
      if (b.phase >= 2 && b.minion <= 0) {
        b.minion = 9;
        this.spawn('glasses', 0, 0, 'strafe', 1, 3);
        this.spawn('glasses', 0, 0, 'strafe', -1, 4);
      }
      if (b.rest <= 0) {
        const pool = b.phase === 1 ? ['fan', 'spiral', 'dash'] : ['fan', 'spiral', 'dash', 'rain', 'ring'];
        const cand = pool.filter((p) => p !== b.last);
        b.atk = cand[Math.floor(Math.random() * cand.length)];
        b.last = b.atk;
        b.mode = 'atk';
        b.at = 0;
        b.n = 0;
        b.sub = 0;
        b.tx = this.px;
      }
      return;
    }
    // 공격 중
    b.at += dt * fast;
    const aim = (): number => Math.atan2(this.py - e.y, this.px - e.x);
    const done = (rest: number): void => {
      b.mode = 'idle';
      b.rest = rest / fast;
    };
    switch (b.atk) {
      case 'fan': {
        e.x += Math.sin(e.age * 1.5) * 12 * dt;
        const nShots = b.phase === 1 ? 3 : 4;
        if (b.at >= b.n * 0.5 && b.n < nShots) {
          b.n++;
          const cnt = b.phase === 1 ? 5 : 7;
          const a0 = aim();
          for (let i = 0; i < cnt; i++) {
            const a = a0 + (i - (cnt - 1) / 2) * 0.26;
            this.eb.push({ x: e.x, y: e.y + 10, vx: Math.cos(a) * 66, vy: Math.sin(a) * 66, r: 3.5, kind: 'heart', age: 0, spin: 0 });
          }
          sfx('puff', 0.4);
        }
        if (b.at > nShots * 0.5 + 0.7) done(b.phase === 1 ? 1.0 : 0.6);
        break;
      }
      case 'spiral': {
        const arms = b.phase === 1 ? 2 : b.phase === 2 ? 3 : 4;
        b.sub -= dt;
        if (b.sub <= 0) {
          b.sub = 0.09;
          for (let k = 0; k < arms; k++) {
            const a = b.at * 2.6 + (k / arms) * TAU;
            this.eb.push({ x: e.x, y: e.y + 4, vx: Math.cos(a) * 50, vy: Math.sin(a) * 50, r: 3, kind: 'wave', age: 0, spin: 0 });
          }
        }
        if (b.at > 3.4) done(1.0);
        break;
      }
      case 'dash': {
        // 0~0.9 예고(몸을 떨며 플레이어 쪽으로 정렬) → 0.9~1.45 돌진 → 복귀
        if (b.at < 0.9) {
          e.x += (b.tx - e.x) * Math.min(1, dt * 3);
          e.x += Math.sin(b.at * 60) * 0.5;
          b.tx = this.px;
        } else if (b.at < 1.5) {
          e.y += 270 * dt * (b.at < 1.3 ? 1 : 0);
          if (e.y > H - 80) e.y = H - 80;
        } else if (b.at < 2.6) {
          if (b.n === 0) {
            b.n = 1;
            this.shake = 0.5;
            for (let i = 0; i < 14; i++) {
              const a = (i / 14) * TAU;
              this.eb.push({ x: e.x, y: e.y, vx: Math.cos(a) * 58, vy: Math.sin(a) * 58 - 14, r: 3.5, kind: 'heart', age: 0, spin: 0 });
            }
          }
          e.y += (74 - e.y) * Math.min(1, dt * 2.4);
        } else {
          e.y = 74;
          done(0.8);
        }
        break;
      }
      case 'rain': {
        b.sub -= dt;
        if (b.sub <= 0) {
          b.sub = 0.16;
          this.eb.push({ x: rand(8, W - 8), y: -4, vx: rand(-6, 6), vy: rand(60, 85), r: 3.5, kind: 'heart', age: 0, spin: 0 });
          this.eb.push({ x: e.x, y: e.y + 12, vx: rand(-30, 30), vy: 52, r: 3.5, kind: 'heart', age: 0, spin: 0 });
        }
        if (b.at > 3.4) done(0.8);
        break;
      }
      case 'ring': {
        if (b.at >= b.n * 0.7 && b.n < 4) {
          const cnt = 16;
          const off = b.n * 0.2;
          for (let i = 0; i < cnt; i++) {
            const a = (i / cnt) * TAU + off;
            this.eb.push({ x: e.x, y: e.y + 6, vx: Math.cos(a) * (46 + b.n * 8), vy: Math.sin(a) * (46 + b.n * 8), r: 3.5, kind: 'heart', age: 0, spin: 0 });
          }
          b.n++;
          sfx('puff', 0.4);
        }
        if (b.at > 3.2) done(0.9);
        break;
      }
      default:
        done(0.5);
    }
  }

  // ───────────── 탄 · 아이템 · 효과 ─────────────
  private nearestEnemy(x: number, y: number): Enemy | null {
    let best: Enemy | null = null;
    let bd = 1e9;
    for (const e of this.en) {
      if (e.dead || e.y < 0) continue;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  private updateBullets(dt: number): void {
    for (const b of this.pb) {
      if (b.kind === 'imo') {
        const tgt = this.nearestEnemy(b.x, b.y);
        if (tgt) {
          const sp = Math.hypot(b.vx, b.vy);
          const want = Math.atan2(tgt.y - b.y, tgt.x - b.x);
          const cur = Math.atan2(b.vy, b.vx);
          let d = want - cur;
          while (d > Math.PI) d -= TAU;
          while (d < -Math.PI) d += TAU;
          const na = cur + clamp(d, -5.5 * dt, 5.5 * dt);
          b.vx = Math.cos(na) * Math.min(220, sp + 160 * dt);
          b.vy = Math.sin(na) * Math.min(220, sp + 160 * dt);
        }
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
    }
    this.pb = this.pb.filter((b) => b.life > 0 && b.y > -30 && b.y < H + 30 && b.x > -30 && b.x < W + 30);
    for (const b of this.eb) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.age += dt;
    }
    this.eb = this.eb.filter((b) => b.x > -20 && b.x < W + 20 && b.y > -24 && b.y < H + 20);
    for (const bm of this.beams) {
      bm.t -= dt;
      if (bm.follow) bm.x = this.cx;
      bm.tick -= dt;
      if (bm.tick <= 0) {
        bm.tick = 0.07;
        for (const e of this.en) if (!e.dead && e.y > 0 && Math.abs(e.x - bm.x) < 7 + e.hr && e.y < this.cy) this.damage(e, 4.2, false);
        this.eb = this.eb.filter((q) => {
          const hit = Math.abs(q.x - bm.x) < 9 + q.r && q.y < this.cy;
          if (hit) this.starFrom(q.x, q.y);
          return !hit;
        });
      }
    }
    this.beams = this.beams.filter((b) => b.t > 0);
  }

  private updateItems(dt: number): void {
    for (const it of this.items) {
      it.age += dt;
      const d = Math.hypot(this.px - it.x, this.py - it.y);
      if (d < 46) {
        it.x += ((this.px - it.x) / d) * 150 * dt;
        it.y += ((this.py - it.y) / d) * 150 * dt;
      } else it.y += (28 + Math.sin(it.age * 4) * 6) * dt;
      if (d < 14) {
        it.y = 999;
        sfx('pickup10', 0.5);
        if (it.kind === 'cookie') {
          this.addScore(300, it.x, it.y);
        } else if (it.kind === 'strawberry') {
          if (this.hp < MAX_HP) {
            this.hp++;
            this.onHud({ hp: this.hp, paused: this.paused });
            this.floatText(this.px, this.py - 24, 'HP +1', '#ff9ec0');
          } else this.addScore(500, this.px, this.py - 20);
        } else if (it.kind === 'banana') {
          this.bombs = Math.min(5, this.bombs + 1);
          this.floatText(this.px, this.py - 24, 'BOMB +1', '#ffe34a');
        } else {
          if (this.power < 4) {
            this.power++;
            this.floatText(this.px, this.py - 24, `POWER UP! Lv${this.power}`, '#ffe34a');
          } else this.addScore(1000, this.px, this.py - 20);
        }
      }
    }
    this.items = this.items.filter((i) => i.y < H + 12);
  }

  private updateFx(dt: number): void {
    for (const p of this.parts) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.g * dt;
      p.life -= dt;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const p of this.pops) p.age += dt;
    this.pops = this.pops.filter((p) => p.age < 0.28);
    for (const f of this.floats) {
      f.age += dt;
      f.y -= 22 * dt;
    }
    this.floats = this.floats.filter((f) => f.age < 0.9);
  }

  private pop(x: number, y: number, big: boolean): void {
    this.pops.push({ x, y, age: 0, big });
  }
  private floatText(x: number, y: number, text: string, col: string): void {
    this.floats.push({ x, y, text, age: 0, col });
  }
  private starFrom(x: number, y: number): void {
    this.addScore(10, x, y, true);
    if (Math.random() < 0.5) this.parts.push({ x, y, vx: rand(-20, 20), vy: rand(-40, -10), life: 0.4, max: 0.4, col: '#ffe34a', size: 2, g: 0 });
  }
  private addScore(v: number, x: number, y: number, quiet = false): void {
    const mult = Math.min(5, 1 + Math.floor(this.combo / 5));
    const add = v * mult;
    this.score += add;
    if (!quiet) this.floatText(x, y, `${add}`, '#fff7dc');
  }

  private damage(e: Enemy, dmg: number, bomb: boolean): void {
    if (e.dead || e.y < -6) return;
    if (e.kind === 'boss') {
      const b = this.bs!;
      if (b.mode === 'enter' || b.mode === 'dying') return;
      if (this.bossHitSfx <= 0) {
        sfx('bossHit', 0.35);
        this.bossHitSfx = 0.12;
      }
    }
    e.hp -= dmg;
    e.flash = 0.07;
    if (e.hp > 0) return;
    if (e.kind === 'boss') {
      if (this.bs!.mode !== 'dying') {
        e.hp = 0;
        this.bs!.mode = 'dying';
        this.bs!.dyingT = 0;
        for (const q of this.eb) this.starFrom(q.x, q.y);
        this.eb = [];
        sfx('bossDown');
        this.bossSay('뽀뽀괴물을 물리쳤다!', '#ffe34a');
        this.shake = 1;
      }
      return;
    }
    e.dead = true;
    this.combo++;
    this.comboT = 2.2;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.addScore(e.score, e.x, e.y - 8);
    this.pop(e.x, e.y, e.kind === 'uncle');
    sfx('puff', 0.4);
    for (let i = 0; i < 8; i++) this.parts.push({ x: e.x, y: e.y, vx: rand(-80, 80), vy: rand(-80, 80), life: 0.5, max: 0.5, col: e.kind === 'uncle' ? '#f6f2e6' : '#b48af0', size: 2, g: 0 });
    // 드롭
    const r = Math.random();
    if (e.kind === 'uncle') {
      this.items.push({ x: e.x, y: e.y, kind: 'star', age: 0 });
      if (r < 0.5) this.items.push({ x: e.x + 8, y: e.y, kind: 'strawberry', age: 0 });
    } else if (r < 0.1) this.items.push({ x: e.x, y: e.y, kind: 'star', age: 0 });
    else if (r < 0.2) this.items.push({ x: e.x, y: e.y, kind: 'cookie', age: 0 });
    else if (r < 0.24) this.items.push({ x: e.x, y: e.y, kind: 'banana', age: 0 });
    // 안경잽이 폭발이 근처 탄을 한 발 지움 — 속도감
    void bomb;
  }

  // ───────────── 충돌 ─────────────
  private collide(dt: number): void {
    this.bossHitSfx -= dt;
    for (const b of this.pb) {
      for (const e of this.en) {
        if (e.dead || b.hit.has(e)) continue;
        const rr = b.r * (b.kind === 'charge' ? 1 : 1) + e.hr;
        if ((b.x - e.x) ** 2 + (b.y - e.y) ** 2 < rr * rr) {
          this.damage(e, b.dmg, false);
          if (b.pierce) b.hit.add(e);
          else {
            b.life = 0;
            this.parts.push({ x: b.x, y: b.y, vx: rand(-30, 30), vy: rand(-50, -10), life: 0.2, max: 0.2, col: '#fff8d0', size: 1, g: 0 });
            break;
          }
        }
      }
      // 차지샷은 적 탄도 지움
      if (b.kind === 'charge') {
        this.eb = this.eb.filter((q) => {
          const hit = (q.x - b.x) ** 2 + (q.y - b.y) ** 2 < (b.r + q.r) ** 2;
          if (hit) this.starFrom(q.x, q.y);
          return !hit;
        });
      }
    }
    this.en = this.en.filter((e) => !e.dead);
    // 플레이어 피격
    const hx = this.px;
    const hy = this.py + 2;
    for (const q of this.eb) {
      if ((q.x - hx) ** 2 + (q.y - hy) ** 2 < (q.r + 2.2) ** 2) {
        q.y = 999;
        this.hurtPlayer();
      }
    }
    this.eb = this.eb.filter((q) => q.y < H + 10);
    for (const e of this.en) {
      if (e.dead || e.y < 0) continue;
      if (e.kind === 'boss' && this.bs && (this.bs.mode === 'dying' || this.bs.mode === 'enter')) continue;
      if ((e.x - hx) ** 2 + (e.y - hy) ** 2 < (e.hr * 0.8 + 3) ** 2) {
        this.hurtPlayer();
        if (e.kind !== 'boss') this.damage(e, 99, false);
      }
    }
  }

  private finish(won: boolean): void {
    if (this.over) return;
    this.over = true;
    this.charging = false;
    this.endT = 0;
    stopBgm();
    if (!won) {
      sfx('gameOver');
      this.banner = { text: 'GAME OVER', t: 9, col: '#ff7a8a' };
      this.shake = 0.8;
    } else {
      sfx('newRecord');
      this.banner = { text: 'STAGE CLEAR!', t: 9, col: '#ffe34a' };
    }
    const info: EndInfo = { won, score: this.score, time: this.t, maxCombo: this.maxCombo, hp: Math.max(0, this.hp) };
    window.setTimeout(() => this.alive && this.onEnd(info), won ? 2600 : 1600);
  }

  // ═════════════ 그리기 ═════════════
  private draw(): void {
    const g = this.g;
    const S = this.S;
    g.setTransform(S, 0, 0, S, 0, 0);
    g.imageSmoothingEnabled = false;
    const sh = this.shake > 0 ? this.shake : 0;
    const ox = sh ? Math.round(rand(-3, 3) * sh) : 0;
    const oy = sh ? Math.round(rand(-3, 3) * sh) : 0;
    g.save();
    g.translate(ox, oy);

    // 하늘
    const sy = Math.floor(this.scroll);
    g.drawImage(this.a.img['sky-tile'], 0, sy - H);
    g.drawImage(this.a.img['sky-tile'], 0, sy);
    for (const c of this.clouds) {
      const im = this.a.img[`cloud-${c.i}` as ImgName];
      g.globalAlpha = 0.9;
      g.drawImage(im, Math.floor(c.x), Math.floor(c.y));
      g.globalAlpha = 1;
    }

    // 아이템
    for (const it of this.items) {
      const im = it.kind === 'star' ? this.a.img['fx-star'] : this.a.img[it.kind];
      const bob = Math.round(Math.sin(it.age * 6) * 1);
      g.drawImage(im, Math.floor(it.x - im.width / 2), Math.floor(it.y - im.height / 2) + bob);
    }

    // 적
    for (const e of this.en) this.drawEnemy(e);

    // 적 탄
    for (const b of this.eb) this.drawEBullet(b);

    // 광선
    for (const bm of this.beams) {
      const k = bm.t / bm.max;
      const w = Math.floor(14 * Math.min(1, (1 - k) * 8, k * 3 + 0.2));
      const x = Math.floor(bm.x - w / 2);
      g.fillStyle = '#cdefff';
      g.fillRect(x - 2, 0, w + 4, this.cy - 10);
      g.fillStyle = '#5ec8f0';
      g.fillRect(x, 0, w, this.cy - 10);
      g.fillStyle = '#ffffff';
      g.fillRect(x + Math.floor(w / 4), 0, Math.ceil(w / 2), this.cy - 10);
      const off = Math.floor(this.t * 120) % 8;
      g.fillStyle = '#3b2a3f';
      for (let y = -off; y < this.cy - 10; y += 8) g.fillRect(x - 3, y, 1, 3);
    }

    // 내 탄
    for (const b of this.pb) this.drawPBullet(b);

    // 동료 · 고나
    this.drawCompanion();
    this.drawGona();

    // 폭탄 링
    if (this.bombT > 0) {
      const prog = 1 - this.bombT / 1.7;
      const r = prog * 300;
      g.strokeStyle = '#fff7dc';
      g.lineWidth = 4;
      g.beginPath();
      g.arc(this.px, this.py, r, 0, TAU);
      g.stroke();
      g.strokeStyle = '#ff9ec0';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(this.px, this.py, Math.max(0, r - 6), 0, TAU);
      g.stroke();
    }

    // 파티클 · 팝
    for (const p of this.parts) {
      g.globalAlpha = Math.min(1, p.life / p.max + 0.2);
      g.fillStyle = p.col;
      g.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
    }
    g.globalAlpha = 1;
    for (const p of this.pops) {
      const f = p.age < 0.14 ? 0 : 1;
      const s = p.big ? 2 : 1;
      g.drawImage(this.a.pop.canvas, f * 14, 0, 14, 14, Math.floor(p.x - 7 * s), Math.floor(p.y - 7 * s), 14 * s, 14 * s);
    }
    g.restore();

    this.drawHud();
    if (this.flashWhite > 0) {
      g.globalAlpha = Math.min(0.85, this.flashWhite);
      g.fillStyle = '#fff';
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 1;
    }
    if (this.over) {
      g.globalAlpha = Math.min(0.5, this.endT * 0.5);
      g.fillStyle = this.boss || this.hp <= 0 ? '#3b1b3b' : '#fff7dc';
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 1;
    }
    this.drawBanner();
  }

  private drawSheet(sh: Sheet, frame: number, cx: number, cy: number, white = false, flip = false): void {
    const g = this.g;
    const src = sh.canvas;
    const dx = Math.floor(cx - sh.fw / 2);
    const dy = Math.floor(cy - sh.fh / 2);
    if (white) {
      g.drawImage(src, frame * sh.fw, 0, sh.fw, sh.fh, dx, dy, sh.fw, sh.fh);
      g.globalAlpha = sh.fw > 30 ? 0.14 : 0.5;
      g.drawImage(whiteOf(this.a, src), frame * sh.fw, 0, sh.fw, sh.fh, dx, dy, sh.fw, sh.fh);
      g.globalAlpha = 1;
      return;
    }
    if (flip) {
      g.save();
      g.translate(dx + sh.fw, dy);
      g.scale(-1, 1);
      g.drawImage(src, frame * sh.fw, 0, sh.fw, sh.fh, 0, 0, sh.fw, sh.fh);
      g.restore();
    } else g.drawImage(src, frame * sh.fw, 0, sh.fw, sh.fh, dx, dy, sh.fw, sh.fh);
  }

  private drawEnemy(e: Enemy): void {
    const white = e.flash > 0;
    if (e.kind === 'glasses') {
      const f = e.fire < 0.4 && e.pat !== 'dive' ? 2 : Math.floor(e.age * 6) % 2;
      this.drawSheet(this.a.glasses, f, e.x, e.y + Math.round(Math.sin(e.age * 8)), white);
      // 날개짓 — 작은 흰 날개 도트 (안경잽이도 하늘을 날고 있음)
      const g = this.g;
      const up = Math.floor(e.age * 12) % 2;
      g.fillStyle = '#fff';
      g.fillRect(Math.floor(e.x - 13), Math.floor(e.y - 3 - up * 2), 4, 2);
      g.fillRect(Math.floor(e.x + 9), Math.floor(e.y - 3 - up * 2), 4, 2);
      g.fillStyle = '#9fc3e0';
      g.fillRect(Math.floor(e.x - 13), Math.floor(e.y - 1 - up * 2), 4, 1);
      g.fillRect(Math.floor(e.x + 9), Math.floor(e.y - 1 - up * 2), 4, 1);
    } else if (e.kind === 'uncle') {
      const f = e.fire < 0.5 ? 2 + (Math.floor(e.age * 12) % 2) : Math.floor(e.age * 3) % 2;
      this.drawSheet(this.a.uncle, f, e.x, e.y, white, true);
      // HP 바
      this.hpBar(e.x - 10, e.y + 15, 20, e.hp / e.max);
    } else {
      const b = this.bs!;
      let f = Math.floor(e.age * 2.5) % 2;
      if (b.phase >= 2) f = Math.floor(e.age * 6) % 2 ? 3 : 1;
      if (b.mode === 'atk' && (b.atk === 'spiral' || (b.atk === 'dash' && b.at < 0.9))) f = 2;
      if (b.mode === 'dying') f = 4;
      this.drawSheet(this.a.kiss, f, e.x, e.y, white);
      if (b.mode === 'atk' && b.atk === 'dash' && b.at < 0.9) {
        const g = this.g;
        g.fillStyle = Math.floor(b.at * 10) % 2 ? '#ff4f86' : '#fff';
        g.fillRect(Math.floor(b.tx - 1), Math.floor(e.y + 24), 3, H - Math.floor(e.y) - 70);
      }
      if (b.mode === 'dying') {
        for (let i = 0; i < 3; i++) this.g.drawImage(this.a.dizzy, Math.floor(e.x - 14 + i * 12), Math.floor(e.y - 30 + Math.sin(e.age * 8 + i) * 3));
      }
    }
  }

  private hpBar(x: number, y: number, w: number, f: number): void {
    const g = this.g;
    g.fillStyle = '#3b2a3f';
    g.fillRect(Math.floor(x) - 1, Math.floor(y) - 1, w + 2, 4);
    g.fillStyle = '#ff6f9f';
    g.fillRect(Math.floor(x), Math.floor(y), Math.max(0, Math.round(w * f)), 2);
  }

  private drawEBullet(b: EBullet): void {
    const g = this.g;
    if (b.kind === 'flask') {
      const fr = Math.floor(b.age * 8) % 3;
      g.drawImage(this.a.flask.canvas, fr * 12, 0, 12, 16, Math.floor(b.x - 6), Math.floor(b.y - 8), 12, 16);
    } else {
      const im = b.kind === 'smell' ? this.a.smell : b.kind === 'heart' ? this.a.heartShot : this.a.waveHeart;
      g.drawImage(im, Math.floor(b.x - im.width / 2), Math.floor(b.y - im.height / 2));
    }
  }

  private drawPBullet(b: PBullet): void {
    const g = this.g;
    const key: ImgName = b.kind === 'gona' ? 'shot-gona' : b.kind === 'charge' ? 'shot-charge' : b.kind === 'heart' ? 'shot-heart' : 'shot-imo';
    const im = this.a.img[key];
    const s = Math.max(1, Math.round(b.scale));
    const w = im.width * s;
    const h = im.height * s;
    if (b.kind === 'charge') {
      g.globalAlpha = 0.5;
      g.fillStyle = '#fff8d0';
      g.fillRect(Math.floor(b.x - w / 2 + 2), Math.floor(b.y), w - 4, 40);
      g.globalAlpha = 1;
    }
    g.drawImage(im, Math.floor(b.x - w / 2), Math.floor(b.y - h / 2), w, h);
  }

  private drawCompanion(): void {
    const g = this.g;
    const im = this.a.img[`family-${this.fam}` as ImgName];
    const bob = Math.round(Math.sin(this.t * 4 + 1) * 1.5);
    const kick = this.cKick;
    // 발밑 뭉게구름
    const pf = this.a.img['puff'];
    g.drawImage(pf, Math.floor(this.cx - pf.width / 2), Math.floor(this.cy + im.height / 2 - 6 + bob));
    const lean = clamp((this.cx - this.px - 38) * 0.02, -1, 1);
    const w = im.width;
    const x0 = Math.floor(this.cx - w / 2);
    const y0 = Math.floor(this.cy - im.height / 2 + bob - kick * 4);
    // 가볍게 기울이는 연출 (행 단위 밀기) + 공격 순간 앞으로 튀어 오름
    for (let r = 0; r < im.height; r++) {
      const off = Math.round(((r - im.height / 2) / im.height) * lean * -3);
      g.drawImage(im, 0, r, w, 1, x0 + off, y0 + r, w, 1);
    }
    // 공격 순간 이펙트 반짝
    if (kick > 0.5) {
      g.drawImage(this.a.img['fx-spark'], Math.floor(this.cx + 6), Math.floor(this.cy - im.height / 2 - 6));
    }
    // 재충전 점 (스킬 쿨타임)
    if (this.fam !== 'imo' && this.cCd > 0 && this.cCd < 20) {
      const full = this.fam === 'mom' ? 1.45 : this.fam === 'dad' ? 2.5 : 8.5;
      const k = 1 - clamp(this.cCd / full, 0, 1);
      g.fillStyle = '#3b2a3f';
      g.fillRect(Math.floor(this.cx - 8), Math.floor(this.cy + im.height / 2 + 6), 17, 3);
      g.fillStyle = k >= 1 ? '#ffe34a' : '#fff8d0';
      g.fillRect(Math.floor(this.cx - 7), Math.floor(this.cy + im.height / 2 + 7), Math.round(15 * k), 1);
    }
  }

  private drawGona(): void {
    const g = this.g;
    const blink = this.inv > 0 && Math.floor(this.t * 16) % 2 === 0 && this.hurtT <= 0 && this.bombT <= 0;
    if (blink) return;
    const lean = clamp(this.pvx / 120, -1, 1);
    // 날개 (뒤) — 좌우로 기울면 위쪽 날개는 올라가고 아래쪽 날개는 내려감
    const flap = Math.floor(this.t * (this.charging ? 9 : 14)) % 4;
    const wing = this.a.img['gona-wings'];
    const bob = Math.round(Math.sin(this.t * 7) * 1.2);
    const cx = Math.floor(this.px);
    const cy = Math.floor(this.py) + bob;
    const wy = cy - 17;
    // 오른쪽 날개
    g.drawImage(wing, flap * 28, 0, 28, 26, cx + 6, wy + Math.round(lean * 3), 28, 26);
    // 왼쪽 날개 (반전)
    g.save();
    g.translate(cx - 6, wy - Math.round(lean * 3));
    g.scale(-1, 1);
    g.drawImage(wing, ((flap + (lean > 0.3 ? 0 : 0)) % 4) * 28, 0, 28, 26, 0, 0, 28, 26);
    g.restore();
    // 몸통
    const frame = this.hurtT > 0 ? 2 : this.atkT > 0 ? 1 : 0;
    const body = this.a.img['gona-body'];
    const bw = 33;
    const bh = 34;
    const x0 = cx - 16;
    const y0 = cy - 20;
    const src = this.hurtT > 0 && Math.floor(this.t * 20) % 2 ? whiteOf(this.a, body) : body;
    for (let r = 0; r < bh; r++) {
      const off = Math.round(((r - bh / 2) / bh) * lean * -4); // 머리는 이동 방향으로, 발은 반대로
      g.drawImage(src, frame * bw, r, bw, 1, x0 + off, y0 + r, bw, 1);
    }
    // 방패
    if (this.shield > 0) {
      const sp = this.a.img['fx-shield'];
      g.globalAlpha = this.shield < 1.5 && Math.floor(this.t * 10) % 2 ? 0.4 : 0.9;
      g.drawImage(sp, cx - 20, cy - 22);
      g.globalAlpha = 1;
    }
    // 차지 표시
    if (this.charging) {
      const k = Math.min(1, this.charge / 1.0);
      const r = 3 + k * 7;
      g.fillStyle = this.charge >= 0.35 ? '#fff8d0' : '#ffe34a';
      g.fillRect(cx - Math.floor(r / 2), cy - 24 - Math.floor(r / 2), Math.floor(r), Math.floor(r));
      g.fillStyle = '#3b2a3f';
      g.fillRect(cx - 12, cy + 18, 25, 3);
      g.fillStyle = k >= 1 ? '#ff6f9f' : this.charge >= 0.35 ? '#ffe34a' : '#fff';
      g.fillRect(cx - 11, cy + 19, Math.round(23 * k), 1);
    }
    // 피격 판정 점 (작은 다이아몬드)
    g.fillStyle = '#fff';
    g.fillRect(cx, Math.floor(this.py) + 1, 1, 3);
    g.fillRect(cx - 1, Math.floor(this.py) + 2, 3, 1);
    g.fillStyle = '#e0482c';
    g.fillRect(cx, Math.floor(this.py) + 2, 1, 1);
  }

  private text(s: string, x: number, y: number, col = '#fff7dc', align: CanvasTextAlign = 'left', size = 11): void {
    const g = this.g;
    g.font = `700 ${size}px Galmuri11, monospace`;
    g.textAlign = align;
    g.textBaseline = 'top';
    g.fillStyle = '#3b2a3f';
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [1, -1], [-1, 1]]) g.fillText(s, x + dx, y + dy);
    g.fillStyle = col;
    g.fillText(s, x, y);
  }

  private drawHud(): void {
    const g = this.g;
    // 목숨 하트
    for (let i = 0; i < MAX_HP; i++) {
      const im = this.a.img[i < this.hp ? 'icon-heart' : 'icon-heart-empty'];
      g.drawImage(im, 4 + i * 11, 4);
    }
    for (let i = 0; i < this.bombs; i++) g.drawImage(this.a.img['icon-bomb'], 4 + i * 11, 15);
    this.text(String(this.score).padStart(8, '0'), W - 4, 3, '#fff7dc', 'right');
    this.text(`Lv${this.power}`, W - 4, 15, '#ffe34a', 'right', 11);
    const mult = Math.min(5, 1 + Math.floor(this.combo / 5));
    if (this.combo >= 3) this.text(`${this.combo} COMBO${mult > 1 ? ` x${mult}` : ''}`, 4, this.boss ? 40 : 27, '#ff9ec0', 'left', 11);
    // 보스 체력
    if (this.boss && this.bs) {
      const f = clamp(this.boss.hp / this.boss.max, 0, 1);
      g.fillStyle = '#3b2a3f';
      g.fillRect(14, 30, W - 28, 7);
      g.fillStyle = '#fff7dc';
      g.fillRect(15, 31, W - 30, 5);
      g.fillStyle = this.bs.phase === 1 ? '#ff6f9f' : this.bs.phase === 2 ? '#ff4f86' : '#e0482c';
      g.fillRect(15, 31, Math.round((W - 30) * f), 5);
    }
    // 하단 동료 이름
  }

  private drawBanner(): void {
    const b = this.banner;
    if (!b) return;
    const k = Math.min(1, b.t * 3, (b.t > 8 ? 1 : 1));
    const g = this.g;
    g.globalAlpha = k;
    const y = 112;
    g.fillStyle = 'rgba(59,42,63,0.78)';
    g.fillRect(0, y - 6, W, b.sub ? 40 : 28);
    g.globalAlpha = 1;
    this.text(b.text, W / 2, y, b.col, 'center', 16);
    if (b.sub) this.text(b.sub, W / 2, y + 20, '#fff7dc', 'center', 11);
  }
}
