/**
 * GONA's Sky Adventure — 건버드 스타일 세로 스크롤 슈팅 엔진 (독립 모듈 · 기존 게임천국 코드와 무관)
 *
 * 좌표: 논리 해상도 180×320 (9:16). 캔버스는 기기와 무관하게 항상 2배(360×640)로 그리고 CSS 로 확대 (pixelated).
 *   → iPhone(DPR 3)에서 예전 1080×1920 대비 픽셀 수 1/9. 모든 스프라이트가 2배 격자라 캔버스와 1:1 로 찍혀 화질 손실 없음.
 *
 * 성능 원칙 (iPhone 보스전 버벅임 대책)
 *   - 매 프레임 이미지 생성·리사이즈 금지: 배경·소품·탄·글자는 로딩/첫 사용 때 캔버스로 미리 만들어 캐시
 *   - 탄·파티클·이펙트는 객체 풀 + 제자리 압축 (프레임마다 배열·Set 새로 만들지 않음 → GC 감소)
 *   - 파티클·폭발·이펙트 상한, 화면 전체 반투명 덮기 최소화 (배경 어둡게 처리는 미리 구워 둠)
 *   - 소리는 Web Audio 버퍼 재사용 (audio.ts) — HTMLAudio 복제 재생 제거
 */
import { type Assets, type V2Name, type CutinId, whiteOf } from './assets';
import { bulletLooks, type BulletLook } from './bullets';
import { CHARACTERS } from './data/characters';
import { sfx, stopSfx, playBgm, stopBgm } from './audio';
import { settings, buzz } from './settings';

export const W = 180;
export const H = 320;
/** 캔버스 배율 (고정) */
const R = 2;
export type FamilyId = 'mom' | 'dad' | 'imo' | 'halmeoni' | 'halabeoji' | 'samchon';

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
  /** 가족 필살기 게이지 0~1 */
  gauge: number;
  bombs: number;
}

// ───────────── 작은 도구 ─────────────
const rand = (a: number, b: number): number => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;

/** 제자리 압축: keep 이 false 인 원소를 빼고, 빠진 원소는 pool 로 돌려줌 (새 배열 생성 없음) */
function compact<T>(arr: T[], keep: (v: T) => boolean, pool?: T[]): void {
  let j = 0;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (keep(v)) arr[j++] = v;
    else if (pool && pool.length < 512) pool.push(v);
  }
  arr.length = j;
}

type PKind = 'shot' | 'wave' | 'charge' | 'heart' | 'star' | 'elec' | 'potion' | 'lance' | 'missile' | 'refl' | 'drill';
interface PBullet {
  x: number; y: number; vx: number; vy: number; r: number; dmg: number; kind: PKind; lvl: number;
  pierce: boolean; hits: number[]; life: number; scale: number; homing: number; age: number; alive: boolean;
}
type EBKind = 'flask' | 'smell' | 'heart' | 'wave' | 'needle' | 'ring' | 'fire';
interface EBullet {
  x: number; y: number; vx: number; vy: number; r: number; kind: EBKind; age: number; alive: boolean;
}
type EKind = 'glasses' | 'uncle' | 'boss' | 'orb';
interface Enemy {
  id: number; kind: EKind; pat: string; x: number; y: number; x0: number; vx: number; vy: number;
  hp: number; max: number; age: number; flash: number; fire: number; dir: number; hr: number; score: number; dead: boolean; ph: number; burst: number;
}
interface Item { x: number; y: number; kind: 'cookie' | 'strawberry' | 'banana' | 'star'; age: number; alive: boolean }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; col: string; size: number; g: number }
interface Boom { x: number; y: number; age: number; delay: number; scale: number }
type FxKind = 'spark' | 'metal' | 'weak' | 'ring' | 'puff';
interface Fx { kind: FxKind; x: number; y: number; age: number; dur: number; scale: number; vy: number }
interface Prop { name: V2Name; x: number; y: number; v: number; layer: number; vx: number }
interface Float { x: number; y: number; text: string; age: number; col: string }
interface Beam { follow: boolean; x: number; t: number; max: number; tick: number; wide: boolean }

interface BossState {
  mode: 'enter' | 'idle' | 'atk' | 'dying';
  atk: string; at: number; rest: number; last: string; phase: 1 | 2 | 3; n: number; tx: number; sub: number; minion: number; dyingT: number;
}

/** 가족 필살기 진행 상태 */
interface Special {
  id: FamilyId | 'gona';
  t: number;
  /** 컷인 시간(초) — 이 동안 게임은 느리게 */
  cut: number;
  dur: number;
  n: number;
  x: number;
  y: number;
  /** 발동 첫 프레임 처리 완료 여부 */
  init: boolean;
}

/** 선택 화면 표시용 정보 — 데이터는 src/sky/data/characters.ts */
export const FAMILY_INFO: Record<FamilyId, { name: string; skill: string; desc: string }> = {
  mom: CHARACTERS.mom, dad: CHARACTERS.dad, imo: CHARACTERS.imo, halmeoni: CHARACTERS.halmeoni, halabeoji: CHARACTERS.halabeoji, samchon: CHARACTERS.samchon,
};

/** 스테이지 1 배경 소품 대본: [시각(초, 60초마다 반복), 에셋, 레이어(0 원경 · 1 중경 · 2 근경 구름), 가로 위치(화면 폭 비율), 가로 이동] */
const STAGE1_PROPS: [number, V2Name, number, number, number][] = [
  [0, 'stage1/island-castle', 1, 0.08, 0], [2, 'stage1/cloud-small', 0, 0.78, 0], [5, 'stage1/island-small', 0, 0.88, 0], [8, 'stage1/cloud-big', 2, 0.15, 0],
  [11, 'stage1/island-ruins', 1, 0.95, 0], [16, 'stage1/clocktower', 1, 0.06, 0], [19, 'stage1/cloud-small', 0, 0.25, 0], [23, 'stage1/airship', 1, 1.05, -7],
  [28, 'stage1/island-tower', 1, -0.02, 0], [31, 'stage1/cloud-big', 2, 0.88, 0], [35, 'stage1/island-small', 0, 0.15, 0], [39, 'stage1/island-castle', 1, 1.0, 0],
  [44, 'stage1/cloud-big', 2, 0.3, 0], [48, 'stage1/clocktower', 1, 0.98, 0], [52, 'stage1/cloud-small', 0, 0.6, 0], [56, 'stage1/island-ruins', 1, 0.02, 0],
];
const LAYER = [{ k: 0.32, v: 14, a: 0.75 }, { k: 0.5, v: 30, a: 1 }, { k: 0.6, v: 70, a: 0.55 }];

const MAX_HP = 5;
const BOSS_WARN_T = 54;
const BOSS_T = 57.5;
const BOMB_T = 1.9;
const CAP = { parts: 220, booms: 36, fx: 70, floats: 10, eb: 320 };
/** 보스 약점(유리 돔 조종석): 보스 중심 기준 위치·반지름 */
const WEAK = { dx: 0, dy: -4, r: 11 };
/** 필살기 이름 (characters.ts 의 special 대신 이번 기획 이름) */
export const SPECIAL_NAME: Record<FamilyId | 'gona', string> = {
  gona: '황금 익룡의 포효', mom: '하트 스톰', dad: '스팀 브레이커', imo: '스타 캐논 버스트', halmeoni: '골든 힐링', halabeoji: '가디언 실드', samchon: '메가 인벤션',
};
const SP_DUR: Record<FamilyId, number> = { mom: 2.6, dad: 2.3, imo: 2.0, halmeoni: 1.6, halabeoji: 5.0, samchon: 3.2 };
const SP_CUT = 0.62;
const SP_CUT_COL: Record<FamilyId | 'gona', string> = { gona: '#ffe34a', mom: '#ff9ec0', dad: '#9cd8ff', imo: '#ffe470', halmeoni: '#b8f0a0', halabeoji: '#cde8ff', samchon: '#a0fff0' };

type Spawn = { t: number; fn: () => void };

// ───────────── 글자 캐시 (fillText 9번 → 이미지 1장) ─────────────
const textCache = new Map<string, HTMLCanvasElement>();
function textImg(s: string, col: string, size: number): HTMLCanvasElement {
  const key = `${size}|${col}|${s}`;
  let c = textCache.get(key);
  if (c) return c;
  if (textCache.size > 360) textCache.clear();
  c = document.createElement('canvas');
  const g = c.getContext('2d')!;
  const font = `700 ${size * R}px Galmuri11, monospace`;
  g.font = font;
  const w = Math.ceil(g.measureText(s).width) + 4 * R;
  c.width = Math.max(1, w);
  c.height = Math.ceil(size * R * 1.25) + 4 * R;
  g.font = font;
  g.textBaseline = 'top';
  g.fillStyle = '#1e1430';
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [1, -1], [-1, 1]]) g.fillText(s, 2 * R + dx * R, R + dy * R);
  g.fillStyle = col;
  g.fillText(s, 2 * R, R);
  textCache.set(key, c);
  return c;
}

export class SkyEngine {
  private g: CanvasRenderingContext2D;
  private raf = 0;
  private last = 0;
  private alive = true;
  paused = false;
  private over = false;
  private endT = 0;

  private t = 0;
  private shake = 0;
  private flashWhite = 0;
  private flashGold = 0;
  private hitstop = 0;
  private banner: { text: string; sub?: string; t: number; col: string } | null = null;

  // 플레이어
  private px = W / 2;
  private py = H - 90;
  private pvx = 0;
  private lastMoveT = 0;
  private shootAnimT = 0;
  private muzzleT = 0;
  private overWon = false;
  private lastAnim = '';
  private hp = MAX_HP;
  private inv = 0;
  private hurtT = 0;
  private bombs = 3;
  private bombT = 0;
  private bombHit = false;
  private power = 1;
  private fireT = 0;
  private volley = 0;
  private charge = 0;
  private charging = false;
  private chargeSnd: AudioBufferSourceNode | null = null;
  private score = 0;
  private combo = 0;
  private comboT = 0;
  private maxCombo = 0;
  private shield = 0;
  private barrier = 0;
  private gauge = 0;
  private hudGauge = -1;

  // 동료
  private cx = W / 2 + 24;
  private cy = H - 80;
  private cCd = 1.5;
  private cN = 0;
  private cKick = 0;
  private sp: Special | null = null;

  private nextId = 1;
  private booms: Boom[] = [];
  private fx: Fx[] = [];
  private props: Prop[] = [];
  private propIdx = 0;
  private propLoop = 0;
  private chargeFlash = 0;
  private pb: PBullet[] = [];
  private eb: EBullet[] = [];
  private pbPool: PBullet[] = [];
  private ebPool: EBullet[] = [];
  private partPool: Particle[] = [];
  private en: Enemy[] = [];
  private items: Item[] = [];
  private parts: Particle[] = [];
  private floats: Float[] = [];
  private beams: Beam[] = [];
  private boss: Enemy | null = null;
  private bs: BossState | null = null;
  private bossSpawned = false;
  private warned = false;
  private timeline: Spawn[] = [];
  private tlIdx = 0;

  // 미리 만든 그림
  private bgBaked: HTMLCanvasElement;
  private propBaked = new Map<string, HTMLCanvasElement>();
  private ebImg = new Map<string, HTMLCanvasElement>();
  private pbImg = new Map<string, HTMLCanvasElement>();

  // 성능 측정
  private perf = { frames: 0, acc: 0, fps: 0, ft: 0, ftMax: 0, upd: 0, drw: 0, updAcc: 0, drwAcc: 0, maxAcc: 0, long: 0 };
  private lastFrame = 0;

  // 입력
  private dragId: number | null = null;
  private dragX = 0;
  private dragY = 0;
  private dragPx = 0;
  private dragPy = 0;
  private targetX = 0;
  private targetY = 0;
  private hasTarget = false;
  private keys = new Set<string>();

