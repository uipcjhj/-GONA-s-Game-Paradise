import { Suspense, lazy, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { effectiveLimitMs } from '../core/difficulty';
import { RoundEngine, type RoundSummary } from '../core/engine';
import type { MiniGameModule, Mode } from '../core/types';
import { audio } from '../services';
import Hud, { type HudInfo } from './Hud';

const END_OVERLAY_MS = 900;

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
    const t = window.setTimeout(() => onEndRef.current(summary), END_OVERLAY_MS);
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

  const paused = snap.phase === 'paused';
  return (
    <div className="mgl-round" data-phase={snap.phase}>
      <Hud snap={snap} info={hud} onPause={() => engine.pause()} />
      <div className="mgl-play">
        <Suspense fallback={<div className="mgl-center">불러오는 중…</div>}>
          <View params={params} level={level} seed={seed} ctx={engine.ctx} />
        </Suspense>

        {snap.phase === 'ready' && (
          <div className="mgl-overlay mgl-overlay-pass" data-testid="ready">
            <div className="mgl-big">READY</div>
          </div>
        )}
        {snap.phase === 'resuming' && (
          <div className="mgl-overlay" data-testid="resuming">
            <div className="mgl-big">{snap.gateSec}</div>
          </div>
        )}
        {paused && (
          <div className="mgl-overlay" data-testid="paused">
            <div className="mgl-panel">
              <h2>일시정지</h2>
              <button type="button" className="mgl-btn mgl-btn-primary" data-testid="resume" onClick={() => engine.resume()}>
                계속하기
              </button>
              <button
                type="button"
                className="mgl-btn"
                data-testid="quit"
                onClick={() => (confirmQuit ? engine.quit() : setConfirmQuit(true))}
              >
                {confirmQuit ? (mode === 'challenge' ? '정말 나갈까요? 챌린지가 끝나요' : '정말 나갈까요?') : '나가기'}
              </button>
            </div>
          </div>
        )}
        {snap.phase === 'done' && summary && summary.reason !== 'quit' && (
          <div className="mgl-overlay mgl-overlay-pass" data-testid="round-end">
            <div className={`mgl-big ${summary.outcome}`}>{summary.outcome === 'clear' ? 'CLEAR!' : summary.reason === 'timeout' ? 'TIME UP' : 'MISS'}</div>
          </div>
        )}
      </div>
    </div>
  );
}
