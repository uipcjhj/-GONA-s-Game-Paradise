import type { MiniGameModule } from '../../core/types';
import { MAX_LEVEL, difficulty, timeLimitSec, type TapParams } from './logic';

export const tapTest: MiniGameModule<TapParams> = {
  id: 'tap-test',
  meta: {
    title: '고나 콕콕',
    tagline: '공통 시스템 점검용 임시 게임',
    howTo: ['나타나는 고나를 콕! 눌러요', '빨간 상자는 누르면 안 돼요 (실수)', '실수 3번이면 실패, 시간 안에 목표를 채우면 성공!'],
    maxLevel: MAX_LEVEL,
    temporary: true,
  },
  difficulty,
  timeLimitSec: (level) => timeLimitSec(level),
  load: () => import('./View'),
};
