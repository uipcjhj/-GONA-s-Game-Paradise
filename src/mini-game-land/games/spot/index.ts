import type { MiniGameModule } from '../../core/types';
import { MAX_LEVEL, difficulty, timeLimitSec, type SpotParams } from './logic';

export const spotGame: MiniGameModule<SpotParams> = {
  id: 'spot',
  meta: {
    title: '고나의 가짜 친구 찾기',
    shortTitle: '가짜 찾기',
    tagline: '똑같은 친구들 사이 딱 하나 다른 가짜를 찾아요',
    howTo: ['한 명만 어딘가 달라요 — 그 친구를 탭!', '색·소품·표정·방향 중 한 곳이 달라요', '잘못 누르면 실수, 빨리 찾으면 보너스!'],
    maxLevel: MAX_LEVEL,
  },
  difficulty,
  timeLimitSec: (level) => timeLimitSec(level),
  load: () => import('./View'),
};
