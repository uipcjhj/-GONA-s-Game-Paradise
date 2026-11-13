/**
 * GONA's Sky Adventure 에셋 로더.
 *  - PNG: public/assets/sky/ (tools/build-sky-assets.py 로 만든 슈팅게임 전용 파일 · Food Adventure 원본은 그대로 보존)
 *  - 몬스터·보스·그들의 탄: Food Adventure 의 도트 코드(src/sky/art/*, 원본 그대로 복사)를 한 번 그려 캔버스로 재사용
 */
import { bossSheet, heartShot, smellCloud, waveHeart, tinyHeart } from './art/bossArt';
import { dizzyStar, flaskSheet, monsterSheet, popSheet, FLASK_FRAME } from './art/monsterArt';

const BASE = `${import.meta.env.BASE_URL}assets/sky/`;

const IMG_NAMES = [
  'gona-body', 'gona-wings', 'family-mom', 'family-dad', 'family-imo', 'family-halmeoni', 'family-halabeoji',
  'shot-gona', 'shot-charge', 'shot-heart', 'shot-dad', 'shot-imo', 'icon-heart', 'icon-heart-empty', 'icon-bomb',
  'fx-spark', 'fx-star', 'fx-shield', 'puff', 'sky-tile', 'cloud-0', 'cloud-1', 'cloud-2', 'cookie', 'strawberry', 'banana',
] as const;
export type ImgName = (typeof IMG_NAMES)[number];

export interface Sheet {
  canvas: HTMLCanvasElement;
  fw: number;
  fh: number;
}

export interface Assets {
  img: Record<ImgName, HTMLImageElement>;
  glasses: Sheet;
  uncle: Sheet;
  kiss: Sheet;
  sniff: Sheet;
  flask: Sheet;
  pop: Sheet;
  heartShot: HTMLCanvasElement;
  waveHeart: HTMLCanvasElement;
  tinyHeart: HTMLCanvasElement;
  smell: HTMLCanvasElement;
  dizzy: HTMLCanvasElement;
  /** 신규 고나 전투 스프라이트 시트 (96×96 셀, 4열×10행). 없으면 null → 기존 그래픽 */
  gonaSheet: HTMLImageElement | null;
  /** 흰색으로 번쩍이는 피격용 사본 (캔버스 → 흰 실루엣) */
  flash: Map<HTMLCanvasElement | HTMLImageElement, HTMLCanvasElement>;
}

function load(name: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error(`이미지를 불러오지 못했어요: ${name}`));
    im.src = `${BASE}${name}.png`;
  });
}

function loadOptional(url: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = url;
  });
}

let cache: Promise<Assets> | null = null;

export function loadAssets(): Promise<Assets> {
  cache ??= (async () => {
    const [imgs, gonaSheet] = await Promise.all([Promise.all(IMG_NAMES.map(load)), loadOptional(`${BASE}v2/chars/gona/sprite.png`)]);
    const img = {} as Record<ImgName, HTMLImageElement>;
    IMG_NAMES.forEach((n, i) => (img[n] = imgs[i]));
    return {
      img,
      glasses: monsterSheet('glasses'),
      uncle: monsterSheet('farter'),
      kiss: bossSheet('kiss'),
      sniff: bossSheet('sniff'),
      flask: { canvas: flaskSheet(), fw: FLASK_FRAME.w, fh: FLASK_FRAME.h },
      pop: { canvas: popSheet(), fw: 14, fh: 14 },
      heartShot: heartShot(),
      waveHeart: waveHeart(),
      tinyHeart: tinyHeart(),
      smell: smellCloud(),
      dizzy: dizzyStar(),
      flash: new Map(),
      gonaSheet,
    };
  })();
  return cache;
}

/** 흰 실루엣 사본 (한 번만 만들어 캐시) */
export function whiteOf(a: Assets, src: HTMLCanvasElement | HTMLImageElement): HTMLCanvasElement {
  let c = a.flash.get(src);
  if (!c) {
    c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    const g = c.getContext('2d')!;
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    a.flash.set(src, c);
  }
  return c;
}

// ── 효과음 (Food Adventure 의 mp3 를 슈팅게임 폴더로 복사해 사용) ──
export type SfxName = 'hit' | 'bossHit' | 'bossDown' | 'shield' | 'special' | 'pickup10' | 'start' | 'gameOver' | 'warn' | 'puff' | 'throw' | 'newRecord' | 'catch';
const sfxCache = new Map<string, HTMLAudioElement>();
let muted = (() => {
  try {
    return localStorage.getItem('gona.sky.mute') === '1';
  } catch {
    return false;
  }
})();
let bgm: HTMLAudioElement | null = null;

export function isMuted(): boolean {
  return muted;
}
export function setMuted(m: boolean): void {
  muted = m;
  try {
    localStorage.setItem('gona.sky.mute', m ? '1' : '0');
  } catch {
    /* 저장 불가(사파리 비공개 모드)는 무시 */
  }
  if (bgm) m ? bgm.pause() : void bgm.play().catch(() => undefined);
}
export function sfx(n: SfxName, vol = 0.6): void {
  if (muted) return;
  try {
    let a = sfxCache.get(n);
    if (!a) {
      a = new Audio(`${BASE}sfx-${n}.mp3`);
      sfxCache.set(n, a);
    }
    const c = a.cloneNode() as HTMLAudioElement;
    c.volume = vol;
    void c.play().catch(() => undefined);
  } catch {
    /* 소리 실패는 게임에 영향 없음 */
  }
}
export function startBgm(): void {
  bgm ??= Object.assign(new Audio(`${BASE}bgm-sky.mp3`), { loop: true, volume: 0.35 });
  if (!muted) void bgm.play().catch(() => undefined);
}
export function stopBgm(): void {
  bgm?.pause();
  if (bgm) bgm.currentTime = 0;
}
