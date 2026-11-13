import { useEffect, useState } from 'react';
import { CHALLENGE } from '../core/difficulty';
import type { RoundSummary } from '../core/engine';
import { GAMES, getGame } from '../core/registry';
import { roundScore } from '../core/scoring';
import {
  endChallenge,
  finishChallengeRound,
  planRound,
  roundsPlayed,
  startChallenge,
  type ChallengeState,
  type RoundPlan,
} from '../core/session';
import { recordChallenge } from '../core/storage';
import { Button, LivesBar, Panel } from '../skin/components';
import ResultScreen from '../ui/ResultScreen';
import Round from '../ui/Round';
import { audio, store } from '../services';

const INTRO_MS = 1400;
const SUMMARY_MS = 1800;

type Stage =
  | { kind: 'start' }
  | { kind: 'intro'; plan: RoundPlan }
  | { kind: 'play'; plan: RoundPlan }
  | { kind: 'summary'; outcome: 'clear' | 'fail'; total: number; lostLife: boolean; gainedLife: boolean }
  | { kind: 'over'; newBest: boolean; quit: boolean };

const refs = () => GAMES.map((g) => ({ id: g.id, maxLevel: g.meta.maxLevel }));

/** 랜덤 챌린지: 목숨 3(5연속 클리어마다 +1, 최대 5), 셔플백으로 게임 무작위 등장, 라운드마다 난이도 상승. */
export default function Challenge({ exit }: { exit: () => void }) {
  const [stage, setStage] = useState<Stage>({ kind: 'start' });
  const [st, setSt] = useState<ChallengeState | null>(null);

  const begin = () => {
    const s0 = startChallenge((Math.random() * 0xffffffff) >>> 0);
    const { state, plan } = planRound(s0, refs());
    setSt(state);
    setStage({ kind: 'intro', plan });
  };

  const advance = (state: ChallengeState) => {
    const { state: next, plan } = planRound(state, refs());
    setSt(next);
    setStage({ kind: 'intro', plan });
  };

  // 자동 진행 타이머 (언마운트·단계 변경 시 정리)
  useEffect(() => {
    if (stage.kind === 'intro') {
      const t = window.setTimeout(() => setStage({ kind: 'play', plan: stage.plan }), INTRO_MS);
      return () => window.clearTimeout(t);
    }
    if (stage.kind === 'summary' && st) {
      const t = window.setTimeout(() => advance(st), SUMMARY_MS);
      return () => window.clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const finishRun = (state: ChallengeState, quit: boolean) => {
    const rec = recordChallenge(store.get(), { score: state.score, rounds: roundsPlayed(state) });
    store.set(rec.save);
    setSt(state);
    setStage({ kind: 'over', newBest: rec.newBestScore, quit });
  };

  const onEnd = (plan: RoundPlan, s: RoundSummary) => {
    if (!st) return;
    if (s.reason === 'quit') return finishRun(endChallenge(st), true);
    const rs = roundScore({ mode: 'challenge', outcome: s.outcome, raw: s.raw, remainingMs: s.remainingMs, round: plan.round });
    const step = finishChallengeRound(st, s.outcome, rs.total);
    if (step.gainedLife) audio.play('lifeup');
    if (step.state.status === 'over') return finishRun(step.state, false);
    setSt(step.state);
    setStage({ kind: 'summary', outcome: s.outcome, total: rs.total, lostLife: step.lostLife, gainedLife: step.gainedLife });
  };

  if (stage.kind === 'start') {
    const best = store.get().challenge;
    return (
      <div className="mgl-screen" data-testid="challenge-start">
        <h2 className="mgl-h">랜덤 챌린지</h2>
        <Panel tone="card">
          <ol className="mgl-how">
            <li>여러 미니게임이 무작위로 나와요</li>
            <li>성공하면 점수, 실패하면 목숨 −1</li>
            <li>목숨은 {CHALLENGE.startLives}개 · {CHALLENGE.lifeEvery}연속 성공마다 +1 (최대 {CHALLENGE.maxLives})</li>
            <li>라운드가 갈수록 어려워져요</li>
          </ol>
        </Panel>
        <p className="mgl-sub mgl-center-text">
          최고 {best.bestScore.toLocaleString('en-US')}점 · {best.bestRound}라운드
        </p>
        <div className="mgl-actions">
          <Button variant="primary" size="lg" data-testid="start" onClick={begin}>
            도전 시작!
          </Button>
          <Button onClick={exit}>돌아가기</Button>
        </div>
      </div>
    );
  }

  if (stage.kind === 'intro' && st) {
    const g = getGame(stage.plan.gameId)!;
    return (
      <button type="button" className="mgl-screen mgl-intro" data-testid="intro" onClick={() => setStage({ kind: 'play', plan: stage.plan })}>
        <div className="mgl-intro-round">ROUND {stage.plan.round}</div>
        <div className="mgl-intro-title">{g.meta.title}</div>
        <div className="mgl-sub">LV {stage.plan.level}</div>
        <LivesBar lives={st.lives} max={CHALLENGE.maxLives} />
        <div className="mgl-sub">탭하면 바로 시작</div>
      </button>
    );
  }

  if (stage.kind === 'play' && st) {
    const g = getGame(stage.plan.gameId)!;
    return (
      <Round
        key={stage.plan.round}
        game={g}
        level={stage.plan.level}
        seed={stage.plan.seed}
        mode="challenge"
        timeScale={stage.plan.timeScale}
        hud={{ label: `ROUND ${stage.plan.round} · ${g.meta.shortTitle ?? g.meta.title}`, lives: st.lives, maxLives: CHALLENGE.maxLives, baseScore: st.score }}
        onEnd={(s) => onEnd(stage.plan, s)}
      />
    );
  }

  if (stage.kind === 'summary' && st) {
    return (
      <button type="button" className="mgl-screen mgl-intro" data-testid="summary" onClick={() => advance(st)}>
        <div className={`mgl-intro-round ${stage.outcome}`}>{stage.outcome === 'clear' ? `CLEAR  +${stage.total}` : 'MISS  목숨 −1'}</div>
        {stage.gainedLife && <div className="mgl-badge">목숨 +1!</div>}
        <LivesBar lives={st.lives} max={CHALLENGE.maxLives} />
        <div className="mgl-sub">
          누적 {st.score.toLocaleString('en-US')}점 · {st.streak}연속 성공
          {st.streak > 0 && ` (다음 목숨까지 ${CHALLENGE.lifeEvery - (st.streak % CHALLENGE.lifeEvery)})`}
        </div>
      </button>
    );
  }

  if (stage.kind === 'over' && st) {
    const best = store.get().challenge;
    return (
      <ResultScreen
        heading={stage.quit ? 'CHALLENGE END' : 'GAME OVER'}
        tone="fail"
        badges={stage.newBest ? ['NEW RECORD! 최고 점수'] : []}
        lines={[
          { label: '도달 라운드', value: `${roundsPlayed(st)}` },
          { label: '클리어', value: `${st.clears}회` },
          { label: '점수', value: `${st.score.toLocaleString('en-US')}점`, strong: true },
          { label: '최고 점수', value: `${best.bestScore.toLocaleString('en-US')}점` },
        ]}
        actions={[
          { label: '다시 도전', primary: true, testId: 'again', onClick: begin },
          { label: '메뉴', testId: 'menu', onClick: exit },
        ]}
      />
    );
  }
  return null;
}
