import { describe, expect, it } from 'vitest';
import { CHALLENGE } from './difficulty';
import { endChallenge, finishChallengeRound, finishFreeRound, planRound, roundsPlayed, startChallenge, startFree } from './session';

const GAMES = [
  { id: 'a', maxLevel: 10 },
  { id: 'b', maxLevel: 10 },
  { id: 'c', maxLevel: 10 },
];

describe('랜덤 챌린지 세션', () => {
  it('목숨 3개로 시작', () => {
    const s = startChallenge(1);
    expect(s.lives).toBe(3);
    expect(s.status).toBe('playing');
  });

  it('셔플백: 첫 3라운드에 3종 모두 등장, 같은 게임 연속 없음', () => {
    for (let seed = 0; seed < 50; seed++) {
      let s = startChallenge(seed);
      const ids: string[] = [];
      for (let r = 0; r < 30; r++) {
        const { state, plan } = planRound(s, GAMES);
        ids.push(plan.gameId);
        s = finishChallengeRound(state, 'clear', 10).state;
      }
      expect(new Set(ids.slice(0, 3)).size).toBe(3);
      for (let i = 1; i < ids.length; i++) expect(ids[i]).not.toBe(ids[i - 1]);
    }
  });

  it('게임이 1종뿐이어도 동작(연속 허용)', () => {
    let s = startChallenge(5);
    for (let r = 0; r < 5; r++) {
      const { state, plan } = planRound(s, [{ id: 'only', maxLevel: 10 }]);
      expect(plan.gameId).toBe('only');
      s = finishChallengeRound(state, 'clear', 1).state;
    }
  });

  it('같은 시드 → 같은 출제(재현 가능)', () => {
    const run = (seed: number) => {
      let s = startChallenge(seed);
      return Array.from({ length: 9 }, () => {
        const { state, plan } = planRound(s, GAMES);
        s = finishChallengeRound(state, 'clear', 1).state;
        return `${plan.gameId}:${plan.level}:${plan.seed}`;
      });
    };
    expect(run(99)).toEqual(run(99));
  });

  it('난이도: 라운드가 오를수록 레벨 상승·시간 압축', () => {
    let s = startChallenge(3);
    const levels: number[] = [];
    const scales: number[] = [];
    for (let r = 0; r < 12; r++) {
      const { state, plan } = planRound(s, GAMES);
      levels.push(plan.level);
      scales.push(plan.timeScale);
      s = finishChallengeRound(state, 'clear', 1).state;
    }
    expect(levels[0]).toBe(1);
    expect(levels[11]).toBe(6);
    for (let i = 1; i < 12; i++) {
      expect(levels[i]).toBeGreaterThanOrEqual(levels[i - 1]);
      expect(scales[i]).toBeLessThanOrEqual(scales[i - 1]);
    }
  });

  it('성공: 점수 누적·연속 증가 / 실패: 목숨 −1·연속 0·점수 불변', () => {
    let s = startChallenge(1);
    s = finishChallengeRound(s, 'clear', 120).state;
    s = finishChallengeRound(s, 'clear', 80).state;
    expect(s).toMatchObject({ score: 200, streak: 2, clears: 2, lives: 3, round: 3 });
    const f = finishChallengeRound(s, 'fail', 0);
    expect(f.lostLife).toBe(true);
    expect(f.state).toMatchObject({ score: 200, streak: 0, lives: 2, status: 'playing' });
  });

  it('5연속 클리어마다 목숨 +1, 최대 5', () => {
    let s = startChallenge(1);
    let gained = 0;
    for (let i = 1; i <= 5; i++) {
      const step = finishChallengeRound(s, 'clear', 1);
      s = step.state;
      if (step.gainedLife) gained++;
      expect(s.lives).toBe(i < 5 ? 3 : 4);
    }
    expect(gained).toBe(1);
    for (let i = 6; i <= 10; i++) s = finishChallengeRound(s, 'clear', 1).state;
    expect(s.lives).toBe(5);
    for (let i = 11; i <= 30; i++) s = finishChallengeRound(s, 'clear', 1).state;
    expect(s.lives).toBe(CHALLENGE.maxLives);
    // 최대일 때는 보너스 없음
    expect(finishChallengeRound({ ...s, streak: 4 }, 'clear', 1).gainedLife).toBe(false);
  });

  it('실패로 연속이 끊기면 5연속 카운트를 처음부터', () => {
    let s = startChallenge(1);
    for (let i = 0; i < 4; i++) s = finishChallengeRound(s, 'clear', 1).state;
    s = finishChallengeRound(s, 'fail', 0).state;
    for (let i = 0; i < 4; i++) s = finishChallengeRound(s, 'clear', 1).state;
    expect(s.lives).toBe(2); // 4연속에서는 보너스 없음
  });

  it('목숨 0 → 게임 오버, 끝낸 라운드 수 계산', () => {
    let s = startChallenge(1);
    s = finishChallengeRound(s, 'clear', 50).state;
    s = finishChallengeRound(s, 'fail', 0).state;
    s = finishChallengeRound(s, 'fail', 0).state;
    const last = finishChallengeRound(s, 'fail', 0).state;
    expect(last.lives).toBe(0);
    expect(last.status).toBe('over');
    expect(roundsPlayed(last)).toBe(4);
    expect(last.score).toBe(50);
  });

  it('중도 종료', () => {
    expect(endChallenge(startChallenge(1)).status).toBe('over');
  });
});

describe('자유 플레이 세션', () => {
  it('클리어하면 다음 레벨(목숨 없음), 점수 누적', () => {
    let s = startFree('a', 1);
    s = finishFreeRound(s, 'clear', 100);
    s = finishFreeRound(s, 'clear', 150);
    expect(s).toMatchObject({ level: 3, runScore: 250, clears: 2, status: 'playing' });
  });
  it('실패하면 런 종료(같은 레벨 유지)·그때까지 점수 인정', () => {
    const s = finishFreeRound(startFree('a', 4), 'fail', 70);
    expect(s).toMatchObject({ level: 4, runScore: 70, status: 'failed' });
  });
  it('시작 레벨 하한 1', () => {
    expect(startFree('a', 0).level).toBe(1);
  });
});
