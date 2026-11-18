/**
 * 오프닝 시네마틱 「서기 2026년, 고나의 대재앙」 (응가 테마 · 약 32초 + 타이틀)
 *
 *  - 하나의 Canvas 에 시간축(초)으로 그리는 실시간 컷신: 레이어 분리 · 카메라 줌/팬 · 실루엣 공개 · 마스킹 ·
 *    속도선 · 빛 입자 · 균열 · 번개 · 플래시 · 화면 흔들림 (입자·효과는 '시간 → 위치' 계산식이라 프레임이 빠져도 같은 장면)
 *  - 그림은 모두 기존 승인 에셋 재사용 (고나·가족 원화, STAGE 1 배경·응가 열차·이펙트, 타이틀 키아트, 기존 구름·성 소품)
 *  - 음악: bgm-opening (tools/sky-audio/opening.py — 장면 시각에 맞춰 작곡) · 나레이션은 자막(DOM, 금빛 서사체)
 *  - SKIP · 끝나면 onDone 한 번만 (빠른 연타·중복 호출 방지) · 그림이 안 불러와져도 멈추지 않고 그 레이어만 생략
 */
import { useEffect, useRef, useState } from 'react';
import { packPath } from './artpack';
import { playBgm, prepareBgm, stopBgm, unlockAudio } from './audio';
import type { FamilyId } from './engine';

const BASE = `${import.meta.env.BASE_URL}assets/sky/`;
const FAMILY: FamilyId[] = ['mom', 'dad', 'imo', 'samchon', 'halmeoni', 'halabeoji'];
const FAM_COL: Record<FamilyId, string> = { mom: '#5ec8ff', dad: '#ff8a3c', imo: '#b45cff', samchon: '#7ff0d0', halmeoni: '#ff8ac8', halabeoji: '#7ab8ff' };
export const OPENING_END = 32.2; // 이 시각에 '터치하여 시작' 표시, END+1.4 초에 자동으로 게임으로
const TITLE_AT = 29.0;

