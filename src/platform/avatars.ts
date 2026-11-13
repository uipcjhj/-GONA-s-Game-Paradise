/**
 * 아바타 = GONA's Food Adventure 에 실제로 존재하는 캐릭터. 가족 7종은 원본 에셋(머리~어깨 크롭, 128×128 PNG)을 쓴다.
 * 몬스터·보스 4종은 **정식 PNG 가 아직 없어서 `asset: 'pending'`** — 선택 화면에는 이름·해금 조건만 잠금 카드로 보이고
 * Food 의 임시 도트는 운영 화면에 절대 쓰지 않는다. 정식 이미지가 준비되면 PNG 두 장(`<id>.png` 128×128, `<id>-s.png` 64×64)을
 * public/assets/avatars/ 에 넣고 아래 `asset` 만 'ready' 로 바꾸면 해금된 플레이어부터 선택할 수 있다(docs/platform/AVATAR_ASSET_SPEC.md).
 */
export type AvatarUnlock = { kind: 'free' } | { kind: 'achievement'; id: string } | { kind: 'level'; level: number };

export interface AvatarDef {
  id: string;
  name: string;
  group: 'hero' | 'family' | 'boss' | 'monster';
  desc: string;
  src: string;
  /** ready = 정식 PNG 있음 · pending = 제작 전(운영 화면에 그림을 보이지 않음) */
  asset: 'ready' | 'pending';
  unlock: AvatarUnlock;
  /** 잠금 카드에 보여줄 해금 조건 문구 */
  hint?: string;
}

const dir = './assets/avatars/';
export const AVATARS: AvatarDef[] = [
  { id: 'gona', name: '고나', group: 'hero', desc: '게임천국의 아기 공룡 주인공', src: `${dir}gona.png`, asset: 'ready', unlock: { kind: 'free' } },
  { id: 'mom', name: '엄마', group: 'family', desc: '고나의 가족', src: `${dir}mom.png`, asset: 'ready', unlock: { kind: 'free' } },
  { id: 'dad', name: '아빠', group: 'family', desc: '고나의 가족', src: `${dir}dad.png`, asset: 'ready', unlock: { kind: 'free' } },
  { id: 'imo', name: '이모', group: 'family', desc: '고나의 가족', src: `${dir}imo.png`, asset: 'ready', unlock: { kind: 'free' } },
  { id: 'halmeoni', name: '할머니', group: 'family', desc: '고나의 가족', src: `${dir}halmeoni.png`, asset: 'ready', unlock: { kind: 'free' } },
  { id: 'halabeoji', name: '할아버지', group: 'family', desc: '고나의 가족', src: `${dir}halabeoji.png`, asset: 'ready', unlock: { kind: 'free' } },
  { id: 'samchon', name: '삼촌', group: 'family', desc: '고나의 가족', src: `${dir}samchon.png`, asset: 'ready', unlock: { kind: 'free' } },
  // ── 해금형(정식 에셋 제작 전) ──
  { id: 'kiss', name: '뽀뽀괴물', group: 'boss', desc: '쪽쪽 뽀뽀로 괴롭히던 첫 번째 보스', src: `${dir}kiss.png`, asset: 'pending', unlock: { kind: 'achievement', id: 'food_stage_3' }, hint: '업적 「두 발로 걷다」(Food 성장 3단계)' },
  { id: 'sniff', name: '킁카괴물', group: 'boss', desc: '킁킁 냄새를 맡던 최종 보스', src: `${dir}sniff.png`, asset: 'pending', unlock: { kind: 'achievement', id: 'first_clear' }, hint: '업적 「첫 클리어」' },
  { id: 'glasses', name: '화학과안경잽이', group: 'monster', desc: '큰 안경이 번쩍이는 보라색 몬스터', src: `${dir}glasses.png`, asset: 'pending', unlock: { kind: 'achievement', id: 'plays_10' }, hint: '업적 「단골 모험가」(누적 플레이 10회)' },
  { id: 'farter', name: '방구할배', group: 'monster', desc: '뒤뚱뒤뚱 걷는 배불뚝이 할아버지 몬스터', src: `${dir}farter.png`, asset: 'pending', unlock: { kind: 'achievement', id: 'food_score_5000' }, hint: '업적 「간식 사냥꾼」(Food 5,000점)' },
];
export const DEFAULT_AVATAR_ID = 'gona';

export function getAvatar(id: string): AvatarDef {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0];
}
export function isKnownAvatar(id: string): boolean {
  return AVATARS.some((a) => a.id === id);
}
/** 해금 조건이 지금 충족됐는가(업적/레벨). 영구 해금은 unlockedAvatarIds 에 저장 */
export function unlockConditionMet(a: AvatarDef, p: { achievements: Record<string, unknown>; playerLevel: number }): boolean {
  if (a.unlock.kind === 'free') return true;
  if (a.unlock.kind === 'achievement') return !!p.achievements[a.unlock.id];
  return p.playerLevel >= a.unlock.level;
}
/** 해금됨(잠금 아님): free 이거나, 영구 해금 목록에 있거나, 조건이 지금 충족 */
export function isAvatarUnlocked(a: AvatarDef, p: { achievements: Record<string, unknown>; playerLevel: number; unlockedAvatarIds: readonly string[] }): boolean {
  return a.unlock.kind === 'free' || p.unlockedAvatarIds.includes(a.id) || unlockConditionMet(a, p);
}
/** 선택 가능: 정식 에셋이 준비됐고(ready) 해금된 아바타만 */
export function canUseAvatar(id: string, p: { achievements: Record<string, unknown>; playerLevel: number; unlockedAvatarIds: readonly string[] }): boolean {
  const a = AVATARS.find((x) => x.id === id);
  return !!a && a.asset === 'ready' && isAvatarUnlocked(a, p);
}
/** (호환) 이전 API: 무료(free)는 항상, 그 밖은 영구 해금 목록 기준 */
export function isAvatarAvailable(a: AvatarDef, unlockedIds: readonly string[]): boolean {
  return a.unlock.kind === 'free' || unlockedIds.includes(a.id);
}
