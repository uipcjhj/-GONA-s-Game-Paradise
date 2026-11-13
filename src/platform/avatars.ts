/**
 * 아바타 = GONA's Food Adventure 에 실제로 존재하는 캐릭터의 원본 에셋(머리~어깨 크롭, 128×128 PNG).
 * 임시·신규 그림은 넣지 않음. 승인 대기 후보(뽀뽀괴물 등)는 art-src/avatars/candidates/ 에만 있고 여기엔 등록하지 않음.
 */
export interface AvatarDef {
  id: string;
  name: string;
  group: 'hero' | 'family';
  desc: string;
  src: string;
  /** 'free' = 처음부터 선택 가능 · 이후 업적/미션 해금형은 'unlock' (Phase 1 에는 없음) */
  unlock: 'free' | 'unlock';
}

const dir = './assets/avatars/';
export const AVATARS: AvatarDef[] = [
  { id: 'gona', name: '고나', group: 'hero', desc: '게임천국의 아기 공룡 주인공', src: `${dir}gona.png`, unlock: 'free' },
  { id: 'mom', name: '엄마', group: 'family', desc: '고나의 가족', src: `${dir}mom.png`, unlock: 'free' },
  { id: 'dad', name: '아빠', group: 'family', desc: '고나의 가족', src: `${dir}dad.png`, unlock: 'free' },
  { id: 'imo', name: '이모', group: 'family', desc: '고나의 가족', src: `${dir}imo.png`, unlock: 'free' },
  { id: 'halmeoni', name: '할머니', group: 'family', desc: '고나의 가족', src: `${dir}halmeoni.png`, unlock: 'free' },
  { id: 'halabeoji', name: '할아버지', group: 'family', desc: '고나의 가족', src: `${dir}halabeoji.png`, unlock: 'free' },
  { id: 'samchon', name: '삼촌', group: 'family', desc: '고나의 가족', src: `${dir}samchon.png`, unlock: 'free' },
];
export const DEFAULT_AVATAR_ID = 'gona';

export function getAvatar(id: string): AvatarDef {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0];
}
export function isKnownAvatar(id: string): boolean {
  return AVATARS.some((a) => a.id === id);
}
/** 해금 구조: free 는 항상 가능, unlock 형은 player.unlockedAvatarIds 에 있어야 함 */
export function isAvatarAvailable(a: AvatarDef, unlockedIds: readonly string[]): boolean {
  return a.unlock === 'free' || unlockedIds.includes(a.id);
}