// ───────── 나레이션 자막 (확정 대본 그대로) ─────────
interface Cue { t: number; end: number; text: string; cls: string }
const CUES: Cue[] = [
  { t: 0.7, end: 3.95, text: '서기 2026년 11월…', cls: 'chron big' },
  { t: 1.9, end: 3.95, text: '고나가 7개월이 되던 해.', cls: 'chron' },
  { t: 4.35, end: 7.95, text: '떡뻥과 이유식을 마음껏 즐긴 고나에게,', cls: 'low' },
  { t: 5.9, end: 7.95, text: '마침내 위기가 도래했다.', cls: 'low strong' },
  { t: 8.3, end: 12.95, text: '처음엔 그 누구도 알지 못했다.', cls: 'low' },
  { t: 9.6, end: 12.95, text: '그것이 단순한 배앓이가 아니라,', cls: 'low' },
  { t: 11.0, end: 12.95, text: '소화왕국 전체를 뒤흔들 재앙의 전조라는 사실을…', cls: 'low strong' },
  { t: 13.4, end: 17.45, text: '막힘은 번지고,', cls: 'low' },
  { t: 14.6, end: 17.45, text: '가스는 차오르며,', cls: 'low' },
  { t: 15.8, end: 17.45, text: '최후의 응가는 아직 모습을 드러내지 않았다.', cls: 'low strong' },
  { t: 18.3, end: 23.85, text: '하지만 절망하기엔 이르다.', cls: 'low' },
  { t: 20.4, end: 23.85, text: '고나에겐 가족이 있으니까.', cls: 'low strong' },
  { t: 24.5, end: 28.55, text: '지금,', cls: 'low big' },
  { t: 25.6, end: 28.55, text: '가장 위대한 응가 탈출 작전이 시작된다.', cls: 'low strong' },
];
/** 장면 경계 (초) — 음악(tools/sky-audio/opening.py)과 같은 값 */
export const SCENES = [
  { id: 1, name: '전설의 시작', t: 0 },
  { id: 2, name: '풍요의 시대', t: 4 },
  { id: 3, name: '재앙의 전조', t: 8 },
  { id: 4, name: '막혀버린 세계', t: 13 },
  { id: 5, name: '여섯 수호자의 각성', t: 18 },
  { id: 6, name: '운명의 출격', t: 24 },
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

/** 화면 흔들림 충격 (초, 세기) — 음악의 충격음과 같은 시각 */
const SHAKES: [number, number][] = [[12.65, 0.7], [13.55, 1.0], [14.75, 0.5], [15.55, 0.35], [16.45, 0.45], [17.45, 1.0],
  [19.6, 0.3], [20.2, 0.45], [20.8, 0.3], [21.4, 0.25], [22.0, 0.25], [22.6, 0.4], [24.0, 0.3], [26.45, 0.4], [29.0, 1.3], [30.8, 0.6]];
const HEARTS = [8.2, 9.15, 10.0, 10.75, 11.4, 11.95, 12.45];

// 균열(보라 금) 미리 계산: 하늘에서 아래로 갈라지는 지그재그 + 가지
interface Crack { pts: [number, number][]; t0: number }
function makeCracks(): Crack[] {
  const out: Crack[] = [];
  let seed = 7;
  const rnd = (): number => hash(seed++);
  for (let k = 0; k < 5; k++) {
    const pts: [number, number][] = [];
    let x = 40 + k * 70 + rnd() * 30;
    let y = -10;
    let a = Math.PI / 2 + (rnd() - 0.5) * 0.6;
    for (let i = 0; i < 14; i++) {
      pts.push([x, y]);
      a += (rnd() - 0.5) * 0.9;
      a = clamp(a, 0.5, Math.PI - 0.5);
      const l = 18 + rnd() * 22;
      x += Math.cos(a) * l;
      y += Math.sin(a) * l;
    }
    out.push({ pts, t0: 11.0 + k * 0.28 });
    // 가지
    const b = pts[4 + Math.floor(rnd() * 6)];
    const bp: [number, number][] = [b];
    let bx = b[0];
    let by = b[1];
    let ba = (rnd() < 0.5 ? 0.3 : Math.PI - 0.3) + (rnd() - 0.5) * 0.4;
    for (let i = 0; i < 6; i++) { ba += (rnd() - 0.5) * 0.8; bx += Math.cos(ba) * 16; by += Math.sin(ba) * 16; bp.push([bx, by]); }
    out.push({ pts: bp, t0: 11.4 + k * 0.28 });
  }
  return out;
}
const CRACKS = makeCracks();

function bolt(seed: number, x0: number, y0: number, x1: number, y1: number): [number, number][] {
  const pts: [number, number][] = [[x0, y0]];
  const n = 10;
  for (let i = 1; i < n; i++) {
    const k = i / n;
    pts.push([x0 + (x1 - x0) * k + (hash(seed + i) - 0.5) * 46, y0 + (y1 - y0) * k]);
  }
  pts.push([x1, y1]);
  return pts;
}

type Img = HTMLImageElement | null;
interface Art {
  keyart: Img; bg: Img; train: Img; castle: Img; cloud: Img; gona: Img; puff: Img;
  fam: Record<FamilyId, Img>;
  splash: Img; prune: Img; pruneSplash: Img; heart: Img; hex: Img; flame: Img; probio: Img; circle: Img; dome: Img;
  spoon: Img; rice: Img; porridge: Img;
}
function loadImg(src: string): Promise<Img> {
  return new Promise((res) => {
    const im = new Image();
    const to = window.setTimeout(() => res(null), 8000); // 느린 망: 8초 넘으면 그 그림만 빼고 진행
    im.onload = () => { window.clearTimeout(to); res(im); };
    im.onerror = () => { window.clearTimeout(to); res(null); };
    im.src = src;
  });
}
async function loadArt(): Promise<Art> {
  const P = (rel: string, fb?: string): Promise<Img> => loadImg(`${BASE}${packPath(rel, fb)}`);
  const R = (path: string): Promise<Img> => loadImg(`${BASE}${path}`);
  const [keyart, bg, train, castle, cloud, gona, puff, splash, prune, pruneSplash, heart, hex, flame, probio, circle, dome, spoon, rice, porridge, ...fam] = await Promise.all([
    P('title/keyart.jpg'), P('stage1/bg-backdrop.png'), P('ending/train.png'), R('v2/stage1/island-castle.png'), R('v2/stage1/cloud-big.png'),
    P('chars/gona/illust.png'), R('v2/fx/steam-puff.png'),
    P('fx/water-splash.png'), P('fx/prune-orb.png'), P('fx/prune-splash.png'), P('fx/heal-heart.png', 'v2/fx/heart-p.png'), P('fx/hex.png'), P('fx/flame.png'),
    P('chars/samchon/probiotic.png'), R('v2/fx/sp-circle.png'), R('v2/fx/sp-dome.png'),
    R('v3-poop/opening/spoon.jpg'), R('v3-poop/opening/rice.jpg'), R('v3-poop/opening/porridge.jpg'),
    ...FAMILY.map((f) => P(`chars/${f}/illust.png`)),
  ]);
  const famRec = {} as Record<FamilyId, Img>;
  FAMILY.forEach((f, i) => (famRec[f] = fam[i]));
  return { keyart, bg, train, castle, cloud, gona, puff, splash, prune, pruneSplash, heart, hex, flame, probio, circle, dome, spoon, rice, porridge, fam: famRec };
}

// ───────── 그리기 ─────────
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
    const sh = im.height * 0.36;
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
  /** 성물 원판 (원·타원 마스크 + 금테 + 빛) */
  relic(im: Img, x: number, y: number, rx: number, ry: number, a: number, t: number): void {
    if (!im || a <= 0) return;
    const g = this.g;
    this.glow(x, y, Math.max(rx, ry) * 2.2, 'rgba(255,214,120,0.55)', a);
    g.save();
    g.globalAlpha *= a;
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, TAU);
    g.save();
    g.clip();
    const s = Math.max((rx * 2) / im.width, (ry * 2) / im.height) * 1.04;
    g.drawImage(im, x - (im.width * s) / 2, y - (im.height * s) / 2, im.width * s, im.height * s);
    const hl = g.createLinearGradient(x - rx, y - ry, x + rx, y + ry);
    const p = (t * 0.35) % 1;
    hl.addColorStop(clamp(p - 0.12), 'rgba(255,255,255,0)');
    hl.addColorStop(clamp(p), 'rgba(255,250,220,0.45)');
    hl.addColorStop(clamp(p + 0.12), 'rgba(255,255,255,0)');
    g.fillStyle = hl;
    g.fillRect(x - rx, y - ry, rx * 2, ry * 2);
    g.restore();
    g.lineWidth = 5;
    g.strokeStyle = '#6a4210';
    g.stroke();
    g.lineWidth = 2.5;
    g.strokeStyle = '#ffd875';
    g.stroke();
    g.beginPath();
    g.ellipse(x, y, rx + 7, ry + 7, 0, 0, TAU);
    g.lineWidth = 1;
    g.strokeStyle = 'rgba(255,220,140,0.7)';
    g.stroke();
    g.restore();
    // 반짝이 십자
    for (let i = 0; i < 4; i++) {
      const an = t * 0.7 + i * 1.6;
      const sx = x + Math.cos(an) * (rx + 10);
      const sy = y + Math.sin(an) * (ry + 10);
      this.star(sx, sy, 5 + 3 * Math.sin(t * 5 + i), a);
    }
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

  // ═════════ 장면들 ═════════
  frame(t: number): void {
    const g = this.g;
    const { W } = this;
    const s = this.c.width / W;
    // 화면 흔들림
    let sx = 0;
    let sy = 0;
    for (const [ti, k] of SHAKES) {
      const d = t - ti;
      if (d >= 0 && d < 0.6) {
        const amp = k * 7 * Math.exp(-d * 7);
        sx += Math.sin(d * 90 + ti) * amp;
        sy += Math.cos(d * 77 + ti * 3) * amp;
      }
    }
    g.setTransform(s, 0, 0, s, sx * s, sy * s);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#000';
    g.fillRect(-40, -40, W + 80, this.H + 80);
    const sc = sceneAt(t);
    if (sc === 1) this.s1(t);
    else if (sc === 2) this.s2(t);
    else if (sc === 3) this.s3(t);
    else if (sc === 4) this.s4(t);
    else if (sc === 5) this.s5(t);
    else if (t < TITLE_AT) this.s6(t);
    else this.title(t);
  }

  /** SCENE 01 — 전설의 시작: 어둠 속 금빛 입자 하나 → 검은 구름 사이로 빛 · 아주 천천히 앞으로 */
  private s1(t: number): void {
    const { W, H } = this;
    const g = this.g;
    const cx = W / 2;
    const cy = H * 0.42;
    const push = 1 + 0.07 * (t / 4);
    g.save();
    g.translate(cx, cy);
    g.scale(push, push);
    g.translate(-cx, -cy);
    const L = eIO(lin(t, 1.2, 4.0)); // 빛이 새어 나옴
    // 먼 하늘 (키아트를 아주 어둡게) + 갈라지는 구름 사이 빛
    this.sky(1.05, 0, 0.2 * L);
    this.glow(cx, cy - 30, 60 + 300 * L, 'rgba(255,200,110,0.65)', L);
    this.rays(cx, cy - 120, 11, H * 0.9, t * 0.05, 0.35 * L);
    // 검은 구름 두 겹: 가운데에서 양옆으로 갈라짐
    const cl = this.a.cloud;
    if (cl) {
      const part = eOut(lin(t, 1.0, 4.2));
      const dark = this.silOf(cl, '#07040e');
      const mid = this.silOf(cl, '#140a24');
      for (let i = 0; i < 6; i++) {
        const side = i % 2 ? 1 : -1;
        const y = cy - 170 + i * 62 + Math.sin(t * 0.4 + i) * 4;
        const x = cx + side * (40 + part * (70 + i * 10)) + side * (i * 6);
        this.img(i < 3 ? dark : mid, x, y, 260 + i * 30, { a: 0.95 });
      }
    }
    // 처음의 금빛 입자 하나
    const p = lin(t, 0.15, 1.6);
    const r = 1 + 5 * eOut(p);
    this.glow(cx, cy, 18 + 70 * eOut(p), 'rgba(255,214,120,0.9)', clamp(p * 2) * (1 - 0.6 * L));
    g.fillStyle = '#fff3c4';
    g.globalAlpha = clamp(p * 3);
    g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill();
    g.globalAlpha = 1;
    this.dust(t, 44, '#ffd88a', 0.8 * lin(t, 0.8, 2.2), 10);
    g.restore();
    this.vignette(0.85);
    // 다음 장면으로: 금빛으로 번지며
    this.fill('#ffcf7a', lin(t, 3.55, 4.0) * 0.85);
  }

  /** SCENE 02 — 풍요의 시대: 황금빛 성물(숟가락·이유식·떡뻥) 소개 → 고나의 손 → 어두워짐 */
  private s2(t: number): void {
    const { W, H } = this;
    const g = this.g;
    const u = t - 4;
    const cx = W / 2;
    // 배경: 황금빛 햇살 + 흐릿한 빛망울
    const bgG = g.createLinearGradient(0, 0, 0, H);
    bgG.addColorStop(0, '#5a3408');
    bgG.addColorStop(0.45, '#c88a2c');
    bgG.addColorStop(1, '#3a1e06');
    g.fillStyle = bgG;
    g.fillRect(-40, -40, W + 80, H + 80);
    this.rays(cx - 60, -40, 9, H * 1.2, 0.9 + u * 0.03, 0.55);
    for (let i = 0; i < 14; i++) {
      const bx = hash(i * 1.3) * W;
      const by = (hash(i * 2.9) * H - u * 12 * (0.5 + hash(i))) % H;
      this.glow(bx, (by + H) % H, 14 + hash(i * 4.4) * 26, 'rgba(255,230,160,0.35)', 0.7);
    }
    // 카메라: 숟가락(위) → 이유식 그릇 → 떡뻥(쌀 튀밥) 으로 내려가며 살짝 줌
    const camY = 160 * eIO(lin(u, 1.1, 2.2)) + 150 * eIO(lin(u, 2.4, 3.2));
    const zoom = 1.04 + 0.08 * (u / 4);
    g.save();
    g.translate(cx, H * 0.45);
    g.scale(zoom, zoom);
    g.translate(-cx, -H * 0.45 - camY);
    const y0 = H * 0.42;
    // 성물 셋: 등장할 때 빛과 함께 떠오름
    this.relic(this.a.spoon, cx, y0 - 20 + Math.sin(u * 1.4) * 4, 52, 112, eOut(lin(u, 0.0, 0.6)), u);
    this.relic(this.a.porridge, cx - 12, y0 + 170 + Math.sin(u * 1.2 + 1) * 4, 120, 58, eOut(lin(u, 1.1, 1.8)), u + 0.3);
    this.relic(this.a.rice, cx + 30, y0 + 330 + Math.sin(u * 1.3 + 2) * 3, 74, 62, eOut(lin(u, 2.3, 2.9)), u + 0.6);
    // 고나의 작은 손: 아래에서 떠오르며 성물을 향해 (원화를 크게, 주먹 쪽을 성물 방향으로)
    const reach = eOut(lin(u, 2.4, 3.6));
    if (this.a.gona) this.img(this.a.gona, cx - 120 + reach * 18, y0 + 520 - reach * 70, 330, { rot: -0.28 + reach * 0.08, a: clamp(reach * 1.4) });
    // 금빛 입자가 성물 쪽으로 모임
    for (let i = 0; i < 26; i++) {
      const k = (u * 0.5 + hash(i)) % 1;
      const a = hash(i * 3.3) * TAU;
      const d = (1 - k) * 160;
      this.star(cx + 30 + Math.cos(a) * d, y0 + 330 + Math.sin(a) * d * 0.7, 2.5 + hash(i * 7) * 3, (1 - k) * 0.9);
    }
    g.restore();
    this.vignette(0.55 + 0.4 * lin(u, 3.1, 4), '20,8,0');
    // 마지막 순간 서서히 어두워짐 (불길한 저음)
    this.fill('#000', eIn(lin(u, 3.0, 4.05)) * 0.92);
  }

  /** SCENE 03 — 재앙의 전조: 배로 다가가는 카메라 → 마법 소용돌이 → 소화왕국 → 보라 균열 · 심장박동 */
  private s3(t: number): void {
    const { W, H } = this;
    const g = this.g;
    const cx = W / 2;
    const cy = H / 2;
    const u = t - 8;
    let beat = 0;
    for (const hb of HEARTS) { const d = t - hb; if (d >= 0 && d < 0.4) beat = Math.max(beat, Math.exp(-d * 9)); }
    const z = 1 + 4.2 * eIn(lin(u, 0.2, 2.4)); // 배로 줌인
    const iw = 300;
    // 원화에서 배(가방·허리띠 근처) 위치 → 줌이 커질수록 화면 가운데로
    const bx = 0.52;
    const by = 0.64;
    const gi = this.a.gona;
    const ih = gi ? (iw * gi.height) / gi.width : 330;
    const bellyX = cx - iw / 2 + bx * iw;
    const bellyY = cy - ih / 2 + by * ih;
    const portal = eOut(lin(u, 2.0, 3.1)); // 왕국이 열리는 원
    if (portal < 1) {
      g.save();
      g.translate(cx, cy);
      g.scale(z * (1 + beat * 0.03), z * (1 + beat * 0.03));
      g.translate(-bellyX, -bellyY);
      this.glow(cx, cy, 260, 'rgba(255,170,80,0.4)', 1 - lin(u, 0.4, 1.6));
      if (gi) this.img(gi, cx, cy, iw);
      g.restore();
      this.fill('#0a0418', eIn(lin(u, 0.3, 2.0)) * 0.88);
      // 소용돌이 (금·보라 입자 나선)
      const vA = lin(u, 0.8, 1.6);
      for (let arm = 0; arm < 5; arm++) {
        for (let i = 0; i < 26; i++) {
          const k = i / 26;
          const ang = arm * (TAU / 5) + k * 5.2 - u * (2.2 + k * 1.5);
          const rr = 6 + k * (40 + 140 * lin(u, 1.0, 2.6));
          const x = cx + Math.cos(ang) * rr;
          const y = cy + Math.sin(ang) * rr * 0.8;
          g.globalAlpha = vA * (1 - k) * 0.9;
          g.fillStyle = i % 3 ? '#b07cff' : '#ffd36a';
          g.fillRect(x - 1.5, y - 1.5, 3 + (1 - k) * 2, 3 + (1 - k) * 2);
        }
      }
      g.globalAlpha = 1;
      this.glow(cx, cy, 30 + 90 * vA, 'rgba(180,120,255,0.8)', vA);
    }
    // 소화왕국: 소용돌이 가운데서 원으로 열림 (마스크)
    if (portal > 0) {
      g.save();
      const R = portal * Math.hypot(W, H) * 0.62;
      if (portal < 1) { g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.clip(); }
      const dz = 1.25 - 0.15 * lin(u, 2.0, 5.0) + beat * 0.02;
      this.cover(this.a.bg, cx, cy, dz);
      // 하늘이 점점 보라색으로 물듦
      this.fill('#2a0c48', 0.15 + 0.45 * lin(u, 3.0, 4.8));
      // 균열 (보라 빛 → 밝은 심)
      for (const ck of CRACKS) {
        const f = eOut(lin(t, ck.t0, ck.t0 + 1.2));
        if (f <= 0) continue;
        this.line(ck.pts, f, 'rgba(150,60,255,0.35)', 9, 1);
        this.line(ck.pts, f, '#b46cff', 3.5, 1);
        this.line(ck.pts, f, '#f4e4ff', 1.2, 1);
      }
      // 균열에서 피어오르는 불길한 기운
      const ev = lin(u, 3.2, 4.4);
      for (let i = 0; i < 40; i++) {
        const k = (u * 0.6 + hash(i * 2.1)) % 1;
        const x = hash(i) * W + Math.sin(u * 2 + i) * 10;
        const y = H * (0.9 - k * 0.8);
        g.globalAlpha = ev * (1 - k) * 0.7;
        g.fillStyle = i % 2 ? '#7a2cff' : '#2a0a40';
        g.fillRect(x, y, 3, 3);
      }
      g.globalAlpha = 1;
      g.restore();
      if (portal < 1) {
        // 열리는 원 테두리 (마법진 빛)
        g.save();
        g.globalCompositeOperation = 'lighter';
        g.strokeStyle = '#ffd36a';
        g.lineWidth = 3;
        g.globalAlpha = 1 - portal;
        g.beginPath(); g.arc(cx, cy, portal * Math.hypot(W, H) * 0.62, 0, TAU); g.stroke();
        g.restore();
      }
    }
    this.vignette(0.6 + beat * 0.35, beat > 0.2 ? '60,0,30' : '0,0,0');
    // 마지막 대사: 짧은 흔들림 + 보라 섬광
    this.fill('#c890ff', Math.max(0, 1 - (t - 12.65) * 5) * (t >= 12.65 ? 0.45 : 0));
    this.fill('#000', lin(t, 12.85, 13.0));
  }

  /** SCENE 04 — 막혀버린 세계: 성문(봉인)이 닫힘 → 응가 열차 급정거 → 보라 안개 · 변비마왕성 · 번개 → 암전 */
  private s4(t: number): void {
    const { W, H } = this;
    const g = this.g;
    const cx = W / 2;
    const u = t - 13;
    const shot = u < 1.0 ? 0 : u < 2.0 ? 1 : 2; // 성문 · 열차 · 전경
    // 기본 배경: 어두워진 왕국 (위아래로 천천히 흐름)
    const z = shot === 0 ? 1.45 : shot === 1 ? 1.2 : 1.05 + 0.08 * lin(u, 2.0, 4.4);
    const yOff = shot === 1 ? 30 : shot === 2 ? -u * 10 : 0;
    this.cover(this.a.bg, cx, H / 2 + yOff, z);
    this.fill('#1a0830', shot === 2 ? 0.55 + 0.2 * lin(u, 2, 4) : 0.5);

    if (shot === 2) {
      // 먼 변비마왕성 실루엣이 솟아오름 + 테두리 보라빛
      const rise = eOut(lin(u, 2.0, 3.3));
      const cs = this.a.castle;
      if (cs) {
        const cy = H * 0.3 + (1 - rise) * 90;
        // 원래 그림의 탑·창 모양이 보이도록: 보라 테두리 빛 → 원본 → 어두운 덧칠(완전 실루엣 아님)
        this.glow(cx, cy, 200, 'rgba(160,60,255,0.55)', rise);
        this.img(this.silOf(cs, '#b070ff'), cx, cy - 3, 306, { a: rise * 0.75 });
        this.img(cs, cx, cy, 300, { a: rise });
        this.img(this.silOf(cs, '#1a0a2e'), cx, cy, 300, { a: rise * 0.62 });
      }
    }
    // 보라 안개 세 겹 (서로 다른 속도 · 점점 짙어짐)
    const cl = this.a.cloud;
    if (cl) {
      const fogA = shot === 2 ? 0.45 + 0.4 * lin(u, 2, 4) : 0.35;
      const fog = this.silOf(cl, '#4a1c78');
      const fog2 = this.silOf(cl, '#24103e');
      for (let layer = 0; layer < 3; layer++) {
        const sp = (layer + 1) * 14;
        for (let i = 0; i < 4; i++) {
          const x = ((i * 150 + u * sp * (layer % 2 ? -1 : 1)) % 600 + 600) % 600 - 120;
          const y = H * (0.55 + layer * 0.14) + Math.sin(u + i) * 6;
          this.img(layer === 2 ? fog2 : fog, x, y, 280 + layer * 60, { a: fogA * (0.6 + layer * 0.2) });
        }
      }
    }
    if (shot === 0) {
      // 성문 봉인: 양옆에서 검보라 장벽이 굉음과 함께 닫힘 (빛나는 문양 줄)
      const close = eIn(lin(u, 0.05, 0.55));
      const half = W / 2;
      for (const side of [-1, 1]) {
        const x0 = side < 0 ? -half + close * half : W - close * half;
        const gr = g.createLinearGradient(x0, 0, x0 + half, 0);
        gr.addColorStop(0, side < 0 ? '#120620' : '#2a0e44');
        gr.addColorStop(1, side < 0 ? '#2a0e44' : '#120620');
        g.fillStyle = gr;
        g.fillRect(x0, -40, half, H + 80);
        g.strokeStyle = '#8a3cff';
        g.lineWidth = 2;
        g.globalAlpha = 0.8;
        for (let k = 1; k < 7; k++) { g.beginPath(); g.moveTo(x0 + 8, (H / 7) * k); g.lineTo(x0 + half - 8, (H / 7) * k); g.stroke(); }
        g.globalAlpha = 1;
        const edge = side < 0 ? x0 + half : x0;
        this.glow(edge, H / 2, 140, 'rgba(190,90,255,0.6)', close);
      }
      // 닫히는 순간 섬광 + 먼지
      const hit = t >= 13.55 ? Math.exp(-(t - 13.55) * 6) : 0;
      this.glow(cx, H / 2, 260, 'rgba(230,180,255,0.9)', hit);
      for (let i = 0; i < 30 && hit > 0.05; i++) {
        const a = hash(i) * TAU;
        const d = (t - 13.55) * (120 + hash(i * 3) * 200);
        g.fillStyle = '#d8b0ff';
        g.globalAlpha = hit;
        g.fillRect(cx + Math.cos(a) * d * 0.3, H / 2 + Math.sin(a) * d, 2, 2);
      }
      g.globalAlpha = 1;
    }
    if (shot === 1) {
      // 응가 열차: 달리다 급정거 (덜컹 · 불꽃 · 증기)
      const tr = this.a.train;
      const ty = H * 0.58;
      const k = lin(u, 1.0, 1.75);
      const x = -140 + 300 * eOut(k);
      const stopped = u >= 1.75;
      const jolt = stopped ? Math.sin((u - 1.75) * 30) * Math.exp(-(u - 1.75) * 5) * 0.12 : -0.03;
      if (!stopped) this.speed(t, 0, 0.5 * (1 - k), '255,230,200', 22, -1);
      if (tr) this.img(tr, x, ty, 170, { rot: jolt, smooth: false });
      if (u > 1.35 && u < 1.85) {
        for (let i = 0; i < 18; i++) {
          g.fillStyle = i % 2 ? '#ffd36a' : '#ff8a3c';
          g.globalAlpha = 0.9;
          g.fillRect(x - 40 + hash(i + u) * 80, ty + 44 - hash(i * 3 + u) * 14, 2, 2);
        }
        g.globalAlpha = 1;
      }
      if (stopped && this.a.puff) {
        for (let i = 0; i < 4; i++) {
          const pk = clamp((u - 1.75 - i * 0.12) / 0.6);
          if (pk <= 0 || pk >= 1) continue;
          this.img(this.a.puff, x + 40 + i * 6, ty - 50 - pk * 50, 50 + pk * 40, { frame: [32 * Math.min(2, Math.floor(pk * 3)), 0, 32, 32], a: 1 - pk, smooth: false });
        }
      }
      this.fill('#000', lin(u, 1.95, 2.0)); // 장면 컷
    }
    if (shot === 2) {
      // 번개 두 번
      for (const [bt, seed] of [[15.55, 11], [16.45, 37]] as [number, number][]) {
        const d = t - bt;
        if (d >= 0 && d < 0.35) {
          const a = 1 - d / 0.35;
          const pts = bolt(seed, cx + (seed % 2 ? -60 : 70), -20, cx + (seed % 2 ? -10 : 20), H * 0.3);
          this.line(pts, 1, 'rgba(200,150,255,0.5)', 10, a);
          this.line(pts, 1, '#f6eaff', 2.5, a);
          this.fill('#e6d0ff', a * 0.4 * (d < 0.08 ? 1 : 0.4));
        }
      }
      // 최후의 충격 → 하얗게 번쩍 → 암전
      if (t >= 17.45) { this.fill('#ffffff', Math.max(0, 1 - (t - 17.45) * 8) * 0.8); this.fill('#000', lin(t, 17.5, 17.75)); }
    }
    this.vignette(0.75, '10,0,20');
    if (u < 0.12) this.fill('#000', 1 - u / 0.12);
  }

  /** SCENE 05 — 여섯 수호자의 각성: 여섯 개의 빛 → 빠른 카메라 몽타주(실루엣 → 공개 + 각자의 마법) → 집결 */
  private s5(t: number): void {
    const { W, H } = this;
    const g = this.g;
    const cx = W / 2;
    const cy = H * 0.46;
    const u = t - 18;
    if (u < 1.6) {
      // 어둠 속 여섯 개의 빛 (차례로)
      for (let i = 0; i < 6; i++) {
        const k = lin(u, 0.1 + i * 0.25, 0.35 + i * 0.25);
        if (k <= 0) continue;
        const a = (i / 6) * TAU - Math.PI / 2;
        const zoom = 1 + eIn(lin(u, 1.25, 1.6)) * 3;
        const x = cx + Math.cos(a) * 92 * zoom;
        const y = cy + Math.sin(a) * 92 * zoom;
        const col = FAM_COL[FAMILY[i]];
        this.glow(x, y, 46 * k, `${col}`, 0.9);
        this.star(x, y, 18 * k + Math.sin(t * 9 + i) * 2, k, '#ffffff');
      }
      this.fill('#ffffff', eIn(lin(u, 1.45, 1.6)) * 0.7);
      return;
    }
    if (u < 5.2) {
      const m = Math.min(5, Math.floor((u - 1.6) / 0.6));
      const v = u - 1.6 - m * 0.6; // 이 수호자 안에서의 시간 (0~0.6)
      const f = FAMILY[m];
      const col = FAM_COL[f];
      const dir = m % 2 ? -1 : 1;
      // 배경: 수호자 색의 어둠 + 방사 빛 + 속도선
      const bg = g.createRadialGradient(cx, cy, 10, cx, cy, H * 0.7);
      bg.addColorStop(0, col);
      bg.addColorStop(0.35, '#140a26');
      bg.addColorStop(1, '#05030a');
      g.fillStyle = bg;
      g.globalAlpha = 0.85;
      g.fillRect(-40, -40, W + 80, H + 80);
      g.globalAlpha = 1;
      this.rays(cx, cy, 14, H, t * 0.6 * dir, 0.35, '255,255,255');
      this.speed(t, 0, 0.55, '255,255,255', 30, dir * 1.3);
      const im = this.a.fam[f];
      const enter = eOut(clamp(v / 0.16));
      const x = cx - dir * 210 * (1 - enter) + dir * v * 14;
      const zoom = 1 + v * 0.18;
      const w = 250 * zoom;
      const reveal = clamp((v - 0.13) / 0.12);
      // 마법 이펙트 (캐릭터 뒤쪽 층)
      this.famFx(f, v, x, cy, true);
      if (im) {
        // 실루엣 → 색 공개 (테두리 빛)
        this.img(this.silOf(im, col), x, cy, w * 1.04, { a: 0.9 * (1 - reveal * 0.5) });
        this.img(im, x, cy, w, { a: reveal });
        this.img(this.silOf(im, '#05030a'), x, cy, w, { a: 1 - reveal });
      }
      this.famFx(f, v, x, cy, false);
      this.fill('#ffffff', Math.max(0, 1 - Math.abs(v - 0.14) / 0.06) * 0.55); // 공개 섬광
      if (v > 0.54) this.speed(t, 0, (v - 0.54) / 0.06, '255,255,255', 50, -dir * 3); // 다음으로 휙
      this.vignette(0.6);
      return;
    }
    // 집결: 여섯 수호자가 V자로 모여 한 장면 (겹치는 레이어)
    const k = eOut(lin(u, 5.2, 5.6));
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#1a0e3a');
    bg.addColorStop(1, '#3a1a10');
    g.fillStyle = bg;
    g.fillRect(-40, -40, W + 80, H + 80);
    this.rays(cx, cy - 40, 16, H, t * 0.2, 0.5);
    const order: FamilyId[] = ['halabeoji', 'imo', 'mom', 'dad', 'halmeoni', 'samchon'];
    order.forEach((f, i) => {
      const side = i < 3 ? -1 : 1;
      const rank = i < 3 ? 2 - i : i - 3;
      const x = cx + side * (40 + rank * 52) * k + side * (1 - k) * 200;
      const y = cy - 20 + rank * 34;
      this.glow(x, y, 70, FAM_COL[f], 0.35);
      this.img(this.a.fam[f], x, y, 120 - rank * 6, { a: k });
    });
    this.fill('#000', eIn(lin(u, 5.75, 6.0)));
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

  /** SCENE 06 — 운명의 출격: 어둠 속 실루엣 → 하늘을 올려다봄 → 날개 펴고 돌진 → 화면을 뚫고 날아옴 → 백색 섬광 */
  private s6(t: number): void {
    const { W, H } = this;
    const cx = W / 2;
    const u = t - 24;
    const gi = this.a.gona;
    if (u < 2.9) {
      // 하늘: 위에서 빛이 쏟아짐 (점점 밝아짐) · 고나가 날아오르면 배경이 아래로 빠르게
      const sky = lin(u, 1.0, 2.0);
      const fly = eIn(lin(u, 2.45, 2.9));
      this.sky(1.25 + fly * 0.2, fly * 260 - 40, 0.15 + 0.6 * sky);
      this.fill('#05030c', 0.7 - 0.4 * sky);
      this.rays(cx, -30, 12, H * 1.1, Math.PI / 2 + Math.sin(u) * 0.05, 0.25 + 0.5 * sky);
      this.glow(cx, 0, 320, 'rgba(255,220,150,0.8)', 0.2 + 0.7 * sky);
      this.dust(t, 40, '#ffe7a8', 0.7, 22);
      if (gi) {
        const rise = eOut(lin(u, 0, 1.2));
        const look = eIO(lin(u, 1.3, 1.9)); // 고개를 들고 하늘을 바라봄
        const crouch = lin(u, 2.2, 2.45) * (1 - lin(u, 2.45, 2.5));
        const y = H * 0.66 - rise * 40 - fly * (H * 0.95);
        const reveal = lin(u, 1.5, 2.1);
        const o = { rot: -0.12 * look, sx: 1 + crouch * 0.06, sy: 1 - crouch * 0.1 };
        // 비행 잔상
        for (let i = 3; i >= 1 && fly > 0; i--) this.img(gi, cx, y + i * 70 * fly, 300, { ...o, a: 0.18 * i * (1 - fly * 0.3) });
        this.img(this.silOf(gi, '#ffcf7a'), cx, y - 3, 306, { ...o, a: 0.8 * (1 - reveal * 0.6) }); // 위에서 오는 테두리 빛
        this.img(gi, cx, y, 300, { ...o, a: reveal });
        this.img(this.silOf(gi, '#07040e'), cx, y, 300, { ...o, a: 1 - reveal });
      }
      this.speed(t, 1, fly * 0.9, '255,240,200', 44, 1.6);
      this.vignette(0.7);
      return;
    }
    // 화면을 뚫고 날아옴: 먼 하늘의 작은 고나가 카메라 쪽으로 (방사 속도선 · 빛 궤적)
    const k = lin(u, 2.9, 4.6);
    this.sky(1.3 + k * 0.6, 0, 0.85);
    this.fill('#0a0614', 0.35);
    this.speed(t, 2, 0.4 + 0.6 * k, '255,240,200', 60, 1 + k * 2);
    this.glow(cx, H * 0.45, 120 + 300 * k, 'rgba(255,220,150,0.7)', 0.4 + 0.5 * k);
    if (gi) {
      const w = 26 + eIn(k) * 1300;
      this.img(gi, cx, H * 0.45 + eIn(k) * 120, w, { rot: Math.sin(u * 8) * 0.03 });
    }
    this.vignette(0.55);
    this.fill('#ffffff', eIn(lin(u, 4.35, 5.0))); // 백색 섬광
  }

  /** 타이틀: 백색 섬광 뒤 충격과 함께 (금빛 파편 · 흔들림) — 글자는 DOM */
  private title(t: number): void {
    const { W, H } = this;
    const g = this.g;
    const cx = W / 2;
    const u = t - TITLE_AT;
    if (this.a.keyart) this.cover(this.a.keyart, cx, H / 2, 1.08 - 0.04 * clamp(u / 4));
    this.fill('#0a0614', 0.68);
    // 글자 뒤 어두운 판 (금빛 제목이 또렷하게)
    const back = g.createRadialGradient(cx, H * 0.4, 20, cx, H * 0.4, W * 0.75);
    back.addColorStop(0, 'rgba(6,3,12,0.75)');
    back.addColorStop(1, 'rgba(6,3,12,0)');
    g.fillStyle = back;
    g.fillRect(-40, -40, W + 80, H + 80);
    this.rays(cx, H * 0.36, 16, H, t * 0.12, 0.45);
    this.glow(cx, H * 0.36, 260, 'rgba(255,214,120,0.6)', 0.8);
    // 금빛 파편 (충격 순간 터져서 떨어짐)
    for (let i = 0; i < 70; i++) {
      const a = hash(i) * TAU;
      const sp = 120 + hash(i * 3.7) * 320;
      const d = Math.min(u, 2.4);
      const x = cx + Math.cos(a) * sp * d;
      const y = H * 0.36 + Math.sin(a) * sp * d + 160 * d * d;
      const al = clamp(1 - u / 2.4);
      if (al <= 0) break;
      g.save();
      g.translate(x, y);
      g.rotate(u * 8 + i);
      g.globalAlpha = al;
      g.fillStyle = i % 3 ? '#ffd36a' : '#fff4c8';
      g.fillRect(-2, -1, 4 + hash(i) * 4, 2);
      g.restore();
    }
    this.dust(t, 40, '#ffe7a8', 0.7, 16);
    this.vignette(0.7);
    this.fill('#ffffff', Math.max(0, 1 - u * 3));
  }
}

/**
 * 오프닝 화면. onDone 은 SKIP · 끝 · 터치 중 먼저 오는 한 번만 불림.
 */
export function OpeningCinematic({ onDone }: { onDone: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(0); // 자막·타이틀 갱신용 (10fps)
  const tRef = useRef(0);

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
      const dpr = Math.min(1.5, window.devicePixelRatio || 1); // 시네마틱은 1.5배까지 (모바일 부하 절감 · 흐림은 거의 없음)
      painter.resize(box.clientWidth, box.clientHeight, dpr);
    };
    // 그림 + 음악 준비 (음악이 늦거나 실패해도 4초 뒤엔 시작 · 자막만으로도 전달)
    const timeout = <T,>(p: Promise<T>, ms: number): Promise<T | null> => Promise.race([p, new Promise<null>((r) => window.setTimeout(() => r(null), ms))]);
    void Promise.all([loadArt(), timeout(prepareBgm(['opening']).catch(() => null), 4000)]).then(([art]) => {
      if (!alive || !ref.current) return;
      painter = new Painter(ref.current, art);
      fit();
      setReady(true);
      unlockAudio();
      playBgm('opening', 0.3, 0.05);
      t0 = performance.now();
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
    if (location.search.includes('skytest')) Object.assign(window, { __skyOpening: { t: () => tRef.current, scene: () => sceneAt(tRef.current) } });
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', fit);
      window.removeEventListener('orientationchange', fit);
      delete (window as unknown as { __skyOpening?: unknown }).__skyOpening;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const t = now;
  const cues = CUES.filter((c) => t >= c.t && t < c.end + 0.5);
  const sc = sceneAt(t);
  const titleOn = t >= TITLE_AT;
  return (
    <div className="sky oc" ref={boxRef} onPointerDown={() => { if (titleOn) finish(); }}>
      <canvas ref={ref} className="oc-canvas" />
      {!ready && <div className="oc-loading">LOADING…</div>}
      {ready && !titleOn && (
        <div className={`oc-subs s${sc}${sc === 1 ? ' center' : ''}`} aria-live="polite">
          {cues.map((c) => (
            <p key={c.t} className={`oc-line ${c.cls}${t >= c.end ? ' out' : ''}`}>{c.text}</p>
          ))}
        </div>
      )}
      {titleOn && (
        <div className="oc-title">
          <h1><span>고나의 응가</span><span>대탈출 대작전</span></h1>
          <p className="oc-en">GONA&apos;s Sky Adventure — The Great Poo Escape</p>
          <p className="oc-copy">“막힌 운명을 뚫어라!”</p>
          {t >= OPENING_END && <p className="oc-press">▶ 터치하여 시작</p>}
        </div>
      )}
      <button type="button" className="oc-skip" onPointerDown={(e) => { e.stopPropagation(); finish(); }}>SKIP ▶▶</button>
    </div>
  );
}
