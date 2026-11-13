import { SORT_SLOT_KEYS } from '../games/sort/slots';
import { TOWER_SLOT_KEYS } from '../games/tower/slots';
import { TOYROOM_SLOT_KEYS } from '../games/toyroom/slots';
import { UI_SLOT_KEYS, type ResolvedSkin, type Skin } from './types';

export type SkinLoader = () => Promise<{ default: Skin }>;

/** 사용 가능한 스킨. 최종 픽셀 스킨은 여기 한 줄만 추가하면 됩니다. */
export const SKIN_LOADERS: Record<string, SkinLoader> = {
  temp: () => import('./temp'),
  wireframe: () => import('./wireframe'),
};
export const DEFAULT_SKIN = 'temp';

/** 주소의 ?skin=id 로 점검용 선택. 없거나 모르는 값이면 기본 스킨 */
export function resolveSkinId(search: string, known: readonly string[] = Object.keys(SKIN_LOADERS)): string {
  const id = new URLSearchParams(search).get('skin');
  return id && known.includes(id) ? id : DEFAULT_SKIN;
}

/** 위에 얹은 스킨이 가진 슬롯만 덮어씀(나머지는 base 그대로) */
export function mergeSkin(base: ResolvedSkin | null, over: Skin): ResolvedSkin {
  return {
    id: over.id,
    name: over.name,
    temporary: over.temporary ?? base?.temporary ?? false,
    tokens: { ...(base?.tokens ?? {}), ...(over.tokens ?? {}) },
    ui: { ...(base?.ui ?? {}), ...(over.ui ?? {}) } as ResolvedSkin['ui'],
    sort: { ...(base?.sort ?? {}), ...(over.sort ?? {}) } as ResolvedSkin['sort'],
    tower: { ...(base?.tower ?? {}), ...(over.tower ?? {}) } as ResolvedSkin['tower'],
    toyroom: { ...(base?.toyroom ?? {}), ...(over.toyroom ?? {}) } as ResolvedSkin['toyroom'],
  };
}

/** 비어 있는 슬롯 이름(완성된 스킨이면 빈 배열) */
export function missingSlots(skin: ResolvedSkin): string[] {
  return [
    ...UI_SLOT_KEYS.filter((k) => !skin.ui[k]).map((k) => `ui.${k}`),
    ...SORT_SLOT_KEYS.filter((k) => !skin.sort[k]).map((k) => `sort.${k}`),
    ...TOWER_SLOT_KEYS.filter((k) => !skin.tower[k]).map((k) => `tower.${k}`),
    ...TOYROOM_SLOT_KEYS.filter((k) => !skin.toyroom[k]).map((k) => `toyroom.${k}`),
  ];
}

/** extends 체인을 따라 불러와 하나로 합침. 순환·미완성 스킨은 오류 */
export async function loadSkin(id: string, loaders: Record<string, SkinLoader> = SKIN_LOADERS, chain: string[] = []): Promise<ResolvedSkin> {
  if (chain.includes(id)) throw new Error(`스킨 순환 참조: ${[...chain, id].join(' → ')}`);
  const load = loaders[id];
  if (!load) throw new Error(`알 수 없는 스킨: ${id}`);
  const skin = (await load()).default;
  const base = skin.extends ? await loadSkin(skin.extends, loaders, [...chain, id]) : null;
  const merged = mergeSkin(base, skin);
  const missing = missingSlots(merged);
  if (missing.length) throw new Error(`스킨 '${id}' 에 빠진 슬롯: ${missing.join(', ')}`);
  return merged;
}
