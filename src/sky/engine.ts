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
import { familyText, THEME_ID } from './theme';
import { talkLines, talkMode, barkSeconds, type TalkKey } from './story';
import { evalRank, type Rank, type RankItem } from './rank';
import { STAGES, DIFF, ENEMIES, type PartDef, type StageDef, type Difficulty, type DiffDef, type EnemyName, type Move, type Fire, type ArtName, type BossDef, type Attack, type Step, type Wave } from './stages';
import { bulletLooks, type BulletLook } from './bullets';
import { CHARACTERS } from './data/characters';
import { sfx, stopSfx, playBgm, stopBgm } from './audio';
import { settings, buzz } from './settings';

export const W = 180;
export const H = 320;
const CROPCHECK = typeof location !== 'undefined' && location.search.includes('skytest');
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
  bonus: { clear: number; hp: number; bomb: number; noMiss: number; rank: number; total: number };
  /** 랭크 평가 (클리어했을 때) */
  hits: number;
  bombsUsed: number;
  partsBroken: number;
  partsTotal: number;
  /** 이번 스테이지에서 번 점수 (보너스 전) */
  stageScore: number;
  rank?: Rank;
  rankPts?: number;
  rankItems?: RankItem[];
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
  /** 일일 도전 규칙: 폭탄 없음 · 하트 1개 (회복 대신 점수) */
  rules?: { noBomb?: boolean; oneLife?: boolean };
}

export interface HudInfo {
  hp: number;
  paused: boolean;
  /** 가족 필살기 게이지 0~1 */
  gauge: number;
  bombs: number;
}

// ───────────── 뽀글이·꾸덕이 스테이지별 연출 (등장 방향 · 장난 · 도망) ─────────────
type VilPrank = 'ring' | 'puffs' | 'squad' | 'rain' | 'turrets' | 'guards';
const VIL_STYLE: { from: 'top' | 'left' | 'right' | 'swoop'; prank: VilPrank; exit: 'up' | 'spin' | 'dash' | 'zigzag' | 'drop' | 'split' }[] = [
  { from: 'top', prank: 'ring', exit: 'up' }, // 1 이유식 왕국: 위에서 내려와 가스 고리 + 쌀알 졸개
  { from: 'left', prank: 'puffs', exit: 'spin' }, // 2 버섯가스 숲: 왼쪽에서 등장, 가스 풍선 3개, 빙글빙글 도망
  { from: 'right', prank: 'squad', exit: 'dash' }, // 3 소화 공장: 오른쪽에서 등장, 양옆 편대, 옆으로 질주
  { from: 'swoop', prank: 'rain', exit: 'zigzag' }, // 4 수분의 바다: 아래에서 휘어 올라옴, 물방울 비, 지그재그
  { from: 'top', prank: 'turrets', exit: 'drop' }, // 5 딱딱 응가 성문: 포탑 설치, 헛디뎌 떨어졌다가 튀어 도망
  { from: 'right', prank: 'guards', exit: 'split' }, // 6 변비마왕성: 근위대 호출, 둘이 서로 다른 쪽으로 (배신)
];

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

type PKind = 'shot' | 'wave' | 'charge' | 'heart' | 'star' | 'elec' | 'potion' | 'lance' | 'missile' | 'refl' | 'drill' | 'water' | 'prune' | 'probio';
interface PBullet {
  x: number; y: number; vx: number; vy: number; r: number; dmg: number; kind: PKind; lvl: number;
  pierce: boolean; hits: number[]; life: number; scale: number; homing: number; age: number; alive: boolean;
  /** 할아버지 방패파: 막아 줄 수 있는 적 탄 수 */
  absorb: number;
}
type EBKind = 'flask' | 'smell' | 'heart' | 'wave' | 'needle' | 'ring' | 'fire';
interface EBullet {
  x: number; y: number; vx: number; vy: number; r: number; kind: EBKind; age: number; alive: boolean;
  /** 가감속(초당 배율) · 유도(초당 회전) · 좌우 흔들림 · 수명 */
  acc: number; hom: number; wob: number; ttl: number;
  /** 수명이 다하면 이 개수의 원형탄으로 터짐 (필살기 포자) */
  pop?: number;
}
type EKind = 'small' | 'boss' | 'part';
interface Enemy {
  id: number; kind: EKind; type: EnemyName | ''; art: ArtName; k: number; pat: Move | 'boss'; fireKind: Fire;
  x: number; y: number; x0: number; vx: number; vy: number;
  hp: number; max: number; age: number; flash: number; fire: number; dir: number; hr: number; score: number; dead: boolean; ph: number; burst: number;
  holdY: number; drop?: Item['kind'];
  /** 부품: 본체 기준 위치 · 공격 */
  parent?: Enemy; dx?: number; dy?: number; partFire?: 'aim' | 'ring' | 'needle' | 'homing' | 'none'; partCd?: number;
  /** 응가 팩 보스 부위 (parts.png 칸 · 이름 · 파괴 효과) */
  pdef?: PartDef;
  /** 부위 피격 반응 (밀림 · 떨림) 남은 시간 */
  hitT?: number;
}
/** 레이저: 경고선(warn) → 발사(life) */
interface Laser { x: number; y: number; ang: number; len: number; w: number; warn: number; life: number; t: number; rot: number; owner: Enemy | null; alive: boolean }
interface Item { x: number; y: number; kind: 'cookie' | 'strawberry' | 'banana' | 'star'; age: number; alive: boolean }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; col: string; size: number; g: number }
interface Boom { x: number; y: number; age: number; delay: number; scale: number }
type FxKind = 'spark' | 'metal' | 'weak' | 'ring' | 'puff' | 'smoke' | 'wsplash' | 'psplash';
interface Fx { kind: FxKind; x: number; y: number; age: number; dur: number; scale: number; vy: number }
interface Prop { name: ArtName; x: number; y: number; v: number; layer: number; vx: number }
interface Float { x: number; y: number; text: string; age: number; col: string }
interface Beam { follow: boolean; x: number; t: number; max: number; tick: number; wide: boolean }

