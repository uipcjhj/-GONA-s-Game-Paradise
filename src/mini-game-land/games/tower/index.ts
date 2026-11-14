import type { MiniGameModule } from '../../core/types';
import { MAX_LEVEL, difficulty, timeLimitSec, type TowerParams } from './logic';

export const tower: MiniGameModule<TowerParams> = {
  id: 'tower',
  meta: {
    title: '고나의 아슬아슬 탑',
    shortTitle: '아슬아슬 탑',
    tagline: '간식을 균형 있게 쌓아 깃발까지!',
    howTo: [
      '화면을 밀어 간식을 옮기고, 손을 떼면 툭! 떨어져요',
      '⟳ 버튼(또는 다른 손가락 탭)으로 돌려서 평평한 면을 아래로',
      '⇄ 교환으로 까다로운 간식을 피할 수 있어요',
      '깃발 높이에서 1초 버티면 성공 · 많이 떨어뜨리면 실패',
    ],
    maxLevel: MAX_LEVEL,
  },
  difficulty,
  timeLimitSec: (level) => timeLimitSec(level),
  load: () => import('./View'),
};
