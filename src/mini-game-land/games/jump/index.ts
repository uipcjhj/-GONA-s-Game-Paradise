import type { MiniGameModule } from '../../core/types';
import { MAX_LEVEL, difficulty, timeLimitSec, type JumpParams } from './logic';

export const jumpGame: MiniGameModule<JumpParams> = {
  id: 'jump',
  meta: {
    title: '고나의 폴짝폴짝 줄넘기',
    shortTitle: '줄넘기',
    tagline: '줄이 발밑에 올 때 탭! 한 번에 폴짝',
    howTo: ['화면 어디든 탭하면 폴짝 뛰어요', '줄이 발밑을 지날 때 공중에 있으면 성공', '박자가 바뀌면 화면에 알려줘요 — 걸리면 실수!'],
    maxLevel: MAX_LEVEL,
  },
  difficulty,
  timeLimitSec: (level) => timeLimitSec(level),
  load: () => import('./View'),
};
