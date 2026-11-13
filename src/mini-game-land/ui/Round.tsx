import { Suspense, lazy, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { effectiveLimitMs } from '../core/difficulty';
import { FX } from '../core/fx';
import { RoundEngine, type RoundSummary } from '../core/engine';
import type { MiniGameModule, Mode } from '../core/types';
import { audio } from '../services';
import { Button, Callout, Caption, Panel } from '../skin/components';
import { useSkin } from '../skin/context';
import { scoreboardView, type HudInfo } from '../skin/viewmodel';


interface Props {
  game: MiniGameModule<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  level: number;
  seed: number;
  mode: Mode;
  /** 제한시간 배율(챌린지 압축 × maxLevel 초과 압축) */
  timeScale?: number;
  hud: HudInfo;
  onEnd: (s: RoundSummary) => void;
}

/** 공통 라운드 화면: HUD + 게임 + READY/일시정지/종료 오버레이. 두 모드가 같은 컴포넌트를 씁니다. */
export default function Round({ game, level, seed, mode, timeScale = 1, hud, onEnd }: Props) {
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const [summary, setSummary] = useState<RoundSummary | null>(null);
  const [confirmQuit, setConfirmQuit] = useState(false);

  const [engine] = useState(
    () =>
      new RoundEngine({
        limitMs: effectiveLimitMs(game.timeLimitSec(level, mode), timeScale),
        sfx: (n) => audio.play(n),
        onFinish: (s) => {
          audio.play(s.outcome === 'clear' ? 'clear' : s.reason === 'quit' ? 'pause' : 'fail');
          setSummary(s);
        },
      }),
  );
  const snap = useSyncExternalStore(engine.subscribe, engine.getSnapshot);

  useEffect(() => engine.attach(), [engine]);

  // 종료 연출 후 부모에게 전달 (quit 은 즉시)
  useEffect(() => {
    if (!summary) return;
    if (summary.reason === 'quit') {
      onEndRef.current(summary);
      return;
    }
    const t = window.setTimeout(() => onEndRef.current(summary), FX.round.endOverlayMs);
    return () => window.clearTimeout(t);
  }, [summary]);

  // 길게 누르기·확대 등 브라우저 기본 제스처가 게임 조작을 방해하지 않게 (라운드 동안만)
  useEffect(() => {
    const block: EventListener = (e) => e.preventDefault();
    const off = [engine.ctx.listen(document, 'gesturestart', block), engine.ctx.listen(document, 'contextmenu', block)];
    return () => off.forEach((f) => f());
  }, [engine]);

  const View = useMemo(() => lazy(game.load), [game]);
  const params = useMemo(() => game.difficulty(level), [game, level]);

  const { Scoreboard } = useSkin().ui;
  const view = scoreboardView(snap, hud);
  const paused = snap.phase === 'paused';
  return (
    <div
      className="mgl-round"
      data-testid="round"
      data-phase={snap.phase}
      data-score={view.score}
      data-combo={view.combo}
      data-time={view.timeSec ?? ''}
      data-lives={hud.lives ?? ''}
      data-level={hud.level ?? ''}
    >
      <div className="mgl-slot-scoreboard">
        <Scoreboard
          view={view}
          pauseButton={
            <Button size="icon" data-testid="pause" aria-label="일시정지" onClick={() => engine.pause()} disabled={snap.phase === 'done'}>
              Ⅱ
            </Button>
          }
        />
      </div>
      <div className="mgl-play">
        <Suspense fallback={<div className="mgl-center"><Caption role="loading">불러오는 중…</Caption></div>}>
          <View params={params} level={level} seed={seed} ctx={engine.ctx} />
        </Suspense>

        {snap.phase === 'ready' && (
          <div className="mgl-overlay mgl-overlay-pass" data-testid="ready">
            <Callout tone="ready">READY</Callout>
          </div>
        )}
        {snap.phase === 'resuming' && (
          <div className="mgl-overlay" data-testid="resuming">
            <Callout tone="count">{snap.gateSec}</Callout>
          </div>
        )}
        {paused && (
          <div className="mgl-overlay" data-testid="paused">
            <Panel tone="popup">
              <h2>일시정지</h2>
              <Button variant="primary" data-testid="resume" onClick={() => engine.resume()}>
                계속하기
              </Button>
              <Button data-testid="quit" onClick={() => (confirmQuit ? engine.quit() : setConfirmQuit(true))}>
                {confirmQuit ? (mode === 'challenge' ? '정말 나갈까요? 챌린지가 끝나요' : '정말 나갈까요?') : '나가기'}
              </Button>
            </Panel>
          </div>
        )}
        {snap.phase === 'done' && summary && summary.reason !== 'quit' && (
          <div className="mgl-overlay mgl-overlay-pass" data-testid="round-end">
            <Callout tone={summary.outcome}>{summary.outcome === 'clear' ? 'CLEAR!' : summary.reason === 'timeout' ? 'TIME UP' : 'MISS'}</Callout>
          </div>
        )}
      </div>
    </div>
  );
}