  constructor(
    private canvas: HTMLCanvasElement,
    private a: Assets,
    private fam: FamilyId,
    private onEnd: (r: EndInfo) => void,
    private onHud: (h: HudInfo) => void,
  ) {
    this.g = canvas.getContext('2d', { alpha: false })!;
    this.resize();
    this.bgBaked = this.bakeBackdrop();
    this.buildTimeline();
    this.cCd = fam === 'halmeoni' ? 5 : fam === 'halabeoji' ? 1 : 1.2;
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onUp);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKeyUp);
    this.banner = { text: 'STAGE 1', sub: '황혼의 부유왕국', t: 2.6, col: '#ffe9a8' };
    sfx('start');
    playBgm('stage1', 0.5);
    this.pushHud();
    this.last = performance.now();
    this.lastFrame = this.last;
    this.raf = requestAnimationFrame(this.loop);
  }

  // ───────────── 외부 제어 ─────────────
  resize(): void {
    if (this.canvas.width !== W * R) this.canvas.width = W * R;
    if (this.canvas.height !== H * R) this.canvas.height = H * R;
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
    stopSfx(this.chargeSnd);
  }
  setPaused(p: boolean): void {
    this.paused = p;
    this.setCharging(false);
    this.pushHud();
  }
  holdCharge(down: boolean): void {
    if (this.paused || this.over) return;
    this.setCharging(down);
  }
  private pushHud(): void {
    this.hudGauge = Math.floor(this.gauge * 20);
    this.onHud({ hp: this.hp, paused: this.paused, gauge: this.gauge, bombs: this.bombs });
  }
  private addGauge(v: number): void {
    if (this.sp || this.over) return;
    const before = this.gauge;
    this.gauge = Math.min(1, this.gauge + v);
    if (before < 1 && this.gauge >= 1) {
      sfx('gaugeFull');
      this.floatText(this.cx, this.cy - 30, 'SP READY!', '#ffe34a');
    }
    if (Math.floor(this.gauge * 20) !== this.hudGauge) this.pushHud();
  }

  /** 고나 폭탄: 황금 익룡의 포효 */
  useBomb(): void {
    if (this.paused || this.over || this.bombs <= 0 || this.bombT > 0 || this.sp) return;
    this.bombs--;
    this.bombT = BOMB_T;
    this.bombHit = false;
    this.inv = Math.max(this.inv, 2.6);
    this.sp = { id: 'gona', t: 0, cut: SP_CUT, dur: BOMB_T, n: 0, x: this.px, y: this.py, init: false };
    this.floats.length = 0;
    sfx('cutin');
    sfx('bomb');
    buzz([30, 40, 60]);
    this.setCharging(false);
    this.pushHud();
  }

  /** 가족 필살기 (게이지 100%) */
  useFamily(): void {
    if (this.paused || this.over || this.gauge < 1 || this.sp || this.bombT > 0) return;
    this.gauge = 0;
    const f = this.fam;
    this.sp = { id: f, t: 0, cut: SP_CUT, dur: SP_DUR[f], n: 0, x: this.cx, y: this.cy, init: false };
    this.floats.length = 0;
    this.inv = Math.max(this.inv, SP_CUT + 0.6);
    sfx('cutin');
    sfx(`sp${f[0].toUpperCase()}${f.slice(1)}` as 'spMom');
    buzz(30);
    this.setCharging(false);
    this.pushHud();
  }

  /** 디버그·테스트용 상태 (자동 검수 스크립트에서 사용) */
  debug(): Record<string, number | string> {
    return {
      t: +this.t.toFixed(1), hp: this.hp, score: this.score, enemies: this.en.length, ebullets: this.eb.length, pbullets: this.pb.length, parts: this.parts.length, fx: this.fx.length + this.booms.length,
      boss: this.boss ? Math.round(this.boss.hp) : -1, phase: this.bs?.phase ?? 0, power: this.power, over: this.over ? 1 : 0, px: Math.round(this.px), py: Math.round(this.py), anim: this.lastAnim,
      gauge: +this.gauge.toFixed(2), sp: this.sp ? this.sp.id : '', bombs: this.bombs, S: R, fps: this.perf.fps, ft: this.perf.ft, ftMax: this.perf.ftMax, upd: this.perf.upd, drw: this.perf.drw,
    };
  }
  cheat(cmd: string): void {
    if (cmd === 'boss') { this.t = Math.max(this.t, BOSS_WARN_T - 0.2); this.tlIdx = this.timeline.length; this.en = this.en.filter((e) => e.kind === 'boss'); this.eb.length = 0; }
    if (cmd === 'power') this.power = 4;
    if (cmd === 'god') this.hp = 99;
    if (cmd === 'hp1') this.hp = 1;
    if (cmd === 'killboss' && this.boss) this.boss.hp = 1;
    if (cmd === 'hurt') { this.inv = 0; this.shield = 0; this.barrier = 0; this.hurtPlayer(); }
    if (cmd === 'bombs') { this.bombs = 5; this.pushHud(); }
    if (cmd === 'gauge') this.addGauge(1);
    if (cmd === 'stress' && this.boss && this.bs) {
      // 최악 상황: 3단계 + 무한 체력 (탄막 최대 패턴만 반복)
      this.boss.max = 1e6; this.boss.hp = 2.9e5; this.bs.phase = 3;
    }
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
  private onKey = (e: KeyboardEvent): void => {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'z', 'x', 'c'].includes(k)) e.preventDefault();
    if (e.repeat) return;
    this.keys.add(k);
    if (k === 'x') this.useBomb();
    if (k === 'c') this.useFamily();
    if (k === ' ' || k === 'z') this.setCharging(true);
    if (k === 'p' || k === 'escape') this.setPaused(!this.paused);
  };
  private onKeyUp = (e: KeyboardEvent): void => {
    const k = e.key.toLowerCase();
    this.keys.delete(k);
    if (k === ' ' || k === 'z') this.setCharging(false);
  };
  private setCharging(on: boolean): void {
    if (on && (this.over || this.paused)) on = false;
    if (on === this.charging) return;
    this.charging = on;
    if (on) this.chargeSnd = sfx('chargeUp');
    else {
      stopSfx(this.chargeSnd);
      this.chargeSnd = null;
      this.releaseCharge();
    }
  }

  // ───────────── 풀 ─────────────
  private newPB(x: number, y: number, vx: number, vy: number, r: number, dmg: number, kind: PKind, pierce = false, life = 1.3): PBullet {
    const b = this.pbPool.pop() ?? ({ hits: [] as number[] } as PBullet);
    b.x = x; b.y = y; b.vx = vx; b.vy = vy; b.r = r; b.dmg = dmg; b.kind = kind; b.pierce = pierce; b.life = life; b.scale = 1; b.homing = 0; b.age = 0; b.lvl = 1; b.alive = true;
    b.hits.length = 0;
    this.pb.push(b);
    return b;
  }
  private newEB(x: number, y: number, vx: number, vy: number, r: number, kind: EBKind, age = 0): void {
    if (this.eb.length >= CAP.eb) return;
    const b = this.ebPool.pop() ?? ({} as EBullet);
    b.x = x; b.y = y; b.vx = vx; b.vy = vy; b.r = r; b.kind = kind; b.age = age; b.alive = true;
    this.eb.push(b);
  }
  private part(x: number, y: number, vx: number, vy: number, life: number, col: string, size: number, g: number): void {
    if (this.parts.length >= CAP.parts) return;
    const p = this.partPool.pop() ?? ({} as Particle);
    p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.max = life; p.col = col; p.size = size; p.g = g;
    this.parts.push(p);
  }
  private addFx(kind: FxKind, x: number, y: number, scale = 1, dur = 0.24, vy = 0): void {
    if (this.fx.length >= CAP.fx) this.fx.shift();
    this.fx.push({ kind, x, y, age: 0, dur, scale, vy });
  }

  // ───────────── 스테이지 타임라인 ─────────────
  private buildTimeline(): void {
    const at = (t: number, fn: () => void): void => void this.timeline.push({ t, fn });
    const row = (t: number, n: number, pat: string, kind: EKind = 'glasses', gap = 0.35, x0 = 30, x1 = 150, dir = 1): void => {
      for (let i = 0; i < n; i++) at(t + i * gap, () => this.spawn(kind, n === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / (n - 1), -14, pat, dir, i));
    };
    row(1.2, 5, 'sine', 'glasses', 0.28, 30, 150);
    row(4.5, 4, 'strafe', 'glasses', 0.45, 0, 0, 1);
    row(7.5, 4, 'strafe', 'glasses', 0.45, 0, 0, -1);
    at(10, () => this.spawn('orb', 40, -16, 'orb', 1, 0));
    at(10.6, () => this.spawn('orb', 140, -16, 'orb', -1, 1));
    at(14, () => this.spawn('uncle', 90, -30, 'uncle', 1, 0));
    for (let i = 0; i < 6; i++) at(17.5 + i * 0.45, () => this.spawn('glasses', i % 2 ? 150 : 30, -14, 'dive', 1, i));
    row(21, 8, 'swarm', 'glasses', 0.2, 20, 160);
    at(24, () => this.spawn('uncle', 48, -30, 'uncle', 1, 0));
    at(24.8, () => this.spawn('uncle', 132, -30, 'uncle', -1, 1));
    row(28, 7, 'sine', 'glasses', 0.26, 20, 160);
    at(30, () => this.spawn('orb', 90, -16, 'orb', 1, 2));
    row(33, 4, 'strafe', 'glasses', 0.4, 0, 0, 1);
    row(33.2, 4, 'strafe', 'glasses', 0.4, 0, 0, -1);
    for (let i = 0; i < 5; i++) at(37 + i * 0.45, () => this.spawn('glasses', 20 + i * 35, -14, 'dive', 1, i));
    at(39.5, () => this.spawn('uncle', 90, -30, 'uncle', 1, 0));
    at(43, () => this.spawn('orb', 30, -16, 'orb', 1, 3));
    at(43.4, () => this.spawn('orb', 150, -16, 'orb', -1, 4));
    row(45, 9, 'swarm', 'glasses', 0.2, 15, 165);
    row(49, 5, 'strafe', 'glasses', 0.4, 0, 0, 1);
    row(49.2, 5, 'strafe', 'glasses', 0.4, 0, 0, -1);
    this.timeline.sort((p, q) => p.t - q.t);
  }

  private spawn(kind: EKind, x: number, y: number, pat: string, dir: number, idx: number): void {
    const glasses = kind === 'glasses';
    const orb = kind === 'orb';
    let sx = x;
    let sy = y;
    if (pat === 'strafe') {
      sx = dir > 0 ? -14 : W + 14;
      sy = 34 + idx * 16;
    }
    this.en.push({
      id: this.nextId++, kind, pat, x: sx, y: sy, x0: x, vx: 0, vy: 0, hp: glasses ? 3 : orb ? 10 : 24, max: glasses ? 3 : orb ? 10 : 24, age: 0, flash: 0, fire: orb ? 1.2 : rand(0.8, 2.2), dir,
      hr: glasses ? 9 : orb ? 11 : 17, score: glasses ? 100 : orb ? 300 : 800, dead: false, ph: idx * 0.7, burst: 0,
    });
  }

  // ───────────── 메인 루프 ─────────────
  private loop = (now: number): void => {
    if (!this.alive) return;
    const frameMs = now - this.lastFrame;
    this.lastFrame = now;
    let dt = Math.min(0.033, (now - this.last) / 1000);
    this.last = now;
    const t0 = performance.now();
    if (!this.paused) {
      if (this.hitstop > 0) {
        // 히트스톱: 아주 짧게 세계를 멈춤 (흔들림·섬광만 진행)
        this.hitstop -= dt;
        this.shake = Math.max(0, this.shake - dt * 1.6);
      } else {
        // 컷인 중 슬로모션
        if (this.sp && this.sp.t < this.sp.cut) {
          this.sp.t += dt;
          dt *= 0.3;
        }
        this.update(dt);
      }
    }
    const t1 = performance.now();
    this.draw();
    const t2 = performance.now();
    this.measure(frameMs, t1 - t0, t2 - t1);
    this.raf = requestAnimationFrame(this.loop);
  };

  private measure(frameMs: number, upd: number, drw: number): void {
    const p = this.perf;
    p.frames++;
    p.acc += frameMs;
    p.updAcc += upd;
    p.drwAcc += drw;
    p.maxAcc = Math.max(p.maxAcc, frameMs);
    if (frameMs > 20) p.long++;
    if (p.acc >= 500) {
      p.fps = Math.round((p.frames * 1000) / p.acc);
      p.ft = +(p.acc / p.frames).toFixed(1);
      p.ftMax = +p.maxAcc.toFixed(1);
      p.upd = +(p.updAcc / p.frames).toFixed(2);
      p.drw = +(p.drwAcc / p.frames).toFixed(2);
      p.frames = 0; p.acc = 0; p.updAcc = 0; p.drwAcc = 0; p.maxAcc = 0;
    }
  }

  private update(dt: number): void {
    this.t += dt;
    this.updateProps(dt);
    this.shake = Math.max(0, this.shake - dt * 1.6);
    this.flashWhite = Math.max(0, this.flashWhite - dt * 1.8);
    this.flashGold = Math.max(0, this.flashGold - dt * 1.5);
    if (this.banner && (this.banner.t -= dt) <= 0) this.banner = null;

    if (this.over) {
      this.endT += dt;
      if (this.overWon) this.py -= 34 * dt;
      else this.py += 46 * dt;
      this.updateFx(dt);
      this.updateEnemies(dt);
      return;
    }

    while (this.tlIdx < this.timeline.length && this.timeline[this.tlIdx].t <= this.t) this.timeline[this.tlIdx++].fn();
    if (!this.warned && this.t >= BOSS_WARN_T) {
      this.warned = true;
      sfx('warn');
      stopBgm(1.4); // 경고음과 함께 스테이지 곡을 서서히 줄임 → 보스 곡으로 전환
      this.banner = null;
    }
    if (!this.bossSpawned && this.t >= BOSS_T) this.spawnBoss();

    this.updatePlayer(dt);
    this.updateWeapons(dt);
    this.updateCompanion(dt);
    this.updateSpecial(dt);
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updateItems(dt);
    this.updateFx(dt);
    this.collide();

    this.comboT -= dt;
    if (this.comboT <= 0) this.combo = 0;
    if (this.inv > 0) this.inv -= dt;
    if (this.barrier > 0) this.barrier -= dt;
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.shootAnimT > 0) this.shootAnimT -= dt;
    if (this.muzzleT > 0) this.muzzleT -= dt;
    if (this.bombT > 0) this.updateBomb(dt);
  }

  private kick(shake: number, stop = 0): void {
    this.shake = Math.max(this.shake, shake * settings.shake);
    if (stop > 0) this.hitstop = Math.max(this.hitstop, stop);
  }

  // ───────────── 플레이어 ─────────────
  private updatePlayer(dt: number): void {
    const prev = this.px;
    const prevY = this.py;
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
    const vy = (this.py - prevY) / Math.max(dt, 0.001);
    if (Math.abs(v) > 6 || Math.abs(vy) > 6) this.lastMoveT = this.t;
    if (this.charging) this.charge = Math.min(1.2, this.charge + dt);
  }

  private updateWeapons(dt: number): void {
    if (this.charging || this.bombT > 0.9) return;
    this.fireT -= dt;
    if (this.fireT > 0) return;
    this.fireT = 0.1;
    this.volley++;
    this.muzzleT = 0.09;
    const p = this.power;
    const x = this.px;
    const y = this.py - 15;
    const add = (dx: number, ang: number, dmg: number, lvl: number, sp = 330): void => {
      const b = this.newPB(x + dx, y, Math.sin(ang) * sp, -Math.cos(ang) * sp, 3, dmg, 'shot');
      b.lvl = lvl;
    };
    if (p === 1) add(0, 0, 1.3, 1);
    else if (p === 2) { add(-4, 0, 1.15, 2); add(4, 0, 1.15, 2); }
    else if (p === 3) { add(0, 0, 1.5, 3); add(-5, -0.15, 1.0, 2); add(5, 0.15, 1.0, 2); }
    else {
      add(-3.5, 0, 1.35, 3); add(3.5, 0, 1.35, 3); add(-7, -0.22, 1.0, 2); add(7, 0.22, 1.0, 2);
      if (this.volley % 2 === 0) for (const s of [-1, 1]) {
        const b = this.newPB(x + s * 9, y + 2, s * 150, -250, 5, 1.2, 'wave', true, 0.9);
        b.lvl = 4;
      }
    }
    if (this.volley % 2 === 0) sfx(p >= 3 ? 'shotHeavy' : 'shot');
  }

  private releaseCharge(): void {
    const c = this.charge;
    this.charge = 0;
    if (c < 0.35 || this.over || this.paused) return;
    const f = Math.min(1, c / 1.0);
    const b = this.newPB(this.px, this.py - 22, 0, -240, 7 + f * 9, 10 + f * 28, 'charge', true, 1.8);
    b.scale = 0.55 + f * 0.6;
    this.shootAnimT = 0.34;
    this.chargeFlash = 0.22;
    this.kick(0.22 + f * 0.25);
    sfx('chargeShot', 0.7 + f * 0.3);
    buzz(25);
    this.addFx('ring', this.px, this.py - 22, 0.6 + f * 0.5, 0.28);
    for (let i = 0; i < 10; i++) this.part(this.px, this.py - 18, rand(-70, 70), rand(-90, -20), 0.4, i % 2 ? '#fff8d0' : '#ffe34a', 2, 0);
  }

  private hurtPlayer(): void {
    if (this.inv > 0 || this.bombT > 0 || this.over || this.barrier > 0) return;
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
    this.kick(0.55, 0.06);
    this.flashWhite = 0.25;
    this.combo = 0;
    this.power = Math.max(1, this.power - 1);
    sfx('playerHit');
    buzz(70);
    this.pushHud();
    for (let i = 0; i < 16; i++) this.part(this.px, this.py, rand(-90, 90), rand(-90, 90), 0.6, i % 2 ? '#fff' : '#ff6f9f', 2, 80);
    // 근처 탄 정리 (연속 피격 방지)
    for (const b of this.eb) if ((b.x - this.px) ** 2 + (b.y - this.py) ** 2 < 45 * 45) b.alive = false;
    if (this.hp <= 0) this.finish(false);
  }

  /** 황금 익룡의 포효: 화면 전체 금빛 충격파 (적 탄 소거 + 광역 피해) */
  private updateBomb(dt: number): void {
    if (this.sp && this.sp.id === 'gona' && this.sp.t < this.sp.cut) return; // 컷인 동안은 대기
    this.bombT -= dt;
    const k = 1 - this.bombT / BOMB_T;
    const rr = k * 420;
    for (const b of this.eb) {
      if (b.alive && (b.x - this.px) ** 2 + (b.y - this.py) ** 2 < rr * rr) {
        b.alive = false;
        this.starFrom(b.x, b.y);
      }
    }
    if (!this.bombHit) {
      this.bombHit = true;
      this.flashGold = 0.9;
      this.kick(0.8, 0.07);
      for (const e of this.en) this.damage(e, e.kind === 'boss' ? 26 : 14, 'bomb', e.x, e.y);
      this.addFx('ring', this.px, this.py, 2.2, 0.5);
    }
    if (Math.random() < 0.7) this.part(rand(0, W), rand(0, H), rand(-20, 20), rand(-160, -60), 0.8, Math.random() < 0.5 ? '#ffe34a' : '#fff8d0', 2, 0);
  }

  // ───────────── 동료 ─────────────
  private updateCompanion(dt: number): void {
    const side = this.px > W - 56 ? -1 : 1;
    const tx = this.px + side * 32;
    const ty = this.py + 10 + Math.sin(this.t * 3) * 2;
    this.cx += (tx - this.cx) * Math.min(1, dt * 7);
    this.cy += (ty - this.cy) * Math.min(1, dt * 7);
    this.cKick = Math.max(0, this.cKick - dt * 4);
    if (this.bombT > 0.9 || this.sp) return;
    this.cCd -= dt;
    const f = this.fam;
    if (f === 'halabeoji') {
      if (this.shield > 0) this.shield -= dt;
      this.cN += dt;
      if (this.cN > 1.1) {
        this.cN = 0;
        this.newPB(this.cx + 4, this.cy - 16, 0, -240, 3, 2.6, 'lance', true, 1.4);
        sfx('compShot', 0.8, 0.8);
      }
      if (this.shield <= 0 && this.cCd <= 0) {
        this.shield = 6;
        this.cCd = 99;
        this.cKick = 1;
        sfx('shield');
        this.floatText(this.cx, this.cy - 30, 'SHIELD', '#cdefff');
      }
      if (this.shield <= 0 && this.cCd > 50) this.cCd = 7;
      return;
    }
    if (this.cCd > 0) return;
    this.cKick = 1;
    if (f === 'mom') {
      this.cN++;
      const n = this.cN % 3 === 0 ? 16 : 10;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + this.t;
        this.newPB(this.cx, this.cy - 10, Math.cos(a) * 100, Math.sin(a) * 100, 4, 2.4, 'heart', true, 1.25);
      }
      sfx('compShot', 1, 1.2);
      this.cCd = 1.45;
    } else if (f === 'dad') {
      this.beams.push({ follow: true, x: this.cx, t: 0.6, max: 0.6, tick: 0, wide: false });
      sfx('beam', 0.6);
      this.kick(0.15);
      this.cCd = 2.5;
    } else if (f === 'imo') {
      this.cN++;
      for (const s of [-1, 1]) {
        const a = -Math.PI / 2 + s * 0.7;
        const b = this.newPB(this.cx, this.cy - 14, Math.cos(a) * 130, Math.sin(a) * 130, 3.5, 1.7, 'star', false, 2.4);
        b.homing = 5.5;
      }
      if (this.cN % 2) sfx('compShot', 0.7, 1.4);
      this.cCd = 0.5;
    } else if (f === 'samchon') {
      for (const sd of [-1, 1]) {
        const a = -Math.PI / 2 + sd * 0.35;
        const b = this.newPB(this.cx + sd * 6, this.cy - 12, Math.cos(a) * 170, Math.sin(a) * 170, 3, 1.5, 'elec', false, 1.8);
        b.homing = 5.5;
      }
      sfx('compShot', 0.6, 0.9);
      this.cCd = 0.62;
    } else if (f === 'halmeoni') {
      this.cN++;
      this.newPB(this.cx, this.cy - 14, rand(-12, 12), -150, 4, 3.2, 'potion', false, 1.6);
      sfx('compShot', 0.7, 0.7);
      this.cCd = 1.1;
      if (this.cN % 7 === 0 && this.hp < MAX_HP) {
        this.hp++;
        this.pushHud();
        sfx('heal');
        this.floatText(this.px, this.py - 26, 'HP +1', '#ff9ec0');
        for (let i = 0; i < 14; i++) this.part(this.px + rand(-12, 12), this.py + rand(-10, 14), rand(-10, 10), rand(-50, -20), 0.9, '#ff9ec0', 2, 0);
      }
    }
  }

  // ───────────── 필살기 ─────────────
  private updateSpecial(dt: number): void {
    const s = this.sp;
    if (!s) return;
    if (s.t < s.cut) return; // 컷인 진행은 loop 에서 (슬로모션)
    if (s.id === 'gona') {
      // 포효 연출은 updateBomb 이 담당 — 여기서는 끝나는 시점만
      s.t += dt;
      if (this.bombT <= 0) this.sp = null;
      return;
    }
    const first = !s.init;
    s.init = true;
    const prevT = first ? s.cut - 1e-6 : s.t;
    s.t += dt;
    const e = s.t - s.cut; // 발동 후 경과
    const pe = prevT - s.cut;
    const every = (sec: number, off = 0): boolean => Math.floor((e - off) / sec) !== Math.floor((pe - off) / sec) && e >= off;
    const cx = this.cx;
    const cy = this.cy;
    switch (s.id) {
      case 'mom':
        // 하트 스톰: 거대한 하트 마법진 + 유도 하트 파상 공격
        if (every(0.28)) {
          s.n++;
          const n = 14;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * TAU + s.n * 0.3;
            const b = this.newPB(this.px + Math.cos(a) * 30, this.py + Math.sin(a) * 30, Math.cos(a) * 90, Math.sin(a) * 90 - 40, 5, 3.0, 'heart', false, 2.2);
            b.homing = 7;
            b.scale = 1.5;
          }
          sfx('compShot', 1, 1.3);
        }
        break;
      case 'dad':
        // 스팀 브레이커: 굵은 증기 레이저 (탄 소거 + 고속 다단 피해)
        if (first) {
          this.beams.push({ follow: true, x: cx, t: s.dur, max: s.dur, tick: 0, wide: true });
          this.kick(0.35);
        }
        this.shake = Math.max(this.shake, 0.12 * settings.shake);
        if (every(0.12)) {
          this.addFx('puff', cx + rand(-22, 22), rand(40, cy - 20), 0.9, 0.5, 20);
        }
        break;
      case 'imo':
        // 스타 캐논 버스트: 별빛 유도탄 대량 발사
        if (every(0.1)) {
          for (let i = 0; i < 5; i++) {
            const a = -Math.PI / 2 + (i - 2) * 0.32 + rand(-0.08, 0.08);
            const b = this.newPB(cx, cy - 14, Math.cos(a) * 200, Math.sin(a) * 200, 4, 2.6, 'star', false, 2.2);
            b.homing = 9;
            b.scale = 1.3;
          }
          sfx('compShot', 0.8, 1.6);
        }
        break;
      case 'halmeoni':
        // 골든 힐링: 즉시 체력 2 회복 + 5초 보호막 + 주변 탄 정화
        if (first) {
          const heal = Math.max(0, Math.min(2, MAX_HP - this.hp));
          this.hp += heal;
          this.barrier = 5;
          this.pushHud();
          sfx('heal');
          this.floatText(this.px, this.py - 30, heal > 0 ? `HP +${heal}` : 'BARRIER', '#ffe34a');
          for (const b of this.eb) if (b.alive && (b.x - this.px) ** 2 + (b.y - this.py) ** 2 < 90 * 90) { b.alive = false; this.starFrom(b.x, b.y); }
          this.flashGold = 0.5;
        }
        if (every(0.08)) this.part(this.px + rand(-22, 22), this.py + rand(-6, 20), 0, rand(-70, -30), 0.8, Math.random() < 0.5 ? '#ffe34a' : '#fff8d0', 2, 0);
        break;
      case 'halabeoji':
        // 가디언 실드: 방패벽이 적 탄을 막고 은빛 창으로 되돌려 반격
        if (first) {
          for (let i = 0; i < 9; i++) this.newPB(this.px - 40 + i * 10, this.py - 30, 0, -260, 3, 3, 'lance', true, 1.4);
          this.kick(0.3);
        }
        break;
      case 'samchon':
        // 메가 인벤션: 거대 발명 메카가 미사일 연사 → 마지막에 드릴 돌진
        if (e < 2.3 && every(0.13)) {
          for (const sd of [-1, 1]) {
            const b = this.newPB(this.px + sd * 26, this.py - 52, sd * 60, -120, 4, 3.4, 'missile', false, 2.4);
            b.homing = 8;
          }
          sfx('compShot', 0.8, 0.6);
        }
        if (pe < 2.3 && e >= 2.3) {
          const b = this.newPB(this.px, this.py - 50, 0, -320, 26, 40, 'drill', true, 1.6);
          b.scale = 1;
          this.kick(0.4);
          sfx('boomM');
        }
        break;
    }
    if (s.t >= s.cut + s.dur) this.sp = null;
  }

  // ───────────── 적 ─────────────
  private spawnBoss(): void {
    this.bossSpawned = true;
    const e: Enemy = { id: this.nextId++, kind: 'boss', pat: 'boss', x: W / 2, y: -40, x0: W / 2, vx: 0, vy: 0, hp: 460, max: 460, age: 0, flash: 0, fire: 0, dir: 1, hr: 30, score: 5000, dead: false, ph: 0, burst: 0 };
    this.en.push(e);
    this.boss = e;
    this.bs = { mode: 'enter', atk: '', at: 0, rest: 1, last: '', phase: 1, n: 0, tx: W / 2, sub: 0, minion: 5, dyingT: 0 };
    playBgm('boss', 0.2, 0.5);
  }

  private updateEnemies(dt: number): void {
    for (const e of this.en) {
      e.age += dt;
      if (e.flash > 0) e.flash -= dt;
      if (e.kind === 'boss') {
        this.updateBoss(e, dt);
        continue;
      }
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
              const a = Math.atan2(this.py - e.y, this.px - e.x);
              e.vx = Math.cos(a) * 104;
              e.vy = Math.sin(a) * 104;
            }
            e.x += e.vx * dt;
            e.y += e.vy * dt;
          }
          break;
        }
        case 'orb':
          if (e.age < 7) e.y += (64 + e.dir * 6 - e.y) * Math.min(1, dt * 1.5);
          else e.y -= 50 * dt;
          e.x = e.x0 + Math.sin(e.age * 1.2 + e.ph) * 8;
          break;
        case 'uncle':
          if (e.y < 62) e.y += 26 * dt;
          else {
            e.y += 3 * dt;
            e.x += Math.sin(e.age * 0.9) * 22 * dt * e.dir;
          }
          if (e.age > 16) e.y -= 60 * dt;
          break;
        default:
          break;
      }
      if (e.y > 6 && e.y < H - 90 && this.bombT <= 0 && !this.over) {
        e.fire -= dt;
        if (e.fire <= 0) {
          const aim = Math.atan2(this.py - e.y, this.px - e.x);
          if (e.kind === 'glasses' && e.pat === 'sine') {
            for (let i = -1; i <= 1; i++) this.newEB(e.x, e.y + 6, Math.cos(aim + i * 0.22) * 64, Math.sin(aim + i * 0.22) * 64, 3.5, 'flask');
            e.fire = rand(2.0, 3.0);
          } else if (e.kind === 'glasses' && e.pat === 'strafe') {
            for (let k = 0; k < 2; k++) this.newEB(e.x - k * e.dir * 4, e.y + 4, Math.cos(aim) * 96, Math.sin(aim) * 96, 2.6, 'needle', -k * 0.08);
            e.fire = rand(1.4, 2.0);
          } else if (e.kind === 'glasses' && e.pat === 'dive') {
            if (e.burst === 0 && e.age > 0.6) {
              e.burst = 1;
              this.newEB(e.x, e.y + 6, Math.cos(aim) * 70, Math.sin(aim) * 70, 4, 'fire');
            }
            e.fire = 0.2;
          } else if (e.kind === 'orb') {
            e.burst++;
            const n = 12;
            for (let i = 0; i < n; i++) {
              const a = (i / n) * TAU + e.burst * 0.26;
              this.newEB(e.x, e.y + 2, Math.cos(a) * 46, Math.sin(a) * 46, 3.5, 'ring');
            }
            e.fire = e.age < 7 ? 1.6 : 99;
          } else if (e.kind === 'uncle') {
            e.burst++;
            if (e.burst % 2) {
              const n = 10;
              for (let i = 0; i < n; i++) {
                const a = (i / n) * TAU + e.burst * 0.31;
                this.newEB(e.x, e.y + 4, Math.cos(a) * 40, Math.sin(a) * 40 + 8, 4.5, 'smell');
              }
            } else {
              for (const sd of [-1, 1]) for (let i = -1; i <= 1; i++) this.newEB(e.x + sd * 18, e.y + 6, Math.cos(aim + i * 0.16) * 82, Math.sin(aim + i * 0.16) * 82, 2.6, 'needle');
            }
            e.fire = 1.5;
          } else e.fire = 9;
        }
      }
      if (e.x < -40 || e.x > W + 40 || e.y > H + 30 || e.y < -60) e.dead = true;
    }
    compact(this.en, (e) => !e.dead);
  }

  private bossSay(text: string, col = '#ff9ec0'): void {
    this.banner = { text, t: 1.3, col };
  }

  private updateBoss(e: Enemy, dt: number): void {
    const b = this.bs!;
    const frac = e.hp / e.max;
    if (b.mode === 'dying') {
      b.dyingT += dt;
      // 대형 연쇄 폭발: 점점 잦아지고 커짐
      const rate = 0.25 + b.dyingT * 0.18;
      if (Math.random() < rate) this.addBoom(e.x + rand(-42, 42), e.y + rand(-42, 42), rand(0.6, 1.0 + b.dyingT * 0.2), 0);
      if (Math.random() < 0.18) this.debris(e.x + rand(-30, 30), e.y + rand(-30, 30), 4, ['#c02040', '#d8a040', '#5a5a66']);
      if (Math.random() < 0.08) this.addFx('ring', e.x + rand(-30, 30), e.y + rand(-30, 30), rand(0.6, 1.1), 0.3);
      this.shake = Math.max(this.shake, 0.2 * settings.shake);
      if (b.dyingT > 2.6) {
        e.dead = true;
        this.boss = null;
        this.score += 5000;
        for (let i = 0; i < 40; i++) {
          const a = (i / 40) * TAU;
          this.part(e.x, e.y, Math.cos(a) * rand(60, 200), Math.sin(a) * rand(60, 200), 1.2, i % 3 ? '#ffb040' : '#fff8d0', 3, 0);
        }
        this.flashWhite = 1;
        this.kick(1, 0.14);
        for (let i = 0; i < 8; i++) this.addBoom(e.x + rand(-48, 48), e.y + rand(-48, 48), rand(1.1, 1.7), i * 0.06);
        this.addFx('ring', e.x, e.y, 2.6, 0.5);
        this.addFx('ring', e.x, e.y, 1.6, 0.4);
        this.debris(e.x, e.y, 40, ['#c02040', '#d8a040', '#5a5a66', '#ff9ec0']);
        sfx('boomL');
        buzz([90, 40, 140], 0);
        for (let i = 0; i < 8; i++) this.items.push({ x: e.x + rand(-30, 30), y: e.y + rand(-20, 10), kind: i % 3 === 0 ? 'strawberry' : 'cookie', age: 0, alive: true });
        this.finish(true);
      }
      return;
    }
    const phase: 1 | 2 | 3 = frac > 0.66 ? 1 : frac > 0.33 ? 2 : 3;
    if (phase > b.phase && b.mode !== 'enter') {
      b.phase = phase;
      b.mode = 'idle';
      b.rest = 1.4;
      b.atk = '';
      for (const q of this.eb) { this.starFrom(q.x, q.y); q.alive = false; }
      sfx('warn');
      sfx('boomM');
      this.kick(0.6, 0.09);
      this.addFx('ring', e.x, e.y, 1.8, 0.4);
      for (let i = 0; i < 4; i++) this.addBoom(e.x + rand(-30, 30), e.y + rand(-20, 30), 0.8, i * 0.08);
      this.bossSay(phase === 2 ? '뽀뽀괴물이 화났다!' : '뽀뽀괴물 폭주!!', '#ff7a8a');
    }
    const fast = b.phase === 3 ? 1.25 : 1;
    if (b.mode === 'enter') {
      e.y += (88 - e.y) * Math.min(1, dt * 1.6) + 10 * dt;
      if (e.y > 84) {
        b.mode = 'idle';
        b.rest = 1;
        this.bossSay('뽀뽀괴물 등장!', '#ff9ec0');
      }
      return;
    }
    if (b.mode === 'idle') {
      e.x = W / 2 + Math.sin(e.age * 0.9) * 50;
      e.y += (88 + Math.sin(e.age * 1.7) * 5 - e.y) * Math.min(1, dt * 4);
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
            this.newEB(e.x, e.y + 10, Math.cos(a) * 66, Math.sin(a) * 66, 3.5, 'heart');
          }
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
            this.newEB(e.x, e.y + 4, Math.cos(a) * 50, Math.sin(a) * 50, 3, 'wave');
          }
        }
        if (b.at > 3.4) done(1.0);
        break;
      }
      case 'dash': {
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
            this.kick(0.5);
            sfx('bossHit', 1.2, 0.7);
            for (let i = 0; i < 14; i++) {
              const a = (i / 14) * TAU;
              this.newEB(e.x, e.y, Math.cos(a) * 58, Math.sin(a) * 58 - 14, 3.5, 'heart');
            }
          }
          e.y += (88 - e.y) * Math.min(1, dt * 2.4);
        } else {
          e.y = 88;
          done(0.8);
        }
        break;
      }
      case 'rain': {
        b.sub -= dt;
        if (b.sub <= 0) {
          b.sub = 0.16;
          this.newEB(rand(8, W - 8), -4, rand(-6, 6), rand(60, 85), 3.5, 'heart');
          this.newEB(e.x, e.y + 12, rand(-30, 30), 52, 3.5, 'heart');
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
            this.newEB(e.x, e.y + 6, Math.cos(a) * (46 + b.n * 8), Math.sin(a) * (46 + b.n * 8), 3.5, 'heart');
          }
          b.n++;
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
      if (e.kind === 'boss' && this.bs && (this.bs.mode === 'enter' || this.bs.mode === 'dying')) continue;
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
      b.age += dt;
      if (b.kind === 'elec') b.x += Math.sin(b.life * 40) * 1.2;
      if (b.homing > 0) {
        const tgt = this.nearestEnemy(b.x, b.y);
        if (tgt) {
          const sp = Math.hypot(b.vx, b.vy);
          const want = Math.atan2(tgt.y - b.y, tgt.x - b.x);
          const cur = Math.atan2(b.vy, b.vx);
          let d = want - cur;
          while (d > Math.PI) d -= TAU;
          while (d < -Math.PI) d += TAU;
          const na = cur + clamp(d, -b.homing * dt, b.homing * dt);
          const ns = Math.min(240, sp + 160 * dt);
          b.vx = Math.cos(na) * ns;
          b.vy = Math.sin(na) * ns;
        }
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.y < -40 || b.y > H + 30 || b.x < -30 || b.x > W + 30) b.alive = false;
    }
    compact(this.pb, (b) => b.alive, this.pbPool);
    // 할아버지 가디언 실드: 방패벽에 닿은 적 탄 → 은빛 반격탄
    const guard = this.sp && this.sp.id === 'halabeoji' && this.sp.t >= this.sp.cut;
    const gx = this.px;
    const gy = this.py - 6;
    for (const b of this.eb) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.age += dt;
      if (b.x < -20 || b.x > W + 20 || b.y < -24 || b.y > H + 20) b.alive = false;
      else if (guard) {
        const d2 = (b.x - gx) ** 2 + (b.y - gy) ** 2;
        if (d2 < 34 * 34 && b.y < gy + 4) {
          b.alive = false;
          this.newPB(b.x, b.y, 0, -280, 3, 3, 'refl', false, 1.2);
          this.addFx('spark', b.x, b.y, 0.7, 0.16);
          sfx('shield', 0.4);
        }
      }
    }
    compact(this.eb, (b) => b.alive, this.ebPool);
    for (const bm of this.beams) {
      bm.t -= dt;
      if (bm.follow) bm.x = this.cx;
      bm.tick -= dt;
      if (bm.tick <= 0) {
        bm.tick = 0.07;
        const half = bm.wide ? 15 : 7;
        for (const e of this.en) if (!e.dead && e.y > 0 && Math.abs(e.x - bm.x) < half + e.hr && e.y < this.cy) this.damage(e, bm.wide ? 6 : 4.2, 'beam', bm.x, e.y + e.hr * 0.6);
        for (const q of this.eb) {
          if (q.alive && Math.abs(q.x - bm.x) < half + 2 + q.r && q.y < this.cy) {
            q.alive = false;
            this.starFrom(q.x, q.y);
          }
        }
      }
    }
    compact(this.beams, (b) => b.t > 0);
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
        it.alive = false;
        this.addGauge(0.04);
        if (it.kind === 'cookie') {
          sfx('item');
          this.addScore(300, it.x, it.y);
        } else if (it.kind === 'strawberry') {
          sfx('heal');
          if (this.hp < MAX_HP) {
            this.hp++;
            this.pushHud();
            this.floatText(this.px, this.py - 24, 'HP +1', '#ff9ec0');
          } else this.addScore(500, this.px, this.py - 20);
        } else if (it.kind === 'banana') {
          sfx('item');
          this.bombs = Math.min(5, this.bombs + 1);
          this.pushHud();
          this.floatText(this.px, this.py - 24, 'BOMB +1', '#ffe34a');
        } else {
          sfx('powerUp');
          if (this.power < 4) {
            this.power++;
            this.floatText(this.px, this.py - 24, `POWER UP! Lv${this.power}`, '#58e0ff');
          } else this.addScore(1000, this.px, this.py - 20);
        }
      }
      if (it.y > H + 12) it.alive = false;
    }
    compact(this.items, (i) => i.alive);
  }

  private updateFx(dt: number): void {
    for (const p of this.parts) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.g * dt;
      p.life -= dt;
    }
    compact(this.parts, (p) => p.life > 0, this.partPool);
    for (const b of this.booms) b.age += dt;
    compact(this.booms, (b) => b.age < b.delay + 0.5);
    for (const f of this.fx) {
      f.age += dt;
      f.y += f.vy * dt;
    }
    compact(this.fx, (f) => f.age < f.dur);
    if (this.chargeFlash > 0) this.chargeFlash -= dt;
    for (const f of this.floats) {
      f.age += dt;
      f.y -= 22 * dt;
    }
    compact(this.floats, (f) => f.age < 0.9);
  }

  /** 다단계 폭발 (fx-explosion 4프레임) */
  private addBoom(x: number, y: number, scale: number, delay: number): void {
    if (this.booms.length >= CAP.booms) return;
    this.booms.push({ x, y, age: 0, delay, scale });
  }
  private debris(x: number, y: number, n: number, col: string[]): void {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const sp = rand(40, 130);
      this.part(x, y, Math.cos(a) * sp, Math.sin(a) * sp - 30, rand(0.6, 1.1), col[i % col.length], Math.random() < 0.4 ? 3 : 2, 180);
    }
  }
  private floatText(x: number, y: number, text: string, col: string): void {
    if (this.floats.length >= CAP.floats) this.floats.shift();
    this.floats.push({ x, y, text, age: 0, col });
  }
  private starFrom(x: number, y: number): void {
    this.addScore(10, x, y, true);
    if (Math.random() < 0.4) this.part(x, y, rand(-20, 20), rand(-40, -10), 0.4, '#ffe34a', 2, 0);
  }
  private addScore(v: number, x: number, y: number, quiet = false): void {
    const mult = Math.min(5, 1 + Math.floor(this.combo / 5));
    const add = v * mult;
    this.score += add;
    if (!quiet) this.floatText(x, y, `${add}`, '#fff7dc');
  }

  /** 피해 처리. src: 맞힌 탄 종류(이펙트·소리 결정), hx/hy: 맞은 위치 */
  private damage(e: Enemy, dmg: number, src: PKind | 'bomb' | 'beam' | 'body', hx: number, hy: number): void {
    if (e.dead || e.y < -6) return;
    const strong = src === 'charge' || src === 'drill';
    if (e.kind === 'boss') {
      const b = this.bs!;
      if (b.mode === 'enter' || b.mode === 'dying') return;
      const weak = (hx - e.x - WEAK.dx) ** 2 + (hy - e.y - WEAK.dy) ** 2 < WEAK.r * WEAK.r;
      if (weak) {
        dmg *= 1.5;
        this.addFx('weak', hx, hy, strong ? 1.4 : 0.8, 0.22);
        sfx('bossWeak');
      } else {
        this.addFx('metal', hx, hy, strong ? 1.5 : 0.9, 0.24);
        sfx('bossHit');
      }
      if (strong) {
        this.kick(0.35, 0.06);
        this.addFx('ring', hx, hy, 1.0, 0.28);
        buzz(30);
      }
    } else if (src !== 'bomb') {
      this.addFx('spark', hx, hy, strong ? 1.4 : 0.8, 0.18);
      sfx('enemyHit');
      if (strong) this.kick(0.2, 0.04);
    }
    e.hp -= dmg;
    e.flash = 0.06;
    this.addGauge(dmg * (e.kind === 'boss' ? 0.0022 : 0.003));
    if (e.hp > 0) return;
    if (e.kind === 'boss') {
      if (this.bs!.mode !== 'dying') {
        e.hp = 0;
        this.bs!.mode = 'dying';
        this.bs!.dyingT = 0;
        for (const q of this.eb) { this.starFrom(q.x, q.y); q.alive = false; }
        sfx('bossBreak');
        stopBgm(1.0);
        this.bossSay('뽀뽀괴물을 물리쳤다!', '#ffe34a');
        this.kick(1, 0.12);
        this.flashWhite = 0.6;
        buzz([60, 40, 60], 0);
      }
      return;
    }
    e.dead = true;
    this.combo++;
    this.comboT = 2.2;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.addScore(e.score, e.x, e.y - 8);
    this.addGauge(e.kind === 'uncle' ? 0.06 : 0.02);
    if (e.kind === 'uncle') {
      for (let i = 0; i < 5; i++) this.addBoom(e.x + rand(-18, 18), e.y + rand(-14, 14), rand(0.5, 0.8), i * 0.09);
      this.addBoom(e.x, e.y, 1.0, 0.45);
      this.addFx('ring', e.x, e.y, 1.1, 0.32);
      this.debris(e.x, e.y, 18, ['#8a6a3a', '#5a5a66', '#d8a040', '#3a2a2a']);
      this.kick(0.4, 0.05);
      sfx('boomM');
      buzz(35);
    } else if (e.kind === 'orb') {
      this.addBoom(e.x, e.y, 0.7, 0);
      this.addBoom(e.x + rand(-6, 6), e.y + rand(-6, 6), 0.5, 0.12);
      this.debris(e.x, e.y, 10, ['#c080ff', '#d8a040', '#5a3a8a']);
      sfx('boomM', 0.7);
      buzz(15);
    } else {
      this.addBoom(e.x, e.y, 0.55, 0);
      this.debris(e.x, e.y, 5, ['#d8a040', '#5a5a66']);
      sfx('boomS');
    }
    const r = Math.random();
    const drop = (kind: Item['kind'], dx = 0): void => void this.items.push({ x: e.x + dx, y: e.y, kind, age: 0, alive: true });
    if (e.kind === 'uncle') {
      drop('star');
      if (r < 0.5) drop('strawberry', 8);
    } else if (r < 0.1) drop('star');
    else if (r < 0.2) drop('cookie');
    else if (r < 0.24) drop('banana');
  }

  // ───────────── 충돌 ─────────────
  private collide(): void {
    for (const b of this.pb) {
      if (!b.alive) continue;
      for (const e of this.en) {
        if (e.dead) continue;
        if (b.pierce && b.hits.includes(e.id)) continue;
        const rr = b.r + e.hr;
        if ((b.x - e.x) ** 2 + (b.y - e.y) ** 2 < rr * rr) {
          // 맞은 지점: 탄 위치를 적 외곽 쪽으로
          const hy = Math.max(b.y, e.y - e.hr * 0.7);
          this.damage(e, b.dmg, b.kind, b.x, hy);
          if (b.kind === 'potion') {
            for (const o of this.en) if (o !== e && (o.x - b.x) ** 2 + (o.y - b.y) ** 2 < 26 * 26) this.damage(o, 2, 'potion', o.x, o.y);
            this.addBoom(b.x, b.y, 0.35, 0);
          }
          if (b.pierce) b.hits.push(e.id);
          else {
            b.alive = false;
            break;
          }
        }
      }
      if (b.kind === 'charge' || b.kind === 'drill') {
        for (const q of this.eb) {
          if (q.alive && (q.x - b.x) ** 2 + (q.y - b.y) ** 2 < (b.r + q.r) ** 2) {
            q.alive = false;
            this.starFrom(q.x, q.y);
          }
        }
      }
    }
    compact(this.en, (e) => !e.dead);
    const hx = this.px;
    const hy = this.py + 2;
    for (const q of this.eb) {
      if (q.alive && q.age >= 0 && (q.x - hx) ** 2 + (q.y - hy) ** 2 < (q.r + 2.2) ** 2) {
        q.alive = false;
        if (this.barrier > 0) this.starFrom(q.x, q.y);
        else this.hurtPlayer();
      }
    }
    for (const e of this.en) {
      if (e.dead || e.y < 0) continue;
      if (e.kind === 'boss' && this.bs && (this.bs.mode === 'dying' || this.bs.mode === 'enter')) continue;
      if ((e.x - hx) ** 2 + (e.y - hy) ** 2 < (e.hr * 0.8 + 3) ** 2) {
        this.hurtPlayer();
        if (e.kind !== 'boss') this.damage(e, 99, 'body', e.x, e.y);
      }
    }
  }

  private finish(won: boolean): void {
    if (this.over) return;
    this.over = true;
    this.overWon = won;
    this.setCharging(false);
    this.endT = 0;
    if (!won) {
      playBgm('over', 0.3);
      this.banner = { text: 'GAME OVER', t: 9, col: '#ff7a8a' };
      this.kick(0.8);
    } else {
      playBgm('clear', 0.3);
      this.banner = { text: 'STAGE CLEAR!', t: 9, col: '#ffe34a' };
    }
    const info: EndInfo = { won, score: this.score, time: this.t, maxCombo: this.maxCombo, hp: Math.max(0, this.hp) };
    window.setTimeout(() => this.alive && this.onEnd(info), won ? 3000 : 1800);
  }

  // ═════════════ 미리 굽기 ═════════════
  private mkCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    return [c, g];
  }
  /** 배경: 원경 대기색 + 탄막 가독성용 어둡게를 미리 합성 (예전엔 매 프레임 화면 전체 반투명 2장) */
  private bakeBackdrop(): HTMLCanvasElement {
    const [c, g] = this.mkCanvas(W * R, H * R);
    g.drawImage(this.a.v2['stage1/bg-backdrop'], 0, 0, W * R, H * R);
    g.fillStyle = 'rgba(40, 20, 70, 0.28)';
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = 'rgba(16, 8, 34, 0.22)';
    g.fillRect(0, 0, c.width, c.height);
    return c;
  }
  /** 배경 소품: 레이어 배율로 줄이고 같은 덮개 색을 미리 입힘 (알파는 그릴 때) */
  private propImg(name: V2Name, layer: number): HTMLCanvasElement {
    const key = `${name}|${layer}`;
    let c = this.propBaked.get(key);
    if (c) return c;
    const im = this.a.v2[name];
    const L = LAYER[layer];
    const [cc, g] = this.mkCanvas(im.width * L.k * R, im.height * L.k * R);
    g.imageSmoothingEnabled = true;
    g.drawImage(im, 0, 0, cc.width, cc.height);
    g.globalCompositeOperation = 'source-atop';
    if (layer === 0) {
      g.fillStyle = 'rgba(40, 20, 70, 0.28)';
      g.fillRect(0, 0, cc.width, cc.height);
    }
    g.fillStyle = 'rgba(16, 8, 34, 0.22)';
    g.fillRect(0, 0, cc.width, cc.height);
    c = cc;
    this.propBaked.set(key, c);
    return c;
  }
  /** 적 탄: 크기·각도별로 최종 픽셀 크기 그림을 한 번만 만듦 (회전·확대를 매 프레임 하지 않음) */
  private ebSprite(look: BulletLook, r: number, ang: number, pulse: number): HTMLCanvasElement {
    const rot = look === 'needle' || look === 'fireball';
    const ai = rot ? (Math.round(((ang + TAU) % TAU) / (TAU / 16)) % 16) : 0;
    const key = `${look}|${r}|${ai}|${pulse}`;
    let c = this.ebImg.get(key);
    if (c) return c;
    const src = bulletLooks()[look];
    const k = ((r * 2 + 2.5) / Math.max(src.width, src.height)) * (look === 'needle' ? 1.6 : 1) * R;
    const w = src.width * k;
    const h = src.height * k;
    const s = Math.ceil(Math.hypot(w, h)) + 2;
    const [cc, g] = this.mkCanvas(s, s);
    g.translate(s / 2, s / 2);
    if (rot) g.rotate(ai * (TAU / 16) - Math.PI / 2);
    g.drawImage(src, -w / 2, -h / 2, w, h);
    if (pulse) {
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(-w / 4, -h / 4, w / 2, h / 2);
    }
    this.ebImg.set(key, cc);
    return cc;
  }
  /** 플레이어 탄 회전본 (16방향) */
  private pbSprite(name: V2Name, ang: number, frame = 0, frames = 1): HTMLCanvasElement {
    const ai = Math.round(((ang + TAU) % TAU) / (TAU / 16)) % 16;
    const key = `${name}|${ai}|${frame}`;
    let c = this.pbImg.get(key);
    if (c) return c;
    const im = this.a.v2[name];
    const fw = im.width / frames;
    const s = Math.ceil(Math.hypot(fw, im.height)) + 2;
    const [cc, g] = this.mkCanvas(s, s);
    g.translate(s / 2, s / 2);
    g.rotate(ai * (TAU / 16));
    g.drawImage(im, frame * fw, 0, fw, im.height, -fw / 2, -im.height / 2, fw, im.height);
    this.pbImg.set(key, cc);
    return cc;
  }

  // ═════════════ 그리기 ═════════════
  /** 캔버스 픽셀 그대로(1:1) 그리기 — (x,y)는 논리 좌표의 중심 */
  private blit(c: HTMLCanvasElement | HTMLImageElement, x: number, y: number): void {
    this.g.drawImage(c, Math.round(x * R - c.width / 2) / R, Math.round(y * R - c.height / 2) / R, c.width / R, c.height / R);
  }
  /** 스프라이트 시트의 프레임 하나를 배율 k 로 (2배 격자 → 논리 0.5) */
  private frame(im: HTMLImageElement, fi: number, frames: number, x: number, y: number, k = 1): void {
    const fw = im.width / frames;
    const w = (fw * k) / R;
    const h = (im.height * k) / R;
    this.g.drawImage(im, fi * fw, 0, fw, im.height, x - w / 2, y - h / 2, w, h);
  }

  private draw(): void {
    const g = this.g;
    g.setTransform(R, 0, 0, R, 0, 0);
    g.imageSmoothingEnabled = false;
    g.globalAlpha = 1;
    const sh = this.shake;
    const ox = sh > 0.01 ? Math.round(rand(-3, 3) * sh) : 0;
    const oy = sh > 0.01 ? Math.round(rand(-3, 3) * sh) : 0;
    g.setTransform(R, 0, 0, R, ox * R, oy * R);

    this.drawStage1();
    for (const it of this.items) this.drawItem(it.kind, it.x, it.y + Math.round(Math.sin(it.age * 6)), it.age);
    for (const e of this.en) this.drawEnemy(e);
    this.drawBeams();
    this.drawSpecialUnder();

    // 내 탄 — 살짝 투명하게 (적 탄이 항상 더 또렷하게 보이도록)
    g.globalAlpha = 0.88;
    for (const b of this.pb) this.drawPBullet(b);
    g.globalAlpha = 1;

    this.drawCompanion();
    this.drawGona();
    this.drawSpecialOver();

    // 폭발·이펙트
    const boomImg = this.a.v2['stage1/fx-explosion'];
    for (const b of this.booms) {
      const t = b.age - b.delay;
      if (t < 0) continue;
      this.frame(boomImg, Math.min(3, Math.floor(t / 0.12)), 4, b.x, b.y, b.scale);
    }
    for (const f of this.fx) this.drawFx(f);
    let lastA = -1;
    for (const p of this.parts) {
      const a = p.life / p.max > 0.5 ? 1 : 0.6;
      if (a !== lastA) { g.globalAlpha = a; lastA = a; }
      g.fillStyle = p.col;
      g.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
    }
    g.globalAlpha = 1;

    // 적 탄 — 맨 위 (고나·동료·이펙트에 가려지지 않게)
    for (const b of this.eb) this.drawEBullet(b);
    this.drawHitDot();
    for (const f of this.floats) {
      const im = textImg(f.text, f.col, 11);
      this.blit(im, f.x, f.y);
    }

    g.setTransform(R, 0, 0, R, 0, 0);
    this.drawWarning();
    this.drawCutin();
    this.drawHud();
    if (this.flashWhite > 0.02) {
      g.globalAlpha = Math.min(0.8, this.flashWhite);
      g.fillStyle = '#fff';
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 1;
    }
    if (this.flashGold > 0.02) {
      g.globalAlpha = Math.min(0.55, this.flashGold * 0.6);
      g.fillStyle = '#ffd860';
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 1;
    }
    if (this.over) {
      g.globalAlpha = Math.min(0.5, this.endT * 0.5);
      g.fillStyle = this.overWon ? '#fff7dc' : '#3b1b3b';
      g.fillRect(0, 0, W, H);
      g.globalAlpha = 1;
    }
    this.drawBanner();
    if (settings.perf) this.drawPerf();
  }

  // ───────────── 스테이지 1 배경 ─────────────
  private spawnProp(entry: [number, V2Name, number, number, number], y?: number): void {
    const [, name, layer, fx, vx] = entry;
    const im = this.propImg(name, layer);
    const L = LAYER[layer];
    this.props.push({ name, x: fx * W, y: y ?? -im.height / R / 2 - 4, v: L.v, layer, vx });
  }
  private updateProps(dt: number): void {
    if (this.propIdx === 0 && this.propLoop === 0 && this.props.length === 0) {
      this.spawnProp(STAGE1_PROPS[0], 70);
      this.spawnProp(STAGE1_PROPS[1], 20);
      this.spawnProp([0, 'stage1/island-small', 0, 0.82, 0], 190);
      this.spawnProp([0, 'stage1/cloud-big', 2, 0.9, 0], 250);
    }
    const tt = this.t - this.propLoop * 60;
    while (this.propIdx < STAGE1_PROPS.length && STAGE1_PROPS[this.propIdx][0] <= tt) this.spawnProp(STAGE1_PROPS[this.propIdx++]);
    if (tt >= 60) { this.propLoop++; this.propIdx = 0; }
    for (const p of this.props) { p.y += p.v * dt; p.x += p.vx * dt; }
    compact(this.props, (p) => p.y < H + 120);
  }
  private drawStage1(): void {
    const g = this.g;
    const off = Math.round(((this.t * 9) % H) * R) / R;
    g.drawImage(this.bgBaked, 0, off - H, W, H);
    g.drawImage(this.bgBaked, 0, off, W, H);
    for (let layer = 0; layer < 3; layer++) {
      g.globalAlpha = LAYER[layer].a;
      for (const p of this.props) {
        if (p.layer !== layer) continue;
        this.blit(this.propImg(p.name, layer), p.x, p.y);
      }
    }
    g.globalAlpha = 1;
  }

  private drawWarning(): void {
    if (this.over || this.t < BOSS_WARN_T || this.t > BOSS_T + 0.6) return;
    const g = this.g;
    const k = Math.sin((this.t - BOSS_WARN_T) * 9) * 0.5 + 0.5;
    g.globalAlpha = 0.12 + k * 0.12;
    g.fillStyle = '#c81432';
    g.fillRect(0, 0, W, H);
    g.globalAlpha = 1;
    for (const y of [70, 236]) {
      g.fillStyle = '#1a0610';
      g.fillRect(0, y, W, 16);
      g.fillStyle = '#e02040';
      for (let x = -16 + ((this.t * 60) % 16); x < W; x += 16) { g.beginPath(); g.moveTo(x, y + 16); g.lineTo(x + 8, y); g.lineTo(x + 14, y); g.lineTo(x + 6, y + 16); g.fill(); }
    }
    this.text('WARNING', W / 2, 150, k > 0.5 ? '#ff4060' : '#ffe0e8', 'center', 22);
    this.text('거대 비행요새 접근 중', W / 2, 176, '#ffe0e8', 'center', 11);
  }

  /** 필살기 컷인: 원화 띠가 오른쪽에서 들어와 멈췄다 왼쪽으로 빠짐 + 이름 */
  private drawCutin(): void {
    const s = this.sp;
    if (!s) return;
    const dur = s.cut;
    const t = s.t;
    if (t > dur + 0.18) return;
    const ci = this.a.cutin[s.id as CutinId];
    const g = this.g;
    const k = t / (dur + 0.18);
    const x = k < 0.18 ? W - (k / 0.18) * W : k > 0.82 ? -((k - 0.82) / 0.18) * W : 0;
    const h = W / 2;
    const y = 92;
    g.globalAlpha = 0.5;
    g.fillStyle = '#0a0418';
    g.fillRect(0, y - 14, W, h + 40);
    g.globalAlpha = 1;
    g.fillStyle = SP_CUT_COL[s.id]; g.fillRect(0, y - 3, W, 2); g.fillRect(0, y + h + 1, W, 2);
    if (ci) g.drawImage(ci, x, y, W, h);
    const name = s.id === 'gona' ? '고나' : CHARACTERS[s.id].name;
    this.text(name, 6 + x * 0.6, y + 4, '#ffffff', 'left', 11);
    this.text(SPECIAL_NAME[s.id] + '!', W / 2 - x * 0.6, y + h + 6, SP_CUT_COL[s.id], 'center', 16);
  }

  /** 필살기 이펙트 (캐릭터 아래 층) */
  private drawSpecialUnder(): void {
    const s = this.sp;
    if (!s) return;
    const v = this.a.v2;
    const g = this.g;
    const e = s.id === 'gona' ? BOMB_T - this.bombT : s.t - s.cut;
    if (s.t < s.cut) return;
    if (s.id === 'gona') {
      // 황금 익룡: 고나 위치에서 화면 위로 솟구침
      const k = clamp((e - 0.5) / 1.2, 0, 1);
      if (k > 0 && k < 1) {
        g.globalAlpha = k < 0.85 ? 0.92 : (1 - k) / 0.15;
        this.frame(v['fx/roar'], 0, 1, W / 2, this.py - k * (this.py + 120) + 20, 0.9 + k * 0.4);
        g.globalAlpha = 1;
      }
      return;
    }
    if (s.id === 'mom') {
      const sc = Math.min(1, e * 4);
      g.globalAlpha = e > s.dur - 0.3 ? Math.max(0, (s.dur - e) / 0.3) : 0.9;
      this.frame(v['fx/sp-circle'], Math.floor(this.t * 8) % 2, 2, this.px, this.py, sc * 1.6);
      g.globalAlpha = 1;
    } else if (s.id === 'halmeoni') {
      this.frame(v['fx/sp-aura'], Math.floor(e * 8) % 4, 4, this.px, this.py, 1.2);
    } else if (s.id === 'samchon') {
      const enter = Math.min(1, e / 0.35);
      const exit = e > 2.3 ? (e - 2.3) * 520 : 0;
      const my = this.py - 50 + (1 - enter) * 120 - exit;
      this.frame(v['fx/mech'], 0, 1, this.px, my + Math.sin(this.t * 10) * 1.5, 1);
      if (e < 2.3 && Math.floor(this.t * 20) % 2) this.part(this.px + rand(-6, 6), my + 34, rand(-10, 10), rand(40, 80), 0.25, '#7ff0ff', 2, 0);
    }
  }
  /** 필살기 이펙트 (캐릭터 위 층) */
  private drawSpecialOver(): void {
    const s = this.sp;
    const v = this.a.v2;
    if (this.barrier > 0) {
      const g = this.g;
      g.globalAlpha = this.barrier < 1.2 && Math.floor(this.t * 10) % 2 ? 0.35 : 0.75;
      this.frame(v['fx/sp-aura'], 3, 4, this.px, this.py, 0.62);
      g.globalAlpha = 1;
    }
    if (!s || s.id !== 'halabeoji' || s.t < s.cut) return;
    const e = s.t - s.cut;
    const g = this.g;
    g.globalAlpha = e > s.dur - 1 && Math.floor(this.t * 12) % 2 ? 0.45 : 0.9;
    this.frame(v['fx/sp-dome'], Math.floor(this.t * 6) % 2, 2, this.px, this.py - 24, 1.16);
    g.globalAlpha = 1;
  }

  private drawBeams(): void {
    const g = this.g;
    for (const bm of this.beams) {
      const k = bm.t / bm.max;
      if (bm.wide) {
        // 스팀 브레이커: 증기 레이저 조각을 세로로 이어 붙임
        const im = this.a.v2['fx/sp-steam'];
        const fi = Math.floor(this.t * 20) % 4;
        const sc = Math.min(1, (1 - k) * 10, k * 6);
        const w = (56 * sc) / R * 1.1;
        for (let y = this.cy - 26; y > -16; y -= 16) g.drawImage(im, fi * 56, 0, 56, 32, bm.x - w / 2, y - 16, w, 16);
        continue;
      }
      const w = Math.floor(12 * Math.min(1, (1 - k) * 8, k * 3 + 0.2));
      const x = Math.floor(bm.x - w / 2);
      g.fillStyle = '#1a78c8';
      g.fillRect(x - 2, 0, w + 4, this.cy - 10);
      g.fillStyle = '#38c0f0';
      g.fillRect(x, 0, w, this.cy - 10);
      g.fillStyle = '#e8fbff';
      g.fillRect(x + Math.floor(w / 4), 0, Math.ceil(w / 2), this.cy - 10);
    }
  }

  private drawFx(f: Fx): void {
    const v = this.a.v2;
    const k = f.age / f.dur;
    switch (f.kind) {
      case 'spark': this.frame(v['fx/spark'], Math.min(3, Math.floor(k * 4)), 4, f.x, f.y, f.scale); break;
      case 'metal': this.frame(v['fx/metal'], Math.min(3, Math.floor(k * 4)), 4, f.x, f.y, f.scale); break;
      case 'weak': this.frame(v['fx/weak'], Math.min(3, Math.floor(k * 4)), 4, f.x, f.y, f.scale); break;
      case 'ring': this.frame(v['fx/ring'], Math.min(3, Math.floor(k * 4)), 4, f.x, f.y, f.scale); break;
      case 'puff': this.frame(v['fx/steam-puff'], Math.min(2, Math.floor(k * 3)), 3, f.x, f.y, f.scale); break;
    }
  }

  /** 아케이드 아이템: P(파워 보석) · 점수 메달 · 체력 하트 · 폭탄 */
  private drawItem(kind: Item['kind'], x: number, y: number, age: number): void {
    const g = this.g;
    const blink = Math.floor(age * 8) % 2;
    if (kind === 'star') {
      g.fillStyle = '#1a1226'; g.beginPath(); g.moveTo(x, y - 7); g.lineTo(x + 7, y); g.lineTo(x, y + 7); g.lineTo(x - 7, y); g.fill();
      g.fillStyle = blink ? '#58e0ff' : '#2a8af0'; g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x + 6, y); g.lineTo(x, y + 6); g.lineTo(x - 6, y); g.fill();
      this.text('P', x, y - 5, '#ffffff', 'center', 11);
    } else if (kind === 'cookie') {
      g.fillStyle = '#1a1226'; g.beginPath(); g.arc(x, y, 6, 0, TAU); g.fill();
      g.fillStyle = blink ? '#ffe34a' : '#e8a92c'; g.beginPath(); g.arc(x, y, 5, 0, TAU); g.fill();
      g.fillStyle = '#fff6c0'; g.fillRect(x - 2, y - 3, 2, 2);
      g.fillStyle = '#a8731a'; g.fillRect(x - 1, y - 2, 2, 5);
    } else {
      const im = this.a.img[kind === 'strawberry' ? 'icon-heart' : 'icon-bomb'];
      g.drawImage(im, x - im.width / 2, y - im.height / 2);
      if (blink) { g.globalAlpha = 0.4; g.drawImage(whiteOf(this.a, im), x - im.width / 2, y - im.height / 2); g.globalAlpha = 1; }
    }
  }

  /** v2 스프라이트(2배 격자)를 0.5배로 — 회전·피격 번쩍 포함 */
  private drawV2(im: HTMLImageElement, cx: number, cy: number, white: boolean, rot = 0, sx = 0, sw = im.width): void {
    const g = this.g;
    const w = sw / R;
    const h = im.height / R;
    if (rot) {
      g.save();
      g.translate(cx, cy);
      g.rotate(rot);
      g.drawImage(im, sx, 0, sw, im.height, -w / 2, -h / 2, w, h);
      if (white) { g.globalAlpha = 0.55; g.drawImage(whiteOf(this.a, im), sx, 0, sw, im.height, -w / 2, -h / 2, w, h); g.globalAlpha = 1; }
      g.restore();
      return;
    }
    const x = Math.round((cx - w / 2) * R) / R;
    const y = Math.round((cy - h / 2) * R) / R;
    g.drawImage(im, sx, 0, sw, im.height, x, y, w, h);
    if (white && (w < 60 || Math.floor(this.t * 30) % 3 === 0)) {
      g.globalAlpha = w < 60 ? 0.55 : 0.22;
      g.drawImage(whiteOf(this.a, im), sx, 0, sw, im.height, x, y, w, h);
      g.globalAlpha = 1;
    }
  }

  private drawEnemy(e: Enemy): void {
    const white = e.flash > 0;
    const v = this.a.v2;
    if (e.kind === 'glasses' || e.kind === 'orb') {
      const name: V2Name = e.kind === 'orb' ? 'stage1/enemy-orb' : e.pat === 'strafe' ? 'stage1/enemy-fighter' : e.pat === 'dive' ? 'stage1/enemy-wyvern' : 'stage1/enemy-drone';
      let rot = 0;
      if (e.pat === 'strafe') rot = (-e.dir * Math.PI) / 2;
      else if (e.pat === 'dive' && e.vy !== 0) rot = Math.atan2(e.vy, e.vx) - Math.PI / 2;
      const bob = e.pat === 'sine' || e.pat === 'swarm' ? Math.sin(e.age * 8) * 1.2 : 0;
      this.drawV2(v[name], e.x, e.y + bob, white, rot);
      if (e.kind === 'orb' && e.fire < 0.35 && e.age < 7) {
        const g = this.g;
        g.globalAlpha = 0.6; g.fillStyle = '#d8b8ff'; g.beginPath(); g.arc(e.x, e.y, 5 + (0.35 - e.fire) * 14, 0, TAU); g.fill(); g.globalAlpha = 1;
      }
      return;
    }
    if (e.kind === 'uncle') {
      this.drawV2(v['stage1/enemy-gunship'], e.x, e.y, white);
      this.hpBar(e.x - 14, e.y + 30, 28, e.hp / e.max);
      return;
    }
    const b = this.bs!;
    const im = v['stage1/boss'];
    const fw = im.width / 2;
    const shakeX = b.mode === 'dying' ? Math.sin(e.age * 60) * 1.5 : 0;
    this.drawV2(im, e.x + shakeX, e.y, white, 0, b.phase >= 2 || b.mode === 'dying' ? fw : 0, fw);
    if (b.mode === 'atk' && b.atk === 'dash' && b.at < 0.9) {
      const g = this.g;
      g.fillStyle = Math.floor(b.at * 10) % 2 ? '#ff4f86' : '#fff';
      g.fillRect(Math.floor(b.tx - 1), Math.floor(e.y + 50), 3, H - Math.floor(e.y) - 90);
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
    if (b.age < 0) return;
    const look: BulletLook = b.kind === 'flask' ? 'orbPurple' : b.kind === 'smell' ? 'orbGreen' : b.kind === 'heart' ? 'heart' : b.kind === 'wave' ? 'orbViolet' : b.kind === 'needle' ? 'needle' : b.kind === 'ring' ? 'orbCyan' : 'fireball';
    const c = this.ebSprite(look, b.r, Math.atan2(b.vy, b.vx), Math.floor(b.age * 12) % 2);
    this.blit(c, b.x, b.y);
  }

  private drawPBullet(b: PBullet): void {
    const v = this.a.v2;
    switch (b.kind) {
      case 'shot': {
        const name: V2Name = b.lvl >= 3 ? 'fx/shot-l3' : b.lvl === 2 ? 'fx/shot-l2' : 'fx/shot-l1';
        const fi = Math.floor(b.age * 20) % 2;
        if (b.vx === 0) this.frame(v[name], fi, 2, b.x, b.y + 7);
        else this.blit(this.pbSprite(name, Math.atan2(b.vy, b.vx) + Math.PI / 2, fi, 2), b.x, b.y + 7);
        return;
      }
      case 'wave': this.blit(this.pbSprite('fx/shot-wave', Math.atan2(b.vy, b.vx) + Math.PI / 2), b.x, b.y); return;
      case 'charge': this.frame(v['fx/charge'], Math.floor(b.age * 16) % 4, 4, b.x, b.y + 8, b.scale * 1.3); return;
      case 'heart': this.frame(v['fx/heart-p'], Math.floor(b.age * 8) % 2, 2, b.x, b.y, b.scale > 1 ? 2 : 1.5); return;
      case 'star': this.frame(v['fx/star-p'], Math.floor(b.age * 10) % 2, 2, b.x, b.y, b.scale > 1 ? 1.6 : 1.2); return;
      case 'elec': this.frame(v['fx/elec'], Math.floor(b.age * 14) % 2, 2, b.x, b.y, 1.2); return;
      case 'potion': this.frame(v['fx/potion'], 0, 1, b.x, b.y, 1.3); return;
      case 'lance': case 'refl': this.frame(v['fx/lance'], 0, 1, b.x, b.y, 1.3); return;
      case 'missile': this.blit(this.pbSprite('fx/missile', Math.atan2(b.vy, b.vx) + Math.PI / 2, Math.floor(b.age * 12) % 2, 2), b.x, b.y); return;
      case 'drill': this.frame(v['fx/mech'], 0, 1, b.x, b.y, 1); return;
    }
  }

  private drawCompanion(): void {
    const g = this.g;
    const fly = this.a.v2[`chars/${this.fam}/fly` as V2Name];
    const attacking = this.cKick > 0.15 || (this.fam === 'halabeoji' && this.shield > 0) || (this.sp !== null && this.sp.id !== 'gona');
    const f = (attacking ? 2 : 0) + (Math.floor(this.t * (attacking ? 10 : 6)) % 2);
    const bob = Math.sin(this.t * 4 + 1) * 1.5;
    g.drawImage(fly, f * 88, 0, 88, 112, this.cx - 22, this.cy - 38 + bob - this.cKick * 2, 44, 56);
    if (this.fam !== 'imo' && this.fam !== 'samchon' && this.cCd > 0 && this.cCd < 20 && !this.sp) {
      const full = this.fam === 'mom' ? 1.45 : this.fam === 'dad' ? 2.5 : this.fam === 'halmeoni' ? 1.1 : 7;
      const k = 1 - clamp(this.cCd / full, 0, 1);
      g.fillStyle = '#1a1226'; g.fillRect(Math.floor(this.cx - 8), Math.floor(this.cy + 16), 17, 3);
      g.fillStyle = k >= 1 ? '#ffe34a' : '#fff8d0'; g.fillRect(Math.floor(this.cx - 7), Math.floor(this.cy + 17), Math.round(15 * k), 1);
    }
  }

  private drawGona(): void {
    const g = this.g;
    const an = this.gonaAnim();
    this.lastAnim = `${an.name}#${an.frame}`;
    const blink = this.inv > 0 && this.hurtT <= 0 && this.bombT <= 0 && !this.sp && !this.over && Math.floor(this.t * 16) % 2 === 0;
    const cx = Math.floor(this.px);
    const cy = Math.floor(this.py);
    if (!blink) {
      const dx = Math.round((this.px - 24) * R) / R;
      const dy = Math.round((this.py - 3 - 26) * R) / R;
      g.drawImage(this.a.gonaSheet, an.frame * 96, an.row * 96, 96, 96, dx, dy, 48, 48);
    }
    // 머즐 플래시 (연사 중)
    if (this.muzzleT > 0 && !this.charging) this.frame(this.a.v2['fx/muzzle'], this.muzzleT > 0.06 ? 0 : this.muzzleT > 0.03 ? 1 : 2, 3, this.px, this.py - 19, 1);
    if (this.shield > 0) {
      const sp = this.a.img['fx-shield'];
      g.globalAlpha = this.shield < 1.5 && Math.floor(this.t * 10) % 2 ? 0.4 : 0.9;
      g.drawImage(sp, cx - 20, cy - 23);
      g.globalAlpha = 1;
    }
    if (this.charging) {
      const kk = Math.min(1, this.charge / 1.0);
      // 머리 위로 모이는 금빛 에너지 + 빨려 드는 입자
      this.frame(this.a.v2['fx/charge-orb'], Math.min(3, Math.floor(kk * 4)), 4, this.px, this.py - 24, 1 + (kk >= 1 && Math.floor(this.t * 16) % 2 ? 0.25 : 0));
      if (Math.random() < 0.5) {
        const a = rand(0, TAU);
        this.part(this.px + Math.cos(a) * 22, this.py - 24 + Math.sin(a) * 22, -Math.cos(a) * 90, -Math.sin(a) * 90, 0.22, '#ffe470', 1, 0);
      }
      g.fillStyle = '#3b2a3f';
      g.fillRect(cx - 12, cy + 22, 25, 3);
      g.fillStyle = kk >= 1 ? '#ff6f9f' : this.charge >= 0.35 ? '#ffe34a' : '#fff';
      g.fillRect(cx - 11, cy + 23, Math.round(23 * kk), 1);
    }
    if (this.chargeFlash > 0) {
      const k = this.chargeFlash / 0.22;
      g.globalAlpha = k;
      g.fillStyle = '#fff8d0';
      g.fillRect(this.px - 3, 0, 6, this.py - 20);
      g.fillStyle = '#ffe34a';
      g.fillRect(this.px - 6, 0, 2, this.py - 24); g.fillRect(this.px + 4, 0, 2, this.py - 24);
      g.globalAlpha = 1;
    }
  }

  /** 피격 판정 점 (작은 다이아몬드) — 탄막 위에 그림 */
  private drawHitDot(): void {
    if (this.over) return;
    const g = this.g;
    const cx = Math.floor(this.px);
    g.fillStyle = '#fff';
    g.fillRect(cx, Math.floor(this.py) + 1, 1, 3);
    g.fillRect(cx - 1, Math.floor(this.py) + 2, 3, 1);
    g.fillStyle = '#e0482c';
    g.fillRect(cx, Math.floor(this.py) + 2, 1, 1);
  }

  /** 현재 게임 상태 → 시트 행·프레임 (행: 0 비행 · 1 왼쪽 · 2 오른쪽 · 3 대기 · 4 공격 · 5 차지 · 6 폭탄 · 7 피격 · 8 격파 · 9 승리) */
  private gonaAnim(): { row: number; frame: number; name: string } {
    const t = this.t;
    if (this.over) {
      const f = Math.min(3, Math.floor(this.endT * 7));
      return this.overWon ? { row: 9, frame: f, name: 'win' } : { row: 8, frame: f, name: 'defeat' };
    }
    if (this.hurtT > 0) return { row: 7, frame: Math.min(3, Math.floor((0.6 - this.hurtT) * 12)), name: 'hurt' };
    if (this.bombT > 0) return { row: 6, frame: Math.min(3, Math.floor(((BOMB_T - this.bombT) / BOMB_T) * 4)), name: 'bomb' };
    if (this.charging) return { row: 5, frame: Math.min(3, Math.floor((this.charge / 1.0) * 4)), name: 'charge' };
    if (this.shootAnimT > 0) return { row: 4, frame: Math.min(3, Math.floor((0.34 - this.shootAnimT) * 12)), name: 'shoot' };
    const vx = this.pvx;
    if (Math.abs(vx) > 22) {
      const strong = Math.abs(vx) > 85;
      return { row: vx < 0 ? 1 : 2, frame: (strong ? 2 : 0) + (Math.floor(t * 8) % 2), name: (vx < 0 ? 'bankL' : 'bankR') + (strong ? '-strong' : '-weak') };
    }
    if (t - this.lastMoveT > 1.5 && this.dragId === null && this.keys.size === 0) return { row: 3, frame: Math.floor(t * 6) % 4, name: 'idle' };
    const firing = this.bombT <= 0.9 && !this.charging;
    const ph = t % 0.5;
    if (firing && ph < 0.16) return { row: 4, frame: ph < 0.08 ? 1 : 2, name: 'shoot-pulse' };
    return { row: 0, frame: Math.floor(t * 10) % 4, name: 'fly' };
  }

  private text(s: string, x: number, y: number, col = '#fff7dc', align: 'left' | 'center' | 'right' = 'left', size = 11): void {
    const im = textImg(s, col, size);
    const w = im.width / R;
    const x0 = align === 'left' ? x - 2 : align === 'center' ? x - w / 2 : x - w + 2;
    this.g.drawImage(im, Math.round(x0 * R) / R, Math.round((y - 1) * R) / R, w, im.height / R);
  }

  private drawHud(): void {
    const g = this.g;
    g.fillStyle = '#120a26';
    g.fillRect(0, 0, W, 25);
    g.fillStyle = '#e8b53c'; g.fillRect(0, 25, W, 1);
    g.fillStyle = '#7a4a14'; g.fillRect(0, 26, W, 1);
    const hearts = Math.min(this.hp, MAX_HP);
    for (let i = 0; i < MAX_HP; i++) g.drawImage(this.a.img[i < hearts ? 'icon-heart' : 'icon-heart-empty'], 4 + i * 10, 3);
    for (let i = 0; i < this.bombs; i++) g.drawImage(this.a.img['icon-bomb'], 4 + i * 10, 14);
    this.text(String(this.score).padStart(8, '0'), W - 4, 2, '#ffe9a8', 'right');
    for (let i = 0; i < 4; i++) { g.fillStyle = i < this.power ? '#58e0ff' : '#2a3060'; g.fillRect(W - 46 + i * 7, 16, 5, 5); }
    this.text('P', W - 54, 13, '#58e0ff', 'left', 11);
    // 필살 게이지·차지 게이지는 조작 버튼과 고나 발밑에 표시 (가운데 일시정지 버튼과 겹치지 않게 HUD 에서는 생략)
    const mult = Math.min(5, 1 + Math.floor(this.combo / 5));
    if (this.combo >= 3) this.text(`${this.combo} HIT${mult > 1 ? ` x${mult}` : ''}`, 4, this.boss ? 40 : 30, '#ff9ec0', 'left', 11);
    if (this.boss && this.bs) {
      const f = clamp(this.boss.hp / this.boss.max, 0, 1);
      g.fillStyle = '#120a26'; g.fillRect(10, 28, W - 20, 10);
      g.fillStyle = '#e8b53c'; g.fillRect(10, 38, W - 20, 1);
      g.fillStyle = '#3a1028'; g.fillRect(46, 31, W - 60, 5);
      g.fillStyle = this.bs.phase === 1 ? '#ff6f9f' : this.bs.phase === 2 ? '#ff4f86' : '#e0482c';
      g.fillRect(46, 31, Math.round((W - 60) * f), 5);
      g.fillStyle = '#120a26'; for (const q of [1 / 3, 2 / 3]) g.fillRect(46 + Math.round((W - 60) * q), 31, 1, 5);
      this.text('BOSS', 12, 28, '#ff9ec0', 'left', 11);
    }
  }

  private drawBanner(): void {
    const b = this.banner;
    if (!b) return;
    const g = this.g;
    const y = 112;
    g.globalAlpha = Math.min(1, b.t * 3) * 0.78;
    g.fillStyle = '#3b2a3f';
    g.fillRect(0, y - 6, W, b.sub ? 40 : 28);
    g.globalAlpha = 1;
    this.text(b.text, W / 2, y, b.col, 'center', 16);
    if (b.sub) this.text(b.sub, W / 2, y + 20, '#fff7dc', 'center', 11);
  }

  /** 실기기 진단: FPS · 평균/최대 프레임 시간 · 갱신/그리기 시간 · 객체 수 · JS 힙(지원 브라우저만) */
  private drawPerf(): void {
    const g = this.g;
    const p = this.perf;
    const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    const lines = [
      `FPS ${p.fps}  ${p.ft}ms max ${p.ftMax}`,
      `upd ${p.upd} drw ${p.drw} long ${p.long}`,
      `eb ${this.eb.length} pb ${this.pb.length} en ${this.en.length}`,
      `pt ${this.parts.length} fx ${this.fx.length + this.booms.length} ${mem ? `heap ${Math.round(mem.usedJSHeapSize / 1e6)}MB` : 'heap n/a'}`,
    ];
    g.globalAlpha = 0.7;
    g.fillStyle = '#000';
    g.fillRect(0, 42, 112, lines.length * 9 + 3);
    g.globalAlpha = 1;
    lines.forEach((l, i) => this.text(l, 3, 43 + i * 9, p.fps >= 55 ? '#9cff9c' : p.fps >= 40 ? '#ffe34a' : '#ff7a7a', 'left', 7));
  }
}
