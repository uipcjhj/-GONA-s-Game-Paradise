import { useEffect, useReducer, useRef } from 'react';
import './tap-test.css';
import type { GameViewProps } from '../../core/types';
import { gonaUrl } from '../../assets';
import { BASE_POINTS, createState, status, step, tap, type TapParams } from './logic';

/** 임시 테스트 게임 화면 — 고나(승인 에셋) + 임시 도형(빨간 상자). 최종 디자인 아님. */
export default function TapTestView({ params, seed, ctx }: GameViewProps<TapParams>) {
  const stateRef = useRef(createState(params, seed));
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const s = stateRef.current;

  useEffect(() => {
    const off = ctx.onFrame((dt) => {
      if (step(stateRef.current, dt)) bump();
    });
    return off;
  }, [ctx]);

  const onTap = (i: number) => {
    if (!ctx.isPlaying()) return;
    const st = stateRef.current;
    const ev = tap(st, i);
    if (ev === 'empty') return;
    ctx.setCombo(st.combo);
    if (ev === 'hit') {
      ctx.addScore(BASE_POINTS);
      ctx.sfx('good');
    } else {
      ctx.sfx('bad');
    }
    bump();
    const res = status(st);
    if (res !== 'playing') ctx.finish({ outcome: res, stats: { hits: st.hits, mistakes: st.mistakes } });
  };

  return (
    <div className="tt">
      <div className="tt-info">
        <span>콕 {s.hits}/{s.params.goal}</span>
        <span className="tt-miss" aria-label={`실수 ${s.mistakes}/${s.params.maxMistakes}`}>
          {Array.from({ length: s.params.maxMistakes }, (_, i) => (i < s.mistakes ? '✕' : '○')).join(' ')}
        </span>
      </div>
      <div className="tt-grid" style={{ gridTemplateColumns: `repeat(${s.params.cols}, 1fr)`, gridTemplateRows: `repeat(${s.params.rows}, 1fr)` }}>
        {s.cells.map((c, i) => (
          <button
            key={i}
            type="button"
            className="tt-cell"
            data-kind={c?.kind ?? 'empty'}
            data-testid={`cell-${i}`}
            aria-label={c ? (c.kind === 'gona' ? '고나' : '빨간 상자') : '빈 칸'}
            onPointerDown={() => onTap(i)}
            onClick={(e) => e.detail === 0 && onTap(i)}
          >
            {c?.kind === 'gona' && <img src={gonaUrl} alt="" className="tt-gona" draggable={false} />}
            {c?.kind === 'decoy' && <span className="tt-decoy">?</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
