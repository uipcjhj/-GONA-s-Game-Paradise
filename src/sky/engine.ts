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
import { type Assets, type V2Name, type CutinId, type StageArt, whiteOf } from './assets';
import { STAGES, DIFF, ENEMIES, type StageDef, type Difficulty, type DiffDef, type EnemyName, type Move, type Fire, type ArtName, type BossDef, type Attack, type Step, type Wave } from './stages';
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
  /** 최종 스테이지까지 클리어 */
  final: boolean;
  stage: number;
  score: number;
  time: number;
  maxCombo: number;
  hp: number;
  bombs: number;
  power: number;
  noMiss: boolean;
  bonus: { clear: number; hp: number; bomb: number; noMiss: number; total: number };
}

/** 스테이지 시작 시 이어받는 상태 */
export interface RunOpts {
  stage: number;
  diff: Difficulty;
  fam: FamilyId;
  hp: number;
  bombs: number;
  power: number;
  score: number;
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
  /** 가감속(초당 배율) · 유도(초당 회전) · 좌우 흔들림 · 수명 */
  acc: number; hom: number; wob: number; ttl: number;
}
type EKind = 'small' | 'boss' | 'part';
interface Enemy {
  id: number; kind: EKind; type: EnemyName | ''; art: ArtName; k: number; pat: Move | 'boss'; fireKind: Fire;
  x: number; y: number; x0: number; vx: number; vy: number;
  hp: number; max: number; age: number; flash: number; fire: number; dir: number; hr: number; score: number; dead: boolean; ph: number; burst: number;
  holdY: number; drop?: Item['kind'];
  /** 부품: 본체 기준 위치 · 공격 */
  parent?: Enemy; dx?: number; dy?: number; partFire?: 'aim' | 'ring' | 'needle' | 'homing'; partCd?: number;
}
/** 레이저: 경고선(warn) → 발사(life) */
interface Laser { x: number; y: number; ang: number; len: number; w: number; warn: number; life: number; t: number; rot: number; owner: Enemy | null; alive: boolean }
interface Item { x: number; y: number; kind: 'cookie' | 'strawberry' | 'banana' | 'star'; age: number; alive: boolean }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; col: string; size: number; g: number }
interface Boom { x: number; y: number; age: number; delay: number; scale: number }
type FxKind = 'spark' | 'metal' | 'weak' | 'ring' | 'puff' | 'smoke';
interface Fx { kind: FxKind; x: number; y: number; age: number; dur: number; scale: number; vy: number }
interface Prop { name: ArtName; x: number; y: number; v: number; layer: number; vx: number }
interface Float { x: number; y: number; text: string; age: number; col: string }
interface Beam { follow: boolean; x: number; t: number; max: number; tick: number; wide: boolean }

interface BossState {
  def: BossDef;
  mode: 'enter' | 'idle' | 'tele' | 'atk' | 'dying' | 'flee';
  atk: Attack | ''; at: number; rest: number; last: string; phase: number; n: number; tx: number; sub: number; minion: number; dyingT: number; teleT: number;
  cycle: number; mask: { w: number; h: number; m: Uint8Array }[]; life: number;
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

const LAYER = [{ k: 0.32, v: 14, a: 0.75 }, { k: 0.5, v: 30, a: 1 }, { k: 0.6, v: 70, a: 0.55 }];

const MAX_HP = 5;
const BOMB_T = 1.9;
const CAP = { parts: 220, booms: 36, fx: 70, floats: 10, eb: 320 };
const MEDALS = [100, 200, 300, 500, 800, 1000, 1500, 2000, 3000, 5000];
/** 탄 종류 → 모양 */
const BOSS_BULLET_R: Record<EBKind, number> = { flask: 3.5, smell: 4.5, heart: 3.5, wave: 3, needle: 2.6, ring: 3.5, fire: 4 };
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
  private fam: FamilyId;
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
  /** 보스 피격 반응: 번쩍임 쿨타임 · 흔들림 · 체력바 잔상 · 장갑 파손 단계 */
  private bossFlashCd = 0;
  private bossRecoil = 0;
  private bossTrail = 1;
  private bossBarHit = 0;
  private armorStage = 0;
  private smokeT = 0;
  private armorPts: number[][] = [];
  private partSmoke: number[][] = [];

