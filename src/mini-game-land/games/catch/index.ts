import type { MiniGameModule } from '../../core/types';
import { MAX_LEVEL, difficulty, timeLimitSec, type CatchParams } from './logic';

export const catchGame: MiniGameModule<CatchParams> = {
  id: 'catch',
  meta: {
    title: '고나의 간식 받아라!',
    shortTitle: '간식 받기',
    tagline: '떨어지는 간식은 받고, 매운 고추는 피해요',
    howTo: ['손가락을 좌우로 움직여 고나를 옮겨요', '간식은 받고 🌶 고추는 피해요', '놓치거나 고추를 받으면 실수 — 목표만큼 받으면 성공!'],
    maxLevel: MAX_LEVEL,
  },
  difficulty,
  timeLimitSec: (level) => timeLimitSec(level),
  load: () => import('./View'),
};
