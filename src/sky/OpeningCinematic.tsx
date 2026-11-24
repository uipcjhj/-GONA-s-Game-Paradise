/**
 * 오프닝 컷신 「고나의 응가 대탈출 대작전」 (응가 테마 · 약 41초 + 타이틀)
 *
 *  이야기: 서기 2026년 → 떡뻥·이유식의 평화 → 꾸르륵(불길한 징조) → 힘주기·실패·울먹임(운명의 사투)
 *         → 잠듦 → 배 속 꿈의 소화왕국이 똥돌이 병사·딱딱똥 골렘에게 막힘 → 변비마왕 꽉막혀 → 여섯 수호자 → 익룡 영웅 출격
 *
 *  - 하나의 Canvas 에 시간축(초)으로 그리는 실시간 컷신. 장면마다 카메라(가감속 줌·팬), 캐릭터 동작(씹기·두드리기·
 *    부들부들·풀썩·흐느낌·숨쉬기), 장면을 잇는 전환(같은 자리 교차 · 배 속으로 들어가는 소용돌이 · 빛 모임)
 *  - 고나 표정 그림: public/assets/sky/v3-poop/opening2/ (Canva AI 로 새로 만든 4장 + 앞으로 받을 그림 칸)
 *    manifest.json 에 적힌 그림만 불러옴 → 새 그림 파일을 넣고 manifest 에 적으면 바로 그 장면에 쓰임
 *    아직 없는 그림 칸은 '임시 대체' 를 쓰고 (FALLBACK 표 참고) 테스트 훅에 기록
 *  - 음악·효과음: bgm-opening (tools/sky-audio/opening.py — 이 파일의 시각표와 같은 값으로 작곡)
 *  - 자막: DOM (고운바탕 OFL · 자체 호스팅, 실패 시 시스템 명조) · 아이보리 본문 + 절제된 금색 강조
 *  - SKIP · 끝나면 onDone 한 번만 · 그림이 안 불러와져도 멈추지 않고 그 레이어만 생략
 */
import { useEffect, useRef, useState } from 'react';
import { hasPack, loadArtPack, packPath } from './artpack';
import { playBgm, prepareBgm, stopBgm, unlockAudio } from './audio';
import type { FamilyId } from './engine';

const BASE = `${import.meta.env.BASE_URL}assets/sky/`;
const FAMILY: FamilyId[] = ['mom', 'dad', 'imo', 'samchon', 'halmeoni', 'halabeoji'];
const FAM_COL: Record<FamilyId, string> = { mom: '#5ec8ff', dad: '#ff8a3c', imo: '#b45cff', samchon: '#7ff0d0', halmeoni: '#ff8ac8', halabeoji: '#7ab8ff' };

// ───────── 시각표 (초) — tools/sky-audio/opening.py 와 같은 값 ─────────
const T = {
  s2: 4.0, pat: 6.9, s3: 9.6, startle: 10.35, s4: 13.6, peak: 17.6, puff: 17.95, cry: 18.2,
  s5: 20.6, dolly: 22.0, kingdom: 23.2, golem: 25.0, trainStop: 26.2, s6: 28.2, laugh: 29.9, gate: 31.5,
  s7: 32.0, cutins: 33.0, s8: 37.0, wake: 38.0, rise: 38.4, toward: 40.2,
};
/** 힘주기 (끄응!) 순간 */
const PUSHES = [14.2, 15.2, 16.1, 16.9];
const TITLE_AT = 41.4;
export const OPENING_END = 44.4; // 이 시각에 '터치하여 시작' 표시, END+1.4 초에 자동으로 게임으로

// ───────── 나레이션 자막 ([[ ]] = 금색 강조) ─────────
interface Cue { t: number; end: number; text: string; cls: string }
const CUES: Cue[] = [
  { t: 0.6, end: 3.7, text: '[[서기 2026년 11월…]]', cls: 'chron' },
  { t: 1.8, end: 3.7, text: '고나가 생후 7개월을 맞이한 해.', cls: 'chron sub' },
  { t: 4.5, end: 9.3, text: '떡뻥과 이유식을 즐기던 작은 영웅, 고나.', cls: '' },
  { t: 6.4, end: 9.3, text: '그 평화로운 나날은 영원할 것만 같았다.', cls: '' },
  { t: 10.4, end: 13.3, text: '그러나…', cls: '' },
  { t: 11.4, end: 13.3, text: '작은 배 속 깊은 곳에서, 불길한 기운이 깨어나고 있었다.', cls: '' },
  { t: 14.0, end: 20.2, text: '그것은 생후 일곱 달 인생에서 마주한…', cls: '' },
  { t: 16.2, end: 20.2, text: '[[가장 혹독한 시련]]이었다.', cls: '' },
  { t: 23.6, end: 27.9, text: '막힘은 번지고, 가스는 차오르며…', cls: '' },
  { t: 25.4, end: 27.9, text: '꿈속의 소화왕국은 깊은 혼란에 빠졌다.', cls: '' },
  { t: 28.6, end: 31.7, text: '모든 것의 배후에는…', cls: '' },
  { t: 29.9, end: 31.7, text: '[[변비마왕 꽉막혀]]가 있었다.', cls: '' },
  { t: 32.3, end: 36.7, text: '그러나 작은 영웅은 혼자가 아니었다.', cls: '' },
  { t: 37.3, end: 41.0, text: '지금, 세상에서 가장 작은 영웅의…', cls: '' },
  { t: 38.9, end: 41.0, text: '[[가장 위대한 탈출 작전]]이 시작된다!', cls: '' },
];
/** 자막 글자 (폰트 부분 집합 만들 때 씀: tools/sky-opening-font.py) */
export const OPENING_TEXT = CUES.map((c) => c.text.replace(/\[\[|\]\]/g, '')).join('');
/** 장면 경계 */
export const SCENES = [
  { id: 1, name: '서기 2026년', t: 0 },
  { id: 2, name: '풍요의 시대', t: T.s2 },
  { id: 3, name: '불길한 징조', t: T.s3 },
  { id: 4, name: '운명의 사투', t: T.s4 },
  { id: 5, name: '막혀버린 왕국', t: T.s5 },
  { id: 6, name: '마왕의 등장', t: T.s6 },
  { id: 7, name: '여섯 수호자', t: T.s7 },
  { id: 8, name: '운명의 출격', t: T.s8 },
];
const sceneAt = (t: number): number => { let s = 1; for (const x of SCENES) if (t >= x.t) s = x.id; return s; };

// ───────── 작은 수학 ─────────
const clamp = (v: number, a = 0, b = 1): number => Math.max(a, Math.min(b, v));
const lin = (t: number, a: number, b: number): number => clamp((t - a) / (b - a));
const eOut = (x: number): number => 1 - (1 - x) ** 3;
const eIn = (x: number): number => x * x * x;
const eIO = (x: number): number => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const hash = (n: number): number => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const TAU = Math.PI * 2;


/** 화면 흔들림 (초, 세기) — 작게 · 꼭 필요한 순간만 */
const SHAKES: [number, number][] = [[T.startle, 0.25], [11.6, 0.3], [14.2, 0.18], [15.2, 0.2], [16.1, 0.22], [16.9, 0.28], [T.golem, 0.45], [T.gate, 0.5], [TITLE_AT, 0.6]];

function bolt(seed: number, x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const pts: [number, number][] = [[x0, y0]];
  const n = 9;
  for (let i = 1; i < n; i++) {
    const k = i / n;
    pts.push([x0 + (x1 - x0) * k + (hash(seed + i) - 0.5) * 46, y0 + (y1 - y0) * k]);
  }
  pts.push([x1, y1]);
  return pts;
}

type Img = HTMLImageElement | null;
/** 오프닝 전용 그림 칸 (opening2/<이름>.png) — 앞 4장은 있음, 나머지는 받으면 채워짐 */
const SLOTS = ['gona-eat', 'gona-eat2', 'gona-pat', 'gona-startle', 'gona-strain', 'gona-strain2', 'gona-cry', 'gona-sleep', 'gona-hero',
  'v-soldier', 'v-golem', 'v-ghost', 'v-knight', 'v-king', 'v-king2', 'bg-castle', 'bg-home'] as const;
type Slot = (typeof SLOTS)[number];
/** 칸이 비었을 때 쓰는 임시 대체 (보고·테스트용 설명) */
export const FALLBACK: Partial<Record<Slot, string>> = {
  'gona-strain2': '힘주기 1장으로 (프레임 교대 없음)',
  'gona-cry': '스포트라이트 아래 작은 실루엣 + 흐느낌·눈물 반짝임 (표정은 보여 주지 않음)',
  'gona-sleep': '달빛 테두리 실루엣 + 숨쉬기·Zzz (표정은 보여 주지 않음)',
  'gona-hero': '기존 승인 고나 원화(주먹 든 자세)',
  'v-soldier': '기존 뽀글이·꾸덕이 무리',
  'v-golem': 'STAGE 1 보스 그림을 어두운 실루엣으로',
  'v-ghost': '생략',
  'v-knight': '생략',
  'v-king': '성 위 구름 속 눈·입 빛 효과',
  'bg-castle': '기존 섬 위의 성 소품',
  'bg-home': '따뜻한 빛 배경 효과',
};
interface Art {
  keyart: Img; bg: Img; train: Img; castle: Img; cloud: Img; gona: Img; puff: Img; duo: Img; boss: Img;
  fam: Record<FamilyId, Img>;
  splash: Img; prune: Img; pruneSplash: Img; heart: Img; hex: Img; flame: Img; probio: Img; circle: Img; dome: Img;
  op: Record<Slot, Img>;
  /** 리마스터 그림 (opening3/ · title/) — 이름 → 그림 */
  r3: Record<string, Img>;
}
/** 리마스터 그림 목록: 아기방(저녁·흐림·밤) · 꿈 터널 · 마왕성 · 고나 연속동작 프레임 · 세로 키아트 */
const R3 = ['opening3/room-eve.jpg', 'opening3/room-eve-blur.jpg', 'opening3/room-night.jpg', 'opening3/dream.jpg', 'opening3/castle.jpg', 'title/keyart-tall.jpg',
  ...['bite', 'chew', 'full', 'pat', 'clutch', 'drowsy'].map((n) => `opening3/a-${n}.png`),
  ...['strain0', 'sleep', 'wake', 'fly', 'rub', 'giggle'].map((n) => `opening3/b-${n}.png`),
  ...['eat2', 'startle', 'strain', 'strain2', 'cry'].map((n) => `opening3/n-${n}.png`)];