  // 스테이지 진행
  private st: StageDef;
  private dif: DiffDef;
  private stepIdx = 0;
  private stepWait = 0;
  private block: 'none' | 'midboss' | 'warning' | 'boss' = 'none';
  private warnT = 0;
  private spawnQ: Spawn[] = [];
  private midboss: Enemy | null = null;
  private lasers: Laser[] = [];
  private medal = 0;
  private hits = 0;
  private ambientT = 0;
  /** 자동 조종(밸런스 검수용 봇) */
  auto = false;
  private botT = 0;
  private botX = W / 2;
  private botY = H - 80;

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
    private art: StageArt,
    opts: RunOpts,
    private onEnd: (r: EndInfo) => void,
    private onHud: (h: HudInfo) => void,
  ) {
    this.g = canvas.getContext('2d', { alpha: false })!;
    this.st = STAGES[Math.max(0, Math.min(STAGES.length - 1, opts.stage - 1))];
    this.dif = DIFF[opts.diff];
    this.fam = opts.fam;
    this.hp = opts.hp;
    this.bombs = opts.bombs;
    this.power = opts.power;
    this.score = opts.score;
    this.resize();
    this.bgBaked = this.bakeBackdrop();
    this.cCd = this.fam === 'halmeoni' ? 5 : this.fam === 'halabeoji' ? 1 : 1.2;
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onUp);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKeyUp);
    sfx('start');
    playBgm(this.st.bgm, 0.6);
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
      stage: this.st.id, t: +this.t.toFixed(1), hp: this.hp, score: this.score, enemies: this.en.length, ebullets: this.eb.length, pbullets: this.pb.length, parts: this.parts.length, fx: this.fx.length + this.booms.length,
      boss: this.boss ? Math.round(this.boss.hp) : -1, bossMax: this.boss ? this.boss.max : 0, phase: this.bs?.phase ?? 0, mid: this.midboss ? Math.round(this.midboss.hp) : -1, block: this.block, step: this.stepIdx,
      power: this.power, over: this.over ? 1 : 0, won: this.overWon ? 1 : 0, px: Math.round(this.px), py: Math.round(this.py), anim: this.lastAnim, hits: this.hits, lasers: this.lasers.length,
      cause: JSON.stringify(this.hitLog), gauge: +this.gauge.toFixed(2), sp: this.sp ? this.sp.id : '', bombs: this.bombs, S: R, fps: this.perf.fps, ft: this.perf.ft, ftMax: this.perf.ftMax, upd: this.perf.upd, drw: this.perf.drw,
    };
  }
  cheat(cmd: string): void {
    if (cmd === 'boss') {
      // 남은 대본을 건너뛰고 경고 → 보스
      this.stepIdx = this.st.script.findIndex((q) => 'warning' in q);
      this.stepWait = 0;
      this.block = 'none';
      this.spawnQ.length = 0;
      for (const e of this.en) if (e.kind !== 'boss') e.dead = true;
      this.midboss = null;
      this.eb.length = 0;
    }
    if (cmd === 'midboss') {
      this.stepIdx = this.st.script.findIndex((q) => 'midboss' in q);
      this.stepWait = 0;
      this.spawnQ.length = 0;
    }
    if (cmd === 'power') this.power = 4;
    if (cmd === 'god') this.hp = 99;
    if (cmd === 'hp1') this.hp = 1;
    if (cmd === 'killboss' && this.boss) { this.boss.hp = 1; for (const e of this.en) if (e.kind === 'part') e.dead = true; }
    if (cmd === 'killmid' && this.midboss) this.midboss.hp = 1;
    if (cmd === 'hurt') { this.inv = 0; this.shield = 0; this.barrier = 0; this.hurtPlayer(); }
    if (cmd === 'bombs') { this.bombs = 5; this.pushHud(); }
    if (cmd === 'gauge') this.addGauge(1);
    if (cmd === 'auto') this.auto = true;
    if (cmd === 'stress' && this.boss && this.bs) {
      // 최악 상황: 마지막 단계 + 무한 체력
      this.boss.max = 1e6; this.boss.hp = 2.9e5; this.bs.phase = this.bs.def.phases.length;
      for (const e of this.en) if (e.kind === 'part') e.dead = true;
    }
  }
  /** 검수용: 그리기 없이 고정 간격(1/60초)으로 게임을 빠르게 진행 */
  sim(seconds: number): void {
    const dt = 1 / 60;
    const n = Math.round(seconds * 60);
    for (let i = 0; i < n && !this.over; i++) {
      if (this.hitstop > 0) { this.hitstop -= dt; continue; }
      let d = dt;
      if (this.sp && this.sp.t < this.sp.cut) { this.sp.t += dt; d *= 0.3; }
      this.update(d);
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
  private newEB(x: number, y: number, vx: number, vy: number, r: number, kind: EBKind, age = 0): EBullet | null {
    if (this.eb.length >= CAP.eb) return null;
    const b = this.ebPool.pop() ?? ({} as EBullet);
    b.x = x; b.y = y; b.vx = vx; b.vy = vy; b.r = r; b.kind = kind; b.age = age; b.alive = true;
    b.acc = 0; b.hom = 0; b.wob = 0; b.ttl = 12;
    this.eb.push(b);
    return b;
  }
  /** 각도·속도로 적 탄 (난이도 속도 배율 적용) */
  private shoot(x: number, y: number, ang: number, v: number, kind: EBKind, r = BOSS_BULLET_R[kind], age = 0): EBullet | null {
    const sp = this.spd(v);
    return this.newEB(x, y, Math.cos(ang) * sp, Math.sin(ang) * sp, r, kind, age);
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

  // ───────────── 스테이지 대본 실행 ─────────────
  /** 스테이지가 올라갈수록·난이도에 따라 적 체력·탄 속도 상승 */
  private ehp(v: number): number {
    return Math.max(1, Math.round(v * this.dif.ehp * (1 + 0.1 * (this.st.id - 1))));
  }
  private spd(v: number): number {
    return v * this.dif.bspd * (1 + 0.035 * (this.st.id - 1));
  }
  private cnt(n: number, odd = false): number {
    let c = Math.max(1, Math.round(n * this.dif.dens));
    if (odd && c % 2 === 0) c++;
    return c;
  }

  private runScript(dt: number): void {
    for (let i = 0; i < this.spawnQ.length; i++) {
      const q = this.spawnQ[i];
      if (q.t <= this.t) {
        q.fn();
        this.spawnQ.splice(i--, 1);
      }
    }
    if (this.block === 'midboss') {
      if (!this.midboss || this.midboss.dead) {
        this.midboss = null;
        this.block = 'none';
      }
      return;
    }
    if (this.block === 'warning') {
      this.warnT -= dt;
      if (this.warnT <= 0) {
        this.block = 'none';
      }
      return;
    }
    if (this.block === 'boss') return;
    this.stepWait -= dt;
    const sc = this.st.script;
    while (this.stepWait <= 0 && this.stepIdx < sc.length && this.block === 'none') {
      this.execStep(sc[this.stepIdx++]);
    }
  }

  private execStep(q: Step): void {
    if ('wait' in q) this.stepWait += q.wait;
    else if ('wave' in q) this.spawnWave(q.wave);
    else if ('banner' in q) {
      this.banner = { text: q.banner, sub: q.sub, t: 2.8, col: '#ffe9a8' };
      if (this.st.temp) this.floatText(W / 2, 168, '※ 임시 그래픽', '#cfc4ff');
    } else if ('item' in q) this.items.push({ x: q.x, y: -10, kind: q.item, age: 0, alive: true });
    else if ('midboss' in q) {
      this.block = 'midboss';
      this.midboss = this.spawnBossEnemy(this.st.midboss);
    } else if ('warning' in q) {
      this.block = 'warning';
      this.warnT = 3.6;
      sfx('warn');
      stopBgm(1.6);
      this.banner = null;
      // 남은 잡몹은 퇴장
      for (const e of this.en) if (e.kind === 'small') { e.pat = 'swarm'; e.fire = 99; }
    } else if ('boss' in q) {
      this.block = 'boss';
      this.boss = this.spawnBossEnemy(this.st.boss);
      playBgm(this.st.bossBgm, 0.2, 0.6);
    }
  }

  private spawnWave(w: Wave): void {
    const n = w.n;
    const gap = w.gap ?? 0.35;
    for (let i = 0; i < n; i++) {
      const x = n === 1 ? (w.x0 ?? 90) : (w.x0 ?? 30) + (((w.x1 ?? 150) - (w.x0 ?? 30)) * i) / (n - 1);
      const last = i === n - 1;
      this.spawnQ.push({ t: this.t + i * gap, fn: () => this.spawnEnemy(w.e, x, w.move, w.dir ?? 1, i, w.y ?? 50, w.fire, last ? w.drop : undefined) });
    }
  }

  private spawnEnemy(type: EnemyName, x: number, move: Move, dir: number, idx: number, y: number, fire?: Fire, drop?: Item['kind']): void {
    const d = ENEMIES[type];
    let sx = x;
    let sy = -16;
    if (move === 'strafe' || move === 'snake') {
      sx = dir > 0 ? -14 : W + 14;
      sy = move === 'snake' ? y : y + (idx % 3) * 12;
    } else if (move === 'loop') {
      sx = dir > 0 ? -14 : W + 14;
      sy = 30 + (idx % 2) * 8;
    }
    const hp = this.ehp(d.hp);
    this.en.push({
      id: this.nextId++, kind: 'small', type, art: d.art, k: 0.5, pat: move, fireKind: fire ?? d.fire,
      x: sx, y: sy, x0: x, vx: 0, vy: 0, hp, max: hp, age: 0, flash: 0, fire: rand(d.cd[0], d.cd[1]) * 0.6 * this.dif.cd, dir, hr: d.hr, score: d.score,
      dead: false, ph: idx * 0.7, burst: 0, holdY: y, drop,
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
      this.updateBullets(dt);
      return;
    }

    this.runScript(dt);
    this.updateLasers(dt);

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
  /**
   * 밸런스 검수용 자동 조종 봇 (사람 반응 흉내: 0.1초마다 판단 · 손가락 속도 제한).
   * 후보 위치마다 앞으로 0.1~0.5초 동안의 탄·레이저·적 몸통 위험도를 계산해 가장 안전한 곳으로 이동.
   */
  private botStep(dt: number): void {
    this.botT -= dt;
    if (this.botT <= 0) {
      this.botT = 0.06;
      let tgtX = W / 2;
      const focus = this.boss ?? this.midboss ?? this.en.find((e) => e.kind === 'small' && e.y > 10 && e.y < 200) ?? null;
      if (focus) tgtX = focus.x;
      /** 위치 (cx,cy) 에 t0 초 뒤에 있을 때의 위험도 */
      const danger = (cx: number, cy: number, t0 = 0, quick = false): number => {
        let c = 0;
        for (const b of this.eb) {
          if (b.age < -0.05 || Math.abs(b.x - cx) > 80 || Math.abs(b.y - cy) > 120) continue;
          for (const t of quick ? [0, 0.06] : [0, 0.06, 0.12, 0.2, 0.3, 0.45, 0.65, 0.9]) {
            const qx = b.x + b.vx * (t + t0);
            const qy = b.y + b.vy * (t + t0);
            const d = Math.hypot(qx - cx, qy - cy - 2);
            const lim = b.r + 2.2 + 3;
            if (d < lim) c += ((lim - d) * 6) / (t + 0.06);
          }
        }
        for (const l of this.lasers) {
          if (l.t > l.warn + l.life - 0.05) continue;
          const dx = cx - l.x;
          const dy = cy - l.y;
          for (const ahead of [0, 0.25]) {
            const ang = l.ang + (l.t + ahead > l.warn ? l.rot * ahead : 0);
            const along = dx * Math.cos(ang) + dy * Math.sin(ang);
            const perp = Math.abs(-dx * Math.sin(ang) + dy * Math.cos(ang));
            if (along > 0 && perp < l.w / 2 + 8) c += 80;
          }
        }
        for (const e of this.en) {
          if (e.kind === 'boss') {
            if (this.bossSolid(e, cx, cy + 2) || this.bossSolid(e, cx, cy - 14)) c += 120;
            const bb = this.bsOf(e);
            if ((bb.mode === 'atk' || bb.mode === 'tele') && bb.atk === 'dash' && Math.abs(cx - bb.tx) < 42) c += 100;
            continue;
          }
          if (e.kind === 'part') continue;
          const fx = e.x + e.vx * 0.2;
          const fy = e.y + e.vy * 0.2;
          if (Math.hypot(fx - cx, fy - cy) < e.hr + 10) c += 60;
        }
        return c;
      };
      let best = 1e9;
      let bx = this.px;
      let by = this.py;
      for (let ox = -48; ox <= 48; ox += 8) {
        for (let oy = -36; oy <= 36; oy += 9) {
          const cx = clamp(this.px + ox, 14, W - 14);
          const cy = clamp(this.py + oy, 110, H - 66);
          // 가는 길 전체도 안전해야 함 (도착 시각에 맞춰 탄 위치 예측)
          const dist = Math.hypot(cx - this.px, cy - this.py);
          const travel = dist / 150;
          let c = danger(cx, cy, travel);
          for (const f of [0.2, 0.4, 0.6, 0.8]) c += danger(this.px + (cx - this.px) * f, this.py + (cy - this.py) * f, travel * f, true);
          c += Math.abs(cx - tgtX) * 0.12 + Math.abs(cy - (H - 95)) * 0.025 + (Math.abs(ox) + Math.abs(oy)) * 0.01;
          if (c < best) { best = c; bx = cx; by = cy; }
        }
      }
      this.botX = bx;
      this.botY = by;
      // 위급하면 폭탄 (사람처럼 가끔만)
      if (best > 40 && this.bombs > 0 && this.bombT <= 0 && !this.sp && Math.random() < 0.3) this.useBomb();
      if (this.gauge >= 1 && (this.boss || this.midboss || this.eb.length > 40)) this.useFamily();
    }
    this.targetX = this.botX;
    this.targetY = this.botY;
    this.hasTarget = true;
  }

  private updatePlayer(dt: number): void {
    if (this.auto) this.botStep(dt);
    const prev = this.px;
    const prevY = this.py;
    const slow = this.charging ? 0.6 : 1;
    if (this.hasTarget) {
      const k = Math.min(1, dt * 22);
      let mx = (this.targetX - this.px) * k;
      let my = (this.targetY - this.py) * k;
      if (this.auto) {
        const lim = 150 * dt;
        mx = clamp(mx, -lim, lim);
        my = clamp(my, -lim, lim);
      }
      this.px += mx;
      this.py += my;
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

  hitLog: Record<string, number> = {};
  private hurtPlayer(cause = '?'): void {
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
    this.hits++;
    const ctx = this.bs && this.boss ? `@${this.bs.atk || this.bs.mode}` : this.midboss ? '@mid' : '';
    this.hitLog[cause + ctx] = (this.hitLog[cause + ctx] ?? 0) + 1;
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
  private spawnBossEnemy(def: BossDef): Enemy {
    const hp = Math.round(def.hp * this.dif.bhp);
    const e: Enemy = {
      id: this.nextId++, kind: 'boss', type: '', art: def.art, k: def.k, pat: 'boss', fireKind: 'none', x: W / 2, y: -60, x0: W / 2, vx: 0, vy: 0,
      hp, max: hp, age: 0, flash: 0, fire: 0, dir: 1, hr: def.hr, score: def.mid ? 8000 : 30000, dead: false, ph: 0, burst: 0, holdY: def.restY,
    };
    this.en.push(e);
    for (const pd of def.parts) {
      const php = Math.round(pd.hp * this.dif.bhp);
      this.en.push({
        id: this.nextId++, kind: 'part', type: '', art: pd.art, k: pd.k, pat: 'boss', fireKind: 'none', x: e.x + pd.dx, y: e.y + pd.dy, x0: 0, vx: 0, vy: 0,
        hp: php, max: php, age: 0, flash: 0, fire: pd.cd * rand(0.6, 1.2), dir: 1, hr: pd.hr, score: 3000, dead: false, ph: 0, burst: 0, holdY: 0,
        parent: e, dx: pd.dx, dy: pd.dy, partFire: pd.fire, partCd: pd.cd,
      });
    }
    const bs: BossState = {
      def, mode: 'enter', atk: '', at: 0, rest: 1, last: '', phase: 1, n: 0, tx: W / 2, sub: 0, minion: 8, dyingT: 0, teleT: 0, cycle: 0,
      mask: this.buildMask(def.art, def.frames, def.k), life: 0,
    };
    (e as Enemy & { bs: BossState }).bs = bs;
    if (!def.mid) {
      this.bs = bs;
      this.bossTrail = 1;
      this.armorStage = 0;
      const sc = (this.art[def.art].width / def.frames) * def.k / 110;
      this.armorPts = [[-30, -18], [30, -8], [-20, 24], [24, 28]].map(([x, y]) => [x * sc, y * sc]);
    }
    this.bossSay(def.mid ? `${def.name} 출현!` : `${def.name} 등장!`, def.mid ? '#ffc040' : '#ff9ec0');
    return e;
  }
  private bsOf(e: Enemy): BossState {
    return (e as Enemy & { bs: BossState }).bs;
  }

  /** 실루엣 마스크 (논리 해상도) — 총알이 실제 그림에 닿은 지점에서 맞도록 */
  private buildMask(art: ArtName, frames: number, k: number): { w: number; h: number; m: Uint8Array }[] {
    const im = this.art[art];
    const fw = im.width / frames;
    const out: { w: number; h: number; m: Uint8Array }[] = [];
    for (let f = 0; f < frames; f++) {
      const w = Math.max(1, Math.round(fw * k));
      const h = Math.max(1, Math.round(im.height * k));
      const [, g] = this.mkCanvas(w, h);
      g.drawImage(im, f * fw, 0, fw, im.height, 0, 0, w, h);
      const d = g.getImageData(0, 0, w, h).data;
      const m = new Uint8Array(w * h);
      for (let i = 0; i < w * h; i++) m[i] = d[i * 4 + 3] > 100 ? 1 : 0;
      out.push({ w, h, m });
    }
    return out;
  }
  private bossSolid(e: Enemy, x: number, y: number): boolean {
    const b = this.bsOf(e);
    const mk = b.mask[b.mask.length > 1 && b.phase >= 2 ? 1 : 0];
    if (!mk) return true;
    const lx = Math.floor(x - (e.x - mk.w / 2));
    const ly = Math.floor(y - (e.y - mk.h / 2));
    if (lx < 0 || ly < 0 || lx >= mk.w || ly >= mk.h) return false;
    return mk.m[ly * mk.w + lx] === 1;
  }

  private aimAt(x: number, y: number): number {
    return Math.atan2(this.py - y, this.px - x);
  }

  private updateEnemies(dt: number): void {
    for (const e of this.en) {
      e.age += dt;
      if (e.flash > -1) e.flash -= dt;
      if (e.kind === 'boss') {
        this.updateBoss(e, dt);
        continue;
      }
      if (e.kind === 'part') {
        this.updatePart(e, dt);
        continue;
      }
      this.moveEnemy(e, dt);
      if (e.y > 6 && e.y < H - 80 && this.bombT <= 0 && !this.over && e.fire < 90) {
        e.fire -= dt;
        if (e.fire <= 0) this.enemyFire(e);
      }
      if (e.x < -40 || e.x > W + 40 || e.y > H + 30 || e.y < -70) e.dead = true;
    }
    compact(this.en, (e) => !e.dead);
  }

  private moveEnemy(e: Enemy, dt: number): void {
    switch (e.pat) {
      case 'sine':
        e.y += 36 * dt;
        e.x = e.x0 + Math.sin(e.age * 2.1 + e.ph) * 26;
        break;
      case 'strafe':
        e.x += e.dir * 50 * dt;
        e.y += Math.sin(e.age * 2.5) * 10 * dt;
        break;
      case 'swarm':
        e.y += 78 * dt;
        e.x = e.x0 + Math.sin(e.age * 4 + e.ph) * 14;
        break;
      case 'zig': {
        e.y += 42 * dt;
        const seg = Math.floor(e.age / 0.9 + e.ph) % 2;
        e.x += (seg ? 1 : -1) * 55 * dt;
        e.x = clamp(e.x, 10, W - 10);
        break;
      }
      case 'dive':
        if (e.age < 0.9) {
          e.y += 40 * dt;
          e.x += Math.sin(e.age * 6) * 14 * dt;
        } else {
          if (e.vy === 0) {
            const a = this.aimAt(e.x, e.y);
            e.vx = Math.cos(a) * 110;
            e.vy = Math.sin(a) * 110;
          }
          e.x += e.vx * dt;
          e.y += e.vy * dt;
        }
        break;
      case 'loop': {
        // 옆에서 들어와 크게 원을 그리고 반대편으로
        const a = e.age * 1.6;
        e.vx = e.dir * (70 - Math.sin(a) * 40);
        e.vy = Math.cos(a) * 60 + 18;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        break;
      }
      case 'snake':
        e.vx = e.dir * 62;
        e.vy = Math.cos(e.age * 3 + e.ph) * 32;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        break;
      case 'hold':
        // 정해진 높이까지 내려와 3초 사격 후 위로 퇴장
        if (e.age < 4.2) e.y += (e.holdY - e.y) * Math.min(1, dt * 2.2);
        else e.y -= 70 * dt;
        break;
      case 'turret':
        if (e.age < 7.5) e.y += (60 + e.dir * 6 - e.y) * Math.min(1, dt * 1.5);
        else e.y -= 50 * dt;
        e.x = e.x0 + Math.sin(e.age * 1.2 + e.ph) * 8;
        break;
      case 'heavy':
        if (e.y < 62) e.y += 28 * dt;
        else {
          e.y += 3 * dt;
          e.x += Math.sin(e.age * 0.9) * 22 * dt * e.dir;
        }
        if (e.age > 15) e.y -= 60 * dt;
        break;
      default:
        break;
    }
  }

  private enemyFire(e: Enemy): void {
    const d = e.type ? ENEMIES[e.type] : null;
    const cd = (d ? rand(d.cd[0], d.cd[1]) : 2) * this.dif.cd;
    const aim = this.aimAt(e.x, e.y);
    e.fire = cd;
    switch (e.fireKind) {
      case 'aim1':
        this.shoot(e.x, e.y + 6, aim, 70, 'flask');
        break;
      case 'aim3': {
        const n = this.cnt(3, true);
        for (let i = 0; i < n; i++) this.shoot(e.x, e.y + 6, aim + (i - (n - 1) / 2) * 0.22, 64, 'flask');
        break;
      }
      case 'needle2':
        for (let k = 0; k < 2; k++) this.shoot(e.x - k * e.dir * 4, e.y + 4, aim, 90, 'needle', 2.6, -k * 0.1);
        break;
      case 'fireball':
        if (e.burst === 0 && e.age > 0.6) {
          e.burst = 1;
          this.shoot(e.x, e.y + 6, aim, 72, 'fire');
        }
        e.fire = 0.2;
        break;
      case 'ring': {
        e.burst++;
        const n = this.cnt(12);
        for (let i = 0; i < n; i++) this.shoot(e.x, e.y + 2, (i / n) * TAU + e.burst * 0.26, 46, 'ring');
        if (e.age > 7) e.fire = 99;
        break;
      }
      case 'spiralMini': {
        // 짧은 간격으로 회전하는 2갈래 탄
        e.burst++;
        for (let k = 0; k < 2; k++) this.shoot(e.x, e.y + 2, e.burst * 0.42 + k * Math.PI, 52, 'wave');
        e.fire = 0.16 * this.dif.cd;
        if (e.age > 7) e.fire = 99;
        break;
      }
      case 'curtain':
        // 바로 아래로 떨어지는 줄탄 (옆으로 비키면 피함)
        for (let k = 0; k < 3; k++) this.shoot(e.x, e.y + 8, Math.PI / 2, 80, 'needle', 2.6, -k * 0.12);
        e.fire = 1.3 * this.dif.cd;
        if (e.age > 7) e.fire = 99;
        break;
      case 'spread5': {
        e.burst++;
        if (e.burst % 2) {
          const n = this.cnt(10);
          for (let i = 0; i < n; i++) this.shoot(e.x, e.y + 4, (i / n) * TAU + e.burst * 0.31, 42, 'smell');
        } else {
          const n = this.cnt(5, true);
          for (let i = 0; i < n; i++) this.shoot(e.x, e.y + 8, aim + (i - (n - 1) / 2) * 0.2, 78, 'needle');
        }
        break;
      }
      case 'snipe':
        // 빠른 조준탄 1발 (발사 직전 반짝임 = drawEnemy)
        this.shoot(e.x, e.y + 6, aim, 112, 'needle');
        e.fire = 99;
        break;
      case 'gun': {
        e.burst++;
        if (e.burst % 2) {
          const n = this.cnt(10);
          for (let i = 0; i < n; i++) this.shoot(e.x, e.y + 4, (i / n) * TAU + e.burst * 0.31, 40, 'smell');
        } else {
          for (const sd of [-1, 1]) for (let i = -1; i <= 1; i++) this.shoot(e.x + sd * 18, e.y + 6, this.aimAt(e.x + sd * 18, e.y) + i * 0.16, 82, 'needle');
        }
        break;
      }
      default:
        e.fire = 99;
    }
  }

  private updatePart(e: Enemy, dt: number): void {
    const p = e.parent!;
    if (p.dead) { e.dead = true; return; }
    e.x = p.x + (e.dx ?? 0);
    e.y = p.y + (e.dy ?? 0);
    const b = this.bsOf(p);
    if (b.mode === 'enter' || b.mode === 'dying' || this.bombT > 0 || this.over) return;
    // 본체가 레이저·탄벽 같은 큰 패턴을 쓰는 동안 포탑은 쉼 (피할 수 없는 겹침 방지)
    if (b.mode === 'tele' || (b.mode === 'atk' && /^(laser|curtain|wallGap|gatling)/.test(b.atk))) return;
    e.fire -= dt;
    if (e.fire > 0) return;
    e.fire = (e.partCd ?? 2) * this.dif.cd * rand(0.85, 1.15);
    const aim = this.aimAt(e.x, e.y);
    switch (e.partFire) {
      case 'aim':
        this.shoot(e.x, e.y + 4, aim, 85, 'needle');
        break;
      case 'needle':
        for (let k = 0; k < 2; k++) this.shoot(e.x, e.y + 4, aim, 95, 'needle', 2.6, -k * 0.1);
        break;
      case 'ring': {
        const n = this.cnt(8);
        for (let i = 0; i < n; i++) this.shoot(e.x, e.y, (i / n) * TAU + e.age, 44, 'ring');
        break;
      }
      case 'homing': {
        const q = this.shoot(e.x, e.y + 4, aim, 50, 'flask', 4);
        if (q) { q.hom = 1.3; q.ttl = 4.5; }
        break;
      }
    }
  }

  private bossSay(text: string, col = '#ff9ec0'): void {
    this.banner = { text, t: 1.3, col };
  }

  private updateBoss(e: Enemy, dt: number): void {
    const b = this.bsOf(e);
    const def = b.def;
    const main = !def.mid;
    const frac = e.hp / e.max;
    b.life += dt;
    if (main) {
      this.bossFlashCd -= dt;
      this.bossRecoil = Math.max(0, this.bossRecoil - dt * 12);
      this.bossBarHit = Math.max(0, this.bossBarHit - dt);
      this.bossTrail += (Math.max(0, frac) - this.bossTrail) * Math.min(1, dt * (this.bossBarHit > 0 ? 0.6 : 3.2));
      this.smokeT -= dt;
      if (this.smokeT <= 0 && this.armorStage + this.partSmoke.length > 0) {
        this.smokeT = 0.16;
        const pts = this.armorPts.slice(0, this.armorStage).concat(this.partSmoke);
        for (let i = 0; i < pts.length; i++) {
          const [dx, dy] = pts[i];
          if (Math.random() < 0.7) this.addFx('smoke', e.x + dx + rand(-3, 3), e.y + dy, 0.55, 0.7, -26);
          if (Math.random() < 0.5) this.part(e.x + dx + rand(-3, 3), e.y + dy, rand(-12, 12), rand(-50, -20), 0.4, Math.random() < 0.5 ? '#ffb040' : '#ff6020', 2, -20);
        }
      }
    }
    if (b.mode === 'flee') {
      e.y -= 70 * dt;
      if (e.y < -90) { e.dead = true; if (this.midboss === e) this.midboss = null; }
      return;
    }
    if (b.mode === 'dying') {
      b.dyingT += dt;
      const big = main ? 1 : 0.6;
      const span = (this.art[def.art].width / def.frames) * def.k * 0.4;
      const rate = 0.25 + b.dyingT * 0.18;
      if (Math.random() < rate) this.addBoom(e.x + rand(-span, span), e.y + rand(-span, span), rand(0.6, 1.0 + b.dyingT * 0.2) * big, 0);
      if (Math.random() < 0.18) this.debris(e.x + rand(-span, span), e.y + rand(-span, span), 4, ['#c02040', '#d8a040', '#5a5a66']);
      if (Math.random() < 0.08) this.addFx('ring', e.x + rand(-span, span), e.y + rand(-span, span), rand(0.6, 1.1), 0.3);
      this.shake = Math.max(this.shake, 0.2 * settings.shake * big);
      const endT = main ? 2.8 : 1.4;
      if (b.dyingT > endT) {
        e.dead = true;
        this.score += e.score;
        this.floatText(e.x, e.y, `${e.score}`, '#ffe34a');
        for (let i = 0; i < 40 * big; i++) {
          const a = (i / 40) * TAU;
          this.part(e.x, e.y, Math.cos(a) * rand(60, 200), Math.sin(a) * rand(60, 200), 1.2, i % 3 ? '#ffb040' : '#fff8d0', 3, 0);
        }
        this.flashWhite = main ? 1 : 0.4;
        this.kick(main ? 1 : 0.6, main ? 0.14 : 0.08);
        for (let i = 0; i < 8 * big; i++) this.addBoom(e.x + rand(-span, span), e.y + rand(-span, span), rand(1.1, 1.7) * big, i * 0.06);
        this.addBoom(e.x, e.y, 2.6 * big, 0.05);
        if (main) {
          this.addBoom(e.x - 20, e.y + 10, 2.0, 0.18);
          this.addBoom(e.x + 22, e.y - 8, 2.2, 0.3);
          this.addFx('ring', e.x, e.y, 1.6, 0.4);
        }
        this.addFx('ring', e.x, e.y, 2.6 * big, 0.5);
        this.debris(e.x, e.y, main ? 40 : 20, ['#c02040', '#d8a040', '#5a5a66', '#ff9ec0']);
        sfx(main ? 'boomL' : 'boomM');
        buzz(main ? [90, 40, 140] : 50, 0);
        if (main) {
          for (let i = 0; i < 8; i++) this.items.push({ x: e.x + rand(-30, 30), y: e.y + rand(-20, 10), kind: 'cookie', age: 0, alive: true });
          this.boss = null;
          this.finish(true);
        } else {
          this.items.push({ x: e.x - 10, y: e.y, kind: 'star', age: 0, alive: true });
          this.items.push({ x: e.x + 10, y: e.y, kind: 'cookie', age: 0, alive: true });
          if (this.midboss === e) this.midboss = null;
        }
      }
      return;
    }
    // 단계 전환
    const np = def.phases.length;
    let phase = 1;
    for (let i = 1; i < np; i++) if (frac <= 1 - i / np) phase = i + 1;
    if (phase > b.phase && b.mode !== 'enter') {
      b.phase = phase;
      b.mode = 'idle';
      b.rest = 1.5;
      b.atk = '';
      b.cycle = 0;
      for (const q of this.eb) { this.starFrom(q.x, q.y); q.alive = false; }
      for (const l of this.lasers) if (l.owner === e) l.alive = false;
      sfx('armorBreak');
      sfx('warn', 0.6);
      this.kick(0.6, 0.09);
      this.addFx('ring', e.x, e.y, 1.8, 0.4);
      for (let i = 0; i < 6; i++) this.addBoom(e.x + rand(-30, 30), e.y + rand(-20, 30), 0.8, i * 0.08);
      this.debris(e.x, e.y, 18, ['#c02040', '#d8a040', '#5a5a66']);
      this.bossSay(phase === np ? `${def.name} 최종 형태!` : `장갑 파손! ${def.name} 분노`, '#ff7a8a');
    }
    if (b.mode === 'enter') {
      e.y += (def.restY - e.y) * Math.min(1, dt * 1.6) + 10 * dt;
      if (e.y > def.restY - 4) {
        b.mode = 'idle';
        b.rest = 0.8;
      }
      return;
    }
    // 중간보스는 오래 버티면 도망 (보상 없음)
    if (def.mid && b.life > 48) {
      b.mode = 'flee';
      this.bossSay(`${def.name} 도주!`, '#cfc4ff');
      return;
    }
    const fast = b.phase === np && np >= 3 ? 1.15 : 1;
    // 이동 (공격 중에도 천천히)
    const mv = b.mode === 'atk' && b.atk === 'dash' ? 0 : b.mode === 'atk' ? 0.4 : 1;
    if (mv > 0) {
      let tx = W / 2;
      let ty = def.restY;
      if (def.move === 'sway') tx = W / 2 + Math.sin(b.life * 0.9) * 46;
      else if (def.move === 'drift') { tx = W / 2 + Math.sin(b.life * 0.6) * 40; ty += Math.sin(b.life * 1.1) * 8; }
      else if (def.move === 'figure8') { tx = W / 2 + Math.sin(b.life * 0.7) * 50; ty += Math.sin(b.life * 1.4) * 12; }
      else tx = W / 2 + Math.sin(b.life * 0.4) * 10;
      e.x += (tx - e.x) * Math.min(1, dt * 2.2 * mv);
      e.y += (ty - e.y) * Math.min(1, dt * 2.2 * mv);
    }
    // 2단계부터 잡몹 호위 (메인 보스)
    if (main && b.phase >= 2) {
      b.minion -= dt;
      if (b.minion <= 0) {
        b.minion = 11;
        this.spawnEnemy('fighter', 0, 'strafe', 1, 0, 40, 'needle2');
        this.spawnEnemy('fighter', 0, 'strafe', -1, 1, 52, 'needle2');
      }
    }
    if (b.mode === 'idle') {
      b.rest -= dt;
      if (b.rest <= 0) {
        const pool = def.phases[b.phase - 1];
        // 순서대로 돌되 같은 공격 연속 금지 · 매 바퀴 시작점 변화
        let atk = pool[(b.cycle + Math.floor(b.life)) % pool.length];
        if (atk === b.last) atk = pool[(pool.indexOf(atk) + 1) % pool.length];
        if (atk === 'dash' && def.art !== 'boss') atk = 'fan';
        b.cycle++;
        b.atk = atk;
        b.last = atk;
        b.at = 0;
        b.n = 0;
        b.sub = 0;
        b.tx = this.px;
        // 공격 전조: 레이저는 경고선이 전조이므로 짧게
        b.mode = 'tele';
        b.teleT = atk.startsWith('laser') ? 0.25 : 0.6;
        sfx('gaugeFull', 0.35, 0.6);
      }
      return;
    }
    if (b.mode === 'tele') {
      b.teleT -= dt;
      if (b.teleT <= 0) b.mode = 'atk';
      return;
    }
    b.at += dt * fast;
    if (this.runAttack(e, b, dt)) {
      b.mode = 'idle';
      const base = def.mid ? 1.0 : 0.85;
      b.rest = (base - (b.phase - 1) * 0.12) * this.dif.cd;
    }
  }

  /** 보스 공격 1회 진행. 끝나면 true */
  private runAttack(e: Enemy, b: BossState, dt: number): boolean {
    const kind = b.def.bullet;
    const my = e.y + 10;
    const ph = b.phase;
    const every = (sec: number): boolean => {
      b.sub -= dt;
      if (b.sub <= 0) { b.sub += sec * this.dif.cd; return true; }
      return false;
    };
    switch (b.atk) {
      case 'fan': {
        const shots = 2 + ph;
        if (b.at >= b.n * 0.5 && b.n < shots) {
          b.n++;
          const c = Math.min(7, this.cnt(3 + ph * 2, true));
          const a0 = this.aimAt(e.x, my);
          for (let i = 0; i < c; i++) this.shoot(e.x, my, a0 + (i - (c - 1) / 2) * 0.24, 66, kind);
        }
        return b.at > shots * 0.5 + 0.6;
      }
      case 'aimBurst': {
        if (b.at < 2.2 && (b.at < 0.7 || b.at > 1.4) && every(0.12)) this.shoot(e.x, my, this.aimAt(e.x, my) + rand(-0.04, 0.04), 105, 'needle');
        return b.at > 2.6;
      }
      case 'gatling': {
        if (b.at < 2.4 && every(0.1)) this.shoot(e.x, my, this.aimAt(e.x, my) + Math.sin(b.at * 7) * 0.14, 96, 'needle');
        return b.at > 3;
      }
      case 'ringPulse': case 'ring': {
        const nR = b.atk === 'ring' ? 3 : 4;
        if (b.at >= b.n * 0.7 && b.n < nR) {
          const c = this.cnt(b.atk === 'ring' ? 20 : 16);
          for (let i = 0; i < c; i++) this.shoot(e.x, my, (i / c) * TAU + b.n * 0.2, (b.atk === 'ring' ? 40 : 46) + b.n * 8, kind);
          b.n++;
        }
        return b.at > nR * 0.7 + 0.8;
      }
      case 'spiral2': case 'spiral3': case 'spiral4': {
        const arms = b.atk === 'spiral2' ? 2 : b.atk === 'spiral3' ? 3 : 4;
        if (b.at < 3.4 && every(0.09)) for (let k = 0; k < arms; k++) this.shoot(e.x, my - 4, b.at * 2.6 + (k / arms) * TAU, 52, 'wave');
        return b.at > 3.8;
      }
      case 'crossSpiral': {
        if (b.at < 3.6 && every(0.11)) {
          for (let k = 0; k < 2; k++) {
            this.shoot(e.x, my - 4, b.at * 2.2 + k * Math.PI, 50, 'wave');
            this.shoot(e.x, my - 4, -b.at * 2.2 + k * Math.PI + 0.5, 50, kind);
          }
        }
        return b.at > 4;
      }
      case 'flower': case 'flowerFast': {
        const fastF = b.atk === 'flowerFast';
        if (b.at < 3.2 && every(fastF ? 0.36 : 0.5)) {
          b.n++;
          const c = this.cnt(fastF ? 14 : 12);
          for (let i = 0; i < c; i++) {
            const a = (i / c) * TAU + (b.n % 2 ? 0.13 : -0.13) * b.n;
            this.shoot(e.x, my, a, fastF ? 58 : 42, kind);
            this.shoot(e.x, my, a + Math.PI / c, fastF ? 82 : 62, 'wave');
          }
        }
        return b.at > 3.6;
      }
      case 'dash': {
        if (b.at < 0.9) {
          e.x += (b.tx - e.x) * Math.min(1, dt * 3);
          e.x += Math.sin(b.at * 60) * 0.5;
          b.tx = this.px;
        } else if (b.at < 1.5) {
          e.y += 270 * dt * (b.at < 1.3 ? 1 : 0);
          if (e.y > H - 90) e.y = H - 90;
        } else if (b.at < 2.6) {
          if (b.n === 0) {
            b.n = 1;
            this.kick(0.5);
            sfx('bossHit', 1.2, 0.7);
          }
          // 착지 0.3초 뒤 위로 퍼지는 고리탄 (바로 옆에서 터지지 않게)
          if (b.n === 1 && b.at > 1.8) {
            b.n = 2;
            const c = this.cnt(10);
            for (let i = 0; i < c; i++) this.shoot(e.x, e.y - 10, Math.PI + (i / (c - 1)) * Math.PI, 50, kind);
          }
          e.y += (b.def.restY - e.y) * Math.min(1, dt * 2.4);
        } else return true;
        return false;
      }
      case 'rain': {
        if (b.at < 3.4 && every(0.16)) {
          this.newEB(rand(8, W - 8), -4, rand(-6, 6), this.spd(rand(58, 80)), BOSS_BULLET_R[kind], kind);
          this.shoot(e.x, my, Math.PI / 2 + rand(-0.5, 0.5), 52, kind);
        }
        return b.at > 3.8;
      }
      case 'sporeRain': {
        if (b.at < 3.4 && every(0.12)) {
          const q = this.newEB(rand(8, W - 8), -4, 0, this.spd(rand(34, 48)), 4, 'smell');
          if (q) q.wob = 24;
        }
        if (b.at < 3.4 && b.n < Math.floor(b.at / 1.1) + 1) {
          b.n++;
          const a0 = this.aimAt(e.x, my);
          for (let i = -1; i <= 1; i++) this.shoot(e.x, my, a0 + i * 0.2, 70, 'flask');
        }
        return b.at > 3.8;
      }
      case 'wallGap': {
        // 위에서 내려오는 탄의 벽 4줄 — 한 칸씩 빈 틈이 있음
        if (b.n < 4 && b.at >= b.n * 0.85) {
          b.n++;
          const gapW = 40 / Math.sqrt(this.dif.dens);
          const gx = clamp(this.px + rand(-30, 30), 24, W - 24);
          for (let x = 6; x < W; x += 11) if (Math.abs(x - gx) > gapW / 2) this.newEB(x, 28, 0, this.spd(58), 3, 'needle');
        }
        return b.at > 4.2;
      }
      case 'curtain': {
        // 고정된 세로 줄 탄 — 줄 사이 빈 통로(폭 약 15px)나 바깥쪽에 있으면 안전
        if (b.n === 0) { b.n = 1; b.tx = e.x; }
        if (b.at < 3 && every(0.3)) {
          for (let x = -60; x <= 60; x += 24) this.shoot(b.tx + x, my, Math.PI / 2, 70, 'needle');
        }
        return b.at > 3.4;
      }
      case 'snipeRain': {
        if (b.at < 3.2 && every(0.22)) this.newEB(rand(8, W - 8), -4, 0, this.spd(rand(55, 75)), 3, kind);
        if (b.at < 3.2 && b.n < Math.floor(b.at / 0.6) + 1) {
          b.n++;
          this.shoot(e.x, my, this.aimAt(e.x, my), 125, 'needle');
        }
        return b.at > 3.6;
      }
      case 'homing': {
        if (b.n < 2 && b.at >= b.n * 1.2) {
          b.n++;
          const c = this.cnt(6);
          for (let i = 0; i < c; i++) {
            const q = this.shoot(e.x, my, Math.PI / 2 + (i - (c - 1) / 2) * 0.45, 46, 'flask', 4);
            if (q) { q.hom = 1.1; q.ttl = 5; }
          }
        }
        return b.at > 3.2;
      }
      case 'bubbleRings': {
        if (b.n < 3 && b.at >= b.n * 0.9) {
          b.n++;
          const c = this.cnt(14);
          for (let i = 0; i < c; i++) {
            const q = this.shoot(e.x, my, (i / c) * TAU + b.n * 0.3, 80, 'ring', 4.5);
            if (q) q.acc = -0.55;
          }
        }
        return b.at > 3.4;
      }
      case 'waveCurtain': {
        if (b.at < 3.4 && every(0.18)) {
          for (const sd of [-1, 1]) {
            const q = this.shoot(e.x + sd * 30, my, Math.PI / 2, 52, kind);
            if (q) q.wob = 36 * sd;
          }
        }
        return b.at > 3.8;
      }
      case 'laserAim': {
        const n = ph >= 3 ? 3 : 2;
        if (b.n < n && b.at >= b.n * 1.05) {
          b.n++;
          this.addLaser(e.x, my, this.aimAt(e.x, my), 0.75, 0.45, 9, 0, e);
        }
        return b.at > n * 1.05 + 0.9;
      }
      case 'laserSweep': {
        if (b.n === 0) {
          b.n = 1;
          // 바깥 → 안쪽으로 쓸어오는 두 줄기 (가운데 아래·화면 가장자리 위쪽이 안전)
          this.addLaser(e.x, my, Math.PI / 2 + 1.05, 0.9, 1.9, 8, -0.42, e);
          this.addLaser(e.x, my, Math.PI / 2 - 1.05, 0.9, 1.9, 8, 0.42, e);
        }
        if (b.at > 1 && b.at < 2.8 && every(0.4)) this.shoot(e.x, my, this.aimAt(e.x, my), 70, kind);
        return b.at > 3.2;
      }
      case 'laserCross': {
        if (b.n === 0) {
          b.n = 1;
          const dirn = Math.random() < 0.5 ? 1 : -1;
          for (let k = 0; k < 4; k++) this.addLaser(e.x, e.y, Math.PI / 4 + (k * Math.PI) / 2, 1.0, 2.3, 7, 0.3 * dirn, e);
        }
        return b.at > 3.6;
      }
      default:
        return true;
    }
  }

  private addLaser(x: number, y: number, ang: number, warn: number, life: number, w: number, rot: number, owner: Enemy | null): void {
    this.lasers.push({ x, y, ang, len: 420, w, warn, life, t: 0, rot, owner, alive: true });
  }
  private updateLasers(dt: number): void {
    for (const l of this.lasers) {
      l.t += dt;
      if (l.owner && !l.owner.dead) { l.x = l.owner.x; l.y = l.owner.y + 10; }
      if (l.owner && (l.owner.dead || this.bsOf(l.owner).mode === 'dying')) l.alive = false;
      if (l.t > l.warn) {
        l.ang += l.rot * dt;
        if (l.t - l.warn < 0.05 && l.w > 0) sfx('beam', 0.5, 1.3);
        // 판정: 고나 중심점과 광선 사이 거리
        const dx = this.px - l.x;
        const dy = this.py + 2 - l.y;
        const along = dx * Math.cos(l.ang) + dy * Math.sin(l.ang);
        const perp = Math.abs(-dx * Math.sin(l.ang) + dy * Math.cos(l.ang));
        if (along > 0 && perp < l.w / 2 + 1 && !this.over) {
          if (this.barrier > 0 || (this.sp && this.sp.id === 'halabeoji' && this.sp.t >= this.sp.cut)) { /* 방어 */ } else this.hurtPlayer('레이저');
        }
      }
      if (l.t > l.warn + l.life) l.alive = false;
    }
    compact(this.lasers, (l) => l.alive);
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
      // 연사 대기 중인 탄(age<0)은 포구에서 기다렸다가 나감 — 보이지 않는 채로 미리 날아가지 않게
      if (b.age < 0) { b.age += dt; continue; }
      if (b.acc) {
        const f = 1 + b.acc * dt;
        const sp = Math.hypot(b.vx, b.vy);
        if (sp * f > 22 && sp * f < 160) { b.vx *= f; b.vy *= f; }
      }
      if (b.hom && b.age > 0.2 && b.age < 2.6) {
        const cur = Math.atan2(b.vy, b.vx);
        let d = Math.atan2(this.py - b.y, this.px - b.x) - cur;
        while (d > Math.PI) d -= TAU;
        while (d < -Math.PI) d += TAU;
        const na = cur + clamp(d, -b.hom * dt, b.hom * dt);
        const sp = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(na) * sp;
        b.vy = Math.sin(na) * sp;
      }
      b.x += b.vx * dt + (b.wob ? Math.cos(b.age * 3) * b.wob * dt : 0);
      b.y += b.vy * dt;
      b.age += dt;
      if (b.age > b.ttl || b.x < -20 || b.x > W + 20 || b.y < -24 || b.y > H + 20) b.alive = false;
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
          // 점수 메달: 놓치지 않고 연속으로 먹을수록 값이 오름
          sfx('item', 1, 1 + this.medal * 0.04);
          const v = MEDALS[Math.min(this.medal, MEDALS.length - 1)];
          this.medal++;
          this.score += v;
          this.floatText(it.x, it.y - 6, `${v}`, '#ffe34a');
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
      if (it.y > H + 12) {
        if (it.alive && it.kind === 'cookie') this.medal = 0; // 메달을 놓치면 단가 초기화
        it.alive = false;
      }
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
    // 화면 밖으로 잘리지 않게 (글자 폭 대략 계산)
    const half = Math.min(W / 2 - 2, text.length * 3.4);
    this.floats.push({ x: clamp(x, half + 2, W - half - 2), y, text, age: 0, col });
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

  /** 장갑 파손: 체력 80·60·40·20% 마다 큰 파열 + 그 자리에서 계속 연기·불꽃 */
  private checkArmor(e: Enemy): void {
    const frac = e.hp / e.max;
    const next = this.armorStage < 4 && frac <= 0.8 - this.armorStage * 0.2;
    if (!next || !this.bs || this.bs.mode === 'dying' || e !== this.boss) return;
    const [dx, dy] = this.armorPts[this.armorStage] ?? [0, 0];
    this.armorStage++;
    const x = e.x + dx;
    const y = e.y + dy;
    for (let i = 0; i < 4; i++) this.addBoom(x + rand(-8, 8), y + rand(-8, 8), rand(0.6, 0.9), i * 0.06);
    this.addFx('ring', x, y, 1.0, 0.3);
    this.debris(x, y, 14, ['#c02040', '#d8a040', '#5a5a66', '#3a2a2a']);
    this.kick(0.45, 0.06);
    sfx('armorBreak');
    buzz(40);
    this.floatText(x, y - 10, 'ARMOR BREAK!', '#ffc040');
  }

  /** 피해 처리. src: 맞힌 탄 종류(이펙트·소리 결정), hx/hy: 맞은 위치 */
  private damage(e: Enemy, dmg: number, src: PKind | 'bomb' | 'beam' | 'body', hx: number, hy: number): void {
    if (e.dead || e.y < -6) return;
    const strong = src === 'charge' || src === 'drill';
    const special = !!this.sp && src !== 'shot' && src !== 'wave' && src !== 'charge';
    if (e.kind === 'boss') {
      const b = this.bsOf(e);
      if (b.mode === 'enter' || b.mode === 'dying' || b.mode === 'flee') return;
      // 필살기·폭탄은 보스에게 절반 (보스를 순식간에 녹이지 않도록)
      if (special || src === 'bomb') dmg *= 0.5;
      // 부품(포탑)이 남아 있으면 본체는 장갑으로 덜 받음
      if (b.def.shielded && this.en.some((p) => p.kind === 'part' && p.parent === e && !p.dead)) dmg *= b.def.shielded;
      const wk = b.def.weak;
      const weak = !!wk && (hx - e.x - wk.dx) ** 2 + (hy - e.y - wk.dy) ** 2 < wk.r * wk.r;
      if (src !== 'beam' && src !== 'bomb') {
        if (weak) {
          dmg *= 1.5;
          this.addFx('weak', hx, hy, strong ? 1.6 : 1.15, 0.24);
          if (Math.random() < 0.35) this.addFx('ring', hx, hy, 0.55, 0.2);
          for (let i = 0; i < 2; i++) this.part(hx, hy, rand(-70, 70), rand(-90, -10), 0.35, i ? '#ffb8d8' : '#ffffff', 2, 160);
          sfx('bossWeak');
        } else {
          this.addFx('metal', hx, hy, strong ? 1.7 : 1.25, 0.24);
          this.part(hx, hy, rand(-80, 80), rand(-100, -30), 0.3, '#ffc040', 1, 220);
          if (Math.random() < 0.5) this.part(hx, hy, rand(-60, 60), rand(-70, -10), 0.5, '#9aa4b4', 2, 260);
          sfx('bossHit', 1, rand(0.92, 1.08));
        }
      } else if (Math.random() < 0.3) this.addFx('metal', hx, hy, 1.1, 0.2);
      if (e === this.boss) {
        if (this.bossFlashCd <= 0) {
          e.flash = strong ? 0.07 : 0.035;
          this.bossFlashCd = strong ? 0.1 : 0.2;
        }
        this.bossRecoil = Math.min(1.6, this.bossRecoil + (strong ? 1.6 : 0.5));
        this.bossBarHit = 0.12;
      } else if (e.flash <= -0.15) e.flash = 0.035; // 중간보스: 0.18초에 한 번만 짧게 번쩍
      if (strong) {
        this.kick(0.38, 0.07);
        this.addFx('ring', hx, hy, 1.2, 0.3);
        buzz(30);
      }
    } else if (src !== 'bomb') {
      if (e.kind === 'part' && (special)) dmg *= 0.6;
      this.addFx(e.kind === 'part' ? 'metal' : 'spark', hx, hy, strong ? 1.4 : 0.8, 0.18);
      sfx(e.kind === 'part' ? 'bossHit' : 'enemyHit', e.kind === 'part' ? 0.6 : 1);
      if (strong) this.kick(0.2, 0.04);
    }
    e.hp -= dmg;
    if (e.kind !== 'boss') e.flash = 0.06;
    else if (e === this.boss) this.checkArmor(e);
    this.addGauge(dmg * (e.kind === 'boss' ? 0.0016 : 0.0026));
    if (e.hp > 0) return;
    if (e.kind === 'boss') {
      const b = this.bsOf(e);
      if (b.mode !== 'dying') {
        e.hp = 0;
        b.mode = 'dying';
        b.dyingT = 0;
        for (const q of this.eb) { this.starFrom(q.x, q.y); q.alive = false; }
        for (const l of this.lasers) l.alive = false;
        for (const p of this.en) if (p.kind === 'part' && p.parent === e) this.killPart(p, false);
        if (!b.def.mid) {
          sfx('bossBreak');
          stopBgm(1.0);
          this.flashWhite = 0.6;
          // 남은 잡몹도 함께 폭발
          for (const o of this.en) if (o.kind === 'small') this.damage(o, 999, 'bomb', o.x, o.y);
        } else sfx('boomL', 0.8);
        this.bossSay(`${b.def.name} 격파!`, '#ffe34a');
        this.kick(1, 0.12);
        buzz([60, 40, 60], 0);
      }
      return;
    }
    if (e.kind === 'part') {
      this.killPart(e, true);
      return;
    }
    e.dead = true;
    this.combo++;
    this.comboT = 2.2;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.addScore(e.score, e.x, e.y - 8);
    this.addGauge(e.type === 'gunship' ? 0.05 : 0.016);
    if (e.type === 'gunship') {
      for (let i = 0; i < 5; i++) this.addBoom(e.x + rand(-18, 18), e.y + rand(-14, 14), rand(0.5, 0.8), i * 0.09);
      this.addBoom(e.x, e.y, 1.0, 0.45);
      this.addFx('ring', e.x, e.y, 1.1, 0.32);
      this.debris(e.x, e.y, 18, ['#8a6a3a', '#5a5a66', '#d8a040', '#3a2a2a']);
      this.kick(0.4, 0.05);
      sfx('boomM');
      buzz(35);
    } else if (e.type === 'orb') {
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
    const drop = (kind: Item['kind'], dx = 0): void => void this.items.push({ x: e.x + dx, y: e.y, kind, age: 0, alive: true });
    if (e.drop) drop(e.drop);
    else {
      const r = Math.random();
      if (e.type === 'gunship') { drop(r < 0.5 ? 'star' : 'cookie'); if (r < 0.35) drop('strawberry', 10); }
      else if (r < 0.05) drop('star');
      else if (r < 0.17) drop('cookie');
      else if (r < 0.19) drop('banana');
    }
  }

  private killPart(p: Enemy, reward: boolean): void {
    if (p.dead) return;
    p.dead = true;
    for (let i = 0; i < 4; i++) this.addBoom(p.x + rand(-8, 8), p.y + rand(-8, 8), rand(0.6, 0.9), i * 0.07);
    this.addFx('ring', p.x, p.y, 0.9, 0.3);
    this.debris(p.x, p.y, 12, ['#d8a040', '#5a5a66', '#3a2a2a']);
    if (!reward) return;
    sfx('armorBreak');
    this.kick(0.4, 0.05);
    this.score += p.score;
    this.floatText(p.x, p.y - 8, `${p.score}`, '#ffc040');
    this.items.push({ x: p.x, y: p.y, kind: 'cookie', age: 0, alive: true });
    // 부품 자리에 계속 연기
    if (p.parent === this.boss) this.partSmoke.push([p.dx ?? 0, p.dy ?? 0]);
    this.addGauge(0.08);
  }

  // ───────────── 충돌 ─────────────
  private collide(): void {
    for (const b of this.pb) {
      if (!b.alive) continue;
      for (const e of this.en) {
        if (e.dead) continue;
        if (b.pierce && b.hits.includes(e.id)) continue;
        let hit: boolean;
        let hx = b.x;
        let hy = b.y;
        if (e.kind === 'boss' && b.kind !== 'drill') {
          // 보스: 그림 실루엣에 닿은 정확한 지점 (탄 머리 → 몸통 순으로 검사)
          hit = Math.abs(b.x - e.x) < 90 && Math.abs(b.y - e.y) < 90 && (this.bossSolid(e, b.x, b.y - 4) || this.bossSolid(e, b.x, b.y) || (b.r > 5 && this.bossSolid(e, b.x, b.y - b.r)));
          if (hit && b.kind === 'charge') { hx = b.x; hy = b.y - b.r * 0.6; }
          else if (hit) hy = this.bossSolid(e, b.x, b.y - 4) ? b.y - 4 : b.y;
        } else {
          const rr = b.r + e.hr;
          hit = (b.x - e.x) ** 2 + (b.y - e.y) ** 2 < rr * rr;
          hy = Math.max(b.y, e.y - e.hr * 0.7);
        }
        if (hit) {
          this.damage(e, b.dmg, b.kind, hx, hy);
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
        else this.hurtPlayer(`탄:${q.kind}`);
      }
    }
    for (const e of this.en) {
      if (e.dead || e.y < 0) continue;
      if (e.kind === 'boss') {
        const bm = this.bsOf(e).mode;
        if (bm === 'dying' || bm === 'enter' || bm === 'flee') continue;
        // 보스 몸통 접촉도 실루엣 기준
        if (this.bossSolid(e, hx, hy)) this.hurtPlayer('보스몸통');
        continue;
      }
      if (e.kind === 'part') continue;
      if ((e.x - hx) ** 2 + (e.y - hy) ** 2 < (e.hr * 0.8 + 3) ** 2) {
        this.hurtPlayer(`몸통:${e.type}`);
        this.damage(e, 99, 'body', e.x, e.y);
      }
    }
  }

  private finish(won: boolean): void {
    if (this.over) return;
    this.over = true;
    this.overWon = won;
    this.setCharging(false);
    this.endT = 0;
    const final = won && this.st.id === STAGES.length;
    const bonus = { clear: 0, hp: 0, bomb: 0, noMiss: 0, total: 0 };
    if (!won) {
      playBgm('over', 0.3);
      this.banner = { text: 'GAME OVER', t: 9, col: '#ff7a8a' };
      this.kick(0.8);
    } else {
      playBgm('clear', 0.3);
      bonus.clear = 10000 * this.st.id;
      bonus.hp = Math.max(0, Math.min(this.hp, MAX_HP)) * 2000;
      bonus.bomb = this.bombs * 1000;
      bonus.noMiss = this.hits === 0 ? 20000 * this.st.id : 0;
      bonus.total = bonus.clear + bonus.hp + bonus.bomb + bonus.noMiss;
      this.score += bonus.total;
      this.banner = { text: final ? 'ALL CLEAR!' : 'STAGE CLEAR!', t: 9, col: '#ffe34a' };
    }
    const info: EndInfo = {
      won, final, stage: this.st.id, score: this.score, time: this.t, maxCombo: this.maxCombo, hp: Math.max(0, Math.min(this.hp, MAX_HP)), bombs: this.bombs, power: this.power,
      noMiss: this.hits === 0, bonus,
    };
    this.endInfo = info;
    window.setTimeout(() => this.alive && this.onEnd(info), won ? 3200 : 1800);
  }
  endInfo: EndInfo | null = null;

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
    g.drawImage(this.art['bg-backdrop'], 0, 0, W * R, H * R);
    g.fillStyle = 'rgba(40, 20, 70, 0.28)';
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = 'rgba(16, 8, 34, 0.22)';
    g.fillRect(0, 0, c.width, c.height);
    return c;
  }
  /** 배경 소품: 레이어 배율로 줄이고 같은 덮개 색을 미리 입힘 (알파는 그릴 때) */
  private propImg(name: ArtName, layer: number): HTMLCanvasElement {
    const key = `${name}|${layer}`;
    let c = this.propBaked.get(key);
    if (c) return c;
    const im = this.art[name];
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
  private darkPuffC: HTMLCanvasElement | null = null;
  private darkPuff(): HTMLImageElement {
    if (!this.darkPuffC) {
      const im = this.a.v2['fx/steam-puff'];
      const [c, g] = this.mkCanvas(im.width, im.height);
      g.drawImage(im, 0, 0);
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = 'rgba(30, 22, 40, 0.62)';
      g.fillRect(0, 0, c.width, c.height);
      this.darkPuffC = c;
    }
    return this.darkPuffC as unknown as HTMLImageElement;
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
    for (const e of this.en) if (e.kind !== 'part') this.drawEnemy(e);
    for (const e of this.en) if (e.kind === 'part') this.drawEnemy(e);
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

    // 레이저 · 적 탄 — 맨 위 (고나·동료·이펙트에 가려지지 않게)
    this.drawLasers();
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

  // ───────────── 스테이지 배경 ─────────────
  private spawnProp(entry: [number, ArtName, number, number, number], y?: number): void {
    const [, name, layer, fx, vx] = entry;
    const im = this.propImg(name, layer);
    const L = LAYER[layer];
    this.props.push({ name, x: fx * W, y: y ?? -im.height / R / 2 - 4, v: L.v, layer, vx });
  }
  private updateProps(dt: number): void {
    const P = this.st.props;
    if (this.propIdx === 0 && this.propLoop === 0 && this.props.length === 0) {
      this.spawnProp(P[0], 70);
      this.spawnProp(P[1], 20);
      this.spawnProp([0, 'island-small', 0, 0.82, 0], 190);
      this.spawnProp([0, 'cloud-big', 2, 0.9, 0], 250);
    }
    const tt = this.t - this.propLoop * 60;
    while (this.propIdx < P.length && P[this.propIdx][0] <= tt) this.spawnProp(P[this.propIdx++]);
    if (tt >= 60) { this.propLoop++; this.propIdx = 0; }
    for (const p of this.props) { p.y += p.v * dt; p.x += p.vx * dt; }
    compact(this.props, (p) => p.y < H + 120);
    // 스테이지 분위기 입자 (단순 이펙트)
    this.ambientT -= dt;
    if (this.ambientT <= 0) {
      switch (this.st.fx) {
        case 'spores':
          this.ambientT = 0.18;
          this.part(rand(0, W), H + 4, rand(-8, 8), rand(-30, -14), 6, Math.random() < 0.5 ? '#a6f070' : '#e8ffb0', 1, 0);
          break;
        case 'steam':
          this.ambientT = 0.5;
          this.addFx('puff', Math.random() < 0.5 ? rand(0, 30) : rand(W - 30, W), rand(20, H), 0.7, 0.9, 18);
          if (Math.random() < 0.5) this.part(rand(0, W), -4, rand(-20, 20), rand(40, 80), 3, '#ffb040', 1, 0);
          break;
        case 'bubbles':
          this.ambientT = 0.14;
          this.part(rand(0, W), H + 4, rand(-6, 6), rand(-40, -20), 8, Math.random() < 0.6 ? '#9cf0ff' : '#e0ffff', Math.random() < 0.3 ? 2 : 1, 0);
          break;
        case 'embers':
          this.ambientT = 0.12;
          this.part(rand(0, W), H + 4, rand(-12, 12), rand(-45, -20), 7, Math.random() < 0.5 ? '#ff6040' : '#ffb060', 1, 0);
          break;
        case 'storm':
          this.ambientT = 0.15;
          this.part(rand(0, W), -4, rand(-30, -10), rand(90, 140), 3, '#a080e0', 1, 0);
          if (Math.random() < 0.012 && !this.boss) this.flashWhite = Math.max(this.flashWhite, 0.18);
          break;
        default:
          this.ambientT = 9;
      }
    }
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

  /** 레이저: 경고선(깜박이는 가는 선) → 굵은 광선 (단순 이펙트) */
  private drawLasers(): void {
    const g = this.g;
    for (const l of this.lasers) {
      const ex = l.x + Math.cos(l.ang) * l.len;
      const ey = l.y + Math.sin(l.ang) * l.len;
      g.beginPath();
      g.moveTo(l.x, l.y);
      g.lineTo(ex, ey);
      if (l.t < l.warn) {
        g.globalAlpha = Math.floor(l.t * 14) % 2 ? 0.9 : 0.45;
        g.strokeStyle = '#ff4060';
        g.lineWidth = 1;
        g.stroke();
      } else {
        const k = Math.min(1, (l.t - l.warn) * 8, (l.warn + l.life - l.t) * 6);
        g.globalAlpha = 0.85;
        g.strokeStyle = '#c0103a';
        g.lineWidth = l.w * k + 2;
        g.stroke();
        g.strokeStyle = '#ff90a8';
        g.lineWidth = l.w * k * 0.6;
        g.stroke();
        g.strokeStyle = '#ffffff';
        g.lineWidth = Math.max(1, l.w * k * 0.25);
        g.stroke();
      }
      g.globalAlpha = 1;
    }
  }

  private drawWarning(): void {
    if (this.over || this.block !== 'warning') return;
    const g = this.g;
    const k = Math.sin(this.warnT * 9) * 0.5 + 0.5;
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
    this.text(`${this.st.boss.name} 접근 중`, W / 2, 176, '#ffe0e8', 'center', 11);
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
      case 'smoke': {
        // 보스 파손 연기: 회색 구름을 어둡게 (미리 구운 사본)
        const g = this.g;
        g.globalAlpha = 0.85 - k * 0.6;
        this.frame(this.darkPuff(), Math.min(2, Math.floor(k * 3)), 3, f.x, f.y, f.scale + k * 0.5);
        g.globalAlpha = 1;
        break;
      }
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
  private drawV2(im: HTMLImageElement, cx: number, cy: number, white: boolean, rot = 0, sx = 0, sw = im.width, k = 0.5): void {
    const g = this.g;
    const w = sw * k;
    const h = im.height * k;
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
    if (white) {
      g.globalAlpha = w < 60 ? 0.55 : 0.34;
      g.drawImage(whiteOf(this.a, im), sx, 0, sw, im.height, x, y, w, h);
      g.globalAlpha = 1;
    }
  }

  private drawEnemy(e: Enemy): void {
    const white = e.flash > 0;
    const im = this.art[e.art];
    if (e.kind === 'small') {
      let rot = 0;
      if (e.pat === 'strafe') rot = (-e.dir * Math.PI) / 2;
      else if ((e.pat === 'dive' && e.vy !== 0) || e.pat === 'loop' || e.pat === 'snake') rot = Math.atan2(e.vy, e.vx) - Math.PI / 2;
      const bob = e.pat === 'sine' || e.pat === 'swarm' || e.pat === 'zig' ? Math.sin(e.age * 8) * 1.2 : 0;
      this.drawV2(im, e.x, e.y + bob, white, rot);
      const g = this.g;
      // 발사 전조: 포탑 발광 · 저격 반짝임
      if ((e.type === 'orb' && e.fire < 0.35 && e.age < 7.5) || (e.fireKind === 'snipe' && e.fire < 0.4 && e.fire > 0)) {
        g.globalAlpha = 0.6; g.fillStyle = e.fireKind === 'snipe' ? '#ffe0f0' : '#d8b8ff'; g.beginPath(); g.arc(e.x, e.y + 4, 3 + (0.4 - e.fire) * 12, 0, TAU); g.fill(); g.globalAlpha = 1;
      }
      if (e.type === 'gunship') this.hpBar(e.x - 14, e.y + 30, 28, e.hp / e.max);
      return;
    }
    if (e.kind === 'part') {
      this.drawV2(im, e.x, e.y, white, 0, 0, im.width, e.k);
      if (e.hp < e.max) this.hpBar(e.x - 8, e.y + 9, 16, e.hp / e.max);
      return;
    }
    const b = this.bsOf(e);
    const def = b.def;
    const fw = im.width / def.frames;
    const shakeX = b.mode === 'dying' ? Math.sin(e.age * 60) * 1.5 : b.mode === 'tele' ? Math.sin(e.age * 70) * 0.7 : 0;
    const recoil = e === this.boss ? Math.round(this.bossRecoil) : 0;
    const sx = def.frames > 1 && (b.phase >= 2 || b.mode === 'dying') ? fw : 0;
    this.drawV2(im, e.x + shakeX, e.y - recoil, white, 0, sx, fw, def.k);
    if (def.core) {
      // 최종 보스: 성채 위의 심장 코어 (부품이 남아 있으면 어둡게 봉인)
      const cim = this.art[def.core.art];
      const cfw = cim.width / 2;
      const sealed = this.en.some((p) => p.kind === 'part' && p.parent === e && !p.dead);
      this.g.globalAlpha = sealed ? 0.55 : 1;
      this.drawV2(cim, e.x + shakeX, e.y + def.core.dy - recoil, white, 0, b.phase >= 3 ? cfw : 0, cfw, def.core.k);
      this.g.globalAlpha = 1;
    }
    const g = this.g;
    // 공격 전조: 포구에 에너지가 모임
    if (b.mode === 'tele') {
      const k = 1 - b.teleT / 0.6;
      this.frame(this.a.v2['fx/charge-orb'], Math.min(3, Math.floor(k * 4)), 4, e.x, e.y + 10, 1 + k * 0.6);
      if (Math.floor(e.age * 20) % 2) this.frame(this.a.v2['fx/ring'], Math.min(3, Math.floor((1 - k) * 4)), 4, e.x, e.y + 10, 0.9);
    }
    if (b.mode === 'atk' && b.atk === 'dash' && b.at < 0.9) {
      g.fillStyle = Math.floor(b.at * 10) % 2 ? '#ff4f86' : '#fff';
      g.fillRect(Math.floor(b.tx - 1), Math.floor(e.y + 50), 3, H - Math.floor(e.y) - 90);
    }
    // 중간보스 체력바
    if (def.mid && b.mode !== 'dying') {
      const w = 44;
      g.fillStyle = '#120a26'; g.fillRect(Math.floor(e.x - w / 2) - 1, Math.floor(e.y - 40), w + 2, 5);
      g.fillStyle = '#ffc040'; g.fillRect(Math.floor(e.x - w / 2), Math.floor(e.y - 39), Math.round(w * clamp(e.hp / e.max, 0, 1)), 3);
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
      // 잔상(흰색) → 실제 체력: 맞는 순간 줄어드는 양이 보이게
      g.fillStyle = '#fff4d6';
      g.fillRect(46, 31, Math.round((W - 60) * clamp(this.bossTrail, f, 1)), 5);
      g.fillStyle = this.bs.phase === 1 ? '#ff6f9f' : this.bs.phase === 2 ? '#ff4f86' : '#e0482c';
      g.fillRect(46, 31, Math.round((W - 60) * f), 5);
      if (this.bossBarHit > 0.06) { g.fillStyle = '#ffffff'; g.fillRect(46, 31, Math.round((W - 60) * f), 1); g.fillRect(45 + Math.round((W - 60) * f), 30, 2, 7); }
      g.fillStyle = '#120a26'; for (const q of [1 / 3, 2 / 3]) g.fillRect(46 + Math.round((W - 60) * q), 31, 1, 5);
      this.text('BOSS', 12, 28, '#ff9ec0', 'left', 11);
      // 단계 표시
      for (let i = 0; i < this.bs.def.phases.length; i++) { g.fillStyle = i < this.bs.phase ? '#ff4f86' : '#3a1028'; g.fillRect(W - 12 - i * 5, 40, 3, 3); }
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
