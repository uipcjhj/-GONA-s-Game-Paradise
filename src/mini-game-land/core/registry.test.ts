import { describe, expect, it } from 'vitest';
import { ALL_GAMES, selectGames } from './registry';
import { challengeLevel } from './difficulty';
import { finishChallengeRound, planRound, startChallenge } from './session';

describe('게임 레지스트리 (두 모드가 공유)', () => {
  it('id 는 고유, 메타·난이도·제한시간·로더가 모두 있음', () => {
    expect(new Set(ALL_GAMES.map((g) => g.id)).size).toBe(ALL_GAMES.length);
    for (const g of ALL_GAMES) {
      expect(g.meta.title.length).toBeGreaterThan(0);
      expect(g.meta.howTo.length).toBeGreaterThan(0);
      expect(typeof g.load).toBe('function');
      for (let l = 1; l <= g.meta.maxLevel + 3; l++) {
        expect(g.difficulty(l)).toBeTruthy();
        for (const mode of ['free', 'challenge'] as const) {
          const t = g.timeLimitSec(l, mode);
          expect(t === null || t > 0).toBe(true);
        }
      }
    }
  });
  it('기본 목록은 임시(개발용) 게임을 숨기고 편가르기를 포함', () => {
    const ids = selectGames(ALL_GAMES, '').map((g) => g.id);
    expect(ids).toContain('sort');
    expect(ids).toContain('tower');
    expect(ids).toContain('toyroom');
    expect(ids).not.toContain('tap-test');
  });
  it('?games= 로 점검용 선택, 알 수 없는 값은 기본으로', () => {
    expect(selectGames(ALL_GAMES, '?games=tap-test').map((g) => g.id)).toEqual(['tap-test']);
    expect(selectGames(ALL_GAMES, '?games=sort,tap-test').map((g) => g.id).sort()).toEqual(['sort', 'tap-test']);
    expect(selectGames(ALL_GAMES, '?games=nope').map((g) => g.id)).toContain('sort');
  });
  it('챌린지가 편가르기를 뽑고 레벨·제한시간 배율을 모듈 규격대로 계산', () => {
    const sort = ALL_GAMES.find((g) => g.id === 'sort')!;
    let s = startChallenge(9);
    for (let r = 1; r <= 12; r++) {
      const { state, plan } = planRound(s, [{ id: sort.id, maxLevel: sort.meta.maxLevel }]);
      expect(plan.gameId).toBe('sort');
      expect(plan.level).toBe(challengeLevel(r));
      s = finishChallengeRound(state, 'clear', 1).state;
    }
  });
});
