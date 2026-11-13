/** 자유 플레이 · 랜덤 챌린지 세션 상태 (순수 리듀서 — UI 와 무관, 단위 테스트 대상) */
import { CHALLENGE, challengeLevel, challengeTimeScale, overflowTimeScale } from './difficulty';
import { mixSeed, mulberry32, shuffle } from './rng';
import type { Outcome } from './types';

// ───────────────────────── 랜덤 챌린지
export interface GameRef {
  id: string;
  maxLevel: number;
}

export interface RoundPlan {
  round: number;
  gameId: string;
  level: number;
  seed: number;
  /** 챌린지 라운드 압축 × maxLevel 초과 압축 */
  timeScale: number;
}

export interface ChallengeState {
  status: 'playing' | 'over';
  seed: number;
  /** 다음에 치를(또는 치르는 중인) 라운드 번호, 1부터 */
  round: number;
  lives: number;
  /** 연속 클리어 수 */
  streak: number;
  score: number;
  clears: number;
  bag: string[];
  lastGameId: string | null;
  current: RoundPlan | null;
}

export const startChallenge = (seed: number): ChallengeState => ({
  status: 'playing',
  seed: seed >>> 0,
  round: 1,
  lives: CHALLENGE.startLives,
  streak: 0,
  score: 0,
  clears: 0,
  bag: [],
  lastGameId: null,
  current: null,
});

/**
 * 셔플백: 게임을 한 번씩 섞어 소진 + 직전과 같은 게임 연속 금지(게임이 2개 이상일 때).
 * 첫 N라운드에 모든 게임을 체험.
 */
export function planRound(state: ChallengeState, games: readonly GameRef[]): { state: ChallengeState; plan: RoundPlan } {
  if (games.length === 0) throw new Error('등록된 미니게임이 없습니다');
  const byId = new Map(games.map((g) => [g.id, g]));
  let bag = state.bag.filter((id) => byId.has(id));
  if (bag.length === 0) {
    bag = shuffle(
      games.map((g) => g.id),
      mulberry32(mixSeed(state.seed, state.round)),
    );
    if (bag.length > 1 && bag[0] === state.lastGameId) {
      // 직전 게임이 맨 앞이면 뒤쪽과 자리 교체
      [bag[0], bag[1]] = [bag[1], bag[0]];
    }
  }
  const [gameId, ...rest] = bag;
  const game = byId.get(gameId)!;
  const level = challengeLevel(state.round);
  const plan: RoundPlan = {
    round: state.round,
    gameId,
    level,
    seed: mixSeed(state.seed, state.round * 7919 + 1),
    timeScale: challengeTimeScale(state.round) * overflowTimeScale(level, game.maxLevel),
  };
  return { state: { ...state, bag: rest, lastGameId: gameId, current: plan }, plan };
}

export interface ChallengeStep {
  state: ChallengeState;
  lostLife: boolean;
  gainedLife: boolean;
}

/** 라운드 결과 반영. 성공: 점수·연속 +1(5연속마다 목숨 +1, 최대 5). 실패: 목숨 −1·연속 0. */
export function finishChallengeRound(state: ChallengeState, outcome: Outcome, roundTotal: number): ChallengeStep {
  const base = { ...state, round: state.round + 1, current: null };
  if (outcome === 'clear') {
    const streak = state.streak + 1;
    const earns = streak % CHALLENGE.lifeEvery === 0 && state.lives < CHALLENGE.maxLives;
    return {
      state: {
        ...base,
        streak,
        clears: state.clears + 1,
        score: state.score + Math.max(0, roundTotal),
        lives: earns ? state.lives + 1 : state.lives,
      },
      lostLife: false,
      gainedLife: earns,
    };
  }
  const lives = Math.max(0, state.lives - 1);
  return {
    state: { ...base, streak: 0, lives, status: lives === 0 ? 'over' : 'playing' },
    lostLife: true,
    gainedLife: false,
  };
}

/** 중도 종료(나가기): 현재 점수로 종료 */
export const endChallenge = (state: ChallengeState): ChallengeState => ({ ...state, status: 'over', current: null });

/** 지금까지 끝낸 라운드 수 */
export const roundsPlayed = (s: ChallengeState) => s.round - 1;

// ───────────────────────── 자유 플레이
export interface FreeState {
  gameId: string;
  level: number;
  startLevel: number;
  /** 이번 런에서 쌓은 점수 */
  runScore: number;
  clears: number;
  status: 'playing' | 'failed';
}

export const startFree = (gameId: string, level = 1): FreeState => ({
  gameId,
  level: Math.max(1, Math.floor(level)),
  startLevel: Math.max(1, Math.floor(level)),
  runScore: 0,
  clears: 0,
  status: 'playing',
});

/** 클리어 → 다음 레벨(목숨 없음). 실패 → 런 종료(결과 화면에서 재도전 선택). */
export function finishFreeRound(state: FreeState, outcome: Outcome, roundTotal: number): FreeState {
  const runScore = state.runScore + Math.max(0, roundTotal);
  if (outcome === 'clear') return { ...state, runScore, clears: state.clears + 1, level: state.level + 1, status: 'playing' };
  return { ...state, runScore, status: 'failed' };
}
