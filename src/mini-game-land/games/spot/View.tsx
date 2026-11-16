import { useEffect, useReducer, useRef } from 'react';
import type { GameViewProps } from '../../core/types';
import { FX } from '../../core/fx';
import { useSkin } from '../../skin/context';
import { POINTS, answer, createState, status, step, type SpotParams } from './logic';
import './spot.css';

/** 정답 칸은 ?dev=1 일 때만 data-answer 로 노출(점검용) */
const DEV = typeof location !== 'undefined' && new URLSearchParams(location.search).has('dev');

/** 가짜 친구 찾기 화면: 칸 탭(버튼)·판정·연출 타이밍은 여기, 겉모습은 스킨 슬롯 */
export default function SpotView({ params, seed, ctx }: GameViewProps<SpotParams>) {
  const { spot: S } = useSkin();
  const st = useRef(createState(params, seed));
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const pop = useRef<{ id: number; kind: 'good' | 'quick' | 'bad'; text: string; until: number } | null>(null);
  const wrongUntil = useRef(0);
  const clock = useRef(0);
  const ended = useRef(false);

  useEffect(
    () =>
      ctx.onFrame((dt) => {
        clock.current += dt;
        if (ended.current) return;
        const shuffled = step(st.current, dt);
        if (pop.current && pop.current.until <= clock.current) pop.current = null;
        if (shuffled || wrongUntil.current) bump();
        if (wrongUntil.current && wrongUntil.current <= clock.current) wrongUntil.current = 0;
      }),
    [ctx],
  );

  const onTap = (i: number) => {
    if (!ctx.isPlaying() || ended.current) return;
    const s = st.current;
    const r = answer(s, i);
    if (r.kind === 'ignored') return;
    if (r.kind === 'correct') {
      ctx.setCombo(s.combo);
      const pts = ctx.addScore(POINTS.base + (r.quick ? POINTS.quick : 0));
      ctx.sfx('good');
      pop.current = { id: s.found, kind: r.quick ? 'quick' : 'good', text: r.quick ? `빠르다! +${pts}` : `+${pts}`, until: clock.current + FX.spot.popMs };
    } else {
      ctx.setCombo(0);
      ctx.sfx('bad');
      wrongUntil.current = clock.current + FX.spot.shakeMs;
      pop.current = { id: -s.miss, kind: 'bad', text: '진짜 친구예요!', until: clock.current + FX.spot.popMs };
    }
    const res = status(s);
    if (res !== 'playing') {
      ended.current = true;
      ctx.finish({ outcome: res, stats: { found: s.found, miss: s.miss, bestCombo: s.bestCombo } });
    }
    bump();
  };

  const s = st.current;
  const { cols, rows } = s.params;
  return (
    <div className="sp">
      <div className="sp-meter">
        <S.Meter found={s.found} goal={s.params.goal} miss={s.miss} maxMiss={s.params.maxMiss} />
      </div>
      <div className="sp-stage">
        <div className="sp-layer">
          <S.Backdrop />
        </div>
        <div
          className="sp-grid"
          data-testid="spot-board"
          data-cols={cols}
          data-rows={rows}
          data-found={s.found}
          data-goal={s.params.goal}
          data-miss={s.miss}
          data-board={s.boards}
          {...(DEV ? { 'data-answer': s.board.fake } : {})}
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
        >
          {s.board.cells.map((f, i) => (
            <button
              key={`${s.boards}-${i}`}
              type="button"
              className="sp-cell"
              data-testid={`spot-cell-${i}`}
              data-wrong={wrongUntil.current && s.lastWrong === i ? '1' : '0'}
              aria-label={`친구 ${i + 1}`}
              onPointerDown={() => onTap(i)}
              onClick={(e) => e.detail === 0 && onTap(i)}
            >
              <S.Friend friend={f} />
            </button>
          ))}
          {pop.current && (
            <div key={pop.current.id} className="sp-pop">
              <S.Pop kind={pop.current.kind} text={pop.current.text} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
