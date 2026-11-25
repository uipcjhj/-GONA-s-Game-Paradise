/**
 * GONA's Sky Adventure 에셋 로더 (이미지 전용 — 소리는 audio.ts)
 *  - public/assets/sky/v2/… : 슈팅게임 전용 PNG (2배 격자: 게임 캔버스 픽셀과 1:1)
 *  - 모든 그림은 로딩 시 한 번 디코딩 · 필요한 변형(흰 번쩍임, 배경 어둡게, 크기 맞춤)은 캔버스로 한 번만 만들어 재사용
 *    → 게임 중 매 프레임 이미지 생성·리사이즈 없음
 */
const BASE = `${import.meta.env.BASE_URL}assets/sky/`;

const IMG_NAMES = ['icon-heart', 'icon-heart-empty', 'icon-bomb', 'fx-shield'] as const;
export type ImgName = (typeof IMG_NAMES)[number];

export const V2_NAMES = [
  'stage1/bg-backdrop', 'stage1/island-castle', 'stage1/island-ruins', 'stage1/island-small', 'stage1/island-tower',
  'stage1/clocktower', 'stage1/airship', 'stage1/cloud-big', 'stage1/cloud-small',
  'stage1/enemy-drone', 'stage1/enemy-fighter', 'stage1/enemy-orb', 'stage1/enemy-wyvern', 'stage1/enemy-gunship',
  'stage1/boss', 'stage1/fx-explosion',
  'chars/mom/fly', 'chars/dad/fly', 'chars/imo/fly', 'chars/halmeoni/fly', 'chars/halabeoji/fly', 'chars/samchon/fly',
  'fx/shot-l1', 'fx/shot-l2', 'fx/shot-l3', 'fx/shot-wave', 'fx/muzzle', 'fx/spark', 'fx/metal', 'fx/weak', 'fx/ring',
  'fx/charge', 'fx/charge-orb', 'fx/heart-p', 'fx/star-p', 'fx/elec', 'fx/potion', 'fx/lance', 'fx/missile',
  'fx/sp-circle', 'fx/sp-steam', 'fx/steam-puff', 'fx/sp-aura', 'fx/sp-dome', 'fx/mech', 'fx/roar',
] as const;
export type V2Name = (typeof V2_NAMES)[number];
export const CUTIN_IDS = ['gona', 'mom', 'dad', 'imo', 'halmeoni', 'halabeoji', 'samchon'] as const;
/** 응가 팩에만 있는 추가 그림 (팩에 없으면 null → 엔진이 기존 도형/그림으로 대체) */
export const EXTRA_NAMES = [
  'fx/water-drop', 'fx/prune-orb', 'fx/heal-heart', 'fx/flame', 'fx/hex', 'fx/germ', 'fx/prune-splash', 'fx/water-splash',
  'chars/samchon/probiotic', 'villain/duo',
] as const;
export type ExtraName = (typeof EXTRA_NAMES)[number];
export type CutinId = (typeof CUTIN_IDS)[number];

export interface Assets {
  img: Record<ImgName, HTMLImageElement>;
  /** 고나 전투 스프라이트 시트 (96×96 셀, 4열×10행) */
  gonaSheet: HTMLImageElement;
  v2: Record<V2Name, HTMLImageElement>;
  cutin: Record<CutinId, HTMLImageElement | null>;
  /** 응가 팩 추가 그림 (없으면 null) */
  extra: Record<ExtraName, HTMLImageElement | null>;
  /** 흰색 번쩍임 사본 캐시 */
  flash: Map<CanvasImageSource, HTMLCanvasElement>;
}

function loadOnce(url: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => {
      // 디코딩을 미리 끝내 첫 그리기에서 끊기지 않게
      if (im.decode) im.decode().then(() => res(im), () => res(im));
      else res(im);
    };
    im.onerror = () => res(null);
    im.src = url;
  });
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** GitHub Pages 가 가끔 잠깐 503 을 돌려주므로, 실패하면 주소를 살짝 바꿔 몇 번 더 받아 본다 */
const RETRY_MS = [500, 1500, 3000];
async function loadUrl(url: string, optional: boolean): Promise<HTMLImageElement | null> {
  let im = await loadOnce(url);
  for (let i = 0; !im && i < RETRY_MS.length; i++) {
    await wait(RETRY_MS[i]);
    im = await loadOnce(`${url}${url.includes('?') ? '&' : '?'}retry=${i + 1}`);
  }
  if (im || optional) return im;
  throw new Error(`이미지를 불러오지 못했어요: ${url}`);
}

