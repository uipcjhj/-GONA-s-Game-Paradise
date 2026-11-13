import type { MiniGameModule } from '../../core/types';
import { MAX_LEVEL, difficulty, timeLimitSec, type ToyParams } from './logic';

export const toyroom: MiniGameModule<ToyParams> = {
  id: 'toyroom',
  meta: {
    title: '고나의 엉망진창 장난감방',
    shortTitle: '장난감방',
    tagline: '정해진 이동 안에 장난감을 모아 정리해요',
    howTo: [
      '장난감을 탭하고, 옮길 선반을 탭해요 (이동 1번)',
      '같은 종류 3개가 붙으면 정리! 가운데를 빼도 양옆이 붙어요',
      '★은 아무 종류, 🔒 칸은 세트를 정리하면 열려요',
      '이동 횟수가 다 되기 전에 전부 정리하면 성공!',
    ],
    maxLevel: MAX_LEVEL,
  },
  difficulty,
  timeLimitSec: (level, mode) => timeLimitSec(level, mode),
  load: () => import('./View'),
};
