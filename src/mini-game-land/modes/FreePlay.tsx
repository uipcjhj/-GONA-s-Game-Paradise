import { useState } from 'react';
import { overflowTimeScale } from '../core/difficulty';
import type { RoundSummary } from '../core/engine';
import { GAMES } from '../core/registry';
import { mixSeed } from '../core/rng';
import { roundScore } from '../core/scoring';
import { finishFreeRound, startFree, type FreeState } from '../core/session';
import { gameRecord, recordFreeRound } from '../core/storage';
import type { MiniGameModule } from '../core/types';
import ResultScreen from '../ui/ResultScreen';
import Round from '../ui/Round';
import { store } from '../services';

type Stage =
  | { kind: 'select' }
  | { kind: 'prepare'; game: MiniGameModule<any> } // eslint-disable-line @typescript-eslint/no-explicit-any
  | { kind: 'play'; seed: number }
  | { kind: 'result'; summary: RoundSummary; total: number; bonus: number; newScore: boolean; newLevel: boolean; clearedLevel: number };

const newRunSeed = () => (Math.random() * 0xffffffff) >>> 0;

/** 자유 플레이: 게임 선택 → 시작 레벨 → 클리어하면 다음 레벨 → 실패하면 재도전 선택. 목숨 없음. */
export default function FreePlay({ exit }: { exit: () => void }) {
  const [stage, setStage] = useState<Stage>({ kind: 'select' });
  const [free, setFree] = useState<FreeState | null>(null);
  const [pickLevel, setPickLevel] = useState(1);
  const [runSeed, setRunSeed] = useState(newRunSeed);
  const game = free ? GAMES.find((g) => g.id === free.gameId) : undefined;

  const begin = (g: MiniGameModule<any>, level: number) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const seed = newRunSeed();
    setRunSeed(seed);
    setFree(startFree(g.id, level));
    setStage({ kind: 'play', seed });
  };

  const onEnd = (s: RoundSummary) => {
    if (!free || !game) return;
    const rs = roundScore({ mode: 'free', outcome: s.outcome, raw: s.raw, remainingMs: s.remainingMs });
    const next = finishFreeRound(free, s.outcome, rs.total);
    const rec = recordFreeRound(store.get(), free.gameId, { level: free.level, cleared: s.outcome === 'clear', runScore: next.runScore });
    store.set(rec.save);
    setFree(next);
    if (s.reason === 'quit') return setStage({ kind: 'select' });
    setStage({ kind: 'result', summary: s, total: rs.total, bonus: rs.timeBonus, newScore: rec.newBestScore, newLevel: !!rec.newBestLevel, clearedLevel: free.level });
  };

  if (stage.kind === 'select') {
    return (
      <div className="mgl-screen" data-testid="free-select">
        <h2 className="mgl-h">자유 플레이</h2>
        <div className="mgl-list">
          {GAMES.map((g) => {
            const r = gameRecord(store.get(), g.id);
            return (
              <button
                key={g.id}
                type="button"
                className="mgl-card mgl-card-btn"
                data-testid={`pick-${g.id}`}
                onClick={() => {
                  setPickLevel(1);
                  setStage({ kind: 'prepare', game: g });
                }}
              >
                <h3>
                  {g.meta.title}
                  {g.meta.temporary && <em className="mgl-temp">임시</em>}
                </h3>
                <p>{g.meta.tagline}</p>
                <p className="mgl-sub">
                  최고 {r.bestScore.toLocaleString('en-US')}점 · 클리어 LV {r.bestLevel}
                </p>
              </button>
            );
          })}
        </div>
        <div className="mgl-actions">
          <button type="button" className="mgl-btn" onClick={exit}>
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  if (stage.kind === 'prepare') {
    const g = stage.game;
    const unlocked = gameRecord(store.get(), g.id).bestLevel + 1;
    const lvl = Math.min(pickLevel, unlocked);
    return (
      <div className="mgl-screen" data-testid="free-prepare">
        <h2 className="mgl-h">{g.meta.title}</h2>
        <section className="mgl-card">
          <h3>하는 방법</h3>
          <ol className="mgl-how">
            {g.meta.howTo.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
        </section>
        <div className="mgl-stepper" data-testid="stepper">
          <button type="button" className="mgl-btn mgl-icon-btn" aria-label="레벨 내리기" disabled={lvl <= 1} onClick={() => setPickLevel(lvl - 1)}>
            ◀
          </button>
          <span data-testid="start-level">시작 LV {lvl}</span>
          <button type="button" className="mgl-btn mgl-icon-btn" aria-label="레벨 올리기" disabled={lvl >= unlocked} onClick={() => setPickLevel(lvl + 1)}>
            ▶
          </button>
        </div>
        <div className="mgl-actions">
          <button type="button" className="mgl-btn mgl-btn-primary mgl-btn-lg" data-testid="start" onClick={() => begin(g, lvl)}>
            시작!
          </button>
          <button type="button" className="mgl-btn" onClick={() => setStage({ kind: 'select' })}>
            뒤로
          </button>
        </div>
      </div>
    );
  }

  if (stage.kind === 'play' && free && game) {
    return (
      <Round
        key={`${free.gameId}-${free.level}-${free.clears}-${runSeed}`}
        game={game}
        level={free.level}
        seed={mixSeed(stage.seed, free.level)}
        mode="free"
        timeScale={overflowTimeScale(free.level, game.meta.maxLevel)}
        hud={{ label: game.meta.title, level: free.level, baseScore: free.runScore }}
        onEnd={onEnd}
      />
    );
  }

  if (stage.kind === 'result' && free && game) {
    const cleared = stage.summary.outcome === 'clear';
    const rec = gameRecord(store.get(), free.gameId);
    return (
      <ResultScreen
        heading={cleared ? `LV ${stage.clearedLevel} CLEAR!` : stage.summary.reason === 'timeout' ? 'TIME UP' : 'MISS'}
        tone={cleared ? 'clear' : 'fail'}
        badges={[...(stage.newScore ? ['NEW RECORD! 최고 점수'] : []), ...(stage.newLevel ? ['NEW RECORD! 최고 레벨'] : [])]}
        lines={[
          { label: '이번 라운드', value: `${stage.summary.raw.toLocaleString('en-US')}점` },
          ...(stage.bonus ? [{ label: '시간 보너스', value: `+${stage.bonus}` }] : []),
          { label: '누적 점수', value: `${free.runScore.toLocaleString('en-US')}점`, strong: true },
          { label: '최고 점수', value: `${rec.bestScore.toLocaleString('en-US')}점` },
        ]}
        actions={
          cleared
            ? [
                { label: `다음 레벨 LV ${free.level} ▶`, primary: true, testId: 'next', onClick: () => setStage({ kind: 'play', seed: runSeed }) },
                { label: '메뉴', onClick: () => setStage({ kind: 'select' }) },
              ]
            : [
                { label: `LV ${free.level} 다시 도전`, primary: true, testId: 'retry', onClick: () => begin(game, free.level) },
                ...(free.level > 1 ? [{ label: 'LV 1부터', onClick: () => begin(game, 1) }] : []),
                { label: '메뉴', testId: 'menu', onClick: () => setStage({ kind: 'select' }) },
              ]
        }
      />
    );
  }

  return null;
}