let cache: Promise<Assets> | null = null;

export function loadAssets(): Promise<Assets> {
  cache ??= (async () => {
    // 응가 테마: 신규 그림 팩 목록을 먼저 읽고, 있는 그림만 v3-poop 에서 (없으면 기존 v2)
    await loadArtPack(BASE);
    applyPackToStages(STAGES);
    const [imgs, gonaSheet, v2list, cutins, extras] = await Promise.all([
      Promise.all(IMG_NAMES.map((n) => loadUrl(`${BASE}${n}.png`, false))),
      loadUrl(`${BASE}${packPath('chars/gona/sprite.png')}`, false),
      Promise.all(V2_NAMES.map((n) => loadUrl(`${BASE}${packPath(`${n}.png`)}`, false))),
      Promise.all(CUTIN_IDS.map((n) => loadUrl(`${BASE}${packPath(`chars/${n}/cutin.png`, `v2/chars/${n}/cutin.${n === 'gona' ? 'png' : 'jpg'}`)}`, true))),
      Promise.all(EXTRA_NAMES.map((n) => (hasPack(`${n}.png`) ? loadUrl(`${BASE}${packPath(`${n}.png`)}`, true) : Promise.resolve(null)))),
    ]);
    const extra = {} as Record<ExtraName, HTMLImageElement | null>;
    EXTRA_NAMES.forEach((n, i) => (extra[n] = extras[i]));
    const v2 = {} as Record<V2Name, HTMLImageElement>;
    V2_NAMES.forEach((n, i) => (v2[n] = v2list[i]!));
    const img = {} as Record<ImgName, HTMLImageElement>;
    IMG_NAMES.forEach((n, i) => (img[n] = imgs[i]!));
    const cutin = {} as Record<CutinId, HTMLImageElement | null>;
    CUTIN_IDS.forEach((n, i) => (cutin[n] = cutins[i]));
    return { img, gonaSheet: gonaSheet!, v2, cutin, extra, flash: new Map() };
  })();
  // 실패하면 기억하지 않음 → 다시 들어오면 처음부터 다시 받기
  cache.catch(() => (cache = null));
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

// ───────── 스테이지별 그림 (스테이지 1 = 승인 에셋, 2~6 = 임시 색변환본) ─────────
import { ART_NAMES, STAGES, type ArtName, type StageDef } from './stages';
import { loadArtPack, applyPackToStages, packPath, hasPack, stageDir } from './artpack';
export type StageArt = Record<ArtName, HTMLImageElement>;
const stageCache = new Map<string, Promise<StageArt>>();
export function loadStageArt(key: StageDef['art']): Promise<StageArt> {
  let p = stageCache.get(key);
  if (!p) {
    const dir = key === 'stage1' ? 'v2/stage1/' : `v2/temp/${key}/`;
    const pd = stageDir(key);
    // 팩에 있는 그림은 v3-poop/<스테이지>/ 에서, 나머지는 기존 폴더에서 (중간보스 전용 그림은 팩에 있을 때만)
    const names: ArtName[] = hasPack(`${pd}/midboss.png`) ? [...ART_NAMES, 'midboss'] : ART_NAMES;
    p = Promise.all(names.map((n) => loadUrl(`${BASE}${packPath(`${pd}/${n}.png`, `${dir}${n}.png`)}`, false))).then((list) => {
      const out = {} as StageArt;
      names.forEach((n, i) => (out[n] = list[i]!));
      return out;
    });
    stageCache.set(key, p);
    p.catch(() => stageCache.delete(key));
    // 지난 스테이지 그림은 놓아 줌 (지금 · 바로 앞 스테이지만 기억 → 후반 스테이지에서 메모리가 계속 쌓이지 않게)
    while (stageCache.size > 2) stageCache.delete(stageCache.keys().next().value as string);
  }
  return p;
}