function loadImg(src: string): Promise<Img> {
  return new Promise((res) => {
    const im = new Image();
    const to = window.setTimeout(() => res(null), 8000); // 느린 망: 8초 넘으면 그 그림만 빼고 진행
    im.onload = () => { window.clearTimeout(to); res(im); };
    im.onerror = () => {
      window.clearTimeout(to);
      // 잠깐 실패(503)일 수 있어 한 번만 더 받아 봄 · 그래도 없으면 그 그림만 빼고 진행
      if (src.includes('retry=')) res(null);
      else window.setTimeout(() => loadImg(`${src}${src.includes('?') ? '&' : '?'}retry=1`).then(res), 700);
    };
    im.src = src;
  });
}
async function loadArt(): Promise<Art> {
  await loadArtPack(BASE);
  const P = (rel: string, fb?: string): Promise<Img> => loadImg(`${BASE}${packPath(rel, fb)}`);
  const R = (path: string): Promise<Img> => loadImg(`${BASE}${path}`);
  const O = (n: Slot): Promise<Img> => (hasPack(`opening2/${n}.png`) ? R(`v3-poop/opening2/${n}.png`) : Promise.resolve(null));
  const [keyart, bg, train, castle, cloud, gona, puff, duo, boss, splash, prune, pruneSplash, heart, hex, flame, probio, circle, dome, ...rest] = await Promise.all([
    P('title/keyart.jpg'), P('stage1/bg-backdrop.png'), P('ending/train.png'), R('v2/stage1/island-castle.png'), R('v2/stage1/cloud-big.png'),
    P('chars/gona/illust.png'), R('v2/fx/steam-puff.png'), P('villain/duo.png'), P('stage1/boss.png'),
    P('fx/water-splash.png'), P('fx/prune-orb.png'), P('fx/prune-splash.png'), P('fx/heal-heart.png', 'v2/fx/heart-p.png'), P('fx/hex.png'), P('fx/flame.png'),
    P('chars/samchon/probiotic.png'), R('v2/fx/sp-circle.png'), R('v2/fx/sp-dome.png'),
    ...FAMILY.map((f) => P(`chars/${f}/illust.png`)),
    ...SLOTS.map(O),
    ...R3.map((rel) => (hasPack(rel) ? R(`v3-poop/${rel}`) : Promise.resolve(null))),
  ]);
  const famRec = {} as Record<FamilyId, Img>;
  FAMILY.forEach((f, i) => (famRec[f] = rest[i]));
  const op = {} as Record<Slot, Img>;
  SLOTS.forEach((n, i) => (op[n] = rest[FAMILY.length + i]));
  const r3: Record<string, Img> = {};
  R3.forEach((rel, i) => (r3[rel.replace(/^.*\//, '').replace(/\.(png|jpg)$/, '')] = rest[FAMILY.length + SLOTS.length + i]));
  return { keyart, bg, train, castle, cloud, gona, puff, duo, boss, splash, prune, pruneSplash, heart, hex, flame, probio, circle, dome, fam: famRec, op, r3 };
}

/** 고나 그림(200px) 안의 얼굴·배 위치 (그림 좌표 → 장면 좌표 변환용) */
const SPOT = {
  mouth: [108, 104], face: [102, 90], eyeL: [86, 90], eyeR: [116, 90], belly: [100, 126], head: [102, 30],
} as const;

class Painter {
  g: CanvasRenderingContext2D;
  W = 360;
  H = 640;
  private sil = new Map<string, HTMLCanvasElement>();
  constructor(private c: HTMLCanvasElement, private a: Art) {
    this.g = c.getContext('2d', { alpha: false })!;
  }
  resize(cssW: number, cssH: number, dpr: number): void {
    this.c.width = Math.round(cssW * dpr);
    this.c.height = Math.round(cssH * dpr);
    this.H = (360 * cssH) / cssW;
  }
  /** 실루엣(한 색으로 칠한 사본) — 한 번만 만들어 재사용 */
  silOf(im: HTMLImageElement, col: string): HTMLCanvasElement {
    const k = `${im.src}|${col}`;
    let c = this.sil.get(k);
    if (!c) {
      c = document.createElement('canvas');
      const s = Math.min(1, 520 / Math.max(im.width, im.height));
      c.width = Math.round(im.width * s);
      c.height = Math.round(im.height * s);
      const g = c.getContext('2d')!;
      g.drawImage(im, 0, 0, c.width, c.height);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = col;
      g.fillRect(0, 0, c.width, c.height);
      this.sil.set(k, c);
    }
    return c;
  }
  /** 그림 하나 (가운데 기준 · 가로 w) */
  img(im: CanvasImageSource | null | undefined, x: number, y: number, w: number, o: { a?: number; rot?: number; sx?: number; sy?: number; smooth?: boolean; ay?: number; frame?: [number, number, number, number] } = {}): void {
    if (!im) return;
    const g = this.g;
    const iw = o.frame ? o.frame[2] : (im as HTMLImageElement).width;
    const ih = o.frame ? o.frame[3] : (im as HTMLImageElement).height;
    if (!iw || !ih) return;
    const h = (w * ih) / iw;
    g.save();
    g.translate(x, y);
    if (o.rot) g.rotate(o.rot);
    g.scale(o.sx ?? 1, o.sy ?? 1);
    g.globalAlpha *= o.a ?? 1;
    g.imageSmoothingEnabled = o.smooth ?? true;
    const ay = o.ay ?? 0.5;
    if (o.frame) g.drawImage(im, o.frame[0], o.frame[1], iw, ih, -w / 2, -h * ay, w, h);
    else g.drawImage(im, -w / 2, -h * ay, w, h);
    g.restore();
  }
  /** 화면을 덮도록 (cover) */
  cover(im: Img, cx: number, cy: number, zoom = 1, a = 1): void {
    if (!im) return;
    const s = Math.max(this.W / im.width, this.H / im.height) * zoom;
    this.img(im, cx, cy, im.width * s, { a });
  }
  /** 키아트 위쪽 하늘(성·구름)만 화면에 덮어 그림 — 아래쪽 가족 인물은 안 보이게 */
  sky(zoom: number, yShift: number, a = 1): void {
    const im = this.a.keyart;
    if (!im || a <= 0) return;
    const sw = im.width;
    const sh = im.height * 0.22; // 새 키아트: 위 22% 가 하늘·마왕성 (그 아래는 가족 인물)
    const s = Math.max(this.W / sw, this.H / sh) * zoom;
    const g = this.g;
    g.save();
    g.globalAlpha *= a;
    g.drawImage(im, 0, 0, sw, sh, this.W / 2 - (sw * s) / 2, this.H / 2 - (sh * s) / 2 + yShift, sw * s, sh * s);
    g.restore();
  }
  private glowCache = new Map<string, HTMLCanvasElement>();
  /** 원형 빛 (색마다 한 번 구운 128px 그림을 늘려 씀 — 매 프레임 그라디언트 생성 없음) */
  glow(x: number, y: number, r: number, col: string, a: number): void {
    if (a <= 0 || r <= 0) return;
    let c = this.glowCache.get(col);
    if (!c) {
      c = document.createElement('canvas');
      c.width = c.height = 128;
      const cg = c.getContext('2d')!;
      const gr = cg.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, col);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      cg.fillStyle = gr;
      cg.fillRect(0, 0, 128, 128);
      this.glowCache.set(col, c);
    }
    const g = this.g;
    g.save();
    g.globalAlpha *= clamp(a);
    g.globalCompositeOperation = 'lighter';
    g.drawImage(c, x - r, y - r, r * 2, r * 2);
    g.restore();
  }
  fill(col: string, a = 1): void {
    if (a <= 0) return;
    const g = this.g;
    g.save();
    g.globalAlpha *= clamp(a);
    g.fillStyle = col;
    g.fillRect(-40, -40, this.W + 80, this.H + 80);
    g.restore();
  }
  private vigCache = new Map<string, HTMLCanvasElement>();
  /** 가장자리 어둡게 (색·화면 비율마다 한 번 구운 그림) */
  vignette(a: number, col = '0,0,0'): void {
    if (a <= 0) return;
    const key = `${col}|${Math.round(this.H)}`;
    let c = this.vigCache.get(key);
    if (!c) {
      c = document.createElement('canvas');
      c.width = 180;
      c.height = Math.round((180 * this.H) / this.W);
      const cg = c.getContext('2d')!;
      const gr = cg.createRadialGradient(c.width / 2, c.height / 2, c.height * 0.25, c.width / 2, c.height / 2, c.height * 0.75);
      gr.addColorStop(0, `rgba(${col},0)`);
      gr.addColorStop(1, `rgba(${col},1)`);
      cg.fillStyle = gr;
      cg.fillRect(0, 0, c.width, c.height);
      this.vigCache.set(key, c);
    }
    const g = this.g;
    g.save();
    g.globalAlpha *= clamp(a);
    g.drawImage(c, -2, -2, this.W + 4, this.H + 4);
    g.restore();
  }
  /** 속도선: dir 0=가로(→), 1=세로(위로), 2=방사(가운데서 바깥) */
  speed(t: number, kind: 0 | 1 | 2, a: number, col = '255,255,255', n = 36, sp = 1): void {
    if (a <= 0) return;
    const g = this.g;
    const { W, H } = this;
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const r = hash(i * 3.1);
      const L = 40 + hash(i * 7.7) * 120;
      g.globalAlpha = a * (0.25 + hash(i * 5.3) * 0.75);
      g.strokeStyle = `rgb(${col})`;
      g.lineWidth = 0.6 + hash(i * 9.1) * 1.8;
      g.beginPath();
      if (kind === 0) {
        const y = r * H;
        const x = ((t * 900 * sp + hash(i) * 2000) % (W + L * 2)) - L;
        g.moveTo(W - x, y); g.lineTo(W - x + L, y);
      } else if (kind === 1) {
        const x = r * W;
        const y = ((t * 1100 * sp + hash(i) * 2000) % (H + L * 2)) - L;
        g.moveTo(x, y); g.lineTo(x, y + L);
      } else {
        const ang = r * TAU;
        const d = ((t * 600 * sp + hash(i) * 900) % 420) + 20;
        g.moveTo(W / 2 + Math.cos(ang) * d, H / 2 + Math.sin(ang) * d);
        g.lineTo(W / 2 + Math.cos(ang) * (d + L * 0.7), H / 2 + Math.sin(ang) * (d + L * 0.7));
      }
      g.stroke();
    }
    g.restore();
  }
  /** 떠다니는 빛 입자 (시간 → 위치 계산식) */
  dust(t: number, n: number, col: string, a: number, rise = 14, size = 1.6): void {
    if (a <= 0) return;
    const g = this.g;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const x = (hash(i) * this.W + Math.sin(t * 0.6 + i) * 8) % this.W;
      const y = (((hash(i * 2.3) * this.H - t * rise * (0.5 + hash(i * 4.1))) % this.H) + this.H) % this.H;
      g.globalAlpha = a * (0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * 3 + i * 1.7)));
      const s = size * (0.6 + hash(i * 6.6));
      g.fillRect(x, y, s, s);
    }
    g.restore();
  }
  private rayCache = new Map<string, HTMLCanvasElement>();
  /** 빛줄기 부채 (갯수·색마다 한 번 구운 256px 그림을 회전·확대) */
  rays(x: number, y: number, n: number, len: number, rot: number, a: number, col = '255,220,140'): void {
    if (a <= 0) return;
    const key = `${n}|${col}`;
    let c = this.rayCache.get(key);
    if (!c) {
      c = document.createElement('canvas');
      c.width = c.height = 256;
      const cg = c.getContext('2d')!;
      cg.translate(128, 128);
      for (let i = 0; i < n; i++) {
        const an = (i / n) * TAU;
        const w = 0.05 + hash(i) * 0.07;
        const gr = cg.createLinearGradient(0, 0, Math.cos(an) * 128, Math.sin(an) * 128);
        gr.addColorStop(0, `rgba(${col},0.6)`);
        gr.addColorStop(1, `rgba(${col},0)`);
        cg.fillStyle = gr;
        cg.beginPath();
        cg.moveTo(0, 0);
        cg.lineTo(Math.cos(an - w) * 128, Math.sin(an - w) * 128);
        cg.lineTo(Math.cos(an + w) * 128, Math.sin(an + w) * 128);
        cg.closePath();
        cg.fill();
      }
      this.rayCache.set(key, c);
    }
    const g = this.g;
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.globalAlpha *= clamp(a);
    g.globalCompositeOperation = 'lighter';
    g.drawImage(c, -len, -len, len * 2, len * 2);
    g.restore();
  }
  line(pts: [number, number][], frac: number, col: string, w: number, a: number): void {
    if (a <= 0 || frac <= 0 || pts.length < 2) return;
    const g = this.g;
    const n = Math.max(1, Math.floor((pts.length - 1) * frac));
    g.save();
    g.globalAlpha *= a;
    g.strokeStyle = col;
    g.lineWidth = w;
    g.lineJoin = 'round';
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i <= n; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.stroke();
    g.restore();
  }
  star(x: number, y: number, r: number, a: number, col = '#fff4c8'): void {
    const g = this.g;
    g.save();
    g.globalAlpha *= a;
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(x, y - r); g.lineTo(x + r * 0.18, y - r * 0.18); g.lineTo(x + r, y); g.lineTo(x + r * 0.18, y + r * 0.18);
    g.lineTo(x, y + r); g.lineTo(x - r * 0.18, y + r * 0.18); g.lineTo(x - r, y); g.lineTo(x - r * 0.18, y - r * 0.18);
    g.closePath();
    g.fill();
    g.restore();
  }


  // ═════════ 컷신용 도우미 ═════════
  /** 카메라: (cx,cy) 를 화면 가운데에 두고 z 배 확대한 상태로 fn 을 그림 */
  cam(cx: number, cy: number, z: number, fn: () => void): void {
    const g = this.g;
    g.save();
    g.translate(this.W / 2, this.H / 2);
    g.scale(z, z);
    g.translate(-cx, -cy);
    fn();
    g.restore();
  }
  /** 고나(표정 그림 200px) — (x,y)=엉덩이 바닥 가운데. 그림 좌표 → 장면 좌표 변환 함수를 돌려줌 */
  gonaAt(im: Img, x: number, y: number, w: number, o: { a?: number; sx?: number; sy?: number; rot?: number; shadow?: number } = {}): (px: number, py: number) => [number, number] {
    const iw = im ? im.width : 200;
    const ih = im ? im.height : 200;
    const k = w / iw;
    const sx = o.sx ?? 1;
    const sy = o.sy ?? 1;
    const bottom = ih * 0.93; // 그림 아래 여백(발 밑)
    if (im) {
      const g = this.g;
      if ((o.shadow ?? 1) > 0) {
        g.save();
        g.globalAlpha *= 0.35 * (o.shadow ?? 1) * (o.a ?? 1);
        g.fillStyle = '#000';
        g.beginPath();
        g.ellipse(x, y + 2, w * 0.36 * sx, w * 0.05, 0, 0, TAU);
        g.fill();
        g.restore();
      }
      g.save();
      g.translate(x, y);
      if (o.rot) g.rotate(o.rot);
      g.scale(sx, sy);
      g.globalAlpha *= o.a ?? 1;
      g.imageSmoothingEnabled = false;
      g.drawImage(im, -w / 2, -bottom * k, w, ih * k);
      g.restore();
    }
    return (px, py) => [x + (px - iw / 2) * k * sx, y - (bottom - py) * k * sy];
  }
  /** 잠든 고나: 그림이 오면 그대로, 없으면 테두리 빛만 있는 실루엣 (배 두드리는 웃는 얼굴이 보이지 않게) */
  sleeper(x: number, y: number, w: number, a: number, rim: string): void {
    const sl = this.a.op['gona-sleep'];
    if (sl) { this.gonaAt(sl, x, y, w, { a, shadow: 0 }); return; }
    const im = this.a.op['gona-pat'];
    if (!im) return;
    this.gonaAt(this.silOf(im, rim) as unknown as HTMLImageElement, x + 1, y - 2, w, { a: a * 0.8, shadow: 0 });
    this.gonaAt(this.silOf(im, '#0a0812') as unknown as HTMLImageElement, x, y, w, { a, shadow: 0 });
  }
  /** 픽셀 글꼴 의성어 (게임 안 효과 글자) */
  ptext(s: string, x: number, y: number, size: number, col: string, a: number, rot = 0): void {
    if (a <= 0) return;
    const g = this.g;
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.globalAlpha *= clamp(a);
    g.font = `700 ${size}px Galmuri11, monospace`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = Math.max(3, size * 0.28);
    g.strokeStyle = '#1a0c1e';
    g.strokeText(s, 0, 0);
    g.fillStyle = col;
    g.fillText(s, 0, 0);
    g.restore();
  }
  /** 물방울 (땀·눈물) */
  drop(x: number, y: number, r: number, a: number, col = '#9fe0ff'): void {
    if (a <= 0) return;
    const g = this.g;
    g.save();
    g.globalAlpha *= clamp(a);
    g.fillStyle = col;
    g.strokeStyle = '#1d3b66';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y - r * 1.9);
    g.quadraticCurveTo(x + r * 1.1, y - r * 0.2, x, y + r);
    g.quadraticCurveTo(x - r * 1.1, y - r * 0.2, x, y - r * 1.9);
    g.fill();
    g.stroke();
    g.fillStyle = '#ffffff';
    g.fillRect(x - r * 0.4, y - r * 0.6, Math.max(1, r * 0.35), Math.max(1, r * 0.35));
    g.restore();
  }
  /** 배경 분위기 (위·아래 색 + 빛줄기 + 떠다니는 빛) — 오프닝 전용 배경 그림이 오면 그 위에 색만 덮음 */
  mood(t: number, top: string, bot: string, ray: string, rayA: number, dustCol: string, dustA: number): void {
    const g = this.g;
    const { W, H } = this;
    const home = this.a.op['bg-home'];
    if (home) {
      this.cover(home, W / 2, H / 2, 1.05);
      g.save();
      g.globalAlpha = 0.55;
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, top);
      gr.addColorStop(1, bot);
      g.fillStyle = gr;
      g.fillRect(-40, -40, W + 80, H + 80);
      g.restore();
    } else {
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, top);
      gr.addColorStop(1, bot);
      g.fillStyle = gr;
      g.fillRect(-40, -40, W + 80, H + 80);
    }
    this.rays(W * 0.15, -H * 0.1, 9, H * 1.2, 0.9 + Math.sin(t * 0.25) * 0.05, rayA, ray);
    this.dust(t, 34, dustCol, dustA, 8, 2);
  }
  /** 색 사이 보간 ('#rrggbb') */
  mix(c1: string, c2: string, k: number): string {
    const p = (c: string, i: number) => parseInt(c.slice(1 + i * 2, 3 + i * 2), 16);
    const v = [0, 1, 2].map((i) => Math.round(p(c1, i) + (p(c2, i) - p(c1, i)) * clamp(k)));
    return `#${v.map((x) => x.toString(16).padStart(2, '0')).join('')}`;
  }
  /** 배 속 소용돌이 (보라 · 꿈 전환에선 금빛) */
  vortex(x: number, y: number, r: number, t: number, a: number, col = '170,80,255', arms = 5): void {
    if (a <= 0 || r <= 0) return;
    const g = this.g;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.lineCap = 'round';
    for (let i = 0; i < arms; i++) {
      g.beginPath();
      for (let s = 0; s <= 24; s++) {
        const k = s / 24;
        const an = t * 3.2 + (i / arms) * TAU + k * 4.2;
        const rr = r * (0.12 + k * 0.88);
        const px = x + Math.cos(an) * rr;
        const py = y + Math.sin(an) * rr * 0.8;
        if (s === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.strokeStyle = `rgba(${col},${0.55 * a})`;
      g.lineWidth = 2 + r * 0.04;
      g.stroke();
    }
    g.restore();
    this.glow(x, y, r * 1.1, `rgba(${col},0.7)`, a * 0.8);
  }

  // ═════════ 장면들 ═════════
  frame(t: number): void {
    const g = this.g;
    const { W } = this;
    const s = this.c.width / W;
    let sx = 0;
    let sy = 0;
    for (const [ti, k] of SHAKES) {
      const d = t - ti;
      if (d >= 0 && d < 0.5) {
        const amp = k * 6 * Math.exp(-d * 9);
        sx += Math.sin(d * 80 + ti) * amp;
        sy += Math.cos(d * 70 + ti * 3) * amp;
      }
    }
    g.setTransform(s, 0, 0, s, sx * s, sy * s);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#000';
    g.fillRect(-40, -40, W + 80, this.H + 80);
    const sc = sceneAt(t);
    if (t < T.kingdom && this.a.r3['room-eve']) this.real(t);
    else if (sc === 1) this.s1(t);
    else if (sc === 2) this.s2(t);
    else if (sc === 3) this.s3(t);
    else if (sc === 4) this.s4(t);
    else if (sc === 5) this.s5(t);
    else if (sc === 6) this.s6(t);
    else if (sc === 7) this.s7(t);
    else if (t < TITLE_AT) { if (this.a.r3['b-fly']) this.s8r(t); else this.s8(t); }
    else this.title(t);
  }

  // ═════════ 리마스터: 현실 세계 (0 ~ 23.2초) — 아기방 안의 고나, 하나로 이어진 카메라 ═════════
  private tintCache = new Map<string, HTMLCanvasElement>();
  /** 조명 색을 입힌 스프라이트 사본 (방 조명과 캐릭터 색을 맞춤) */
  private tinted(im: HTMLImageElement, col: string, a: number): HTMLCanvasElement | HTMLImageElement {
    if (a <= 0.01) return im;
    const q = Math.round(a * 20) / 20;
    const k = `${im.src}|${col}|${q}`;
    let c = this.tintCache.get(k);
    if (!c) {
      c = document.createElement('canvas');
      c.width = im.width;
      c.height = im.height;
      const g = c.getContext('2d')!;
      g.drawImage(im, 0, 0);
      g.globalCompositeOperation = 'source-atop';
      g.globalAlpha = q;
      g.fillStyle = col;
      g.fillRect(0, 0, c.width, c.height);
      if (this.tintCache.size > 160) this.tintCache.clear();
      this.tintCache.set(k, c);
    }
    return c;
  }
  /** 방 좌표계: 방 그림 = 가로 360 · 세로 360×(그림 비율). 고나는 매트 가운데 (GX, GY) 에 앉음 */
  private static GX = 180;
  private static GY = 468;
  private static GW = 116;
  /** 고나 프레임(200px 칸, 발 밑 196) 그리기 → 그림 좌표 → 방 좌표 변환 */
  private kid(name: string, a: number, tint: [string, number], o: { sx?: number; sy?: number; dx?: number; dy?: number } = {}): (px: number, py: number) => [number, number] {
    const im = this.a.r3[name] ?? (this.a.op as Record<string, Img>)[name];
    const { GX, GY, GW } = Painter;
    const x = GX + (o.dx ?? 0);
    const y = GY + (o.dy ?? 0);
    const k = GW / 200;
    if (im && a > 0) {
      const g = this.g;
      g.save();
      g.globalAlpha *= a;
      g.fillStyle = 'rgba(30,12,4,0.32)';
      g.beginPath();
      g.ellipse(x, y - 2, GW * 0.34 * (o.sx ?? 1), GW * 0.06, 0, 0, TAU);
      g.fill();
      g.translate(x, y);
      g.scale(o.sx ?? 1, o.sy ?? 1);
      g.imageSmoothingEnabled = false;
      const src = this.tinted(im, tint[0], tint[1]);
      g.drawImage(src, -(im.width * k) / 2, -(im.height * k) + (200 - 196) * k, im.width * k, im.height * k);
      g.restore();
    }
    const iw = im ? im.width : 200;
    return (px, py) => [x + (px - iw / 2) * k * (o.sx ?? 1), y - (196 - py) * k * (o.sy ?? 1)];
  }
  /** 0~23.2초 카메라 경로 (방 좌표 · 줌) — 구간마다 부드러운 가감속, 멈칫 순간만 빠르게 */
  private roomCam(t: number): [number, number, number] {
    const K: [number, number, number, number, number?][] = [
      [0, 214, 118, 2.9], [1.0, 212, 130, 2.75], [3.9, 180, 360, 1.1], [5.4, 180, 402, 1.85], [6.9, 182, 406, 1.75],
      [9.6, 180, 408, 1.66], [T.startle, 180, 408, 1.7], [T.startle + 0.28, 180, 398, 2.45, 1], [T.s4, 180, 396, 2.6],
      [T.peak, 180, 392, 3.25], [T.cry, 180, 398, 3.0], [T.s5, 180, 420, 1.5], [T.dolly, 178, 438, 1.75], [T.kingdom, 186, 448, 16, 2],
    ];
    for (let i = 0; i < K.length - 1; i++) {
      const [t0, x0, y0, z0] = K[i];
      const [t1, x1, y1, z1, mode] = K[i + 1];
      if (t <= t1) {
        const r = lin(t, t0, t1);
        const e = mode === 1 ? eOut(r) : mode === 2 ? eIn(r) : eIO(r);
        // 줌은 곱셈으로 보간 (가까이 갈수록 일정한 속도감)
        return [x0 + (x1 - x0) * e, y0 + (y1 - y0) * e, z0 * Math.pow(z1 / z0, e)];
      }
    }
    const L = K[K.length - 1];
    return [L[1], L[2], L[3]];
  }
  /** 이 시각의 고나 프레임 (이전 프레임과 겹치는 시간 0~0.2초) */
  private kidFrame(t: number, push: number): [string, string | null, number] {
    const tr: [number, string, number][] = [
      [0, 'a-bite', 0], [5.4, 'n-eat2', 0.18], [6.9, 'a-full', 0.2], [9.6, 'a-full', 0], [T.startle, 'n-startle', 0.06], [11.4, 'a-clutch', 0.16],
      [T.s4, 'b-strain0', 0.08], [15.0, 'n-strain', 0.14], [T.puff, 'n-strain2', 0], [T.cry, 'n-cry', 0.16], [19.9, 'a-drowsy', 0.3], [T.s5, 'b-sleep', 0.5],
    ];
    let i = 0;
    while (i < tr.length - 1 && t >= tr[i + 1][0]) i++;
    let cur = tr[i][1];
    // 오물오물 (0.42초마다 입에 가져가 → 씹기) · 배 통통 (0.5초마다 손이 배에) · 끄응! 순간엔 두 주먹 번쩍
    if (t >= 4.0 && t < 5.4) cur = (t - 4.0) % 0.42 < 0.2 ? 'a-bite' : 'a-chew';
    if (t >= 6.9 && t < 9.4) cur = (t - 6.9) % 0.5 < 0.16 ? 'a-pat' : 'a-full';
    if (t >= 14.2 && t < T.puff && push > 0.3) cur = 'n-strain2';
    const t0 = tr[i][0];
    const xf = tr[i][2];
    const prev = i > 0 && xf > 0 && t - t0 < xf ? tr[i - 1][1] : null;
    return [cur, prev, prev ? (t - t0) / xf : 1];
  }
  private real(t: number): void {
    const { W, H } = this;
    const g = this.g;
    const r = this.a.r3;
    const roomH = 360 * ((r['room-eve']?.height ?? 1910) / (r['room-eve']?.width ?? 1080));
    // 끄응! 순간 (카메라가 쏠리고 몸이 눌림)
    let push = 0;
    let pi = -1;
    for (const [i, p] of PUSHES.entries()) { const d = t - p; if (d >= 0 && d < 0.6 && Math.exp(-d * 5) > push) { push = Math.exp(-d * 5); pi = i; } }
    const heat = lin(t, T.s4, T.peak) * (t < T.cry ? 1 : 0);
    let [cx, cy, z] = this.roomCam(t);
    if (pi >= 0) { cx += [-6, 7, -4, 0][pi] * push; z *= 1 + (0.02 + 0.012 * pi) * push; }
    // 조명 (저녁 → 힘주기 붉은 열기 → 울먹임 푸른 그늘 → 달밤)
    const nightK = eIO(lin(t, T.cry + 0.2, 20.2));
    const tint: [string, number] = t < T.s4 ? ['#ffb070', 0.1] : t < T.cry ? ['#ff5a30', 0.06 + 0.16 * heat] : t < T.s5 ? ['#4a64c8', 0.08 + 0.22 * nightK] : ['#2f44a8', 0.34];
    const [frame, prev, xk] = this.kidFrame(t, push);
    // 몸의 작은 움직임: 숨쉬기 · 씹기 · 통통 · 부들부들 · 흐느낌 · 잠든 숨
    let sx = 1;
    let sy = 1;
    let dx = 0;
    let dy = 0;
    const br = Math.sin(t * 2.4);
    sy = 1 + 0.008 * br;
    if (t >= 4.0 && t < 5.4) { const c = Math.max(0, Math.sin(((t - 4.0) / 0.42) * TAU)); sy -= 0.02 * c; sx += 0.012 * c; }
    if (t >= 6.9 && t < 9.4) { const h = Math.exp(-(((t - 6.9) % 0.5) / 0.5) * 6); sx += 0.02 * h; sy -= 0.02 * h; }
    if (t >= T.s4 && t < T.cry) { const tr = (0.4 + 1.6 * heat) * (t < T.puff ? 1 : 0.2); dx = Math.sin(t * 73) * tr; dy = Math.cos(t * 61) * tr * 0.4; sx += 0.035 * push; sy -= 0.05 * push; }
    if (t >= T.cry && t < 19.9) { const u = t - T.cry; dy = -Math.max(0, Math.sin(u * 2.6 * TAU)) * 1.2 * lin(t, T.cry + 0.5, T.cry + 0.9); sy *= 1 - 0.05 * Math.exp(-u * 3) * Math.cos(u * 9); }
    if (t >= T.s5) { const b = Math.sin((t - T.s5) * 1.9); sy = 1 + 0.018 * b; sx = 1 - 0.008 * b; }
    let face: [number, number] = [Painter.GX, 300];
    let belly: [number, number] = [Painter.GX, 420];
    this.cam(cx, cy, z, () => {
      // 방 (저녁 → 힘주기 땐 초점이 고나에게 → 밤)
      const draw = (im: Img, a: number) => { if (im && a > 0) { g.save(); g.globalAlpha *= a; g.imageSmoothingEnabled = true; g.drawImage(im, 0, 0, 360, roomH); g.restore(); } };
      draw(r['room-eve'], 1 - nightK * (t >= T.cry ? 1 : 0));
      draw(r['room-eve-blur'], eIO(lin(t, T.s4, T.s4 + 0.7)) * (1 - eIO(lin(t, T.cry - 0.3, T.cry + 0.4))));
      if (t >= T.cry) draw(r['room-night'], nightK);
      if (t < T.s4) this.rays(214, 96, 8, 330, 1.15, 0.22, '255,214,150');
      if (t >= T.s5) this.rays(220, 110, 6, 360, 1.2, 0.16, '170,190,255');
      // 힘주기: 몸 주변 붉은 열기 (방은 그대로 보이게)
      if (heat > 0) this.glow(Painter.GX, Painter.GY - 60, 90 + 30 * push, 'rgba(255,70,40,0.55)', 0.25 + 0.45 * heat);
      if (prev) this.kid(prev, 1 - xk, tint, { sx, sy, dx, dy });
      const map = this.kid(frame, prev ? xk : 1, tint, { sx, sy, dx, dy });
      face = map(100, 86);
      belly = frame === 'b-sleep' ? map(112, 150) : map(100, 140);
      // 장면별 작은 효과
      if (t >= 4.0 && t < 5.4) {
        const n0 = Math.floor((t - 4.0) / 0.42);
        const life = ((t - 4.0) % 0.42) / 0.42;
        for (let i = 0; i < 7; i++) {
          const an = -Math.PI / 2 + (hash(n0 * 7 + i) - 0.5) * 2.6;
          const sp = 10 + hash(n0 * 13 + i) * 16;
          g.fillStyle = hash(i + n0) > 0.5 ? '#fff6dc' : '#f2d9a6';
          g.globalAlpha = 1 - life;
          g.fillRect(face[0] + 6 + Math.cos(an) * sp * life, face[1] + 14 + Math.sin(an) * sp * life + 26 * life * life, 1.4, 1.4);
        }
        g.globalAlpha = 1;
      }
      if (t >= 6.9 && t < 9.4) {
        const h = Math.exp(-(((t - 6.9) % 0.5) / 0.5) * 6);
        if (h > 0.55) this.ptext('통', belly[0] + 30, belly[1] - 6, 7, '#fff2c8', (h - 0.55) * 2.5);
        for (let i = 0; i < 3; i++) { const life = ((t - 6.9 + i * 0.7) % 2.1) / 2.1; this.img(this.a.heart, belly[0] + (i - 1) * 16, belly[1] - 30 - life * 50, 7, { a: (1 - life) * 0.9, smooth: false }); }
      }
      if (t >= 9.95 && t < T.s4) {
        const k = lin(t, 9.95, T.startle);
        const rumble = t >= 11.6 ? Math.exp(-(t - 11.6) * 3) : 0;
        this.vortex(belly[0], belly[1], 10 + 16 * k + 14 * rumble, t, 0.25 + 0.5 * k);
        if (t < 10.8) this.ptext('꾸르륵…', belly[0] + 34, belly[1] - 2 + Math.sin(t * 30) * 0.6, 7, '#d9b8ff', lin(t, 10.05, 10.15) * (1 - lin(t, 10.6, 10.8)), -0.12);
        if (rumble > 0.05) this.ptext('꾸르르륵!', belly[0] - 34, belly[1] + 4, 8 + 2 * rumble, '#d9b8ff', Math.min(1, rumble * 3), 0.15);
        const sw = lin(t, T.startle + 0.2, T.startle + 2.4);
        this.drop(face[0] + 20, face[1] - 8 + sw * 12, 2.2, Math.min(1, sw * 6) * (1 - lin(t, 13.0, 13.5)));
      }
      if (t >= T.s4 && t < T.cry) {
        for (const p of PUSHES) {
          const d = t - p;
          if (d < 0 || d > 0.9) continue;
          if (this.a.puff) this.img(this.a.puff, face[0] + (p % 2 ? 16 : -16), face[1] - 34 - d * 26, 16 + d * 16, { frame: [32 * Math.min(2, Math.floor(d * 3.3)), 0, 32, 32], a: 1 - d / 0.9, smooth: false });
          for (let i = 0; i < 4; i++) { const an = -Math.PI / 2 + (i - 1.5) * 0.7; this.drop(face[0] + Math.cos(an) * (16 + d * 48), face[1] - 4 + Math.sin(an) * (12 + d * 32) + d * d * 80, 1.5, 1 - d / 0.9); }
          this.ptext('끄응!', face[0] + (p % 2 ? 44 : -44), face[1] - 46 - d * 6, 8, '#ffb08a', (1 - d / 0.9) * 1.3, p % 2 ? 0.18 : -0.18);
        }
        if (t >= T.puff && this.a.puff) {
          const d = t - T.puff;
          this.img(this.a.puff, Painter.GX + 26, Painter.GY - 4 - d * 8, 10 + d * 12, { frame: [32 * Math.min(2, Math.floor(d * 6)), 0, 32, 32], a: clamp(1 - d / 0.3), smooth: false });
          this.ptext('…뿌웅?', Painter.GX + 40, Painter.GY - 16, 6, '#e8dcc0', clamp(d * 8) * clamp(1 - (d - 0.15) / 0.12));
        }
      }
      if (t >= T.cry && t < 19.9) this.ptext('훌쩍…', face[0] + ((Math.floor((t - T.cry) / 0.8) % 2) ? 40 : -40), face[1] - 40, 7, '#bcd2ff', 0.8 * lin(t, T.cry + 0.5, T.cry + 0.8));
      if (t >= T.s5) {
        for (let i = 0; i < 3; i++) { const life = ((t - T.s5) * 0.6 + i / 3) % 1; this.ptext('Z', face[0] + 26 + life * 16 + i * 2, face[1] - 30 - life * 28, 5 + i + life * 3, '#c8d4ff', (1 - life) * (1 - lin(t, T.dolly, T.dolly + 0.4))); }
        const dz = eIn(lin(t, T.dolly, T.kingdom));
        this.vortex(belly[0], belly[1], 6 + 40 * dz, t, 0.2 + 0.8 * dz, '255,200,120', 6);
      }
    });
    // 꿈 터널: 배 속으로 빨려 들어가며 화면 전체가 꿈으로
    const dk = eIO(lin(t, T.dolly + 0.5, T.kingdom - 0.15));
    if (dk > 0) {
      g.save();
      g.globalAlpha = dk;
      if (r.dream) this.cover(r.dream, W / 2, H / 2, 1 + 0.25 * lin(t, T.dolly + 0.5, T.kingdom) + 0.1 * Math.sin(t));
      else this.fill('#140a30');
      g.restore();
      this.vortex(W / 2, H / 2, 40 + 220 * dk, t, dk, '255,210,140', 7);
    }
    this.dust(t, 30, t < T.s4 ? '#fff2c8' : t < T.s5 ? '#ffb08a' : '#c8d4ff', 0.35, 6, 1.6);
    this.vignette(t < T.s4 ? 0.45 : t < T.cry ? 0.55 + 0.3 * heat : 0.7, t < T.s4 ? '40,16,0' : t < T.cry ? '50,0,0' : '0,4,24');
    this.fill('#000', 1 - eOut(lin(t, 0, 1.1)));
    this.fill('#1a0a04', 0.42 * (1 - eIO(lin(t, 2.6, 4.0))));
    this.fill('#fff0d0', eIn(lin(t, T.kingdom - 0.35, T.kingdom)) * 0.9);
  }

  /** 1 · 서기 2026년: 어둠 속 금빛 점 → 새벽빛 하늘로 천천히 내려옴 → 따뜻한 빛으로 번지며 다음 장면 */
  private s1(t: number): void {
    const { W, H } = this;
    const cx = W / 2;
    const dawn = eIO(lin(t, 1.4, 3.8));
    this.cam(cx, H / 2, 1 + 0.06 * eIO(lin(t, 0, 4)), () => {
      this.sky(1.2, -50 + 50 * dawn, 0.55 * dawn);
      this.fill('#05030a', 0.75 - 0.35 * dawn);
      this.dust(t, 50, '#ffe7a8', 0.4 + 0.3 * dawn, 6, 1.4);
      const p = eOut(lin(t, 0.2, 1.4));
      this.glow(cx, H * 0.4, 10 + 70 * p + 120 * dawn, 'rgba(255,214,140,0.85)', 0.5 + 0.5 * p);
      this.star(cx, H * 0.4, 4 + 10 * p, p, '#fff4c8');
      this.rays(cx, H * 0.4, 12, H * 0.9 * dawn, t * 0.05, 0.3 * dawn);
    });
    this.vignette(0.8);
    this.fill('#ffe6b8', eIn(lin(t, 3.5, 4.0)) * 0.55); // 따뜻한 빛으로 번지며 방 안으로
  }

  /** 2 · 풍요의 시대: 떡뻥을 오물오물 → (같은 자리에서 교차) 배를 통통 */
  private s2(t: number): void {
    const { W, H } = this;
    const cx = W / 2;
    const fy = H * 0.6;
    const u = t - T.s2;
    this.mood(t, '#f6c48a', '#7a3e1c', '255,236,190', 0.45, '#fff2c8', 0.55);
    const eat = this.a.op['gona-eat'];
    const pat = this.a.op['gona-pat'];
    const eat2 = this.a.op['gona-eat2'];
    const cross = eIO(lin(t, T.pat - 0.2, T.pat + 0.15));
    const mid = eat2 ? eIO(lin(t, 5.3, 5.6)) : 0; // 떡뻥 → 이유식 한 숟갈
    const z = t < T.pat ? 1.0 + 0.07 * eIO(lin(t, T.s2, T.pat)) : 1.07 - 0.05 * eIO(lin(t, T.pat, T.s3));
    this.cam(cx, fy - 120, z, () => {
      // 떡뻥 먹기: 0.42초마다 오물 (몸 살짝 눌림 + 부스러기)
      if (cross < 1) {
        const ph = (u / 0.42) % 1;
        const chew = Math.max(0, Math.sin(ph * TAU));
        if (eat2 && mid > 0) {
          // 이유식 한 숟갈씩 (0.55초마다 숟가락이 입으로 · 행복한 흔들림)
          const sp = Math.max(0, Math.sin(((u - 1.3) / 0.55) * TAU));
          this.gonaAt(eat2, cx, fy - sp * 3, 300, { a: mid * (1 - cross), sy: 1 + 0.02 * sp, sx: 1 - 0.01 * sp, rot: Math.sin(u * 2.2) * 0.02 });
        }
        const map = this.gonaAt(eat, cx, fy, 300, { a: (1 - cross) * (1 - mid), sy: 1 - 0.025 * chew, sx: 1 + 0.015 * chew });
        const [mx, my] = map(112, 100);
        for (let i = 0; i < 10; i++) {
          const n = Math.floor(u / 0.42) * 10 + i;
          const life = ((u % 0.42) / 0.42 + hash(n) * 0.3) % 1;
          const an = -Math.PI / 2 + (hash(n * 3) - 0.5) * 2.6;
          const sp = 30 + hash(n * 7) * 40;
          const g = this.g;
          g.save();
          g.globalAlpha = (1 - life) * (1 - cross) * (1 - mid);
          g.fillStyle = hash(n) > 0.5 ? '#fff6dc' : '#f2d9a6';
          g.fillRect(mx + Math.cos(an) * sp * life, my + Math.sin(an) * sp * life + 60 * life * life, 3, 3);
          g.restore();
        }
        for (let i = 0; i < 3; i++) this.star(mx + (hash(i + 4) - 0.5) * 140, my - 60 + Math.sin(t * 3 + i) * 10, 4 + 3 * Math.sin(t * 6 + i * 2), (1 - cross) * 0.8);
      }
      // 배 두드리기: 0.5초마다 통! (배가 출렁 · 작은 하트)
      if (cross > 0) {
        const pu = t - T.pat;
        const ph = Math.max(0, pu) / 0.5;
        const hit = Math.exp(-(ph % 1) * 6) * (t < T.s3 - 0.3 ? 1 : 0);
        const map = this.gonaAt(pat, cx, fy, 300, { a: cross, sx: 1 + 0.03 * hit, sy: 1 - 0.03 * hit });
        const [bx, by] = map(...(SPOT.belly as unknown as [number, number]));
        for (let i = 0; i < 4; i++) {
          const life = ((pu + i * 0.6) % 2.4) / 2.4;
          this.img(this.a.heart, bx + (i - 1.5) * 34 + Math.sin(t * 2 + i) * 6, by - 40 - life * 120, 16, { a: cross * (1 - life) * 0.9, smooth: false });
        }
        if (hit > 0.6 && cross > 0.9) this.ptext('통', bx + 58, by - 10 - (1 - hit) * 10, 13, '#fff2c8', (hit - 0.6) * 2.5);
      }
    });
    this.vignette(0.45, '60,20,0');
    if (u < 0.5) this.fill('#ffe6b8', 0.55 * (1 - u / 0.5)); // 1장면의 빛에서 이어짐
  }

  /** 3 · 불길한 징조: 두드리던 손이 멈춤 → 꾸르륵 → 멈칫(카메라 확 다가감) · 배 속 보랏빛 */
  private s3(t: number): void {
    const { W, H } = this;
    const cx = W / 2;
    const fy = H * 0.6;
    const dark = eIO(lin(t, T.s3 + 0.2, T.startle));
    this.mood(t, this.mix('#f6c48a', '#3a2350', dark), this.mix('#7a3e1c', '#120a1c', dark), '255,236,190', 0.45 * (1 - dark), '#fff2c8', 0.5 * (1 - dark));
    const pat = this.a.op['gona-pat'];
    const st = this.a.op['gona-startle'];
    if (t < T.startle) {
      this.cam(cx, fy - 120, 1.02, () => {
        const map = this.gonaAt(pat, cx, fy, 300);
        const [bx, by] = map(100, 126);
        const k = lin(t, 9.95, T.startle);
        this.vortex(bx, by, 50 * k, t, k * 0.8);
        this.ptext('꾸르륵…', bx + 66, by - 4 + Math.sin(t * 30) * 1.5, 15, '#d9b8ff', lin(t, 10.05, 10.15), -0.12);
      });
      this.fill('#1a0c2a', 0.25 * dark);
      return;
    }
    // 멈칫: 얼굴 쪽으로 확 다가간 뒤 아주 천천히 계속 다가감
    const snap = eOut(lin(t, T.startle, T.startle + 0.28));
    const z = 1.02 + 0.2 * snap + 0.12 * eIO(lin(t, T.startle + 0.3, T.s4));
    const rumble = Math.exp(-Math.max(0, t - 11.6) * 3) * (t >= 11.6 ? 1 : 0);
    this.cam(cx, fy - 150 * snap - 120 * (1 - snap), z, () => {
      this.glow(cx, fy - 150, 220, 'rgba(120,50,200,0.5)', 0.6);
      const jit = rumble * Math.sin(t * 60) * 2;
      const map = this.gonaAt(st, cx + jit, fy, 300);
      const [bx, by] = map(...(SPOT.belly as unknown as [number, number]));
      // 배 속에서 맥박처럼 커지는 보라 소용돌이
      const beat = 0.5 + 0.5 * Math.sin((t - T.startle) * 7.5);
      this.vortex(bx, by, 46 + 18 * beat + 40 * rumble, t, 0.55 + 0.35 * rumble);
      this.ptext('꾸르르륵!', bx - 70, by + 6, 17 + 4 * rumble, '#d9b8ff', rumble > 0.05 ? Math.min(1, rumble * 3) : 0, 0.15);
      // 땀 한 방울 (이마에서 볼로 미끄러짐)
      const [ex, ey] = map(126, 72);
      const sw = lin(t, T.startle + 0.2, T.startle + 2.6);
      this.drop(ex + 4, ey + sw * 26, 4.5, Math.min(1, sw * 6) * (1 - lin(t, 13.1, 13.5)));
    });
    this.vignette(0.85, '20,0,30');
    if (t < T.startle + 0.08) this.fill('#ffffff', 0.25 * (1 - (t - T.startle) / 0.08));
  }

  /** 4 · 운명의 사투: 얼굴 빨개지며 끄응!(네 번) · 부들부들 → …뿌웅? → 풀썩 · 눈물 */
  private s4(t: number): void {
    const { W, H } = this;
    const cx = W / 2;
    const fy = H * 0.6;
    const g = this.g;
    const strain = this.a.op['gona-strain'];
    const strain2 = this.a.op['gona-strain2'];
    const crying = t >= T.cry;
    // 배경: 붉은 불씨 → 실패 뒤에는 차가운 남색
    const cool = eIO(lin(t, T.cry, T.cry + 1.2));
    this.mood(t, this.mix('#4a0e0c', '#14182e', cool), this.mix('#12030a', '#06070f', cool), crying ? '150,170,255' : '255,120,60', 0.35, crying ? '#9fb0ff' : '#ff9a5a', 0.6);
    if (!crying) {
      const heat = lin(t, T.s4, T.peak);
      this.rays(cx, fy - 160, 14, H * 0.9, t * 0.15, 0.25 + 0.3 * heat, '255,110,60');
      // 끄응! 순간: 몸이 눌렸다 펴짐 · 충격 고리
      let push = 0;
      let pi = -1;
      for (const [i, p] of PUSHES.entries()) { const d = t - p; if (d >= 0 && d < 0.6 && Math.exp(-d * 5) > push) { push = Math.exp(-d * 5); pi = i; } }
      // 끄응마다 카메라가 다른 쪽으로 살짝 쏠리고 점점 세게 (같은 장면 반복 느낌 줄이기)
      const camX = pi < 0 ? 0 : [-16, 18, -10, 0][pi] * push;
      const z = 1 + 0.22 * eIO(lin(t, T.s4, T.peak + 0.3)) + (pi < 0 ? 0 : (0.02 + 0.015 * pi) * push);
      const trem = (0.6 + 2.2 * heat) * (t < T.puff ? 1 : 0.2);
      this.cam(cx + camX, fy - 150 - 20 * heat, z, () => {
        const jx = Math.sin(t * 73) * trem;
        const jy = Math.cos(t * 61) * trem * 0.5;
        this.glow(cx, fy - 170, 120 + 60 * push, 'rgba(255,60,30,0.6)', 0.4 + 0.5 * heat);
        const two = strain2 && push > 0.32; // 끄응! 순간엔 두 주먹 번쩍 · 빨개진 얼굴 그림으로
        const map = this.gonaAt(two ? strain2 : strain, cx + jx, fy + jy, 300, { sx: 1 + 0.04 * push, sy: 1 - 0.06 * push });
        const [fx, fyy] = map(...(SPOT.face as unknown as [number, number]));
        // 얼굴의 붉은 열기 (빛 덧칠)
        this.glow(fx, fyy, 60 + 30 * push, 'rgba(255,40,40,0.55)', 0.25 + 0.45 * heat + 0.3 * push);
        // 부들부들 선 (양옆)
        g.save();
        g.strokeStyle = '#ffd0b0';
        g.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          if (hash(Math.floor(t * 14) + i) < 0.45) continue;
          const side = i % 2 ? -1 : 1;
          const x0 = cx + side * (120 + hash(i) * 20);
          const y0 = fy - 100 - i * 22;
          g.globalAlpha = 0.5 + 0.5 * heat;
          g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + side * 10, y0 - 4); g.stroke();
        }
        g.restore();
        // 머리 위 김 · 날아가는 땀
        const [hx, hy] = map(...(SPOT.head as unknown as [number, number]));
        for (const p of PUSHES) {
          const d = t - p;
          if (d < 0 || d > 0.9 || !this.a.puff) continue;
          this.img(this.a.puff, hx + (p % 2 ? 28 : -28) + d * 20 * (p % 2 ? 1 : -1), hy - d * 60, 40 + d * 40, { frame: [32 * Math.min(2, Math.floor(d * 3.3)), 0, 32, 32], a: 1 - d / 0.9, smooth: false });
          for (let i = 0; i < 4; i++) {
            const an = -Math.PI / 2 + (i - 1.5) * 0.7;
            this.drop(fx + Math.cos(an) * (40 + d * 120), fyy - 10 + Math.sin(an) * (30 + d * 80) + d * d * 200, 3.5, 1 - d / 0.9);
          }
          if (d < 0.08) this.glow(cx, fy - 150, 260, 'rgba(255,200,160,0.5)', 1 - d / 0.08);
          this.ptext('끄응!', cx + (p % 2 ? 108 : -108), fy - 210 - d * 14, 18, '#ffb08a', (1 - d / 0.9) * 1.3, p % 2 ? 0.18 : -0.18);
        }
        // …뿌웅? (아주 작은 김 한 줄기)
        if (t >= T.puff && this.a.puff) {
          const d = t - T.puff;
          this.img(this.a.puff, cx + 70, fy - 10 - d * 20, 26 + d * 30, { frame: [32 * Math.min(2, Math.floor(d * 6)), 0, 32, 32], a: clamp(1 - d / 0.3), smooth: false });
          this.ptext('…뿌웅?', cx + 96, fy - 40, 13, '#e8dcc0', clamp(d * 8) * clamp(1 - (d - 0.15) / 0.12));
        }
      });
      this.vignette(0.75, '30,0,0');
      if (t < T.s4 + 0.1) this.fill('#000', 1 - (t - T.s4) / 0.1);
      return;
    }
    // 실패: 풀썩 (눌렸다가) · 울먹임 · 흐느낌 · 카메라 천천히 물러남
    const cry = this.a.op['gona-cry'];
    const im = cry ?? this.a.op['gona-startle'];
    const u = t - T.cry;
    const slump = 1 - 0.07 * Math.exp(-u * 3) * Math.cos(u * 9);
    const sob = Math.max(0, Math.sin(u * 2.6 * TAU)) * lin(t, T.cry + 0.6, T.cry + 1.0) * 1.5;
    // 그림이 없으면 카메라를 넓게 빼서 작고 외로운 실루엣으로
    const z = cry ? 1.2 - 0.12 * eIO(lin(t, T.cry, T.s5)) : 1.2 - 0.32 * eIO(lin(t, T.cry, T.cry + 0.9)) - 0.06 * lin(t, T.cry + 0.9, T.s5);
    this.cam(cx, fy - 150 + (cry ? 0 : 40 * eIO(lin(t, T.cry, T.cry + 0.9))), z, () => {
      this.glow(cx, fy - 160, 160, 'rgba(120,140,255,0.35)', 0.6);
      if (!cry && im) {
        // 임시(울먹임 그림 없음): 표정을 억지로 그리지 않고 뒤에서 빛을 받은 작은 실루엣으로 —
        // 어깨가 들썩이는 흐느낌 + 푸른 테두리 빛 + 떨어지는 눈물 반짝임만
        const dk = eIO(lin(t, T.cry, T.cry + 0.5));
        const w = 300 - 90 * dk;
        // 위에서 내려오는 한 줄기 스포트라이트 + 바닥의 빛 웅덩이
        this.rays(cx, fy - 420, 5, 520, Math.PI / 2, 0.35 * dk, '170,190,255');
        const gg = this.g;
        gg.save();
        gg.globalAlpha = 0.35 * dk;
        gg.fillStyle = '#8fa8ff';
        gg.beginPath();
        gg.ellipse(cx, fy + 2, 120, 16, 0, 0, TAU);
        gg.fill();
        gg.restore();
        this.gonaAt(im, cx, fy - sob, w, { sy: slump, sx: 2 - slump, a: 1 - dk });
        const o = { sy: slump, sx: 2 - slump, shadow: 0 };
        this.gonaAt(this.silOf(im, '#8fb4ff') as unknown as HTMLImageElement, cx - 2, fy - sob - 3, w, { ...o, a: dk * 0.85 });
        this.gonaAt(this.silOf(im, '#0b0f22') as unknown as HTMLImageElement, cx, fy - sob, w, { ...o, a: dk });
        const map0 = this.gonaAt(im, cx, fy - sob, w, { ...o, a: 0 });
        for (const [i, e] of [SPOT.eyeL, SPOT.eyeR].entries()) {
          const [ex, ey] = map0(e[0], e[1] + 6);
          for (let n = 0; n < 3; n++) {
            const st = 0.7 + n * 0.55 + i * 0.25;
            const d = u - st;
            if (d < 0 || d > 1.0) continue;
            this.star(ex + (i ? 4 : -4), ey + d * 60 + d * d * 40, 5, (1 - d) * dk, '#e4f0ff');
          }
        }
        return;
      }
      const map = this.gonaAt(im, cx, fy - sob, 300, { sy: slump, sx: 2 - slump });
      // 눈물: 고이고(반짝) → 볼을 타고 → 뚝
      const well = eOut(lin(t, T.cry + 0.3, T.cry + 1.1));
      const eyes = cry ? [[90, 76], [117, 76]] : [SPOT.eyeL, SPOT.eyeR];
      for (const [i, e] of eyes.entries()) {
        const [ex, ey] = map(e[0], e[1] + 4);
        if (!cry) {
          // 임시(울먹임 그림 없음): 눈가에 고인 눈물 + 볼을 타고 흐르는 눈물 줄기
          this.glow(ex, ey, 14 * well, 'rgba(180,230,255,0.9)', well);
          const len = 46 * eOut(lin(t, T.cry + 0.7, T.cry + 1.6));
          const g2 = this.g;
          g2.save();
          g2.globalAlpha = 0.75;
          g2.fillStyle = '#9fe0ff';
          g2.fillRect(ex + (i ? 4 : -7), ey + 4, 4, len);
          g2.fillStyle = '#ffffff';
          g2.fillRect(ex + (i ? 5 : -6), ey + 4, 1, len * 0.8);
          g2.restore();
        }
        for (let n = 0; n < 4; n++) {
          const d = ((u - 0.9 - n * 0.45 - i * 0.2) % 1.8 + 1.8) % 1.8;
          if (u < 0.9 + n * 0.45 + i * 0.2) continue;
          const fall = d / 1.8;
          this.drop(ex + (i ? 6 : -6), ey + 8 + fall * 70 + fall * fall * 60, 5, 1 - fall);
        }
      }
      this.ptext('훌쩍…', cx + (Math.floor(u / 0.8) % 2 ? 100 : -100), fy - 230, 14, '#bcd2ff', clamp(sob) * 0.9);
    });
    this.dust(t, 40, '#9fb0ff', 0.25, -40, 1.2); // 내리는 빛 (차가운 비 느낌)
    this.vignette(0.85, '0,0,20');
    this.fill('#06070f', eIn(lin(t, T.s5 - 0.4, T.s5)) * 0.7);
  }

  /** 5 · 막혀버린 왕국: 지쳐 잠듦 → 배 속으로 들어가는 소용돌이 → 꿈의 소화왕국을 막아선 똥돌이 병사·딱딱똥 골렘 */
  private s5(t: number): void {
    const { W, H } = this;
    const cx = W / 2;
    const fy = H * 0.6;
    const g = this.g;
    if (t < T.kingdom) {
      const sl = this.a.op['gona-sleep'];
      const im = sl ?? this.a.op['gona-pat'];
      this.mood(t, '#141a3a', '#05060f', '170,190,255', 0.25, '#c8d4ff', 0.4);
      const dz = eIn(lin(t, T.dolly, T.kingdom));
      const breathe = Math.sin((t - T.s5) * 2.2);
      let bx = cx;
      let by = fy - 80;
      // 배 쪽으로 들어가기 (카메라가 배를 향해 빨려 들어감)
      this.cam(cx, fy - 120 + 60 * dz, 1.05 + dz * 5, () => {
        const o = { sy: 1 + 0.012 * breathe, sx: 1 - 0.006 * breathe, a: eIO(lin(t, T.s5, T.s5 + 0.5)) };
        let map;
        if (!sl && im) {
          // 임시(잠든 그림 없음): 어둠 속 달빛 실루엣 + 느린 숨결 (앉아 웃는 표정이 보이지 않게)
          this.rays(cx + 60, fy - 420, 5, 520, Math.PI / 2 + 0.15, 0.3, '170,190,255');
          this.gonaAt(this.silOf(im, '#a9bcff') as unknown as HTMLImageElement, cx + 2, fy - 3, 210, { ...o, a: o.a * 0.8, shadow: 0 });
          map = this.gonaAt(this.silOf(im, '#0a0e22') as unknown as HTMLImageElement, cx, fy, 210, o);
          map = this.gonaAt(im, cx, fy, 210, { ...o, a: 0 });
        } else map = this.gonaAt(im, cx, fy, 300, o);
        [bx, by] = sl ? map(112, 145) : map(...(SPOT.belly as unknown as [number, number]));
        for (let i = 0; i < 3; i++) {
          const life = ((t - T.s5) * 0.6 + i / 3) % 1;
          this.ptext('Z', cx + 70 + life * 40 + i * 6, fy - 230 - life * 70, 11 + i * 3 + life * 6, '#c8d4ff', (1 - life) * (1 - dz));
        }
        this.vortex(bx, by, 20 + 90 * dz, t, 0.2 + 0.8 * dz, '255,200,120', 6);
      });
      this.fill('#fff0d0', eIn(lin(t, T.kingdom - 0.35, T.kingdom)) * 0.9);
      return;
    }
    // 꿈속 소화왕국
    const u = t - T.kingdom;
    const pan = eIO(lin(t, T.kingdom, T.s6));
    const castle = this.a.r3.castle;
    const cH = castle ? (360 * castle.height) / castle.width : H;
    // 리마스터: 마왕성 그림 위로 — 둑길(아래)에서 성문 쪽으로 카메라가 천천히 올라감 (다음 장면의 성 꼭대기까지 이어짐)
    const camK = castle ? [180, cH * (0.86 - 0.18 * pan), 1.5 - 0.22 * pan] : [cx + 10 - 20 * pan, H / 2 + 20 - 30 * pan, 1.04 - 0.04 * pan];
    this.cam(camK[0], camK[1], camK[2], () => {
      if (castle) {
        g.drawImage(castle, 0, 0, 360, cH);
        this.fill('#1e0a33', 0.12);
      } else {
        this.cover(this.a.bg, cx, H / 2, 1.15);
        this.fill('#1e0a33', 0.62); // 꿈속 · 불길한 보랏빛
        this.glow(cx, H * 0.3, 260, 'rgba(160,70,255,0.45)', 0.7);
      }
      // 선로 (기존 판: 화면 아래쪽 가로 · 리마스터 판: 성문 앞 둑길)
      const ry = castle ? cH * 0.9 : H * 0.66;
      if (!castle) {
        g.fillStyle = '#2a1a12';
        g.fillRect(-60, ry, W + 120, 6);
        g.fillStyle = '#6b4a2a';
        for (let x = -60; x < W + 60; x += 18) g.fillRect(x, ry + 6, 10, 4);
      }
      // 응가 열차: 달려오다 막힌 선로 앞에서 급정거
      const tr = this.a.train;
      const tk = lin(t, 25.3, T.trainStop);
      const tx = -150 + 210 * eOut(tk);
      const stopped = t >= T.trainStop;
      if (tr && t > 25.2 && !castle) {
        const jolt = stopped ? Math.sin((t - T.trainStop) * 30) * Math.exp(-(t - T.trainStop) * 5) * 0.1 : 0;
        this.img(tr, tx, ry - 40, 140, { rot: jolt, smooth: false });
        if (stopped && this.a.puff) for (let i = 0; i < 3; i++) {
          const pk = clamp((t - T.trainStop - i * 0.15) / 0.7);
          if (pk > 0 && pk < 1) this.img(this.a.puff, tx + 30, ry - 80 - pk * 40, 40 + pk * 30, { frame: [32 * Math.min(2, Math.floor(pk * 3)), 0, 32, 32], a: 1 - pk, smooth: false });
        }
      }
      // 딱딱똥 골렘: 위에서 쿵! 선로를 막아섬
      const gk = lin(t, T.golem - 0.35, T.golem);
      const gx = cx + 70;
      const gyy = ry + 4 - (1 - eIn(gk)) * 380;
      const gol = this.a.op['v-golem'];
      if (gk > 0) {
        const stomp = t >= T.golem ? Math.exp(-(t - T.golem) * 6) : 0;
        if (gol) this.img(gol, gx, gyy, castle ? 118 : 170, { ay: 0.95, smooth: false, sy: 1 - 0.06 * stomp, sx: 1 + 0.04 * stomp });
        else if (this.a.boss) {
          // 임시: 거대한 그림자 몸 + 갈라진 틈의 빛 + 빛나는 두 눈
          const sil = this.silOf(this.a.boss, '#2e1c12');
          const sk = sil.width / this.a.boss.width; // 실루엣 사본은 축소돼 있음
          const gw = 210;
          const gh = (gw * 240) / 220;
          this.img(sil, gx, gyy, gw, { frame: [0, 0, 220 * sk, 240 * sk], ay: 0.95, sy: 1 - 0.06 * stomp, sx: 1 + 0.04 * stomp });
          const top = gyy - gh * 0.95;
          for (let i = 0; i < 4; i++) {
            const pts = bolt(50 + i * 7, gx - 50 + i * 32, top + gh * 0.35, gx - 40 + i * 30, top + gh * 0.8).map(([x, y]) => [gx + (x - gx) * 0.5, y] as [number, number]);
            this.line(pts, 1, 'rgba(255,150,70,0.85)', 1.6, gk * (0.5 + 0.3 * Math.sin(t * 5 + i)));
          }
          for (const sd of [-1, 1]) this.glow(gx + sd * 24, top + gh * 0.36, 18, 'rgba(255,190,80,1)', gk);
        }
        if (stomp > 0.02) {
          for (let i = 0; i < 16; i++) {
            const a2 = Math.PI + (i / 15) * Math.PI;
            const d = (t - T.golem) * (60 + hash(i) * 80);
            g.fillStyle = '#c9a070';
            g.globalAlpha = stomp;
            g.fillRect(gx + Math.cos(a2) * d * 1.6, ry + Math.sin(a2) * d * 0.5, 3, 3);
          }
          g.globalAlpha = 1;
          this.ptext('쿵!', gx - 90, ry - 120, 22, '#ffd8a0', stomp * 1.5, -0.1);
        }
      }
      // 똥돌이 병사: 줄지어 행진해 와 선로를 둘러쌈 (좌우에서)
      const sol = this.a.op['v-soldier'];
      const duo = this.a.duo;
      for (let i = 0; i < 14; i++) {
        const side = i % 2 ? 1 : -1;
        const row = Math.floor(i / 2);
        const start = T.kingdom + 0.2 + row * 0.18;
        const k = eOut(lin(t, start, start + 1.4));
        if (k <= 0) continue;
        // 리마스터(마왕성): 선로 양옆에 원근감 있게 줄지어 섬 (앞줄일수록 크게·아래로)
        const homeX = castle ? cx + side * (44 + (row % 4) * 22 + (row >= 4 ? 30 : 0)) : cx + side * (36 + (row % 4) * 40) - (row >= 4 ? side * 18 : 0);
        const x = homeX + side * (1 - k) * 280;
        const y = castle ? ry - (row % 4) * 16 + (row >= 4 ? 22 : 0) : ry - 2 + (row >= 4 ? 40 : 0) - (row % 2) * 10;
        const step = Math.abs(Math.sin((t - start) * 9)) * 5 * (k < 1 ? 1 : 0.3);
        if (sol) this.img(sol, x, y - step, castle ? 36 : 60, { ay: 0.95, smooth: false, sx: side > 0 ? -1 : 1 });
        else if (duo) {
          const fr = Math.floor(t * 6 + i) % 2;
          this.img(duo, x, y - step, 54, { ay: 0.95, smooth: false, frame: [64 * fr, i % 4 < 2 ? 0 : 64, 64, 64], sx: side > 0 ? -1 : 1 });
        }
      }
      // 응가 유령 (오면 그 그림으로 둥실둥실)
      const gh = this.a.op['v-ghost'];
      if (gh) for (let i = 0; i < 2; i++) {
        const k = lin(t, 24.2 + i * 0.6, 25.2 + i * 0.6);
        this.img(gh, cx + (i ? 110 : -120) + Math.sin(t * 2 + i) * 18, H * 0.3 + Math.sin(t * 3 + i * 2) * 12, 60, { a: 0.75 * k, smooth: false, rot: Math.sin(t * 2.5 + i) * 0.15 });
      }
    });
    // 보라 안개 (앞쪽)
    const cl = this.a.cloud;
    if (cl) {
      const fog = this.silOf(cl, '#4a1c78');
      for (let i = 0; i < 4; i++) {
        const x = ((i * 150 + u * 18) % 600 + 600) % 600 - 120;
        this.img(fog, x, H * 0.86 + Math.sin(u + i) * 6, 300, { a: 0.45 });
      }
    }
    this.vignette(0.7, '10,0,20');
    if (u < 0.5) this.fill('#fff0d0', 0.9 * (1 - eOut(u / 0.5)));
    this.fill('#0a0614', eIn(lin(t, T.s6 - 0.3, T.s6)) * 0.8);
  }

  /** 6 · 마왕의 등장: 안개 속에서 응가 성이 솟고 → 변비마왕 꽉막혀가 웃음 → 성문이 닫힘 */
  private s6(t: number): void {
    const { W, H } = this;
    const cx = W / 2;
    const g = this.g;
    const u = t - T.s6;
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1a0830');
    bg.addColorStop(1, '#05020a');
    g.fillStyle = bg;
    g.fillRect(-40, -40, W + 80, H + 80);
    const z = 1 + 0.08 * eIO(lin(t, T.s6, T.gate));
    const castleBg = this.a.r3.castle;
    const cH = castleBg ? (360 * castleBg.height) / castleBg.width : H;
    // 리마스터: 앞 장면(성문)에서 이어서 성 꼭대기까지 카메라가 올라감
    const ck = eIO(lin(t, T.s6, T.laugh));
    const cam6: [number, number, number] = castleBg ? [180, cH * (0.68 - 0.36 * ck), 1.28 - 0.14 * ck + 0.06 * lin(t, T.laugh, T.gate)] : [cx, H / 2, z];
    this.cam(cam6[0], cam6[1], cam6[2], () => {
      if (castleBg) g.drawImage(castleBg, 0, 0, 360, cH);
      // 번개 (마왕 웃음 앞뒤)
      for (const [bt, seed] of [[29.0, 11], [30.6, 37]] as [number, number][]) {
        const d = t - bt;
        if (d >= 0 && d < 0.3) {
          const a = 1 - d / 0.3;
          const pts = bolt(seed, cx + (seed % 2 ? -80 : 90), -20, cx + (seed % 2 ? -30 : 40), H * 0.32);
          this.line(pts, 1, 'rgba(200,150,255,0.5)', 9, a);
          this.line(pts, 1, '#f6eaff', 2.2, a);
          this.fill('#d6c0ff', a * 0.18);
        }
      }
      // 마왕: 성 뒤 하늘에서 떠오름
      const kingK = eOut(lin(t, 29.2, 30.0));
      const laugh = t >= T.laugh ? Math.abs(Math.sin((t - T.laugh) * 11)) * Math.exp(-(t - T.laugh) * 0.8) : 0;
      const king = this.a.op['v-king'];
      const ky = (castleBg ? cH * 0.1 + (1 - kingK) * 90 : H * 0.22 + (1 - kingK) * 120) - laugh * 4;
      if (king) {
        this.glow(cx, ky, 200, 'rgba(150,60,255,0.5)', kingK);
        const k2 = this.a.op['v-king2'];
        this.img(t >= T.laugh && k2 ? k2 : king, cx, ky + 34, castleBg ? 176 : 228, { a: kingK, smooth: false, sy: 1 + laugh * 0.03 });
      } else if (kingK > 0) {
        // 임시: 구름 속에서 빛나는 두 눈과 웃는 입
        if (this.a.cloud) this.img(this.silOf(this.a.cloud, '#120624'), cx, ky + 10, 420, { a: kingK });
        for (const s of [-1, 1]) {
          this.glow(cx + s * 44, ky, 34, 'rgba(255,200,80,0.9)', kingK);
          g.save();
          g.globalAlpha = kingK;
          g.fillStyle = '#ffe28a';
          g.beginPath();
          g.ellipse(cx + s * 44, ky, 16, 7 - laugh * 3, s * -0.35, 0, TAU);
          g.fill();
          g.restore();
        }
        g.save();
        g.globalAlpha = kingK * (0.5 + 0.5 * laugh);
        g.strokeStyle = '#ffcf6a';
        g.lineWidth = 4;
        g.beginPath();
        g.arc(cx, ky + 30, 46, 0.2 * Math.PI, 0.8 * Math.PI);
        g.stroke();
        g.restore();
      }
      if (laugh > 0.05) this.ptext('크하하하!', cx + 96, ky - 70, 16, '#e0c4ff', Math.min(1, (t - T.laugh) * 4) * clamp(1 - (t - T.laugh - 1.2)), 0.12);
      // 응가 성 (안개 속에서 솟아오름)
      const rise = eOut(lin(t, T.s6, T.s6 + 1.3));
      const cs = this.a.op['bg-castle'] ?? this.a.castle;
      if (cs && !castleBg) {
        const cy = H * 0.56 + (1 - rise) * 160;
        this.glow(cx, cy, 200, 'rgba(160,60,255,0.45)', rise);
        this.img(this.silOf(cs, '#b070ff'), cx, cy - 3, 316, { a: rise * 0.7 });
        this.img(cs, cx, cy, 310, { a: rise });
        if (!this.a.op['bg-castle']) this.img(this.silOf(cs, '#1a0a2e'), cx, cy, 310, { a: rise * 0.55 });
      }
      // 기사단장 (오면 성문 앞을 지킴)
      const kn = this.a.op['v-knight'];
      if (kn) this.img(kn, cx, castleBg ? cH * 0.62 : H * 0.84, castleBg ? 60 : 110, { a: eOut(lin(t, 28.8, 29.6)), smooth: false, ay: 1 });
    });
    // 안개
    const cl = this.a.cloud;
    if (cl) {
      const fog = this.silOf(cl, '#3a1660');
      for (let i = 0; i < 4; i++) this.img(fog, ((i * 160 - u * 14) % 640 + 640) % 640 - 140, H * 0.8 + Math.sin(u + i) * 5, 300, { a: 0.55 });
    }
    // 성문이 닫힘 (양쪽 무거운 문짝 · 쿵 → 암전)
    const close = eIn(lin(t, T.gate - 0.5, T.gate));
    if (close > 0) {
      const half = W / 2;
      for (const side of [-1, 1]) {
        const x0 = side < 0 ? -half + close * half : W - close * half;
        g.fillStyle = side < 0 ? '#1e0c14' : '#26101a';
        g.fillRect(x0, -40, half, H + 80);
        g.fillStyle = '#4a2a18';
        for (let k = 1; k < 8; k++) g.fillRect(x0, (H / 8) * k, half, 5);
        g.fillStyle = '#8a6a30';
        for (let k = 1; k < 8; k++) g.fillRect(side < 0 ? x0 + half - 14 : x0 + 6, (H / 8) * k - 3, 8, 11);
      }
      if (t >= T.gate) this.fill('#c8a0ff', Math.max(0, 1 - (t - T.gate) * 6) * 0.35);
    }
    this.vignette(0.7, '10,0,20');
    if (u < 0.3) this.fill('#0a0614', 0.8 * (1 - u / 0.3));
    this.fill('#000', lin(t, T.gate + 0.2, T.s7));
  }

  /** 7 · 여섯 수호자: 어둠 속 잠든 고나 곁에 여섯 빛 → 한 명씩 컷인(각자의 마법) → 빛이 고나에게 모임 */
  private s7(t: number): void {
    const { W, H } = this;
    const g = this.g;
    const cx = W / 2;
    const cy = H * 0.46;
    if (t < T.cutins) {
      const u = t - T.s7;
      this.fill('#05040c');
      this.sleeper(cx, H * 0.66, 170, eOut(lin(u, 0, 0.4)), '#c8b8ff');
      this.glow(cx, H * 0.58, 90, 'rgba(255,220,160,0.5)', 0.6);
      for (let i = 0; i < 6; i++) {
        const k = lin(u, 0.1 + i * 0.12, 0.3 + i * 0.12);
        if (k <= 0) continue;
        const a = (i / 6) * TAU - Math.PI / 2;
        const x = cx + Math.cos(a) * 110;
        const y = H * 0.55 + Math.sin(a) * 110;
        this.glow(x, y, 40 * k, FAM_COL[FAMILY[i]], 0.9);
        this.star(x, y, 14 * k + Math.sin(t * 9 + i) * 2, k, '#ffffff');
      }
      return;
    }
    if (t < 36.6) {
      const m = Math.min(5, Math.floor((t - T.cutins) / 0.6));
      const v = t - T.cutins - m * 0.6;
      const f = FAMILY[m];
      const col = FAM_COL[f];
      const dir = m % 2 ? -1 : 1;
      const bg = g.createRadialGradient(cx, cy, 10, cx, cy, H * 0.7);
      bg.addColorStop(0, col);
      bg.addColorStop(0.35, '#140a26');
      bg.addColorStop(1, '#05030a');
      g.fillStyle = bg;
      g.globalAlpha = 0.85;
      g.fillRect(-40, -40, W + 80, H + 80);
      g.globalAlpha = 1;
      this.rays(cx, cy, 14, H, t * 0.6 * dir, 0.3, '255,255,255');
      this.speed(t, 0, 0.45, '255,255,255', 26, dir * 1.2);
      const fam = this.a.fam[f];
      const enter = eOut(clamp(v / 0.18));
      const x = cx - dir * 210 * (1 - enter) + dir * v * 14;
      const w = 250 * (1 + v * 0.15);
      const reveal = clamp((v - 0.12) / 0.14);
      this.famFx(f, v, x, cy, true);
      if (fam) {
        this.img(this.silOf(fam, col), x, cy, w * 1.04, { a: 0.9 * (1 - reveal * 0.5) });
        this.img(fam, x, cy, w, { a: reveal });
        this.img(this.silOf(fam, '#05030a'), x, cy, w, { a: 1 - reveal });
      }
      this.famFx(f, v, x, cy, false);
      if (v > 0.5) this.speed(t, 0, (v - 0.5) / 0.1, '255,255,255', 40, -dir * 3);
      this.vignette(0.6);
      return;
    }
    // 여섯 빛이 잠든 고나에게 모임
    const u = t - 36.6;
    this.fill('#05040c');
    this.sleeper(cx, H * 0.66, 170, 1, '#ffe2a0');
    for (let i = 0; i < 6; i++) {
      const k = eIn(clamp(u / 0.4));
      const a = (i / 6) * TAU - Math.PI / 2 + k * 2;
      const r = 150 * (1 - k);
      this.glow(cx + Math.cos(a) * r, H * 0.55 + Math.sin(a) * r, 36, FAM_COL[FAMILY[i]], 0.9);
    }
    this.glow(cx, H * 0.56, 60 + 200 * clamp(u / 0.4), 'rgba(255,230,170,0.8)', clamp(u / 0.4));
  }
  /** 수호자별 마법 (back=캐릭터 뒤 층 / front=앞 층) */
  private famFx(f: FamilyId, v: number, x: number, y: number, back: boolean): void {
    const g = this.g;
    const k = clamp((v - 0.1) / 0.45);
    if (k <= 0) return;
    if (f === 'mom') {
      if (back) {
        // 샤워기 지팡이에서 거대한 푸른 물결
        for (let i = 0; i < 3; i++) {
          const r = 40 + (k * 220 + i * 50) % 240;
          g.save();
          g.globalCompositeOperation = 'lighter';
          g.strokeStyle = '#7fd8ff';
          g.globalAlpha = (1 - r / 280) * 0.7;
          g.lineWidth = 10 - i * 2;
          g.beginPath(); g.ellipse(x, y + 30, r, r * 0.45, 0, Math.PI, TAU); g.stroke();
          g.restore();
        }
      } else for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i - 3) * 0.35;
        const d = 60 + k * 150;
        this.img(this.a.splash, x + Math.cos(a) * d, y - 40 + Math.sin(a) * d * 0.6, 34 + k * 14, { a: 1 - k * 0.6, smooth: false });
      }
    } else if (f === 'dad') {
      if (back) return;
      // 물대포 직선 발사 + 반동
      const sx = x + 46;
      const sy = y - 40;
      const L = 40 + k * 420;
      const gr = g.createLinearGradient(sx, sy, sx + L * 0.6, sy - L);
      gr.addColorStop(0, 'rgba(255,255,255,0.95)');
      gr.addColorStop(1, 'rgba(110,210,255,0.2)');
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = gr;
      g.lineCap = 'round';
      g.lineWidth = 22;
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + L * 0.6, sy - L); g.stroke();
      g.lineWidth = 8;
      g.strokeStyle = '#ffffff';
      g.stroke();
      g.restore();
      this.img(this.a.splash, sx, sy, 60, { a: 1 - k, smooth: false });
    } else if (f === 'imo') {
      if (back) { this.glow(x, y - 20, 160 * k, 'rgba(190,80,255,0.8)', 1 - k * 0.4); return; }
      // 보라색 프룬 에너지 폭발
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU + 0.3;
        const d = 30 + k * 170;
        this.img(this.a.prune, x + Math.cos(a) * d, y - 20 + Math.sin(a) * d, 20, { a: 1 - k * 0.5, smooth: false });
      }
      this.img(this.a.pruneSplash, x + 50, y - 80, 70 * (0.6 + k), { a: 1 - k * 0.6, smooth: false });
    } else if (f === 'samchon') {
      if (back) { this.glow(x, y, 150, 'rgba(160,255,230,0.7)', k); return; }
      // 빛 속에서 유산균 소환체 셋
      const pr = this.a.probio;
      if (!pr) return;
      for (let i = 0; i < 3; i++) {
        const pk = eOut(clamp((v - 0.15 - i * 0.07) / 0.2));
        if (pk <= 0) continue;
        const px = x + (i - 1) * 78;
        const py = y - 120 + Math.abs(i - 1) * 30 - Math.sin(v * 20 + i) * 4;
        this.glow(px, py, 40, 'rgba(255,255,255,0.8)', 1 - pk * 0.5);
        this.img(pr, px, py, 54 * pk, { frame: [40 * (Math.floor(v * 12) % 3), 40 * i, 40, 40], smooth: false });
      }
    } else if (f === 'halmeoni') {
      if (back) {
        this.img(this.a.circle, x, y + 20, 260 * (0.7 + k * 0.4), { frame: [0, 0, 112, 112], a: 0.8, rot: v * 2 });
        this.glow(x, y, 170, 'rgba(255,214,120,0.7)', k);
        return;
      }
      // 분홍 치유 하트 + 금빛 마법
      for (let i = 0; i < 9; i++) {
        const hk = (k + hash(i) * 0.5) % 1;
        this.img(this.a.heart, x + (hash(i * 3) - 0.5) * 220, y + 80 - hk * 220, 22 + hash(i) * 12, { a: 1 - hk, smooth: false });
      }
      for (let i = 0; i < 6; i++) this.star(x + Math.cos(i + v * 6) * 110, y - 40 + Math.sin(i * 2 + v * 6) * 80, 7, 1 - k * 0.3);
    } else if (f === 'halabeoji') {
      if (back) {
        this.img(this.a.dome, x, y - 10, 300 * (0.6 + k * 0.6), { frame: [0, 0, 120, 64], a: 0.8 });
        return;
      }
      // 거대한 방패에서 육각형 보호막 확장
      const hex = this.a.hex;
      for (let ring = 1; ring <= 3; ring++) {
        const rk = clamp(k * 3 - (ring - 1));
        if (rk <= 0) continue;
        for (let i = 0; i < ring * 6; i++) {
          const a = (i / (ring * 6)) * TAU;
          this.img(hex, x + Math.cos(a) * ring * 44 * eOut(rk), y - 10 + Math.sin(a) * ring * 40 * eOut(rk), 30, { a: rk * (1 - k * 0.4), smooth: false });
        }
      }
    }
  }


  /** 8 · 운명의 출격: 빛을 받은 고나가 꿈속에서 눈을 뜸 → 익룡 영웅으로 → 하늘로 솟구쳐 → 화면 쪽으로 */
  private s8(t: number): void {
    const { W, H } = this;
    const cx = W / 2;
    const hero = this.a.op['gona-hero'];
    const heroIm = hero ?? this.a.gona;
    const heroW = hero ? 300 : 250;
    if (t < T.rise) {
      // 금빛 속에서 잠든 고나 → 눈을 뜨며 영웅의 모습으로 (빛 테두리 · 날개 펼침)
      this.fill('#140c08');
      this.rays(cx, H * 0.5, 16, H, t * 0.3, 0.3 + 0.4 * lin(t, T.s8, T.wake), '255,220,150');
      this.dust(t, 50, '#ffe7a8', 0.7, 20);
      this.glow(cx, H * 0.55, 220, 'rgba(255,214,140,0.7)', 0.6 + 0.4 * lin(t, T.s8, T.wake));
      const k = eIO(lin(t, T.wake - 0.25, T.wake + 0.15));
      this.sleeper(cx, H * 0.66, 170 + 30 * k, 1 - k, '#ffd88a');
      if (heroIm && k > 0) {
        const spread = eOut(lin(t, T.wake, T.rise));
        this.img(this.silOf(heroIm, '#ffd88a'), cx, H * 0.5, heroW * 1.05, { a: k * (1 - spread * 0.7), sx: 0.85 + 0.15 * spread });
        this.img(heroIm, cx, H * 0.5, heroW, { a: k * (0.3 + 0.7 * spread), sx: 0.85 + 0.15 * spread, smooth: !hero });
      }
      this.glow(cx, H * 0.5, 260, 'rgba(255,240,200,0.9)', Math.max(0, 1 - Math.abs(t - T.wake) / 0.3) * 0.7);
      this.vignette(0.6, '20,10,0');
      return;
    }
    if (t < T.toward) {
      // 하늘로 솟구침: 배경이 아래로 흐르고 고나가 위로 (세로 속도선)
      const k = eIO(lin(t, T.rise, T.toward));
      this.sky(1.3, -60 + k * 220, 0.9);
      this.fill('#0a0614', 0.3 - 0.2 * k);
      this.rays(cx, -30, 12, H * 1.1, Math.PI / 2, 0.45, '255,230,170');
      this.speed(t, 1, 0.4 + 0.5 * k, '255,240,200', 40, 1.4);
      const y = H * 0.62 - k * H * 0.2 + Math.sin(t * 5) * 4;
      if (heroIm) {
        for (let i = 3; i >= 1; i--) this.img(heroIm, cx, y + i * 26, heroW, { a: 0.12 * i, smooth: !hero });
        this.img(heroIm, cx, y, heroW, { rot: Math.sin(t * 3) * 0.04, smooth: !hero });
      }
      this.vignette(0.55);
      return;
    }
    // 화면 쪽으로 날아옴 → 따뜻한 빛으로 번지며 타이틀
    const k = lin(t, T.toward, TITLE_AT);
    this.sky(1.4 + k * 0.5, 160, 0.9);
    this.fill('#0a0614', 0.25);
    this.speed(t, 2, 0.4 + 0.5 * k, '255,240,200', 50, 1 + k * 2);
    this.glow(cx, H * 0.42, 140 + 260 * k, 'rgba(255,220,150,0.7)', 0.4 + 0.5 * k);
    if (heroIm) this.img(heroIm, cx, H * 0.42 + eIn(k) * 80, heroW * (1 + eIn(k) * 3), { rot: Math.sin(t * 6) * 0.03, smooth: !hero });
    this.vignette(0.5);
    this.fill('#fff2d8', eIn(lin(t, TITLE_AT - 0.5, TITLE_AT)) * 0.85);
  }

  /** 8 · 운명의 출격 (리마스터): 꿈의 빛 속 잠든 고나 → 눈을 뜸 → 날개를 펴고 솟구침 → 화면 쪽으로 */
  private s8r(t: number): void {
    const { W, H } = this;
    const cx = W / 2;
    const g = this.g;
    const r = this.a.r3;
    const spr = (name: string, x: number, y: number, w: number, a = 1, rot = 0) => {
      const im = r[name];
      if (!im || a <= 0) return;
      g.save();
      g.globalAlpha *= a;
      g.translate(x, y);
      g.rotate(rot);
      g.imageSmoothingEnabled = false;
      g.drawImage(im, -w / 2, -w / 2, w, w);
      g.restore();
    };
    if (t < T.rise) {
      if (r.dream) this.cover(r.dream, cx, H / 2, 1.15 - 0.08 * lin(t, T.s8, T.rise));
      else this.fill('#140c08');
      this.fill('#1a0c04', 0.35);
      this.rays(cx, H * 0.48, 16, H, t * 0.3, 0.3 + 0.4 * lin(t, T.s8, T.wake), '255,220,150');
      this.glow(cx, H * 0.52, 200, 'rgba(255,214,140,0.7)', 0.6 + 0.4 * lin(t, T.s8, T.wake));
      // 여섯 빛이 모여 고나를 감쌈
      for (let i = 0; i < 6; i++) {
        const k = eIn(lin(t, T.s8, T.s8 + 0.7));
        const a = (i / 6) * TAU + t * 1.2;
        this.glow(cx + Math.cos(a) * 140 * (1 - k), H * 0.52 + Math.sin(a) * 140 * (1 - k), 26, FAM_COL[FAMILY[i]], 0.9 * (1 - lin(t, T.wake, T.rise)));
      }
      const wk = eIO(lin(t, T.wake - 0.2, T.wake + 0.1));
      const br = 1 + 0.015 * Math.sin(t * 2);
      spr('b-sleep', cx, H * 0.52, 250 * br, 1 - wk);
      spr('b-wake', cx, H * 0.52, 250, wk);
      this.glow(cx, H * 0.5, 240, 'rgba(255,244,210,0.95)', Math.max(0, 1 - Math.abs(t - (T.rise - 0.12)) / 0.18) * 0.9);
      this.dust(t, 50, '#ffe7a8', 0.7, 20);
      this.vignette(0.55, '20,10,0');
      return;
    }
    const sky = r['keyart-tall'];
    const skyDraw = (zoom: number, yShift: number) => {
      if (!sky) { this.fill('#2a1850'); return; }
      const sw = sky.width;
      const sh = sky.height * 0.3;
      const s = Math.max(W / sw, H / sh) * zoom;
      g.drawImage(sky, 0, 0, sw, sh, W / 2 - (sw * s) / 2, H / 2 - (sh * s) / 2 + yShift, sw * s, sh * s);
    };
    if (t < T.toward) {
      const k = eIO(lin(t, T.rise, T.toward));
      skyDraw(1.25, -40 + k * 200);
      this.fill('#0a0614', 0.25 - 0.15 * k);
      this.rays(cx, -30, 12, H * 1.1, Math.PI / 2, 0.4, '255,230,170');
      this.speed(t, 1, 0.35 + 0.5 * k, '255,240,200', 40, 1.4);
      const y = H * 0.7 - k * H * 0.24 + Math.sin(t * 5) * 4;
      for (let i = 3; i >= 1; i--) spr('b-fly', cx, y + i * 22, 240, 0.12 * i);
      spr('b-fly', cx, y, 240, 1, Math.sin(t * 3) * 0.05);
      this.vignette(0.5);
      return;
    }
    const k = lin(t, T.toward, TITLE_AT);
    skyDraw(1.4 + k * 0.5, 160);
    this.fill('#0a0614', 0.2);
    this.speed(t, 2, 0.4 + 0.5 * k, '255,240,200', 50, 1 + k * 2);
    this.glow(cx, H * 0.42, 140 + 260 * k, 'rgba(255,220,150,0.7)', 0.4 + 0.5 * k);
    spr('b-fly', cx, H * 0.46 + eIn(k) * 60, 240 * (1 + eIn(k) * 3.2), 1, Math.sin(t * 6) * 0.03);
    this.vignette(0.5);
    this.fill('#fff2d8', eIn(lin(t, TITLE_AT - 0.5, TITLE_AT)) * 0.85);
  }

  /** 타이틀: 따뜻한 빛이 걷히며 (금빛 파편 · 작은 흔들림) — 글자는 DOM */
  private title(t: number): void {
    const { W, H } = this;
    const g = this.g;
    const cx = W / 2;
    const u = t - TITLE_AT;
    const ka = this.a.r3['keyart-tall'] ?? this.a.keyart;
    if (ka) this.cover(ka, cx, H / 2, 1.08 - 0.04 * clamp(u / 4));
    this.fill('#0a0614', 0.7);
    const back = g.createRadialGradient(cx, H * 0.4, 20, cx, H * 0.4, W * 0.75);
    back.addColorStop(0, 'rgba(6,3,12,0.7)');
    back.addColorStop(1, 'rgba(6,3,12,0)');
    g.fillStyle = back;
    g.fillRect(-40, -40, W + 80, H + 80);
    this.rays(cx, H * 0.36, 16, H, t * 0.1, 0.3);
    for (let i = 0; i < 50; i++) {
      const a = hash(i) * TAU;
      const sp = 100 + hash(i * 3.7) * 260;
      const d = Math.min(u, 2.4);
      const al = clamp(1 - u / 2.4);
      if (al <= 0) break;
      g.save();
      g.translate(cx + Math.cos(a) * sp * d, H * 0.36 + Math.sin(a) * sp * d + 150 * d * d);
      g.rotate(u * 8 + i);
      g.globalAlpha = al * 0.9;
      g.fillStyle = i % 3 ? '#e8c477' : '#fff4d8';
      g.fillRect(-2, -1, 4 + hash(i) * 3, 2);
      g.restore();
    }
    this.dust(t, 36, '#ffe7a8', 0.6, 14);
    this.vignette(0.7);
    this.fill('#fff2d8', Math.max(0, 0.85 - u * 2.2));
  }
}

