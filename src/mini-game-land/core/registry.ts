import type { MiniGameModule } from './types';
import { sort } from '../games/sort';
import { tapTest } from '../games/tap-test';

/** 만들어 둔 모든 미니게임. 새 게임은 모듈 하나를 만들어 여기에 추가하면 자유 플레이·챌린지에 모두 나타남. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ALL_GAMES: MiniGameModule<any>[] = [sort, tapTest];

/**
 * 화면에 내보낼 게임 선택.
 * 기본: 개발용 임시 게임(temporary)은 숨김. 점검용으로 `?games=id1,id2` 를 주면 그 게임들만 사용.
 */
export function selectGames<T extends { id: string; meta: { temporary?: boolean } }>(all: readonly T[], search: string): T[] {
  const wanted = new URLSearchParams(search).get('games');
  if (wanted) {
    const ids = wanted.split(',').map((s) => s.trim()).filter(Boolean);
    const picked = all.filter((g) => ids.includes(g.id));
    if (picked.length) return picked;
  }
  return all.filter((g) => !g.meta.temporary);
}

export const GAMES = selectGames(ALL_GAMES, typeof location !== 'undefined' ? location.search : '');

export const getGame = (id: string) => GAMES.find((g) => g.id === id);