interface BossState {
  def: BossDef;
  mode: 'enter' | 'idle' | 'tele' | 'atk' | 'dying' | 'flee';
  atk: Attack | ''; at: number; rest: number; last: string; phase: number; n: number; tx: number; sub: number; minion: number; dyingT: number; teleT: number;
  cycle: number; mask: { w: number; h: number; m: Uint8Array }[]; life: number;
  /** 다음 공격을 필살기로 (페이즈 전환 직후 · 마지막 페이즈에서 주기적으로) */
  sigDue?: boolean;
  /** 부위 파괴 결과: 쓰지 않게 된 공격 · 새로 열린 공격 · 약점 배율 · 쉬는 시간 배율 · 남은 잔해 */
  cut: Attack[]; rage: Attack[]; weakMul: number; restMul: number;
  /** 약점 노출 표시 남은 시간 (부위가 깨진 직전) · 노출 여부 */
  exposedT?: number;
  wrecks: { dx: number; dy: number; cell: number; k: number }[];
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
/** 가족 차지 공격: 완전 충전까지 걸리는 시간(초) — 아빠·할아버지는 빨리, 삼촌은 오래 */
const CHARGE_FULL: Record<FamilyId, number> = { mom: 1.0, dad: 0.8, imo: 1.0, halmeoni: 1.0, halabeoji: 0.8, samchon: 1.2 };
/** 근접 공격: 돌진 시간 · 돌진 속도 · 가족별 피해 · 쿨다운(초). 붙어야 맞고, 맞는 동안 잠깐 무적 */
/** 동료 비행 그림 표시 배율: 대기 프레임의 실제 실루엣 면적을 엄마(2860px²)·아빠·삼촌 기준으로 맞춤
 *  (측정: 할머니 3841 · 할아버지 3634 → √(2860/면적) ≈ 0.86 · 0.89 / 이모 2428 은 원래 날씬한 체형이라 그대로) */
const FLY_K: Record<FamilyId, number> = { mom: 1, dad: 1, imo: 1, samchon: 1, halmeoni: 0.87, halabeoji: 0.89 };
const MELEE_T = 0.32;
/** 터치 차지: 이만큼 누르고 있어야 충전 시작 (짧은 터치 · 잠깐 움직임은 차지가 아님) */
const HOLD_START = 0.3;
/** 손을 뗐을 때 차지 공격이 나가는 최소 충전량 (= 약 0.65초 이상 누름) */
const HOLD_FIRE = 0.35;
const MELEE_SPEED = 240;
const MELEE: Record<FamilyId, { dmg: number; cd: number }> = {
  mom: { dmg: 3, cd: 2.2 }, dad: { dmg: 6, cd: 2.6 }, imo: { dmg: 3, cd: 1.8 }, halmeoni: { dmg: 3, cd: 2.8 }, halabeoji: { dmg: 5, cd: 3.0 }, samchon: { dmg: 4, cd: 2.6 },
};
const BOMB_T = 1.9;
const CAP = { parts: 220, booms: 36, fx: 70, floats: 10, eb: 320 };
const MEDALS = [100, 200, 300, 500, 800, 1000, 1500, 2000, 3000, 5000];
/** 탄 종류 → 모양 */
/** 스테이지 보스 필살기 이름 (예고 문구) */
const SIG_NAME = ['쫀득 떡메치기', '포자 대폭발', '블렌더 회오리', '대해일 촉수', '방패 대돌진', '대막힘 메테오'];
const BOSS_BULLET_R: Record<EBKind, number> = { flask: 3.5, smell: 4.5, heart: 3.5, wave: 3, needle: 2.6, ring: 3.5, fire: 4 };
/** 필살기 이름 (characters.ts 의 special 대신 이번 기획 이름) */
export const SPECIAL_NAME: Record<FamilyId | 'gona', string> = {
  gona: '황금 익룡의 포효', mom: '하트 스톰', dad: '스팀 브레이커', imo: '스타 캐논 버스트', halmeoni: '골든 힐링', halabeoji: '가디언 실드', samchon: '메가 인벤션',
};
/** 무기 진화 이름 (동료별 Lv1~4) — 레벨업 문구 · 결과 화면 */
export const WEAPON_NAME: Record<FamilyId, string[]> = {
  mom: ['물방울', '물방울 부채', '목욕 물줄기', '대목욕 폭포'],
  dad: ['물대포', '연발 물대포', '관통 수류', '초고압 물대포'],
  imo: ['프룬탄', '3연 프룬탄', '고속 프룬탄', '별빛 프룬탄'],
  halmeoni: ['약초 포션', '튐 포션', '쌍 포션', '삼단 포션'],
  halabeoji: ['수호 창', '빠른 창', '방패파', '철벽 방패파'],
  samchon: ['유산균 1기', '유산균 2기', '강화 유산균', '유산균 3기'],
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
  if (c) {
    // 최근에 쓴 글자를 뒤로 (오래 안 쓴 것부터 지움 — 예전엔 360장마다 통째로 비워 한꺼번에 다시 만들며 끊김)
    textCache.delete(key);
    textCache.set(key, c);
    return c;
  }
  if (textCache.size > 200) textCache.delete(textCache.keys().next().value as string);
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
  /** 근접 공격 상태 · 스테이지 회복 보급 남은 횟수 */
  private meleeT = 0;
  private meleeCd = 0;
  private meleeSeen = new Set<number>();
  private healLeft = 0;
  /** 할머니 필살기: 피어오르는 하트 (기존 하트 스프라이트 재사용 · 임시 효과) */
  private healHearts: { x: number; y: number; t0: number }[] = [];
  private volley = 0;
  private charge = 0;
  private charging = false;
  /** 터치 차지: 손가락을 누르고 있는 시간 · MAX 알림 1회 · 근접 자동 발동 · 이번 근접이 돌진형인지 */
  private holdT = 0;
  private tcMax = false;
  autoMelee = true;
  private meleeLunge = true;
  private meleeHitT = 0;
  private nCharge = 0;
  private nMelee = 0;
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
  /** 필살기 예고 (화면 가장자리 붉은 깜빡임) 남은 시간 */
  private sigWarn = 0;
  private armorStage = 0;
  private smokeT = 0;
  private armorPts: number[][] = [];
  private partSmoke: number[][] = [];
  /** 이번 스테이지 보스 부위 파괴 수 · 전체 수 (랭크 평가) */
  partsBroken = 0;
  /** 보스 분노 컷인 남은 시간 · 최종 형태 여부 · 격파 슬로모션 */
  private rageT = 0;
  private rageFinal = false;
  private slowT = 0;
  /** 부서져 떨어지는 부위 조각 */
  private chunks: { cell: number; x: number; y: number; vx: number; vy: number; rot: number; vr: number; k: number; t: number }[] = [];
  private darkCache = new Map<CanvasImageSource, HTMLCanvasElement>();
  /** 그림자용 어두운 실루엣 (한 번만 만듦) */
  private darkOf(src: HTMLImageElement): HTMLCanvasElement {
    let c = this.darkCache.get(src);
    if (!c) {
      const [cc, g] = this.mkCanvas(src.width, src.height);
      g.drawImage(src, 0, 0);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = '#1a0a20';
      g.fillRect(0, 0, cc.width, cc.height);
      c = cc;
      this.darkCache.set(src, c);
    }
    return c;
  }
  private startScore = 0;
  private diffId: Difficulty = 'normal';
  private bombsUsed = 0;
  private rules: NonNullable<RunOpts['rules']> = {};
  partsTotal = 0;

  // 스테이지 진행
  private st: StageDef;
  private dif: DiffDef;
  private stepIdx = 0;
  private stepWait = 0;
  private block: 'none' | 'midboss' | 'warning' | 'boss' | 'villain' = 'none';
  // ───── 응가 팩 스토리: 대화(전투 정지) · 뽀글이·꾸덕이 ─────
  /** 대화창을 띄울 때 부름 (SkyGame 이 설정) — 대화가 끝나면 endTalk() */
  onTalk: ((key: TalkKey) => void) | null = null;
  /** 전투를 멈추지 않는 무전창 대사 (SkyGame 이 설정) */
  onBark: ((key: TalkKey) => void) | null = null;
  talking = false;
  private talkDone = new Set<string>();
  /** 같은 순간에 대사가 겹치면 (페이즈 전환 + 격파 등) 차례대로 */
  private talkQ: TalkKey[] = [];
  private vil: { kind: 'prank' | 'callMid' | 'callBoss'; x: number; y: number; sx: number; sy: number; vy: number; t: number; t2: number; hold: number; split: number; mode: 'in' | 'talk' | 'act' | 'out'; act: number; done: boolean } | null = null;
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
    this.diffId = opts.diff;
    this.fam = opts.fam;
    this.hp = opts.hp;
    this.bombs = opts.bombs;
    this.power = opts.power;
    this.healLeft = this.dif.heal;
    this.score = opts.score;
    this.startScore = opts.score;
    this.rules = opts.rules ?? {};
    if (this.rules.noBomb) this.bombs = 0;
    if (this.rules.oneLife) { this.hp = 1; this.healLeft = 0; }
    this.resize();
    this.bgBaked = this.bakeBackdrop();
    this.prewarm();
    this.cCd = this.fam === 'halmeoni' ? 5 : this.fam === 'halabeoji' ? 1 : 1.2;
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onCancel);
    canvas.addEventListener('contextmenu', this.noMenu); // 길게 누르기 → 메뉴·이미지 저장 창이 뜨지 않게
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
    this.canvas.removeEventListener('pointercancel', this.onCancel);
    this.canvas.removeEventListener('contextmenu', this.noMenu);
    this.canvas.removeEventListener('pointercancel', this.onUp);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKeyUp);
    stopSfx(this.chargeSnd);
    // 이 판에서 만든 캔버스를 바로 0 크기로 (iOS 사파리 캔버스 메모리 한도 · 늦은 회수로 인한 끊김 방지)
    for (const m of [this.propBaked, this.ebImg, this.pbImg]) { for (const c of m.values()) { c.width = 0; c.height = 0; } m.clear(); }
    this.bgBaked.width = 0;
    this.bgBaked.height = 0;
    for (const im of Object.values(this.art)) {
      const c = im && this.a.flash.get(im);
      if (c) { c.width = 0; c.height = 0; this.a.flash.delete(im); }
    }
  }
  /** 스토리 대화 시작 (대사가 없으면 아무것도 안 함 → 케이크 테마·대사 없는 순간은 그대로 진행) */
  private talk(key: TalkKey): boolean {
    if (this.over || !this.onTalk || this.talkDone.has(key) || !talkLines(this.st.id, key)) return false;
    this.talkDone.add(key);
    if (talkMode(this.st.id, key) === 'bark') {
      this.onBark?.(key);
      return false;
    }
    if (this.talking) {
      this.talkQ.push(key);
      return true;
    }
    this.talking = true;
    this.setCharging(false);
    this.cancelHold();
    this.dragId = null;
    this.hasTarget = false;
    this.keys.clear();
    this.onTalk(key);
    return true;
  }
  /** 무전창 대사가 보이는 시간 (빌런이 그동안 제자리에서 떠듦) */
  private barkDur(key: TalkKey): number {
    const ls = talkLines(this.st.id, key);
    if (!ls || talkMode(this.st.id, key) !== 'bark') return 0;
    let t = 0;
    for (const l of ls) {
      const tx = l.who === 'partner' ? l.by?.[this.fam] : l.text;
      if (tx) t += barkSeconds(tx);
    }
    return t;
  }
  /** 대화가 끝나면 SkyGame 이 부름 → 전투 재개 (재개 직후 잠깐 무적) */
  endTalk(): void {
    if (!this.talking) return;
    const nx = this.talkQ.shift();
    if (nx && this.onTalk && !this.over) {
      this.onTalk(nx);
      return;
    }
    this.talking = false;
    this.inv = Math.max(this.inv, 0.8);
    this.last = performance.now();
  }
  setPaused(p: boolean): void {
    this.paused = p;
    if (!p) this.last = performance.now();
    this.setCharging(false);
    this.cancelHold();
    if (p) this.dragId = null;
    this.pushHud();
  }
  holdCharge(down: boolean): void {
    if (this.paused || this.talking || this.over) return;
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
    if (this.paused || this.talking || this.over || this.bombs <= 0 || this.bombT > 0 || this.sp) return;
    this.bombs--;
    this.bombsUsed++;
    this.bombT = BOMB_T;
    this.bombHit = false;
    this.inv = Math.max(this.inv, 2.6);
    this.sp = { id: 'gona', t: 0, cut: SP_CUT, dur: BOMB_T, n: 0, x: this.px, y: this.py, init: false };
    this.floats.length = 0;
    sfx('cutin');
    sfx('bomb');
    buzz([30, 40, 60]);
    this.setCharging(false);
    this.cancelHold();
    this.pushHud();
  }

  /** 근접 공격: 앞으로 돌진해 붙은 적·탄을 친다 (사거리 짧음 · 쿨다운 · 돌진 중 짧은 무적) */
  useMelee(): void {
    if (this.paused || this.talking || this.over || this.sp || this.bombT > 0 || this.meleeCd > 0 || this.meleeT > 0) return;
    this.startMelee(true);
  }
  /** 근접 시작 (lunge: 앞으로 돌진 · 자동 근접은 제자리에서 휘두름 → 보스 쪽으로 끌려가 맞지 않게) */
  private startMelee(lunge: boolean): void {
    this.meleeLunge = lunge;
    this.nMelee++;
    this.meleeT = MELEE_T;
    this.meleeCd = MELEE[this.fam].cd * (lunge ? 1 : 0.8);
    this.meleeSeen.clear();
    this.inv = Math.max(this.inv, lunge ? MELEE_T + 0.1 : 0.22);
    this.setCharging(false);
    this.cKick = 1;
    this.shootAnimT = 0.3;
    this.kick(0.15);
    this.addFx('ring', this.px, this.py - 20, 0.8, 0.22);
    sfx('shotHeavy', 0.8, 1.3);
    buzz(20);
  }

  private updateMelee(dt: number): void {
    if (this.meleeCd > 0) this.meleeCd -= dt;
    if (this.meleeT <= 0) return;
    this.meleeT -= dt;
    if (this.meleeLunge) this.py = clamp(this.py - MELEE_SPEED * dt, 40, H - 66);
    const hx = this.px;
    const hy = this.py - 22;
    const dmg = MELEE[this.fam].dmg;
    for (const e of this.en) {
      if (e.dead || e.y < -4 || this.meleeSeen.has(e.id)) continue;
      const reach = 16 + e.hr * 0.8;
      if (Math.abs(e.x - hx) > reach || Math.abs(e.y - hy) > reach) continue;
      this.meleeSeen.add(e.id);
      this.damage(e, dmg, 'melee', hx, hy);
      this.part(hx, hy, rand(-60, 60), rand(-80, -20), 0.3, '#fff8d0', 2, 0);
      if (this.meleeSeen.size === 1) {
        // 근접 명중: 묵직한 타격음 · 짧은 멈춤 · 섬광 고리 · 'SMASH!' (일반 탄과 확실히 다른 손맛)
        sfx('bossHit', 0.9, 0.78);
        sfx('enemyHit', 1, 0.7);
        this.hitstop = Math.max(this.hitstop, 0.055);
        this.kick(0.3, 0.06);
        this.addFx('ring', (e.x + hx) / 2, (e.y + hy) / 2, 1.3, 0.24);
        this.meleeHitT = 0.14;
        this.floatText(e.x, e.y - e.hr - 4, 'SMASH!', '#9cf0ff');
        for (let i = 0; i < 8; i++) this.part(e.x, e.y, rand(-120, 120), rand(-120, 40), 0.35, i % 2 ? '#bfe6ff' : '#ffffff', 2, 120);
        buzz(18);
      }
    }
    for (const q of this.eb) {
      if (q.alive && q.age >= 0 && Math.abs(q.x - hx) < 16 + q.r && Math.abs(q.y - hy) < 16 + q.r) { q.alive = false; this.starFrom(q.x, q.y); }
    }
  }

  /** 가족 필살기 (게이지 100%) */
  useFamily(): void {
    if (this.paused || this.talking || this.over || this.gauge < 1 || this.sp || this.bombT > 0) return;
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
      hold: +this.holdT.toFixed(2), charge: +this.charge.toFixed(2), chargeShots: this.nCharge, melees: this.nMelee, meleeCd: +Math.max(0, this.meleeCd).toFixed(2), drag: this.dragId === null ? 0 : 1,
      talking: this.talking ? 1 : 0, vil: this.vil ? `${this.vil.kind}:${this.vil.mode}` : '',
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
    if (cmd === 'sig' && this.bs) { this.bs.sigDue = true; this.bs.rest = Math.min(this.bs.rest, 0.1); }
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
    for (let i = 0; i < n && !this.over && !this.talking; i++) {
      if (this.hitstop > 0) { this.hitstop -= dt; continue; }
      let d = dt;
      if (this.sp && this.sp.t < this.sp.cut) { this.sp.t += dt; d *= 0.3; }
      this.update(d);
    }
  }

  // ───────────── 입력 ─────────────
  private onDown = (e: PointerEvent): void => {
    if (this.paused || this.talking || this.over) return;
    if (this.dragId !== null) return;
    this.dragId = e.pointerId;
    this.canvas.setPointerCapture?.(e.pointerId);
    this.dragX = e.clientX;
    this.dragY = e.clientY;
    this.dragPx = this.px;
    this.dragPy = this.py;
    // 화면 크기는 누를 때 한 번만 잼 (움직일 때마다 재면 DOM 이 바뀐 프레임마다 강제 레이아웃 → iPhone 끊김)
    this.dragK = (W / Math.max(1, this.canvas.getBoundingClientRect().width)) * 1.45;
    e.preventDefault();
  };
  private dragK = 1.45;
  private onMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.dragId) return;
    const k = this.dragK; // 손가락보다 살짝 더 멀리 움직이는 감도
    this.targetX = this.dragPx + (e.clientX - this.dragX) * k;
    this.targetY = this.dragPy + (e.clientY - this.dragY) * k;
    this.hasTarget = true;
  };
  private onUp = (e: PointerEvent): void => {
    if (e.pointerId === this.dragId) {
      this.releaseHold();
      this.dragId = null;
      this.hasTarget = false;
    }
  };
  private noMenu = (e: Event): void => e.preventDefault();
  /** 시스템이 터치를 뺏음(알림·제스처 등): 발사하지 않고 충전만 취소 */
  private onCancel = (e: PointerEvent): void => {
    if (e.pointerId === this.dragId) {
      this.cancelHold();
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
    if (k === 'v') this.useMelee();
    if (k === ' ' || k === 'z') this.setCharging(true);
    if (k === 'p' || k === 'escape') this.setPaused(!this.paused);
  };
  private onKeyUp = (e: KeyboardEvent): void => {
    const k = e.key.toLowerCase();
    this.keys.delete(k);
    if (k === ' ' || k === 'z') this.setCharging(false);
  };
  private setCharging(on: boolean): void {
    if (on && (this.over || this.paused || this.talking)) on = false;
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
    b.x = x; b.y = y; b.vx = vx; b.vy = vy; b.r = r; b.dmg = dmg; b.kind = kind; b.pierce = pierce; b.life = life; b.scale = 1; b.homing = 0; b.age = 0; b.lvl = 1; b.alive = true; b.absorb = 0;
    b.hits.length = 0;
    this.pb.push(b);
    return b;
  }
  private newEB(x: number, y: number, vx: number, vy: number, r: number, kind: EBKind, age = 0): EBullet | null {
    if (this.eb.length >= CAP.eb) return null;
    const b = this.ebPool.pop() ?? ({} as EBullet);
    b.x = x; b.y = y; b.vx = vx; b.vy = vy; b.r = r; b.kind = kind; b.age = age; b.alive = true;
    b.acc = 0; b.hom = 0; b.wob = 0; b.ttl = 12; b.pop = 0;
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
  /** 스테이지 난이도 곡선 (1 튜토리얼 → 2~3 패턴 증가 → 4~5 탄속·밀도 → FINAL 최고) */
  private sk(): { spd: number; dens: number; cd: number } {
    const i = Math.max(0, Math.min(5, this.st.id - 1));
    return { spd: [0.86, 0.94, 1.0, 1.06, 1.11, 1.16][i], dens: [0.78, 0.9, 1.0, 1.07, 1.13, 1.2][i], cd: [1.18, 1.07, 1.0, 0.95, 0.9, 0.85][i] };
  }
  private spd(v: number): number {
    return v * this.dif.bspd * this.sk().spd;
  }
  private cnt(n: number, odd = false): number {
    let c = Math.max(1, Math.round(n * this.dif.dens * this.sk().dens));
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
    if (this.block === 'villain') {
      if (this.vil) return;
      this.block = 'none';
    }
    this.stepWait -= dt;
    const sc = this.st.script;
    while (this.stepWait <= 0 && this.stepIdx < sc.length && this.block === 'none' && !this.talking) {
      this.execStep(sc[this.stepIdx++]);
    }
  }

  private execStep(q: Step): void {
    if ('wait' in q) this.stepWait += q.wait;
    else if ('wave' in q) this.spawnWave(q.wave);
    else if ('talk' in q) this.talk(q.talk);
    else if ('villain' in q) {
      this.block = 'villain';
      const from = VIL_STYLE[(this.st.id - 1) % VIL_STYLE.length].from;
      const sx = from === 'left' || from === 'swoop' ? -34 : from === 'right' ? W + 34 : W / 2;
      const sy = from === 'top' ? -34 : from === 'swoop' ? 150 : 30;
      this.vil = { kind: q.villain, x: sx, y: sy, sx, sy, vy: 0, t: 0, t2: 0, hold: 0, split: 0, mode: 'in', act: 0, done: false };
      sfx('menuOk', 0.7);
    }
    else if ('banner' in q) {
      // 응가 팩: 스테이지 시작은 화면 위 인트로 카드(STAGE n · 왕국 이름 · 위험)가 보여 주므로 캔버스 배너는 생략 (같은 정보 이중 표시 방지)
      if (!(THEME_ID === 'poop' && /^(STAGE \d|FINAL STAGE)$/.test(q.banner))) this.banner = { text: q.banner, sub: q.sub, t: 2.8, col: '#ffe9a8' };
      if (this.st.temp) this.floatText(W / 2, 168, '※ 임시 그래픽', '#cfc4ff');
    } else if ('item' in q) this.items.push({ x: q.x, y: -10, kind: q.item, age: 0, alive: true });
    else if ('midboss' in q) {
      this.block = 'midboss';
      this.midboss = this.spawnBossEnemy(this.st.midboss);
    } else if ('warning' in q) {
      this.block = 'warning';
      this.warnT = 3.6;
      sfx('warn');
      buzz([80, 60, 80, 60, 80], 0); // 보스 경고 (iPhone 은 톡 3번 · 화면은 붉은 WARNING 으로 대체 연출)
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

  /** 뽀글이·꾸덕이: 등장 → 무전창 대사(전투 계속) → 장난 / 중간보스·보스 호출 → 도망
   *  스테이지마다 등장 방향 · 장난 종류 · 도망 방식이 다름 (VIL_STYLE) */
  private updateVillain(dt: number): void {
    const v = this.vil;
    if (!v) return;
    const sty = VIL_STYLE[(this.st.id - 1) % VIL_STYLE.length];
    v.t += dt;
    if (v.mode === 'in') {
      const p = Math.min(1, v.t / 1.1);
      const e = 1 - (1 - p) ** 3;
      v.x = v.sx + (W / 2 - v.sx) * e;
      v.y = v.sy + (66 - v.sy) * e - (sty.from === 'swoop' ? Math.sin(p * Math.PI) * 40 : 0);
      if (p >= 1) {
        v.mode = 'talk';
        v.hold = this.barkDur(v.kind);
        this.talk(v.kind);
      }
      return;
    }
    if (v.mode === 'talk' || v.mode === 'act') v.x = W / 2 + Math.sin((v.t - 1.1) * 1.5) * 22;
    if (v.mode === 'talk') {
      v.hold -= dt; // 무전창 대사가 보이는 동안 제자리에서 떠듦 (정지 대화였다면 끝난 뒤 바로)
      if (v.hold <= 0) v.mode = 'act';
    } else if (v.mode === 'act') {
      v.act += dt;
      if (!v.done && v.act > 0.35) {
        v.done = true;
        if (v.kind === 'prank') this.villainPrank(sty.prank, v.x, v.y);
        else if (v.kind === 'callMid') this.floatText(v.x, v.y - 26, '부탁해요~!', '#ffe9a8');
        else this.floatText(v.x, v.y - 26, this.st.id === 6 ? '퇴근이다~!' : '도망이다~!', '#cfc4ff');
      }
      if (v.act > 0.9) { v.mode = 'out'; v.t2 = 0; }
    } else {
      v.t2 += dt;
      v.vy = Math.min(v.vy + 260 * dt, 280);
      switch (sty.exit) {
        case 'spin': v.x += Math.cos(v.t2 * 9) * 120 * dt + 40 * dt; v.y -= v.vy * 0.8 * dt; break;
        case 'dash': v.x += (90 + v.t2 * 400) * dt; v.y -= 20 * dt; break;
        case 'zigzag': v.x = W / 2 + Math.sin(v.t2 * 10) * 40; v.y -= v.vy * dt; break;
        case 'drop': if (v.t2 < 0.35) v.y += 60 * dt; else v.y -= v.vy * 1.2 * dt; break;
        case 'split': v.split += 120 * dt; v.y -= v.vy * 0.7 * dt; break;
        default: v.y -= v.vy * dt;
      }
      if (v.y < -50 || v.x > W + 60 || v.x < -60 || v.split > W) this.vil = null;
    }
  }
  /** 빌런 장난 (스테이지마다 다름) */
  private villainPrank(kind: VilPrank, x: number, y: number): void {
    const sp = (v: number) => this.spd(v);
    if (kind === 'ring') {
      // 뽀글이 가스 방울 고리 + 쌀알 졸개
      const n = this.cnt(12);
      for (let i = 0; i < n; i++) { const a = (i / n) * TAU; this.newEB(x - 18, y, Math.cos(a) * sp(48), Math.sin(a) * sp(48), 3, 'smell'); }
      this.spawnWave({ e: 'drone', n: 5, move: 'swarm', gap: 0.22, x0: 30, x1: 150 });
      this.floatText(x, y - 26, '킥킥킥!', '#e8c8ff');
    } else if (kind === 'puffs') {
      // 가스 풍선 3개가 터지며 작은 가스 고리
      for (const cx of [x - 46, x, x + 46]) {
        const n = this.cnt(7);
        for (let i = 0; i < n; i++) { const a = (i / n) * TAU; this.newEB(cx, y + 10, Math.cos(a) * sp(34), Math.sin(a) * sp(34) + sp(18), 3, 'smell'); }
      }
      this.spawnWave({ e: 'drone', n: 4, move: 'zig', gap: 0.3, x0: 30, x1: 150 });
      this.floatText(x, y - 26, '뿡뿡~!', '#c8ffb0');
    } else if (kind === 'squad') {
      // 컨베이어처럼 양옆에서 편대 출격 (탄 없음)
      this.spawnWave({ e: 'fighter', n: 5, move: 'strafe', gap: 0.3, dir: 1, y: 40 });
      this.spawnWave({ e: 'fighter', n: 5, move: 'strafe', gap: 0.3, dir: -1, y: 72 });
      this.floatText(x, y - 26, '최대 속도~!', '#ffe0a0');
    } else if (kind === 'rain') {
      // 훔친 물방울을 뿌림 (부채꼴로 떨어지는 느린 탄)
      const n = this.cnt(9, true);
      for (let i = 0; i < n; i++) { const a = Math.PI / 2 + (i - (n - 1) / 2) * 0.16; this.newEB(x, y + 8, Math.cos(a) * sp(70), Math.sin(a) * sp(70), 3, 'wave'); }
      this.floatText(x, y - 26, '메롱~!', '#a8e8ff');
    } else if (kind === 'turrets') {
      // 돌멩이 포탑 둘을 내려놓음
      this.spawnWave({ e: 'orb', n: 1, move: 'turret', x0: 40, x1: 40, fire: 'ring' });
      this.spawnWave({ e: 'orb', n: 1, move: 'turret', x0: 140, x1: 140, fire: 'ring' });
      this.floatText(x, y - 26, '딱딱하지롱!', '#ffd8a0');
    } else {
      // 근위대 호출: 고리 비행 편대 + 일렬 대기 드론
      this.spawnWave({ e: 'fighter', n: 4, move: 'loop', gap: 0.35, dir: 1 });
      this.spawnWave({ e: 'drone', n: 6, move: 'hold', gap: 0.15, x0: 30, x1: 150, y: 50, fire: 'aim1' });
      this.floatText(x, y - 26, '근위대 출동~!', '#ffb0d0');
    }
    sfx('compShot', 0.8, 0.7);
  }
  private drawVillain(): void {
    const v = this.vil;
    const im = this.a.extra['villain/duo'];
    if (!v || !im) return;
    const panic = v.mode === 'out' && v.kind !== 'prank';
    const col = v.mode === 'act' ? (v.kind === 'callBoss' ? 3 : 2) : v.mode === 'out' ? (panic ? 3 : 1) : Math.floor(v.t * 4) % 2;
    const bob = Math.sin(v.t * 6) * 2;
    this.cell(im, col, 0, 4, 2, v.x - 18 - v.split, v.y + bob, 1);
    this.cell(im, col, 1, 4, 2, v.x + 18 + v.split, v.y - bob + 4, 1);
  }

  private spawnWave(w: Wave): void {
    // 추가 편대는 난이도별로 수가 다름 (EASY 는 크게 줄이고, 1기 이하면 생략)
    const n = w.extra ? Math.round(w.n * ({ easy: 0.55, normal: 1, hard: 1.35 } as const)[this.diffId]) : w.n;
    if (n < 2 && w.extra) return;
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
    } else if (move === 'xcross') {
      sx = dir > 0 ? 6 + (idx % 3) * 8 : W - 6 - (idx % 3) * 8;
      sy = -16 - idx * 10;
    } else if (move === 'circle') {
      sx = W / 2;
      sy = -16;
    } else if (move === 'dash') {
      sx = dir > 0 ? -14 : W + 14;
      sy = y + (idx % 2) * 18;
    } else if (move === 'swoop') {
      sx = dir > 0 ? -14 : W + 14;
      sy = 22 + (idx % 3) * 6;
    } else if (move === 'vee') {
      const off = Math.abs(idx - 2) * 13;
      sy = -16 - off;
      y -= off;
    }
    const hp = this.ehp(d.hp);
    this.en.push({
      id: this.nextId++, kind: 'small', type, art: d.art, k: 0.5, pat: move, fireKind: fire ?? d.fire,
      x: sx, y: sy, x0: move === 'spiral' ? W / 2 + dir * 24 : x, vx: 0, vy: 0, hp, max: hp, age: 0, flash: 0, fire: rand(d.cd[0], d.cd[1]) * 0.6 * this.dif.cd, dir, hr: d.hr, score: d.score,
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
    if (!this.paused && !this.talking) {
      if (this.hitstop > 0) {
        // 히트스톱: 아주 짧게 세계를 멈춤 (흔들림·섬광만 진행)
        this.hitstop -= dt;
        this.shake = Math.max(0, this.shake - dt * 1.6);
      } else {
        if (this.slowT > 0) { this.slowT -= dt; dt *= 0.35; }
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
    if (this.lvUpT > 0) this.lvUpT -= dt;
    if (this.rageT > 0) this.rageT -= dt;
    if (this.lvDownT > 0) this.lvDownT -= dt;
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
    this.updateVillain(dt);
    this.updateLasers(dt);

    this.updatePlayer(dt);
    this.updateMelee(dt);
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
    this.updateHold(dt);
    this.checkAutoMelee();
  }
  /** 터치 차지: 손가락을 누르고 있는 동안 (이동해도) 충전 · 일반 공격은 계속 나감 · 손을 떼면 발사 */
  private updateHold(dt: number): void {
    if (this.charging) return; // 키보드 차지 중
    const can = this.dragId !== null && !this.paused && !this.talking && !this.over && !this.sp && this.bombT <= 0;
    if (!can) {
      if (this.dragId !== null && (this.sp || this.bombT > 0)) this.cancelHold();
      return;
    }
    this.holdT += dt;
    if (this.holdT <= HOLD_START) return;
    this.charge = Math.min(1.2, this.charge + dt);
    if (!this.tcMax && this.charge >= CHARGE_FULL[this.fam]) {
      this.tcMax = true;
      sfx('gaugeFull', 0.9);
      this.addFx('ring', this.px, this.py - 6, 1.2, 0.3);
      this.floatText(this.px, this.py - 34, 'MAX!', '#ff8ac8');
      buzz(15);
    }
  }
  private cancelHold(): void {
    this.holdT = 0;
    this.tcMax = false;
    if (!this.charging) this.charge = 0;
  }
  /** 손을 뗐을 때: 충분히 충전됐으면 차지 공격 (짧은 터치 · 바로 뗀 손은 아무 일 없음) */
  private releaseHold(): void {
    const ok = this.holdT > HOLD_START && this.charge >= HOLD_FIRE && !this.charging && !this.paused && !this.talking && !this.over && !this.sp && this.bombT <= 0;
    if (ok) this.releaseCharge();
    this.cancelHold();
  }
  /** 근접 자동 발동: 적이 바로 앞(근접 판정 안)에 들어오면 제자리에서 휘두름 · 쿨다운 동안은 다시 안 나감 */
  private checkAutoMelee(): void {
    if (!this.autoMelee || this.meleeCd > 0 || this.meleeT > 0 || this.sp || this.bombT > 0 || this.talking || this.paused || this.over) return;
    const hx = this.px;
    const hy = this.py - 22;
    for (const e of this.en) {
      if (e.dead || e.y < 8) continue;
      if (e.kind === 'boss') { const m = this.bsOf(e).mode; if (m === 'enter' || m === 'dying') continue; }
      const reach = 12 + e.hr * 0.75; // 실제 타격 판정(16 + hr·0.8)보다 조금 좁게 → 발동하면 반드시 맞음
      if (Math.abs(e.x - hx) <= reach && Math.abs(e.y - hy) <= reach) {
        this.startMelee(false);
        this.cKick = 1;
        this.shootAnimT = 0.3;
        this.addFx('ring', hx, hy, 0.8, 0.2);
        sfx('shotHeavy', 0.8, 1.3);
        return;
      }
    }
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
    this.nCharge++;
    const f = Math.min(1, c / CHARGE_FULL[this.fam]);
    const px = this.px;
    const py = this.py - 22;
    switch (this.fam) {
      case 'mom': { // 하트 마법 빔: 전방 집중, 관통
        const b = this.newPB(px, py, 0, -300, 5 + f * 3, 12 + f * 18, 'water', true, 1.0);
        b.scale = 1.4 + f * 0.4;
        break;
      }
      case 'dad': { // 증기 충격파: 넓고 관통하는 파동
        const b = this.newPB(px, py, 0, -240, 9 + f * 5, 14 + f * 16, 'wave', true, 1.1);
        b.lvl = 4;
        break;
      }
      case 'imo': { // 스타 캐논: 빠른 관통 별
        const b = this.newPB(px, py, 0, -340, 5, 14 + f * 18, 'prune', true, 1.0);
        b.scale = 1.6;
        break;
      }
      case 'samchon': { // 폭발 미사일: 한 발 · 명중 시 주변 폭발
        const b = this.newPB(px, py, 0, -260, 8, 20 + f * 18, 'missile', false, 1.4);
        b.scale = 1.6;
        break;
      }
      case 'halmeoni': { // 연금 폭발 플라스크: 명중 시 넓은 폭발
        const b = this.newPB(px, py, 0, -190, 7, 14 + f * 12, 'potion', false, 1.0);
        b.scale = 1.6;
        break;
      }
      case 'halabeoji': { // 방패 충격파: 즉발 · 주변 탄 소거 + 근접 적 타격
        const R = 46 + f * 10;
        for (const q of this.eb) if (q.alive && q.age >= 0 && (q.x - px) ** 2 + (q.y - this.py) ** 2 < R * R) { q.alive = false; this.starFrom(q.x, q.y); }
        for (const e of this.en) if (!e.dead && e.y > 0 && (e.x - px) ** 2 + (e.y - this.py) ** 2 < (R + e.hr) ** 2) this.damage(e, 6 + f * 8, 'charge', e.x, e.y);
        this.addFx('ring', px, this.py, 1.5 + f * 0.5, 0.35);
        this.flashWhite = Math.max(this.flashWhite, 0.2 * f);
        break;
      }
      default: {
        const b = this.newPB(px, py, 0, -240, 7 + f * 9, 10 + f * 28, 'charge', true, 1.8);
        b.scale = 0.55 + f * 0.6;
      }
    }
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
    if (this.power > 1) {
      this.power--;
      this.lvDownT = 1;
      this.floatText(this.px, this.py - 34, `LV DOWN ▼ Lv${this.power}`, '#ff9eb0');
    }
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
      this.updateGuard(dt);
      if (this.cN > [1.2, 1.0, 1.0, 0.9][this.power - 1]) {
        this.cN = 0;
        // 수호 창: Lv1 1자루 → Lv2 빨라짐 → Lv3 + 방패파 → Lv4 창 2자루 + 방패파 강화
        for (const dx of this.power >= 4 ? [-3, 7] : [4]) this.newPB(this.cx + dx, this.cy - 16, 0, -240, 3, [2.2, 2.4, 2.4, 2.2][this.power - 1], 'lance', true, 1.4);
        sfx('compShot', 0.8, 0.8);
        if (THEME_ID === 'poop') this.cKick = 1; // 응가 팩: 창을 쏠 때 방패 밀기(공격 프레임 2·3)를 보여 줌 (케이크 버전 동작은 그대로)
      }
      // 동료 자동 보호막 없음 — 일반 공격에서 상시 무적 금지 (보호는 필살기 중에만)
      return;
    }
    this.updateBugs(dt);
    if (this.cCd > 0) return;
    this.cKick = 1;
    const L = this.power; // 무기 레벨 1~4 (P 로 오르고 피격 시 1단계 내려감) — 동료 공격도 함께 진화
    const cx = this.cx;
    const cy = this.cy;
    if (f === 'mom') {
      // 목욕물: Lv1 물방울 3 → Lv2 5갈래 → Lv3 가운데 물줄기 추가 → Lv4 넓은 7갈래 + 관통 물줄기 (평시 유도 없음)
      const n = [3, 5, 5, 7][L - 1];
      const spread = [0.16, 0.2, 0.2, 0.22][L - 1];
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i - (n - 1) / 2) * spread;
        this.newPB(cx, cy - 10, Math.cos(a) * 160, Math.sin(a) * 160, 3.5, 1.1, 'water', false, 1.3);
      }
      if (L >= 3) for (const dx of L >= 4 ? [-3, 3] : [0]) { const b = this.newPB(cx + dx, cy - 14, 0, -300, 3.5, L >= 4 ? 1.5 : 1.3, 'water', L >= 4, 1.1); b.scale = 1.3; }
      sfx('compShot', 0.9, 1.2);
      this.cCd = [0.85, 0.85, 0.8, 0.75][L - 1];
    } else if (f === 'dad') {
      // 고압 물대포: Lv1 굵은 직선 → Lv2 연사 ↑ → Lv3 관통 수류 → Lv4 초고압 관통포 (탄 지우기 없음 · 필살기 전용)
      const dmg = [3.0, 3.2, 3.0, 4.2][L - 1];
      const b = this.newPB(cx, cy - 16, 0, L >= 3 ? -460 : -420, L >= 4 ? 5 : 3.5, dmg, 'water', L >= 3, 1.1);
      b.scale = [1.25, 1.3, 1.45, 1.7][L - 1]; // 굵은 물대포 (고나 탄과 구분되게 큰 물방울)
      sfx('shotHeavy', 0.6);
      this.cCd = [1.0, 0.8, 0.72, 0.7][L - 1];
    } else if (f === 'imo') {
      // 프룬 마법탄: Lv1 2발 → Lv2 3발 → Lv3 빠른 연사 → Lv4 + 아주 약한 유도 별 2발 (유도는 Lv4 에서만)
      this.cN++;
      const angs = L === 1 ? [-0.05, 0.05] : [0, -0.12, 0.12];
      const sp = L >= 3 ? 280 : 220;
      for (const a of angs) this.newPB(cx, cy - 14, Math.sin(a) * sp, -Math.cos(a) * sp, 3.5, 1.1, 'prune', false, 1.2);
      if (L >= 4 && this.cN % 2 === 0) for (const sd of [-1, 1]) { const b = this.newPB(cx + sd * 6, cy - 10, sd * 60, -200, 3, 0.9, 'star', false, 1.4); b.homing = 1.6; }
      if (this.cN % 2) sfx('compShot', 0.7, 1.4);
      this.cCd = [0.6, 0.55, 0.42, 0.42][L - 1];
    } else if (f === 'samchon') {
      // 유산균 소환: 전기탄 2발은 그대로, 레벨마다 고나 주변 유산균 드론이 늘어 함께 쏨 (드론 공격은 updateBugs)
      for (const sd of [-1, 1]) this.newPB(cx + sd * 5, cy - 12, 0, -200, 3, L >= 3 ? 1.6 : 1.4, 'elec', false, 1.2);
      sfx('compShot', 0.6, 0.9);
      this.cCd = L >= 4 ? 0.55 : 0.62;
    } else if (f === 'halmeoni') {
      // 연금 포션 (화력 최약 · 맞으면 주변에 튐): Lv1 1병 → Lv2 튐 범위 ↑ → Lv3 2병 → Lv4 3병
      this.cN++;
      const n = [1, 1, 2, 3][L - 1];
      for (let i = 0; i < n; i++) {
        const b = this.newPB(cx, cy - 14, (i - (n - 1) / 2) * 45 + rand(-8, 8), -150, 4, [1.8, 2.0, 1.9, 1.8][L - 1], 'potion', false, 1.6);
        b.lvl = L;
      }
      sfx('compShot', 0.7, 0.7);
      this.cCd = [1.2, 1.1, 1.1, 1.0][L - 1];
      // 자동 회복 없음: 14발마다 '스테이지 회복 보급'이 남아 있을 때만 하트 1
      if (this.cN % 14 === 0 && this.hp < MAX_HP && this.healLeft > 0) {
        this.healLeft--;
        this.hp++;
        this.pushHud();
        sfx('heal');
        this.floatText(this.px, this.py - 26, 'HP +1', '#ff9ec0');
        for (let i = 0; i < 14; i++) this.part(this.px + rand(-12, 12), this.py + rand(-10, 14), rand(-10, 10), rand(-50, -20), 0.9, '#ff9ec0', 2, 0);
      }
    }
  }

  /** 삼촌 유산균 드론: 무기 레벨만큼 (Lv1 1 · Lv2 2 · Lv3 2 · Lv4 3) 고나 둘레를 돌며 작은 탄을 쏨 */
  private bugT = 0;
  private bugCount(): number {
    return this.fam === 'samchon' && !this.sp ? [1, 2, 2, 3][this.power - 1] : 0;
  }
  private bugPos(i: number, n: number): [number, number] {
    const a = this.t * 2.6 + (i * TAU) / Math.max(1, n);
    return [this.px + Math.cos(a) * 22, this.py - 4 + Math.sin(a) * 9];
  }
  private updateBugs(dt: number): void {
    const n = this.bugCount();
    if (!n) return;
    this.bugT -= dt;
    if (this.bugT > 0) return;
    this.bugT = this.power >= 4 ? 0.42 : 0.5;
    for (let i = 0; i < n; i++) {
      const [x, y] = this.bugPos(i, n);
      this.newPB(x, y - 6, 0, -240, 2.5, this.power >= 3 ? 0.7 : 0.6, 'elec', false, 1.0);
    }
  }

  /** 할아버지 방패파: 방패 모양 관통 파동 — 닿은 작은 적 탄을 몇 개까지 막아 줌 (Lv3~4) */
  private updateGuard(dt: number): void {
    if (this.fam !== 'halabeoji' || this.power < 3 || this.bombT > 0.9 || this.sp) return;
    this.guardT -= dt;
    if (this.guardT > 0) return;
    this.guardT = this.power >= 4 ? 1.4 : 2.0;
    const b = this.newPB(this.cx, this.cy - 18, 0, -150, 9, 1.6, 'wave', true, 1.3);
    b.lvl = 4;
    b.absorb = this.power >= 4 ? 3 : 2;
    sfx('shield', 0.4);
  }
  private guardT = 1;
  private lvUpT = 0;
  private lvDownT = 0;

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
        // 목욕 폭포: 화면 위에서 물줄기가 넓게 쏟아짐 (자동 유도 없음 · 넓은 범위)
        if (every(0.12)) {
          for (let i = 0; i < 2; i++) this.newPB(rand(12, W - 12), -8, rand(-12, 12), 230, 3, 2.2, 'water', false, 2.0).scale = 1.5;
          if (this.a.extra['fx/water-splash']) this.addFx('wsplash', rand(16, W - 16), rand(6, 22), 1.1, 0.36); // 폭포 입구 물보라
          if (every(0.36)) sfx('compShot', 1, 1.1);
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
            const b = this.newPB(cx, cy - 14, Math.cos(a) * 200, Math.sin(a) * 200, 4, 2.6, 'prune', false, 2.2);
            b.homing = 9;
            b.scale = 1.3;
          }
          sfx('compShot', 0.8, 1.6);
        }
        break;
      case 'halmeoni':
        // 불꽃의 약손: 체력 1칸 회복 + 주변 탄 정화 + 불꽃·하트 연출
        if (first) {
          // 필살기 1회당 체력 1칸 (최대 체력 초과 없음 · 보급 횟수 공유 · 별도 무적 없음)
          const heal = Math.max(0, Math.min(1, MAX_HP - this.hp, this.healLeft));
          this.healLeft -= heal;
          this.hp += heal;
          this.pushHud();
          sfx('heal');
          this.floatText(this.px, this.py - 30, heal > 0 ? `HP +${heal}` : '회복 보급 없음', '#ffe34a');
          for (const b of this.eb) if (b.alive && (b.x - this.px) ** 2 + (b.y - this.py) ** 2 < 90 * 90) { b.alive = false; this.starFrom(b.x, b.y); }
          this.flashGold = 0.5;
        }
        // 불꽃 (임시 효과): 몸 둘레에서 주황·노랑 불꽃 입자가 위로 타오름
        if (every(0.04)) {
          const a = rand(0, TAU);
          this.part(this.px + Math.cos(a) * 15, this.py - 6 + Math.sin(a) * 11, rand(-6, 6), rand(-95, -55), 0.45, Math.random() < 0.55 ? '#ff7a2e' : '#ffd34a', 2, 0);
        }
        // 하트: 기존 하트 스프라이트가 고나 주변에서 피어오름 (최대 12개)
        if (every(0.16) && this.healHearts.length < 12) this.healHearts.push({ x: this.px + rand(-18, 18), y: this.py - 4, t0: this.t });
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
        // 유산균 특공대: 유산균 3마리가 고나 주변을 돌며 위로 쏨 (자동 유도 없음 · 3초 제한)
        if (e < 3.0 && every(0.5)) {
          for (let i = 0; i < 3; i++) {
            const [x, y] = this.probioticPos(i);
            this.newPB(x, y - 2, 0, -200, 3, 1.6, 'elec', false, 1.2);
          }
          sfx('compShot', 0.8, 0.6);
        }
        if (pe < 2.3 && e >= 2.3 && this.a.extra['chars/samchon/probiotic']) {
          // 응가 팩: 메카 대신 유산균 3마리가 만세 자세로 위로 돌진 (같은 총 피해)
          for (let i = 0; i < 3; i++) {
            const [x, y] = this.probioticPos(i);
            const b = this.newPB(x, y, 0, -300, 10, 14, 'probio', true, 1.6);
            b.lvl = i;
          }
          this.kick(0.4);
          sfx('boomM');
        } else if (pe < 2.3 && e >= 2.3) {
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
      hp, max: hp, age: 0, flash: 0, fire: 0, dir: 1, hr: def.hr, score: def.mid ? 8000 : 30000, dead: false, ph: 0, burst: 0, holdY: this.restOf(def),
    };
    this.en.push(e);
    for (const pd of def.parts) {
      const php = Math.round(pd.hp * this.dif.bhp);
      this.en.push({
        id: this.nextId++, kind: 'part', type: '', art: pd.art, k: pd.k, pat: 'boss', fireKind: 'none', x: e.x + pd.dx, y: e.y + pd.dy, x0: 0, vx: 0, vy: 0,
        hp: php, max: php, age: 0, flash: 0, fire: pd.cd * rand(0.6, 1.2), dir: 1, hr: pd.hr, score: pd.bonus ?? 3000, dead: false, ph: 0, burst: 0, holdY: 0,
        parent: e, dx: pd.dx, dy: pd.dy, partFire: pd.fire, partCd: pd.cd, pdef: pd.cell != null ? pd : undefined,
      });
    }
    const bs: BossState = {
      def, mode: 'enter', atk: '', at: 0, rest: 1, last: '', phase: 1, n: 0, tx: W / 2, sub: 0, minion: 8, dyingT: 0, teleT: 0, cycle: 0,
      mask: this.maskOf(def), life: 0, cut: [], rage: [], weakMul: 1.5, restMul: 1, wrecks: [],
    };
    (e as Enemy & { bs: BossState }).bs = bs;
    if (!def.mid) {
      this.partsTotal = def.parts.length;
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

  /** 보스 마스크는 스테이지 시작 때 미리 만들어 둠 (보스 등장 순간 getImageData 로 끊기지 않게) */
  private masks = new Map<string, { w: number; h: number; m: Uint8Array }[]>();
  private maskOf(def: BossDef): { w: number; h: number; m: Uint8Array }[] {
    const key = `${def.art}|${def.frames}|${def.k}`;
    let m = this.masks.get(key);
    if (!m) { m = this.buildMask(def.art, def.frames, def.k); this.masks.set(key, m); }
    return m;
  }
  /** 첫 피격·첫 등장 때 만들던 사본(흰 번쩍임 · 마스크)을 시작 전에 미리 → 전투 중 큰 캔버스 생성 없음 */
  private prewarm(): void {
    try {
      for (const def of [this.st.boss, this.st.midboss]) if (def) { this.maskOf(def); whiteOf(this.a, this.art[def.art]); for (const pd of def.parts) whiteOf(this.a, this.art[pd.art]); }
      for (const n of ['enemy-drone', 'enemy-fighter', 'enemy-orb', 'enemy-wyvern', 'enemy-gunship'] as ArtName[]) if (this.art[n]) whiteOf(this.a, this.art[n]);
      for (const n of ['icon-heart', 'icon-bomb'] as const) if (this.a.img[n]) whiteOf(this.a, this.a.img[n]);
      for (let d = 0; d <= 9; d++) textImg(String(d), '#ffe9a8', 11);
    } catch {
      /* 미리 만들기 실패는 무시 (그때그때 만듦) */
    }
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
    const mk = b.mask[Math.min(b.mask.length - 1, this.bossFrame(b))];
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
      case 'swoop': {
        // 옆에서 들어와 고나 쪽으로 깊게 휘어 내려왔다가 반대편 위로 빠져나감
        e.x += e.dir * 96 * dt;
        e.y = 22 + Math.sin(Math.min(Math.PI, e.age * 1.25)) * (165 + (e.ph % 3) * 8) - Math.max(0, e.age - 2.5) * 60;
        break;
      }
      case 'vee':
        // V자 진형으로 내려와 잠깐 버티며 쏘고 → 바깥쪽으로 갈라져 퇴장
        if (e.age < 2.8) e.y += (e.holdY - e.y) * Math.min(1, dt * 2.4);
        else { e.x += (e.x < W / 2 ? -1 : 1) * 95 * dt; e.y -= 18 * dt; }
        break;
      case 'xcross':
        // X자 교차: 위 양쪽 모서리에서 대각선으로 내려와 가운데에서 엇갈림
        e.x += e.dir * 78 * dt;
        e.y += 92 * dt;
        break;
      case 'circle': {
        // 원형 진입: 가운데 위에서 큰 원을 그리며 한 바퀴 돌고 아래로 빠짐
        const a = -Math.PI / 2 + e.age * 2.1 * e.dir + e.ph * 0.9;
        const r = 58;
        e.x = W / 2 + Math.cos(a) * r;
        e.y = (e.age < 3 ? 110 : 110 + (e.age - 3) * 80) + Math.sin(a) * r * 0.75;
        break;
      }
      case 'dash':
        // 화면을 가로지르는 고속 돌진 (속도감) — 살짝 물결치며 옆으로 관통
        e.x += e.dir * 175 * dt;
        e.y = e.holdY + Math.sin(e.age * 5 + e.ph) * 10 + e.age * 14;
        break;
      case 'spiral': {
        // 회전하며 내려오는 소용돌이 편대
        const a = e.age * 2.6 + e.ph * 1.8;
        e.x = e.x0 + Math.cos(a) * 34;
        e.y = -20 + e.age * 40 + Math.sin(a) * 22;
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
    const cd = (d ? rand(d.cd[0], d.cd[1]) : 2) * this.dif.cd * this.sk().cd;
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
    if (e.hitT) e.hitT = Math.max(0, e.hitT - dt);
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
    if (e.partFire === 'none') return;
    e.fire = (e.partCd ?? 2) * this.dif.cd * this.sk().cd * rand(0.85, 1.15);
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
      this.sigWarn = Math.max(0, this.sigWarn - dt);
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
      if (!def.mid) { this.rageT = 1.6; this.rageFinal = phase === np; buzz([60, 40, 90], 0); }
      if (!def.mid) { this.talk(phase >= 3 ? 'bossP3' : 'bossP2'); b.sigDue = true; }
    }
    if (b.mode === 'enter') {
      e.y += (this.restOf(def) - e.y) * Math.min(1, dt * 1.6) + 10 * dt;
      if (e.y > this.restOf(def) - 4) {
        b.mode = 'idle';
        b.rest = 0.8;
        this.talk(def.mid ? 'midIn' : 'bossIn');
      }
      return;
    }
    // 중간보스는 오래 버티면 도망 (보상 없음)
    if (def.mid && b.life > 48) {
      b.mode = 'flee';
      this.bossSay(`${def.name} 도주!`, '#cfc4ff');
      this.talk('midFlee');
      return;
    }
    const fast = b.phase === np && np >= 3 ? 1.15 : 1;
    // 이동 (공격 중에도 천천히)
    const mv = b.mode === 'atk' && b.atk === 'dash' ? 0 : b.mode === 'atk' ? 0.4 : 1;
    if (mv > 0) {
      let tx = W / 2;
      let ty = this.restOf(def);
      if (def.move === 'sway') tx = W / 2 + Math.sin(b.life * 0.9) * 46;
      else if (def.move === 'drift') { tx = W / 2 + Math.sin(b.life * 0.6) * 40; ty += Math.sin(b.life * 1.1) * 8; }
      else if (def.move === 'figure8') { tx = W / 2 + Math.sin(b.life * 0.7) * 50; ty += Math.sin(b.life * 1.4) * 12; }
      else tx = W / 2 + Math.sin(b.life * 0.4) * 10;
      // 좌우로 움직여도 그림이 화면 밖으로 나가지 않게
      const [hw] = this.bossHalf(def);
      tx = clamp(tx, Math.min(W / 2, hw + 2), Math.max(W / 2, W - hw - 2));
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
        // 부위 파괴: 부서진 부위가 맡던 공격은 빠지고, 봉인·왕관이 깨지며 열린 위험한 공격이 더해짐
        const base = def.phases[b.phase - 1].filter((a) => !b.cut.includes(a));
        const pool = [...(base.length ? base : def.phases[b.phase - 1]), ...b.rage];
        // 순서대로 돌되 같은 공격 연속 금지 · 매 바퀴 시작점 변화
        let atk = pool[(b.cycle + Math.floor(b.life)) % pool.length];
        if (atk === b.last) atk = pool[(pool.indexOf(atk) + 1) % pool.length];
        if (atk === 'dash' && def.art !== 'boss') atk = 'fan';
        const np2 = def.phases.length;
        if (main && (b.sigDue || (b.phase === 1 && b.cycle === 3) || (b.phase === np2 && b.cycle > 0 && b.cycle % 4 === 0))) { atk = 'sig'; b.sigDue = false; }
        b.cycle++;
        b.atk = atk;
        b.last = atk;
        b.at = 0;
        b.n = 0;
        b.sub = 0;
        b.tx = this.px;
        // 공격 전조: 레이저는 경고선이 전조이므로 짧게
        b.mode = 'tele';
        b.teleT = atk.startsWith('laser') ? 0.25 : atk === 'sig' ? 1.25 : 0.6;
        if (atk === 'sig') {
          // 필살기 예고: 이름 · 경고음 · 화면 가장자리 붉은 깜빡임 (피할 준비 시간 1.25초)
          this.bossSay(`필살! ${SIG_NAME[this.st.id - 1] ?? ''}`, '#ffd34a');
          sfx('warn', 0.9);
          this.sigWarn = 1.25;
          buzz([40, 60, 40]);
        } else sfx('gaugeFull', 0.35, 0.6);
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
      b.rest = (base - (b.phase - 1) * 0.12) * this.dif.cd * this.sk().cd * b.restMul;
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
          const [hw] = this.bossHalf(b.def);
          b.tx = clamp(this.px, Math.min(W / 2, hw + 2), Math.max(W / 2, W - hw - 2));
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
          e.y += (this.restOf(b.def) - e.y) * Math.min(1, dt * 2.4);
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
      case 'sig':
        return this.runSig(e, b, my, dt);
      default:
        return true;
    }
  }

  /** 보스 필살기 — 스테이지 테마별 시그니처 (모두 빈틈이 보이는 '읽히는' 패턴) */
  private runSig(e: Enemy, b: BossState, my: number, dt: number): boolean {
    const kind = b.def.bullet;
    const id = this.st.id;
    const at = b.at;
    const once = (k: number, t: number): boolean => { if (b.n < k && at >= t) { b.n = k; return true; } return false; };
    if (id === 1) {
      // 쫀득 떡메치기: 내려찍기 3번 → 매번 플레이어 쪽이 열린 반원 고리 + 마지막에 떡 비
      for (let k = 1; k <= 3; k++) if (once(k, (k - 1) * 0.9)) {
        this.kick(0.5, 0.06); sfx('boomS', 0.7);
        const open = this.aimAt(e.x, my);
        const c = this.cnt(22);
        for (let i = 0; i < c; i++) {
          const a = (i / c) * TAU;
          let d = a - open; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
          if (Math.abs(d) < 0.42) continue; // 빈틈
          this.shoot(e.x, my, a, 44 + k * 6, kind);
        }
      }
      if (once(4, 2.9)) for (let x = 14; x < W; x += 26) this.newEB(x + rand(-4, 4), 30, 0, this.spd(50), 4, kind);
      return at > 3.8;
    }
    if (id === 2) {
      // 뿡뿡 포자 대폭발: 포자 5개가 천천히 퍼진 뒤 1.6초 후 원형으로 터짐
      if (once(1, 0)) for (let i = 0; i < 5; i++) {
        const q = this.shoot(e.x, my, Math.PI / 2 + (i - 2) * 0.42, 34, 'smell', 6);
        if (q) { q.acc = -0.6; q.ttl = 1.6 + i * 0.12; q.pop = this.cnt(9); }
      }
      if (once(2, 2.2)) for (let i = 0; i < 4; i++) {
        const q = this.shoot(e.x, my, Math.PI / 2 + (i - 1.5) * 0.6, 40, 'smell', 6);
        if (q) { q.acc = -0.6; q.ttl = 1.4; q.pop = this.cnt(8); }
      }
      return at > 4.4;
    }
    if (id === 3) {
      // 3000RPM 블렌더 회오리: 칼날 레이저 2줄 회전 + 6갈래 반대방향 나선
      if (once(1, 0)) for (let k = 0; k < 2; k++) this.addLaser(e.x, my, Math.PI / 2 + k * Math.PI + 0.6, 0.9, 3.0, 6, 0.55, e);
      if (at > 0.9 && at < 3.9 && b.sub <= 0) {
        b.sub = 0.16 * this.dif.cd;
        for (let k = 0; k < 6; k++) this.shoot(e.x, my, -at * 1.6 + (k / 6) * TAU, 46, 'needle');
      }
      b.sub -= dt;
      return at > 4.4;
    }
    if (id === 4) {
      // 대해일 촉수: 양쪽 화면 끝에서 밀려오는 물결 줄 — 높이를 바꿔 가며 6줄, 가운데로 갈수록 느려짐
      for (let k = 1; k <= 6; k++) if (once(k, (k - 1) * 0.55)) {
        const y = 150 + ((k * 37) % 120);
        const sd = k % 2 ? 1 : -1;
        for (let j = 0; j < 5; j++) {
          const q = this.newEB(sd > 0 ? -6 - j * 9 : W + 6 + j * 9, y + j * 3, sd * this.spd(62), 0, 3.5, 'ring');
          if (q) { q.acc = -0.35; q.wob = 18; }
        }
      }
      if (once(7, 3.4)) { const c = this.cnt(12); for (let i = 0; i < c; i++) this.shoot(e.x, my, (i / c) * TAU, 50, kind); }
      return at > 4.4;
    }
    if (id === 5) {
      // 철벽 방패 대돌진: 플레이어 줄로 돌진 예고선 → 돌진하며 양옆으로 방패 파편 → 뒤로 물러나며 벽
      if (once(1, 0)) { const [hw] = this.bossHalf(b.def); b.tx = clamp(this.px, Math.min(W / 2, hw + 2), Math.max(W / 2, W - hw - 2)); this.addLaser(b.tx, 40, Math.PI / 2, 0.7, 0.01, 0, 0, null); }
      if (at > 0.7 && at < 1.4) {
        e.x += (b.tx - e.x) * 0.2;
        e.y += (Math.min(H - 110, this.py - 60) - e.y) * 0.08;
        if (b.sub <= 0) { b.sub = 0.1; for (const sd of [-1, 1]) this.shoot(e.x, e.y + 10, Math.PI / 2 + sd * 1.2, 60, 'needle'); }
        b.sub -= dt;
      }
      if (once(2, 1.5)) { this.kick(0.7, 0.08); sfx('boomS', 0.8); const c = this.cnt(16); for (let i = 0; i < c; i++) this.shoot(e.x, e.y + 10, (i / c) * TAU, 52, kind); }
      if (at > 1.6) e.y += (this.restOf(b.def) - e.y) * 0.05;
      if (once(3, 2.4)) {
        const gx = clamp(this.px + rand(-24, 24), 26, W - 26);
        for (let x = 6; x < W; x += 11) if (Math.abs(x - gx) > 22) this.newEB(x, 28, 0, this.spd(66), 3, 'needle');
      }
      return at > 3.6;
    }
    // FINAL 대막힘 메테오: 위에서 떨어질 줄을 먼저 보여 주고(경고선) 굵은 기둥 낙하 3회 — 매번 한 줄은 비어 있음
    for (let k = 1; k <= 3; k++) if (once(k, (k - 1) * 1.15)) {
      const safe = Math.floor(rand(0, 5));
      for (let c = 0; c < 5; c++) {
        if (c === safe) continue;
        this.addLaser(18 + c * 36, 34, Math.PI / 2, 0.85, 0.45, 16, 0, null);
      }
      sfx('warn', 0.5);
    }
    if (at > 3.4 && at < 4.6 && b.sub <= 0) {
      b.sub = 0.14 * this.dif.cd;
      for (let k = 0; k < 4; k++) this.shoot(e.x, my, at * 2.4 + (k / 4) * TAU, 50, kind);
    }
    b.sub -= dt;
    if (once(4, 3.4)) this.kick(0.8, 0.1);
    return at > 4.9;
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
      if (b.absorb > 0) {
        for (const q of this.eb) {
          if (q.alive && q.age >= 0 && q.r <= 4 && (q.x - b.x) ** 2 + (q.y - b.y) ** 2 < (b.r + q.r) ** 2) {
            q.alive = false;
            this.starFrom(q.x, q.y);
            if (--b.absorb <= 0) break;
          }
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
      if (b.age > b.ttl && b.pop) {
        // 시한 폭발: 그 자리에서 원형탄으로 터짐 (터지기 직전 깜빡임은 그리기에서)
        const n = b.pop;
        b.pop = 0;
        b.alive = false;
        for (let i = 0; i < n; i++) this.shoot(b.x, b.y, (i / n) * TAU + b.age, 44, b.kind);
        this.addFx('ring', b.x, b.y, 0.5, 0.25);
      } else if (b.age > b.ttl || b.x < -20 || b.x > W + 20 || b.y < -24 || b.y > H + 20) b.alive = false;
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
          if (this.hp < MAX_HP && this.healLeft > 0 && !this.rules.oneLife) {
            this.healLeft--;
            this.hp++;
            this.pushHud();
            this.floatText(this.px, this.py - 24, 'HP +1', '#ff9ec0');
          } else this.addScore(this.rules.oneLife ? 3000 : 500, this.px, this.py - 20);
        } else if (it.kind === 'banana') {
          sfx('item');
          if (this.rules.noBomb) this.addScore(3000, this.px, this.py - 20);
          else {
            this.bombs = Math.min(5, this.bombs + 1);
            this.pushHud();
            this.floatText(this.px, this.py - 24, 'BOMB +1', '#ffe34a');
          }
        } else {
          sfx('powerUp');
          if (this.power < 4) {
            this.power++;
            this.floatText(this.px, this.py - 24, this.power >= 4 ? 'MAX POWER!' : `POWER UP! Lv${this.power}`, '#58e0ff');
            this.floatText(this.px, this.py - 12, WEAPON_NAME[this.fam][this.power - 1], '#bff4ff');
            this.lvUpT = 0.5;
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
    for (const c of this.chunks) { c.t += dt; c.x += c.vx * dt; c.vy += 320 * dt; c.y += c.vy * dt; c.rot += c.vr * dt; }
    if (this.chunks.length) compact(this.chunks, (c) => c.t < 1.4 && c.y < H + 40);
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
    if (this.meleeHitT > 0) this.meleeHitT -= dt;
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
  private damage(e: Enemy, dmg: number, src: PKind | 'bomb' | 'beam' | 'body' | 'melee', hx: number, hy: number): void {
    if (e.dead || e.y < -6) return;
    // 응가 팩: 물방울·프룬 구슬이 맞으면 물/보라 과즙 튐 (팩 그림이 있을 때만)
    if ((src === 'water' || src === 'prune') && Math.random() < 0.45 && this.a.extra[src === 'water' ? 'fx/water-splash' : 'fx/prune-splash']) this.addFx(src === 'water' ? 'wsplash' : 'psplash', hx, hy, 0.7, 0.26);
    const strong = src === 'charge' || src === 'drill' || src === 'probio';
    const special = !!this.sp && src !== 'shot' && src !== 'wave' && src !== 'charge' && src !== 'melee';
    if (e.kind === 'boss') {
      const b = this.bsOf(e);
      if (b.mode === 'enter' || b.mode === 'dying' || b.mode === 'flee') return;
      // 필살기·폭탄은 보스에게 절반 (보스를 순식간에 녹이지 않도록)
      if (special || src === 'bomb') dmg *= 0.5;
      // 부품(포탑)이 남아 있으면 본체는 장갑으로 덜 받음
      if (b.def.shielded && this.en.some((p) => p.kind === 'part' && p.parent === e && !p.dead)) {
        dmg *= b.def.shielded;
        // 장갑에 막힘: 둔탁한 소리 · 회색 'GUARD' (부위를 먼저 부수라는 신호)
        if (Math.random() < 0.05) { this.floatText(hx, hy - 8, 'GUARD', '#b8c0d0'); sfx('bossHit', 0.5, 0.7); }
      }
      // 부위 파괴: 방패·봉인이 살아 있으면 본체 장갑 · 흉갑/뚜껑이 약점을 가림
      let covered = false;
      for (const p of this.en) {
        if (p.kind !== 'part' || p.parent !== e || p.dead || !p.pdef?.fx) continue;
        if (p.pdef.fx.armor) dmg *= p.pdef.fx.armor;
        if (p.pdef.fx.cover) covered = true;
      }
      const wk = b.def.weak;
      const weak = !covered && !!wk && (hx - e.x - wk.dx) ** 2 + (hy - e.y - wk.dy) ** 2 < wk.r * wk.r;
      if (src !== 'beam' && src !== 'bomb') {
        if (weak) {
          dmg *= b.weakMul;
          this.addFx('weak', hx, hy, strong ? 1.6 : 1.15, 0.24);
          if (Math.random() < 0.35) this.addFx('ring', hx, hy, 0.55, 0.2);
          for (let i = 0; i < 2; i++) this.part(hx, hy, rand(-70, 70), rand(-90, -10), 0.35, i ? '#ffb8d8' : '#ffffff', 2, 160);
          sfx('bossWeak');
          if (strong) this.hitstop = Math.max(this.hitstop, 0.045); // 약점에 차지 · 강공격: 짧은 멈춤
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
      if (e.kind === 'part') {
        // 파손 임계치(체력 절반)를 넘는 순간: 금 가는 소리 · 파편 폭발 · CRACK!
        if (e.hp > e.max * 0.5 && e.hp - dmg <= e.max * 0.5) {
          sfx('armorBreak', 0.5, 1.5);
          for (let i = 0; i < 10; i++) this.part(e.x, e.y, rand(-120, 120), rand(-130, 10), 0.45, i % 3 ? '#ffd890' : '#ffffff', 2, 260);
          this.floatText(e.x, e.y - 14, 'CRACK!', '#ffe9a0');
          this.kick(0.25, 0.04);
          this.hitstop = Math.max(this.hitstop, 0.04);
        }
        // 부위 피격: 살짝 밀려 들어가며 떨림 + 금속 파편 · 불티 (손맛)
        e.hitT = 0.13;
        for (let i = 0; i < (strong ? 4 : 2); i++) this.part(hx, hy, rand(-90, 90), rand(-110, -20), 0.32, i % 2 ? '#fff4c0' : '#ffb040', 2, 240);
        if (e.parent && e.parent === this.boss) this.bossRecoil = Math.min(1.6, this.bossRecoil + 0.2);
      }
      this.addFx(e.kind === 'part' ? 'metal' : 'spark', hx, hy, strong ? 1.6 : e.kind === 'part' ? 1.1 : 0.8, 0.18);
      // 소리 차등: 부위 = 높은 금속음 · 일반 적 = 기본
      if (e.kind === 'part') sfx('bossHit', 0.75, rand(1.2, 1.35)); else sfx('enemyHit', 1);
      if (strong) this.hitstop = Math.max(this.hitstop, e.kind === 'part' ? 0.05 : 0.03);
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
          this.slowT = 1.1; // 격파 순간 슬로모션 → 연쇄 폭발
          buzz([90, 50, 140, 50, 200], 0);
          sfx('bossBreak');
          stopBgm(1.0);
          this.flashWhite = 0.6;
          // 남은 잡몹도 함께 폭발
          for (const o of this.en) if (o.kind === 'small') this.damage(o, 999, 'bomb', o.x, o.y);
        } else {
          sfx('boomL', 0.8);
          // 중간보스 격파 보상: P 1개 (무기 진화의 확실한 기회)
          this.items.push({ x: e.x, y: e.y, kind: 'star', age: 0, alive: true });
        }
        this.bossSay(`${b.def.name} 격파!`, '#ffe34a');
        this.talk(b.def.mid ? 'midDown' : 'bossDown');
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
      // 회복(딸기)은 일반 적에게서 떨어지지 않음 — 회복은 스테이지 보급(난이도별 횟수)과 정해진 자리에서만
      // 드랍 밸런스: P(무기 진화)는 귀하게 · 폭탄은 더 귀하게 · 큰 적(포함)은 확실한 보상
      if (e.type === 'gunship') drop(r < 0.55 ? 'star' : r < 0.75 ? 'banana' : 'cookie');
      else if (r < 0.075) drop('star');
      else if (r < 0.155) drop('cookie');
      else if (r < 0.17) drop('banana');
    }
  }

  private killPart(p: Enemy, reward: boolean): void {
    if (p.dead) return;
    p.dead = true;
    for (let i = 0; i < 4; i++) this.addBoom(p.x + rand(-8, 8), p.y + rand(-8, 8), rand(0.6, 0.9), i * 0.07);
    this.addFx('ring', p.x, p.y, 0.9, 0.3);
    this.debris(p.x, p.y, 12, ['#d8a040', '#5a5a66', '#3a2a2a']);
    const pd = p.pdef;
    const b = p.parent ? this.bsOf(p.parent) : null;
    // 부서진 자리에 파손 그림이 그대로 남음 (응가 팩 부위)
    if (pd && b && pd.cell != null) {
      b.wrecks.push({ dx: p.dx ?? 0, dy: p.dy ?? 0, cell: pd.cell + 1, k: pd.k });
      // 떨어져 나가는 조각: 부서지기 전 모습이 회전하며 튕겨 떨어짐 (본체엔 파손 그림이 남음)
      if (this.chunks.length < 6) this.chunks.push({ cell: pd.cell, x: p.x, y: p.y, vx: Math.sign(p.dx ?? 1) * rand(40, 80), vy: rand(-140, -90), rot: 0, vr: rand(-6, 6), k: pd.k * 0.8, t: 0 });
      if (p.parent) { p.parent.flash = 0.09; if (p.parent === this.boss) this.bossRecoil = 1.6; }
      this.addFx('ring', p.x, p.y, 1.6, 0.4);
      for (let i = 0; i < 10; i++) this.addFx('smoke', p.x + rand(-10, 10), p.y + rand(-8, 8), rand(0.6, 1.1), rand(0.6, 1.1), -rand(10, 30));
      if (pd.fx?.cover || pd.fx?.weak) b.exposedT = 3;
    }
    if (!reward) return;
    sfx('armorBreak');
    sfx('boomM', 0.8);
    this.hitstop = Math.max(this.hitstop, 0.09); // 부위 파괴 순간: 확실한 히트스톱
    this.kick(0.6, 0.07);
    this.score += p.score;
    this.partsBroken++;
    this.floatText(p.x, p.y - 8, `+${p.score}`, '#ffc040');
    this.items.push({ x: p.x, y: p.y, kind: pd ? 'star' : 'cookie', age: 0, alive: true });
    buzz([30, 30, 50]);
    // 부품 자리에 계속 연기
    if (p.parent === this.boss) this.partSmoke.push([p.dx ?? 0, p.dy ?? 0]);
    this.addGauge(0.08);
    if (pd && b) {
      const fx = pd.fx ?? {};
      if (fx.cut) b.cut.push(...fx.cut.filter((a) => !b.cut.includes(a)));
      if (fx.rage) b.rage.push(...fx.rage.filter((a) => !b.rage.includes(a)));
      if (fx.weak) b.weakMul = Math.max(b.weakMul, fx.weak);
      if (fx.slow) b.restMul *= fx.slow;
      // 무엇이 바뀌었는지 짧게 알려 줌 (전략이 보이도록)
      const what = fx.cover ? '약점 노출!' : fx.armor ? (fx.rage ? '봉인 해제! 그러나 발악…!' : '방어력 저하!') : fx.rage ? '분노! 새 공격이 열렸다!' : fx.cut ? '공격 하나 봉쇄!' : '';
      this.banner = { text: `${pd.name ?? '부위'} 파괴!`, sub: what, t: 1.6, col: '#ffc040' };
      this.flashWhite = Math.max(this.flashWhite, 0.25);
      for (let i = 0; i < 6; i++) this.addBoom(p.x + rand(-12, 12), p.y + rand(-10, 10), rand(0.7, 1.1), 0.05 + i * 0.06);
    }
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
            const pr = 18 + b.lvl * 4; // 할머니 포션 튐 범위: 레벨마다 넓어짐
            for (const o of this.en) if (o !== e && (o.x - b.x) ** 2 + (o.y - b.y) ** 2 < pr * pr) this.damage(o, 1.5, 'potion', o.x, o.y);
            this.addBoom(b.x, b.y, 0.35, 0);
          }
          // 차지 폭발탄(삼촌 미사일 · 할머니 플라스크): 주변에 절반 피해
          if (b.scale >= 1.5 && (b.kind === 'missile' || b.kind === 'potion')) {
            // 폭발 중심은 맞은 적 (탄이 적 가장자리에 닿아도 주변이 안정적으로 맞음)
            for (const o of this.en) if (o !== e && !o.dead && o.y > -4 && (o.x - e.x) ** 2 + (o.y - e.y) ** 2 < 36 * 36) this.damage(o, b.dmg * 0.5, b.kind, o.x, o.y);
            this.addBoom(e.x, e.y, 0.6, 0);
            this.addFx('ring', e.x, e.y, 1.1, 0.25);
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
    const bonus = { clear: 0, hp: 0, bomb: 0, noMiss: 0, rank: 0, total: 0 };
    const stageScore = this.score - this.startScore;
    let rk: ReturnType<typeof evalRank> | null = null;
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
      rk = evalRank({
        stage: this.st.id, diff: this.diffId, time: this.t, hits: this.hits, bombsUsed: this.bombsUsed, maxCombo: this.maxCombo,
        partsBroken: this.partsBroken, partsTotal: this.partsTotal, stageScore,
      });
      bonus.rank = rk.bonus;
      bonus.total = bonus.clear + bonus.hp + bonus.bomb + bonus.noMiss + bonus.rank;
      this.score += bonus.total;
      this.banner = { text: final ? 'ALL CLEAR!' : 'STAGE CLEAR!', t: 9, col: '#ffe34a' };
    }
    const info: EndInfo = {
      won, final, stage: this.st.id, score: this.score, time: this.t, maxCombo: this.maxCombo, hp: Math.max(0, Math.min(this.hp, MAX_HP)), bombs: this.bombs, power: this.power,
      noMiss: this.hits === 0, bonus,
      hits: this.hits, bombsUsed: this.bombsUsed, partsBroken: this.partsBroken, partsTotal: this.partsTotal, stageScore,
      rank: rk?.rank, rankPts: rk?.points, rankItems: rk?.items,
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
  /** 보스 그림 프레임: 2장 시트 = 정상/파손(2페이즈부터) · 3장 이상 = 페이즈마다 다른 모습 (격파 중은 마지막 장) */
  private bossFrame(b: { def: BossDef; phase: number; mode: string }): number {
    const n = b.def.frames;
    if (n >= 3) return b.mode === 'dying' ? n - 1 : Math.min(n - 1, Math.max(0, b.phase - 1));
    return n > 1 && (b.phase >= 2 || b.mode === 'dying') ? 1 : 0;
  }

  private bakeBackdrop(): HTMLCanvasElement {
    const [c, g] = this.mkCanvas(W * R, H * R);
    g.drawImage(this.art['bg-backdrop'], 0, 0, W * R, H * R);
    const tint = this.st.tint ?? 1; // 응가 팩 배경은 밝은 색감 유지용으로 덜 덮을 수 있음
    g.fillStyle = `rgba(40, 20, 70, ${0.28 * tint})`;
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = `rgba(16, 8, 34, ${0.22 * tint})`;
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

  /** 격자 시트 (cols×rows) 의 한 칸 */
  private cell(im: HTMLImageElement, col: number, row: number, cols: number, rows: number, x: number, y: number, k = 1): void {
    const fw = im.width / cols;
    const fh = im.height / rows;
    const w = (fw * k) / R;
    const h = (fh * k) / R;
    this.g.drawImage(im, col * fw, row * fh, fw, fh, x - w / 2, y - h / 2, w, h);
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
    if (this.chunks.length && this.art.parts) {
      const pim = this.art.parts;
      const fw = pim.width / 4;
      for (const c of this.chunks) { this.g.globalAlpha = clamp(1.4 - c.t, 0, 1); this.drawV2(pim, c.x, c.y, c.t < 0.08, c.rot, c.cell * fw, fw, c.k); }
      this.g.globalAlpha = 1;
    }
    this.drawBeams();
    this.drawSpecialUnder();

    // 내 탄 — 살짝 투명하게 (적 탄이 항상 더 또렷하게 보이도록)
    g.globalAlpha = 0.88;
    for (const b of this.pb) this.drawPBullet(b);
    g.globalAlpha = 1;

    this.drawVillain();
    this.drawCompanion();
    this.drawProbiotic();
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
    this.drawRage();
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
    if (P.length && this.propIdx === 0 && this.propLoop === 0 && this.props.length === 0) {
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

  /** 보스 분노: 붉은 테두리 맥동 + 사선 띠 'RAGE MODE' 컷인 (필살기 예고) */
  private drawRage(): void {
    if (this.rageT <= 0 || this.over) return;
    const g = this.g;
    const t = 1.6 - this.rageT;
    const a = Math.min(1, this.rageT * 2) * (0.35 + 0.25 * Math.sin(this.t * 30));
    g.globalAlpha = a; g.fillStyle = '#ff2040';
    g.fillRect(0, 0, W, 5); g.fillRect(0, H - 5, W, 5); g.fillRect(0, 0, 5, H); g.fillRect(W - 5, 0, 5, H);
    g.globalAlpha = 1;
    if (t < 1.2) {
      const x = t < 0.2 ? (1 - t / 0.2) * W : t > 1.0 ? -((t - 1.0) / 0.2) * W : 0;
      g.fillStyle = 'rgba(20,4,10,0.85)'; g.fillRect(x, 150, W, 30);
      g.fillStyle = '#ff2040'; g.fillRect(x, 150, W, 2); g.fillRect(x, 178, W, 2);
      this.text(this.rageFinal ? 'FINAL FORM!' : 'RAGE MODE!', W / 2 + x, 154, '#ff6f8a', 'center', 16);
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
    // 보스 실루엣이 붉은 하늘 뒤에서 천천히 다가옴 (등장 컷)
    const bim = this.art[this.st.boss.art];
    if (bim) {
      const fw = bim.width / this.st.boss.frames;
      const prog = clamp(1 - this.warnT / 3.6, 0, 1);
      const sc = this.st.boss.k * (1.1 + prog * 0.5);
      g.globalAlpha = 0.25 + prog * 0.35;
      this.drawV2(this.darkOf(bim) as unknown as HTMLImageElement, W / 2, 118 - (1 - prog) * 20, false, 0, 0, fw, sc);
      g.globalAlpha = 1;
    }
    this.text('WARNING', W / 2, 150, k > 0.5 ? '#ff4060' : '#ffe0e8', 'center', 22);
    // 이름표: 금테 남색 명판이 옆에서 미끄러져 들어옴
    const slide = clamp((3.6 - this.warnT) / 0.5, 0, 1);
    const px = W / 2 - (1 - slide) * W;
    g.fillStyle = '#120a2e'; g.fillRect(px - 76, 174, 152, 34);
    g.fillStyle = '#e8b53c'; g.fillRect(px - 76, 174, 152, 2); g.fillRect(px - 76, 206, 152, 2);
    this.text(this.st.boss.name, px, 178, '#ffe9a0', 'center', 13);
    this.text(this.st.boss.intro.slice(0, 22), px, 194, '#cfc4ff', 'center', 8);
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
    // 필살기 이름: 이미 '!' 로 끝나면 덧붙이지 않음 · 화면(180px)에 안 들어가는 긴 이름은 '!' 뒤에서 두 줄로 나눠 작게
    const spName = familyText(s.id)?.special ?? SPECIAL_NAME[s.id];
    const full = spName.endsWith('!') ? spName : spName + '!';
    const cut = full.indexOf('! ');
    if (full.length > 11 && cut > 0) {
      this.text(full.slice(0, cut + 1), W / 2 - x * 0.6, y + h + 4, SP_CUT_COL[s.id], 'center', 13);
      this.text(full.slice(cut + 2), W / 2 - x * 0.6, y + h + 19, SP_CUT_COL[s.id], 'center', 13);
    } else this.text(full, W / 2 - x * 0.6, y + h + 6, SP_CUT_COL[s.id], 'center', full.length > 11 ? 12 : 16);
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
      const fl = this.a.extra['fx/flame'];
      if (fl) {
        // 불꽃의 약손: 몸 둘레를 도는 불꽃 3개 (살짝 커졌다 작아짐)
        for (let i = 0; i < 3; i++) {
          const a = this.t * 3 + (i * TAU) / 3;
          this.frame(fl, 0, 1, this.px + Math.cos(a) * 20, this.py - 4 + Math.sin(a) * 12, 0.7 + Math.sin(this.t * 14 + i) * 0.08);
        }
      }
    } else if (s.id === 'samchon' && !this.a.extra['chars/samchon/probiotic']) {
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
      case 'wsplash': case 'psplash': {
        const im = this.a.extra[f.kind === 'wsplash' ? 'fx/water-splash' : 'fx/prune-splash'];
        if (!im) break;
        this.g.globalAlpha = k > 0.6 ? Math.max(0, (1 - k) / 0.4) : 1;
        this.frame(im, 0, 1, f.x, f.y - k * 4, f.scale * (0.7 + k * 0.5));
        this.g.globalAlpha = 1;
        break;
      }
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

  /** 보스 그림 반폭·반높이 (화면 안에 머물도록 이동 범위 계산) */
  private bossHalf(def: BossDef): [number, number] {
    const im = this.art[def.art];
    let hw = ((im.width / def.frames) * def.k) / 2;
    let hh = (im.height * def.k) / 2;
    // 보스 고유 부위가 몸 밖으로 튀어나오면 그만큼 더 (화면 가장자리에서 잘리지 않게)
    const pim = this.art.parts;
    if (pim) for (const p of def.parts) if (p.cell != null) {
      const ph = ((pim.width / 4) * p.k) / 2;
      hw = Math.max(hw, Math.abs(p.dx) + ph);
      hh = Math.max(hh, -p.dy + ph);
    }
    return [hw, hh];
  }
  /** 머무는 높이: 위쪽 상태 표시줄(40px) 아래로 그림 전체가 보이게 */
  private restOf(def: BossDef): number {
    const [, hh] = this.bossHalf(def);
    const bob = def.move === 'figure8' ? 12 : def.move === 'drift' ? 8 : 0;
    return Math.max(def.restY, Math.round(40 + hh + bob + 4));
  }
  /** 자동 검수(?skytest): 그림이 화면 밖으로 나간 최대 픽셀 (종류:그림 → [왼, 오른, 위, 아래]) */
  cropLog: Record<string, number[]> = CROPCHECK ? (((window as unknown as { __cropLog?: Record<string, number[]> }).__cropLog ??= {})) : {};
  private noteCrop(key: string, cx: number, cy: number, w: number, h: number): void {
    const o = [Math.max(0, -(cx - w / 2)), Math.max(0, cx + w / 2 - W), Math.max(0, 40 - (cy - h / 2)), Math.max(0, cy + h / 2 - H)];
    const c = (this.cropLog[key] ??= [0, 0, 0, 0]);
    for (let i = 0; i < 4; i++) c[i] = Math.max(c[i], Math.round(o[i]));
  }
  private drawEnemy(e: Enemy): void {
    const white = e.flash > 0;
    const im = this.art[e.art];
    if (CROPCHECK && e.kind !== 'small') {
      const b0 = e.kind === 'boss' ? this.bsOf(e) : null;
      const pm = e.kind === 'part' && e.parent ? this.bsOf(e.parent).mode : '';
      if (pm !== 'enter' && pm !== 'dying' && (!b0 || (b0.mode !== 'enter' && b0.mode !== 'dying'))) {
        const fw0 = b0 ? im.width / b0.def.frames : e.pdef ? im.width / 4 : im.width;
        this.noteCrop(`${b0?.def.mid ? 'mid' : e.kind}:${this.st.art}/${e.art}`, e.x, e.y, fw0 * (b0 ? b0.def.k : e.k), im.height * (b0 ? b0.def.k : e.k));
      }
    }
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
      if (e.pdef?.cell != null) {
        // 보스 고유 부위 (A · B): 본체에 붙은 그림자 · 맞으면 안쪽으로 밀리며 떨림 · 체력이 줄수록 파손 그림이 서서히 드러남
        const fw = im.width / 4;
        const ht = e.hitT ?? 0;
        // 본체와 한 몸: 본체의 반동 · 떨림 · 피격 번쩍임을 그대로 따라감
        const par = e.parent;
        const pb = par ? this.bsOf(par) : null;
        const pShake = pb ? (pb.mode === 'dying' ? Math.sin((par?.age ?? 0) * 60) * 1.5 : pb.mode === 'tele' ? Math.sin((par?.age ?? 0) * 70) * 0.7 : 0) : 0;
        const pRec = par && par === this.boss ? Math.round(this.bossRecoil) : 0;
        // 맞으면 본체 바깥쪽으로 밀렸다가 돌아옴 · 체력 25% 아래면 덜렁거림
        const ang = par ? Math.atan2(e.y - par.y, e.x - par.x) : -Math.PI / 2;
        const loose = e.hp < e.max * 0.25 ? Math.sin(this.t * 13 + e.x) * 1.1 : 0;
        const px = e.x + pShake + Math.cos(ang) * ht * 9 + (ht > 0 ? Math.sin(this.t * 90) * 1.2 : 0) + loose;
        const py = e.y - pRec + Math.sin(ang) * ht * 9 - ht * 4;
        // 붙은 자리(이음매) 그림자: 본체 쪽으로 어두운 타원 → 떠 있는 그림처럼 보이지 않게
        if (par) {
          const g = this.g;
          const jx = px - Math.cos(ang) * e.hr * 0.55;
          const jy = py - Math.sin(ang) * e.hr * 0.55;
          g.globalAlpha = 0.32;
          g.fillStyle = '#140818';
          g.beginPath(); g.ellipse(jx, jy + 2, e.hr * 0.75, e.hr * 0.5, ang, 0, TAU); g.fill();
          g.globalAlpha = 1;
        }
        const parWhite = par ? par.flash > 0 : false;
        // 본체와 같은 굵은 어두운 외곽선 + 붙은 자리 그림자 → '따로 얹은 그림'이 아니라 한 몸처럼
        const dk = this.darkOf(im) as unknown as HTMLImageElement;
        for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) this.drawV2(dk, px + ox, py + oy, false, 0, e.pdef.cell * fw, fw, e.k);
        this.g.globalAlpha = 0.45;
        this.drawV2(dk, px + 2, py + 3, false, 0, e.pdef.cell * fw, fw, e.k);
        this.g.globalAlpha = 1;
        this.drawV2(im, px, py, white || parWhite || (e.hp < e.max * 0.25 && Math.floor(this.t * 8) % 2 === 0), 0, e.pdef.cell * fw, fw, e.k);
        // 파괴 직전: 이음매에서 붉은 열기가 새어 나옴
        if (e.hp < e.max * 0.25) { const g = this.g; g.globalAlpha = 0.25 + 0.2 * Math.sin(this.t * 16); g.fillStyle = '#ff5030'; g.beginPath(); g.arc(px - Math.cos(ang) * e.hr * 0.5, py - Math.sin(ang) * e.hr * 0.5, 4 + Math.sin(this.t * 9) * 1.5, 0, TAU); g.fill(); g.globalAlpha = 1; }
        const dmgK = clamp((1 - e.hp / e.max - 0.3) / 0.55, 0, 0.9);
        if (dmgK > 0) { this.g.globalAlpha = dmgK; this.drawV2(im, px, py, false, 0, (e.pdef.cell + 1) * fw, fw, e.k); this.g.globalAlpha = 1; }
        // 금이 많이 갔으면 작은 불꽃 · 연기
        if (dmgK > 0.4 && Math.random() < 0.12) this.part(px + rand(-6, 6), py + rand(-6, 6), rand(-10, 10), rand(-40, -15), 0.5, '#ff8a30', 2, -30);
        if (e.hp < e.max) this.hpBar(e.x - 9, e.y + e.hr, 18, e.hp / e.max);
        return;
      }
      this.drawV2(im, e.x, e.y, white, 0, 0, im.width, e.k);
      if (e.hp < e.max) this.hpBar(e.x - 8, e.y + 9, 16, e.hp / e.max);
      return;
    }
    const b = this.bsOf(e);
    const def = b.def;
    const fw = im.width / def.frames;
    const shakeX = b.mode === 'dying' ? Math.sin(e.age * 60) * 1.5 : b.mode === 'tele' ? Math.sin(e.age * 70) * 0.7 : 0;
    const recoil = e === this.boss ? Math.round(this.bossRecoil) : 0;
    const sx = this.bossFrame(b) * fw;
    this.drawV2(im, e.x + shakeX, e.y - recoil, white, 0, sx, fw, def.k);
    if (b.wrecks.length && this.art.parts) {
      // 부서진 부위 잔해 (본체와 함께 흔들림)
      const pim = this.art.parts;
      const pfw = pim.width / 4;
      for (const w of b.wrecks) this.drawV2(pim, e.x + shakeX + w.dx, e.y - recoil + w.dy, white, 0, w.cell * pfw, pfw, w.k);
      // 부서진 자리에서 가끔 연기 · 불똥 (부서진 뒤에도 자리가 어색하지 않게)
      if (b.mode !== 'dying' && Math.random() < 0.06 * b.wrecks.length) { const w = b.wrecks[Math.floor(Math.random() * b.wrecks.length)]; this.part(e.x + w.dx + rand(-4, 4), e.y + w.dy + rand(-4, 4), rand(-6, 6), rand(-30, -12), 0.7, Math.random() < 0.3 ? '#ff9a40' : '#6a6070', 2.5, -20); }
    }
    // 약점 노출: 깨진 자리 너머 약점에 붉은 조준 고리가 맥동 (어디를 쏴야 하는지 한눈에)
    if (e === this.boss && b.weakMul > 1.5 && def.weak && b.mode !== 'dying') {
      const g = this.g;
      const pul = 0.5 + 0.5 * Math.sin(this.t * 7);
      if (b.exposedT && b.exposedT > 0) b.exposedT -= 1 / 60;
      g.strokeStyle = (b.exposedT ?? 0) > 0 ? '#ffffff' : '#ff4060';
      g.globalAlpha = 0.5 + 0.4 * pul;
      g.lineWidth = 1.5;
      g.beginPath(); g.arc(e.x + def.weak.dx + shakeX, e.y + def.weak.dy - recoil, def.weak.r + 2 + pul * 3, 0, TAU); g.stroke();
      g.globalAlpha = 1;
      if ((b.exposedT ?? 0) > 1.5) this.text('WEAK!', e.x + def.weak.dx, e.y + def.weak.dy - def.weak.r - 14, '#ff6f8a', 'center', 9);
    }
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
      case 'wave': {
        if (b.r >= 9 && this.fam === 'halabeoji') {
          // 할아버지 방패파: 은빛 방패가 앞으로 밀려 나감
          const sh = this.a.img['fx-shield'];
          this.g.globalAlpha = 0.85;
          this.g.drawImage(sh, Math.round(b.x - sh.width / 2), Math.round(b.y - sh.height / 2));
          this.g.globalAlpha = 1;
          return;
        }
        this.blit(this.pbSprite('fx/shot-wave', Math.atan2(b.vy, b.vx) + Math.PI / 2), b.x, b.y);
        return;
      }
      case 'charge': this.frame(v['fx/charge'], Math.floor(b.age * 16) % 4, 4, b.x, b.y + 8, b.scale * 1.3); return;
      case 'heart': this.frame(v['fx/heart-p'], Math.floor(b.age * 8) % 2, 2, b.x, b.y, b.scale > 1 ? 2 : 1.5); return;
      // 물방울 (엄마): 하늘색 물방울 + 흰 하이라이트 — 단순 탄환 모양 (임시 효과)
      case 'water': {
        const wd = this.a.extra['fx/water-drop'];
        if (wd) { this.frame(wd, 0, 1, b.x, b.y, b.scale > 1.2 ? b.scale : b.scale > 1 ? 1.15 : 0.85); return; }
        const g = this.g;
        const r = (b.scale > 1 ? 3 : 2.2) * (1 + Math.sin(b.age * 14) * 0.08);
        g.fillStyle = '#2f9fd8'; g.beginPath(); g.arc(b.x, b.y, r + 0.8, 0, TAU); g.fill();
        g.fillStyle = '#9ee6ff'; g.beginPath(); g.arc(b.x, b.y, r, 0, TAU); g.fill();
        g.fillStyle = '#ffffff'; g.fillRect(Math.round(b.x - r * 0.5), Math.round(b.y - r * 0.6), 1, 1);
        return;
      }
      // 프룬 구슬 (이모): 보라 구슬 + 연보라 하이라이트 — 단순 탄환 모양 (임시 효과)
      case 'prune': {
        const po = this.a.extra['fx/prune-orb'];
        if (po) { this.frame(po, 0, 1, b.x, b.y, b.scale > 1 ? 1.1 : 0.8); return; }
        const g = this.g;
        const r = (b.scale > 1 ? 3 : 2.4) * (1 + Math.sin(b.age * 12) * 0.1);
        g.fillStyle = '#3d1466'; g.beginPath(); g.arc(b.x, b.y, r + 0.8, 0, TAU); g.fill();
        g.fillStyle = '#9b4fe0'; g.beginPath(); g.arc(b.x, b.y, r, 0, TAU); g.fill();
        g.fillStyle = '#e6c8ff'; g.fillRect(Math.round(b.x - r * 0.5), Math.round(b.y - r * 0.5), 1, 1);
        return;
      }
      case 'star': this.frame(v['fx/star-p'], Math.floor(b.age * 10) % 2, 2, b.x, b.y, b.scale > 1 ? 1.6 : 1.2); return;
      case 'elec': this.frame(v['fx/elec'], Math.floor(b.age * 14) % 2, 2, b.x, b.y, 1.2); return;
      case 'potion': this.frame(v['fx/potion'], 0, 1, b.x, b.y, 1.3); return;
      case 'lance': case 'refl': this.frame(v['fx/lance'], 0, 1, b.x, b.y, 1.3); return;
      case 'missile': this.blit(this.pbSprite('fx/missile', Math.atan2(b.vy, b.vx) + Math.PI / 2, Math.floor(b.age * 12) % 2, 2), b.x, b.y); return;
      case 'drill': this.frame(v['fx/mech'], 0, 1, b.x, b.y, 1); return;
      case 'probio': {
        const pr = this.a.extra['chars/samchon/probiotic'];
        if (pr) this.cell(pr, 3, b.lvl % 3, 4, 3, b.x, b.y, 1.2);
        return;
      }
    }
  }

  /** 유산균 특공대 위치 (삼촌 필살기 중 고나 주변을 타원으로 돈다) */
  private probioticPos(i: number): [number, number] {
    const a = this.t * 2.2 + (i * TAU) / 3;
    return [this.px + Math.cos(a) * 34, this.py - 6 + Math.sin(a) * 12];
  }

  /** 유산균 그리기 (임시: 차지 구슬 스프라이트 — 유산균 전용 그림은 아직 없음) */
  private drawProbiotic(): void {
    const s = this.sp;
    if (!s || s.id !== 'samchon' || s.t < s.cut || s.t > s.cut + 3.0) return;
    const pr = this.a.extra['chars/samchon/probiotic'];
    const e = s.t - s.cut;
    for (let i = 0; i < 3; i++) {
      const [x, y] = this.probioticPos(i);
      if (pr) {
        if (e >= 2.3) continue; // 돌진한 뒤에는 탄(probio)이 그림
        const pop = Math.min(1, e / 0.25); // 튀어나오며 커짐
        this.cell(pr, Math.floor(this.t * 6 + i) % 3, i, 4, 3, x, y + (1 - pop) * 8, 0.6 + pop * 0.4);
      } else this.frame(this.a.v2['fx/charge-orb'], Math.floor(this.t * 10 + i) % 4, 4, x, y, 0.55);
    }
  }

  private drawCompanion(): void {
    const g = this.g;
    // 삼촌 유산균 드론 (무기 레벨만큼)
    const nb = this.bugCount();
    const pr = nb ? this.a.extra['chars/samchon/probiotic'] : null;
    if (pr) for (let i = 0; i < nb; i++) { const [x, y] = this.bugPos(i, nb); this.cell(pr, 3, i % 3, 4, 3, x, y, 0.8); }
    const fly = this.a.v2[`chars/${this.fam}/fly` as V2Name];
    const attacking = this.cKick > 0.15 || (this.fam === 'halabeoji' && this.shield > 0) || (this.sp !== null && this.sp.id !== 'gona');
    const f = (attacking ? 2 : 0) + (Math.floor(this.t * (attacking ? 10 : 6)) % 2);
    const bob = Math.sin(this.t * 4 + 1) * 1.5;
    // 화면상 크기 통일: 스프라이트 칸은 같아도 실제 그림(불투명 면적)이 큰 할머니·할아버지는 줄여서 그림 (발끝 기준)
    const sk = FLY_K[this.fam];
    const dw = 44 * sk;
    const dh = 56 * sk;
    g.drawImage(fly, f * 88, 0, 88, 112, this.cx - dw / 2, this.cy + 18 - dh + bob - this.cKick * 2, dw, dh);
    if (this.fam !== 'imo' && this.fam !== 'samchon' && this.cCd > 0 && this.cCd < 20 && !this.sp) {
      const full = this.fam === 'mom' ? 0.9 : this.fam === 'dad' ? 0.9 : this.fam === 'halmeoni' ? 1.1 : 7;
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
    if (this.sp && this.sp.id === 'halabeoji' && this.sp.t >= this.sp.cut) {
      // 유해균 방패: 방패 둘레를 도는 육각 방패 조각 + 다가오다 튕겨 나가는 세균 (팩 그림 없으면 보라 점)
      const hx = this.a.extra['fx/hex'];
      const gm = this.a.extra['fx/germ'];
      for (let i = 0; i < 6; i++) {
        const a = this.t * 2.4 + (i * TAU) / 6;
        const x = this.px + Math.cos(a) * 30;
        const y = this.py - 14 + Math.sin(a) * 20;
        if (hx) this.frame(hx, 0, 1, x, y, 0.8);
        else {
          g.fillStyle = '#c9a0ff';
          g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
        }
      }
      if (gm) {
        for (let i = 0; i < 4; i++) {
          const ph = (this.t * 0.9 + i * 0.25) % 1; // 0→1: 바깥에서 다가옴 → 방패에 닿으면 튕겨 나감
          const a = i * 1.7 + 0.6;
          const r = ph < 0.7 ? 78 - ph * 60 : 36 + (ph - 0.7) * 160;
          g.globalAlpha = ph < 0.7 ? 1 : Math.max(0, 1 - (ph - 0.7) / 0.3);
          this.frame(gm, 0, 1, this.px + Math.cos(a) * r, this.py - 14 + Math.sin(a) * r * 0.75, ph < 0.7 ? 0.8 : 0.6);
        }
        g.globalAlpha = 1;
      }
    }
    if (this.healHearts.length) {
      const hv = this.a.v2['fx/heart-p'];
      const hh = this.a.extra['fx/heal-heart'];
      for (const h of this.healHearts) {
        const age = this.t - h.t0;
        g.globalAlpha = clamp(1 - age / 1.1, 0, 1);
        if (hh) this.frame(hh, 0, 1, h.x + Math.sin(age * 6 + h.x) * 3, h.y - age * 42, 0.75 + Math.min(age, 0.2));
        else this.frame(hv, Math.floor(age * 8) % 2, 2, h.x + Math.sin(age * 6 + h.x) * 3, h.y - age * 42, 1.2);
      }
      g.globalAlpha = 1;
      compact(this.healHearts, (h) => this.t - h.t0 < 1.1);
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
    // 차지 에너지 링: 캐릭터 둘레에서 점점 커지고 · 테두리 게이지가 차오름 · MAX 면 분홍빛으로 맥동
    const touchC = !this.charging && this.dragId !== null && this.holdT > HOLD_START && this.charge > 0;
    if (this.charging || touchC) {
      const full = CHARGE_FULL[this.fam];
      const kk = Math.min(1, this.charge / full);
      const max = kk >= 1;
      const pul = max ? 0.5 + 0.5 * Math.sin(this.t * 18) : 0;
      const rr = 11 + kk * 9 + pul * 2;
      const cy0 = this.py - 6;
      g.globalAlpha = 0.08 + kk * 0.1 + pul * 0.06;
      g.fillStyle = max ? '#ff8ac8' : '#ffe470';
      g.beginPath(); g.arc(this.px, cy0, rr, 0, TAU); g.fill();
      g.globalAlpha = 0.55;
      g.strokeStyle = '#2a1a3a';
      g.lineWidth = 3;
      g.beginPath(); g.arc(this.px, cy0, rr + 3, 0, TAU); g.stroke();
      g.globalAlpha = 1;
      g.strokeStyle = max ? (pul > 0.5 ? '#ffffff' : '#ff6fb0') : kk >= HOLD_FIRE / full ? '#ffe34a' : '#fff4d6';
      g.lineWidth = 2;
      g.beginPath(); g.arc(this.px, cy0, rr + 3, -Math.PI / 2, -Math.PI / 2 + TAU * kk); g.stroke();
      if (Math.random() < 0.35) {
        const a = rand(0, TAU);
        this.part(this.px + Math.cos(a) * (rr + 10), cy0 + Math.sin(a) * (rr + 10), -Math.cos(a) * 70, -Math.sin(a) * 70, 0.2, max ? '#ffb0d8' : '#ffe470', 1, 0);
      }
    }
    if (this.meleeHitT > 0) {
      g.globalAlpha = this.meleeHitT / 0.14;
      g.fillStyle = '#e8fbff';
      g.beginPath(); g.arc(this.px, this.py - 24, 12 + (0.14 - this.meleeHitT) * 120, 0, TAU); g.fill();
      g.globalAlpha = 1;
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
    if (s.length >= 4 && /^\d+$/.test(s)) {
      // 점수처럼 자주 바뀌는 숫자: 숫자 한 글자씩 캐시된 그림을 이어 그림 (바뀔 때마다 새 캔버스를 만들지 않음)
      // 글자마다 실제 폭만큼 진행 (글꼴의 숫자 폭이 서로 달라도 틈이 생기지 않게)
      let w0 = 4;
      for (const ch of s) w0 += (textImg(ch, col, size).width - 4 * R) / R;
      let x0 = align === 'left' ? x - 2 : align === 'center' ? x - w0 / 2 : x - w0 + 2;
      for (const ch of s) {
        const im = textImg(ch, col, size);
        this.g.drawImage(im, Math.round(x0 * R) / R, Math.round((y - 1) * R) / R, im.width / R, im.height / R);
        x0 += (im.width - 4 * R) / R;
      }
      return;
    }
    const im = textImg(s, col, size);
    const w = im.width / R;
    const x0 = align === 'left' ? x - 2 : align === 'center' ? x - w / 2 : x - w + 2;
    this.g.drawImage(im, Math.round(x0 * R) / R, Math.round((y - 1) * R) / R, w, im.height / R);
  }

  private drawHud(): void {
    if (this.sigWarn > 0) {
      // 필살기 예고: 화면 가장자리 붉은 테두리 깜빡임
      const g0 = this.g;
      g0.globalAlpha = 0.35 + 0.35 * (Math.floor(this.sigWarn * 10) % 2);
      g0.fillStyle = '#ff3a5a';
      g0.fillRect(0, 0, W, 3); g0.fillRect(0, H - 3, W, 3); g0.fillRect(0, 0, 3, H); g0.fillRect(W - 3, 0, 3, H);
      g0.globalAlpha = 1;
    }
    const g = this.g;
    g.fillStyle = '#120a26';
    g.fillRect(0, 0, W, 25);
    g.fillStyle = '#e8b53c'; g.fillRect(0, 25, W, 1);
    g.fillStyle = '#7a4a14'; g.fillRect(0, 26, W, 1);
    const hearts = Math.min(this.hp, MAX_HP);
    for (let i = 0; i < MAX_HP; i++) g.drawImage(this.a.img[i < hearts ? 'icon-heart' : 'icon-heart-empty'], 4 + i * 10, 3);
    for (let i = 0; i < this.bombs; i++) g.drawImage(this.a.img['icon-bomb'], 4 + i * 10, 14);
    this.text(String(this.score).padStart(8, '0'), W - 4, 2, '#ffe9a8', 'right');
    // 무기 레벨: LV + 4칸 (최대면 금색 MAX · 레벨이 내려가면 잠깐 붉게 깜빡)
    const lvCol = this.lvDownT > 0 && Math.floor(this.lvDownT * 10) % 2 ? '#ff6f8a' : this.power >= 4 ? '#ffd84a' : '#58e0ff';
    for (let i = 0; i < 4; i++) {
      g.fillStyle = '#120a26'; g.fillRect(W - 47 + i * 7, 15, 7, 7);
      g.fillStyle = i < this.power ? lvCol : '#2a3060'; g.fillRect(W - 46 + i * 7, 16, 5, 5);
    }
    if (this.lvUpT > 0) { g.fillStyle = '#ffffff'; g.globalAlpha = this.lvUpT * 2; g.fillRect(W - 47, 15, 28, 7); g.globalAlpha = 1; }
    this.text(this.power >= 4 ? 'MAX' : 'LV', W - 50, 13, lvCol, 'right', 11);
    // 임시 그래픽 스테이지: 화면 아래쪽에 항상 작게 표시 (최종본으로 오해하지 않게)
    if (THEME_ID === 'poop' && this.st.temp && !this.over) this.text('※ 임시 그래픽', W / 2, H - 11, '#cfc4ff', 'center', 9);
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
    // 글자가 화면 폭을 넘으면 크기를 줄여서 (양옆 잘림 방지)
    let fs = 16;
    while (fs > 10 && textImg(b.text, b.col, fs).width / R > W - 8) fs -= 1;
    this.text(b.text, W / 2, y, b.col, 'center', fs);
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