/** 자막 한 줄: [[…]] 부분만 금색 강조 */
function Line({ text }: { text: string }) {
  const parts = text.split(/(\[\[.*?\]\])/g).filter(Boolean);
  return <>{parts.map((p, i) => (p.startsWith('[[') ? <em key={i}>{p.slice(2, -2)}</em> : <span key={i}>{p}</span>))}</>;
}

/**
 * 오프닝 화면. onDone 은 SKIP · 끝 · 터치 중 먼저 오는 한 번만 불림.
 */
export function OpeningCinematic({ onDone, startAt = 0 }: { onDone: () => void; startAt?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(0); // 자막·타이틀 갱신용 (10fps)
  const tRef = useRef(0);
  const artRef = useRef<Art | null>(null);

  const finish = (): void => {
    if (done.current) return;
    done.current = true;
    stopBgm(0.5);
    onDone();
  };

  useEffect(() => {
    let alive = true;
    let raf = 0;
    let painter: Painter | null = null;
    let t0 = 0;
    const fit = () => {
      const box = boxRef.current;
      const c = ref.current;
      if (!box || !c || !painter) return;
      const dpr = Math.min(1.5, window.devicePixelRatio || 1); // 컷신은 1.5배까지 (모바일 부하 절감)
      painter.resize(box.clientWidth, box.clientHeight, dpr);
    };
    // 그림 + 음악 + 자막 글꼴 준비 (늦거나 실패해도 4초 뒤엔 시작 · 글꼴이 없으면 시스템 명조)
    const timeout = <T,>(p: Promise<T>, ms: number): Promise<T | null> => Promise.race([p, new Promise<null>((r) => window.setTimeout(() => r(null), ms))]);
    const font = document.fonts ? timeout(Promise.all([document.fonts.load('400 16px "Gowun Batang"', OPENING_TEXT), document.fonts.load('700 16px "Gowun Batang"', '고나의 응가 대탈출 대작전')]).catch(() => null), 3000) : Promise.resolve(null);
    void Promise.all([loadArt(), timeout(prepareBgm(['opening']).catch(() => null), 4000), font]).then(([art]) => {
      if (!alive || !ref.current) return;
      artRef.current = art;
      painter = new Painter(ref.current, art);
      fit();
      setReady(true);
      unlockAudio();
      playBgm('opening', 0.3, 0.05, startAt);
      t0 = performance.now() - startAt * 1000; // 테스트 허브: 원하는 장면부터
      let lastUi = -1;
      const loop = (ms: number): void => {
        if (!alive || !painter) return;
        const t = (ms - t0) / 1000;
        tRef.current = t;
        painter.frame(Math.min(t, OPENING_END + 4));
        const ui = Math.floor(t * 10);
        if (ui !== lastUi) { lastUi = ui; setNow(t); }
        if (t > OPENING_END + 1.4) { finish(); return; }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    });
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', fit);
    if (location.search.includes('skytest')) {
      Object.assign(window, {
        __skyOpening: {
          t: () => tRef.current,
          scene: () => sceneAt(tRef.current),
          art: () => (artRef.current ? SLOTS.map((n) => `${n}:${artRef.current!.op[n] ? '새 그림' : `임시(${FALLBACK[n] ?? '-'})`}`) : []),
          font: () => (document.fonts ? document.fonts.check('16px "Gowun Batang"', '고나') : false),
          /** 검수용: 컷신 시각을 바로 옮김 (음악은 그대로) */
          seek: (s: number) => { t0 = performance.now() - s * 1000; },
        },
      });
    }
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', fit);
      window.removeEventListener('orientationchange', fit);
      delete (window as unknown as { __skyOpening?: unknown }).__skyOpening;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const t = now;
  const cues = CUES.filter((c) => t >= c.t && t < c.end + 0.6);
  const sc = sceneAt(t);
  const titleOn = t >= TITLE_AT;
  return (
    <div className="sky oc" ref={boxRef} onPointerDown={() => { if (titleOn) finish(); }}>
      <canvas ref={ref} className="oc-canvas" />
      {!ready && <div className="oc-loading">LOADING…</div>}
      {ready && !titleOn && (
        <div className={`oc-subs s${sc}${sc === 1 ? ' center' : ''}`} aria-live="polite">
          {cues.map((c) => (
            <p key={c.t} className={`oc-line ${c.cls}${t >= c.end ? ' out' : ''}`}><Line text={c.text} /></p>
          ))}
        </div>
      )}
      {titleOn && (
        <div className="oc-title">
          <img className="oc-logo" src={`${BASE}${packPath('title/logo.png')}`} alt="GONA's SKY ADVENTURE" />
          <p className="oc-sub">응가 대탈출 대작전</p>
          <p className="oc-copy">“막힌 운명을 뚫어라!”</p>
          {t >= OPENING_END && <p className="oc-press">▶ 터치하여 시작</p>}
        </div>
      )}
      <button type="button" className="oc-skip" onPointerDown={(e) => { e.stopPropagation(); finish(); }}>SKIP ▶▶</button>
    </div>
  );
}
