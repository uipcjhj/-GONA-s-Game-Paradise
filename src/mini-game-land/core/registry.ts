import type { MiniGameModule } from './types';
import { tapTest } from '../games/tap-test';

/** 등록된 미니게임. 새 게임은 모듈 하나를 만들어 여기에 추가하면 자유 플레이·챌린지에 모두 나타남. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GAMES: MiniGameModule<any>[] = [tapTest];

export const getGame = (id: string) => GAMES.find((g) => g.id === id);
