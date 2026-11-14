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
export type CutinId = (typeof CUTIN_IDS)[number];

export interface Assets {
  img: Record<ImgName, HTMLImageElement>;
  /** 고나 전투 스프라이트 시트 (96×96 셀, 4열×10행) */
  gonaSheet: HTMLImageElement;
  v2: Record<V2Name, HTMLImageElement>;
  cutin: Record<CutinId, HTMLImageElement | null>;
  /** 흰색 번쩍임 사본 캐시 */
  flash: Map<CanvasImageSource, HTMLCanvasElement>;
}

function loadUrl(url: string, optional: boolean): Promise<HTMLImageElement | null> {
  return new Promise((res, rej) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => {
      // 디코딩을 미리 끝내 첫 그리기에서 끊기지 않게
      if (im.decode) im.decode().then(() => res(im), () => res(im));
      else res(im);
    };
    im.onerror = () => (optional ? res(null) : rej(new Error(`이미지를 불러오지 못했어요: ${url}`)));
    im.src = url;
  });
}

let cache: Promise<Assets> | null = null;

export function loadAssets(): Promise<Assets> {
  cache ??= (async () => {
    const [imgs, gonaSheet, v2list, cutins] = await Promise.all([
      Promise.all(IMG_NAMES.map((n) => loadUrl(`${BASE}${n}.png`, false))),
      loadUrl(`${BASE}v2/chars/gona/sprite.png`, false),
      Promise.all(V2_NAMES.map((n) => loadUrl(`${BASE}v2/${n}.png`, false))),
      Promise.all(CUTIN_IDS.map((n) => loadUrl(`${BASE}v2/chars/${n}/cutin.${n === 'gona' ? 'png' : 'jpg'}`, true))),
    ]);
    const v2 = {} as Record<V2Name, HTMLImageElement>;
    V2_NAMES.forEach((n, i) => (v2[n] = v2list[i]!));
    const img = {} as Record<ImgName, HTMLImageElement>;
    IMG_NAMES.forEach((n, i) => (img[n] = imgs[i]!));
    const cutin = {} as Record<CutinId, HTMLImageElement | null>;
    CUTIN_IDS.forEach((n, i) => (cutin[n] = cutins[i]));
    return { img, gonaSheet: gonaSheet!, v2, cutin, flash: new Map() };
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
