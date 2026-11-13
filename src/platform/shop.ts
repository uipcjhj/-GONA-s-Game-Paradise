import type { PlayerData } from './types';

/** 꾸미기 아이템. 모양은 임시(CSS 색 링/배경) — 최종 픽셀 에셋은 승인 후 교체. 능력치 아이템 없음 */
export type ItemKind = 'frame' | 'title' | 'background';
export interface ShopItem {
  id: string;
  kind: ItemKind;
  name: string;
  /** 0 = 상점 판매 아님(업적 보상 전용) */
  price: number;
  /** frame/background: CSS 색 값 */
  color?: string;
  color2?: string;
  desc?: string;
}
export const ITEMS: ShopItem[] = [
  { id: 'frame-gold', kind: 'frame', name: '금색 테두리', price: 0, color: '#ffc21a', desc: '기본 테두리' },
  { id: 'frame-mint', kind: 'frame', name: '민트 테두리', price: 40, color: '#4fd3b0' },
  { id: 'frame-berry', kind: 'frame', name: '딸기 테두리', price: 60, color: '#ff6f91' },
  { id: 'frame-sky', kind: 'frame', name: '하늘 테두리', price: 80, color: '#4aa3f0' },
  { id: 'frame-royal', kind: 'frame', name: '보라 테두리', price: 150, color: '#8a5cd0' },
  { id: 'bg-sky', kind: 'background', name: '하늘 배경', price: 0, color: '#cfeeff', color2: '#b7e3fb', desc: '기본 배경' },
  { id: 'bg-grass', kind: 'background', name: '풀밭 배경', price: 50, color: '#c9f0a6', color2: '#a6e07c' },
  { id: 'bg-sunset', kind: 'background', name: '노을 배경', price: 90, color: '#ffd8a8', color2: '#ffb88a' },
  { id: 'bg-night', kind: 'background', name: '밤하늘 배경', price: 120, color: '#5b6bb8', color2: '#46549c' },
  { id: 'title-newbie', kind: 'title', name: '새내기 탐험가', price: 20 },
  { id: 'title-snack', kind: 'title', name: '간식 수집가', price: 70 },
  { id: 'title-pro', kind: 'title', name: '게임천국 단골', price: 150 },
  // 업적 보상 전용(price 0 — 상점 진열 안 함)
  { id: 'title-clear', kind: 'title', name: '첫 클리어 영웅', price: 0 },
  { id: 'title-streak', kind: 'title', name: '꾸준한 고나', price: 0 },
  { id: 'title-mini', kind: 'title', name: '미니게임 달인', price: 0 },
  { id: 'title-master', kind: 'title', name: '게임천국 마스터', price: 0 },
];
export const DEFAULT_OWNED = ['frame-gold', 'bg-sky'];
export const getItem = (id: string): ShopItem | undefined => ITEMS.find((i) => i.id === id);
export const shopList = (): ShopItem[] => ITEMS.filter((i) => i.price > 0);

export type BuyResult = { ok: true; player: PlayerData } | { ok: false; error: 'unknown' | 'owned' | 'coins' | 'not-for-sale' };
/** 구매: 잔액이 모자라면 실패(음수 불가), 이미 가진 아이템은 중복 구매 불가 */
export function buyItem(p: PlayerData, id: string, now: Date): BuyResult {
  const it = getItem(id);
  if (!it) return { ok: false, error: 'unknown' };
  if (it.price <= 0) return { ok: false, error: 'not-for-sale' };
  if (p.inventory.owned.includes(id)) return { ok: false, error: 'owned' };
  if (p.coinBalance < it.price) return { ok: false, error: 'coins' };
  const at = now.toISOString();
  return {
    ok: true,
    player: {
      ...p,
      coinBalance: p.coinBalance - it.price,
      coinLog: [{ txId: `buy-${id}-${now.getTime()}`, delta: -it.price, reason: 'purchase' as const, at, refId: id }, ...p.coinLog].slice(0, 30),
      inventory: { ...p.inventory, owned: [...p.inventory.owned, id] },
      stats: { ...p.stats, purchases: (p.stats.purchases ?? 0) + 1 },
    },
  };
}
export function equipItem(p: PlayerData, id: string | null, kind: ItemKind): PlayerData | null {
  if (id !== null) {
    const it = getItem(id);
    if (!it || it.kind !== kind || !p.inventory.owned.includes(id)) return null;
  }
  const equipped = { ...p.inventory.equipped };
  if (id === null) delete equipped[kind];
  else equipped[kind] = id;
  return { ...p, inventory: { ...p.inventory, equipped } };
}
export function grantItem(p: PlayerData, id: string): PlayerData {
  if (!getItem(id) || p.inventory.owned.includes(id)) return p;
  return { ...p, inventory: { ...p.inventory, owned: [...p.inventory.owned, id] } };
}
