import type { MiniGameModule } from '../../core/types';
import { MAX_LEVEL, difficulty, timeLimitSec, type SortParams } from './logic';

export const sort: MiniGameModule<SortParams> = {
  id: 'sort',
  meta: {
    title: '고나의 편가르기 대소동',
    shortTitle: '편가르기 대소동',
    tagline: '색·표정·특징을 보고 빠르게 편을 갈라요',
    howTo: [
      '규칙에 맞게 친구를 알맞은 분류함으로 보내요',
      '카드를 밀거나(스와이프) 아래 분류함을 눌러요',
      '틀리면 이유를 알려줘요 · 실수 3번이면 실패',
      '갈수록 복합 조건 · 제외 · 3분류 · 규칙 반전이 나와요',
    ],
    maxLevel: MAX_LEVEL,
  },
  difficulty,
  timeLimitSec: (level) => timeLimitSec(level),
  load: () => import('./View'),
};
