import { useCallback, useEffect, useReducer, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import './sort.css';
import { FX, FX_CLEANUP_MARGIN_MS } from '../../core/fx';
import type { GameViewProps } from '../../core/types';
import { useSkin } from '../../skin/context';
import {
  CLEAR_BONUS, FAST_BONUS, answer, binCount, binLabels, createState, currentCard, isLocked, isReversed,
  ruleHint, status, swipeToBin, tick, type Card, type SortParams,
} from './logic';

/**
 * 편가르기 화면 — 동작(판정·스와이프·분류함 탭·타이밍)만 담당하고, 겉모습은 전부 스킨 슬롯(skin.sort.*)에 넘깁니다.
 * 슬롯이 바뀌어도 아래의 data-* 속성과 터치 영역은 그대로여야 합니다(점검 스크립트가 이 속성을 읽음).
 */
interface Leaving { id: number; card: Card; bin: number; bins: number }
interface Feedback { id: number; kind: 'correct' | 'wrong'; text: string; sub?: string }

export default function SortView({ params, seed, ctx }: GameViewProps<SortParams>) {
  const { sort: S } = useSkin();
  const stateRef = useRef(createState(params, seed));
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const [leaving, setLeaving] = useState<Leaving | null>(null);
  const [fb, setFb] = useState<Feedback | null>(null);
  const [happy, setHappy] = useState(0);
  const idRef = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const binsRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const s = stateRef.current;
  const rule = s.plan.rule;
  const bins = binCount(rule);
  const reversed = isReversed(s);
  const rc = currentCard(s);
  const next = s.plan.cards[s.index + 1];

  // 공통 프레임 루프: 잠금·반전 예고 시간 관리
  useEffect(() => ctx.onFrame((dt) => tick(stateRef.current, dt) && bump()), [ctx]);

  // 효과 표시 정리(타이머는 정리 함수로 해제)
  useEffect(() => {
    if (!leaving) return;
    const t = window.setTimeout(() => setLeaving(null), FX.sort.flyMs + FX_CLEANUP_MARGIN_MS);
    return () => window.clearTimeout(t);
  }, [leaving]);
  useEffect(() => {
    if (!fb) return;
    const t = window.setTimeout(() => setFb(null), fb.kind === 'wrong' ? FX.sort.feedbackWrongMs : FX.sort.feedbackMs);
    return () => window.clearTimeout(t);
  }, [fb]);
  useEffect(() => {
    if (!happy) return;
    const t = window.setTimeout(() => setHappy(0), FX.sort.happyMs);
    return () => window.clearTimeout(t);
  }, [happy]);

  const submit = useCallback(
    (bin: number) => {
      if (!ctx.isPlaying()) return;
      const st = stateRef.current;
      const before = currentCard(st);
      const res = answer(st, bin);
      if (res.kind === 'ignored' || !before) return;
      const id = ++idRef.current;
      setLeaving({ id, card: before.card, bin, bins: binCount(st.plan.rule) });
      ctx.setCombo(st.combo);
      if (res.kind === 'correct') {
        const got = ctx.addScore(res.points);
        ctx.sfx('good');
        setFb({ id, kind: 'correct', text: `+${got}`, sub: res.fast ? `빠르다! +${FAST_BONUS}` : undefined });
        if (res.combo >= 3) setHappy(id);
      } else {
        ctx.sfx('bad');
        setHappy(0);
        setFb({ id, kind: 'wrong', text: '앗, 틀렸어요!', sub: res.explain.text });
      }
      const result = status(st);
      if (result === 'clear') {
        ctx.setCombo(0);
        ctx.addScore(CLEAR_BONUS);
      }
      if (result !== 'playing') ctx.finish({ outcome: result, stats: { correct: st.correct, mistakes: st.mistakes, bestCombo: st.bestCombo } });
      bump();
    },
    [ctx],
  );

  // 키보드(개발·접근성): ←/→/↑ — 터치 외 보조
  useEffect(() => {
    const on: EventListener = (e) => {
      const k = (e as KeyboardEvent).key;
      const n = binCount(stateRef.current.plan.rule);
      if (k === 'ArrowLeft') submit(0);
      else if (k === 'ArrowRight') submit(n - 1);
      else if (k === 'ArrowUp' && n === 3) submit(1);
    };
    return ctx.listen(window, 'keydown', on);
  }, [ctx, submit]);

  // ── 스와이프: 카드가 손가락을 따라오고, 놓으면 방향에 따라 분류
  const setHint = (bin: number | null) => {
    if (binsRef.current) binsRef.current.dataset.hint = bin == null ? '' : String(bin);
  };
  const onDown = (e: RPointerEvent) => {
    if (!ctx.isPlaying() || isLocked(stateRef.current) || drag.current) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
    if (cardRef.current) cardRef.current.style.transition = 'none';
  };
  const onMove = (e: RPointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId || !cardRef.current) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    cardRef.current.style.transform = `translate(${dx}px, ${bins === 3 ? Math.min(0, dy) : 0}px) rotate(${dx / 14}deg)`;
    setHint(swipeToBin(dx, dy, bins));
  };
  const endDrag = (e: RPointerEvent, cancelled: boolean) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    setHint(null);
    const el = cardRef.current;
    if (el) {
      el.style.transition = 'transform 120ms steps(4)';
      el.style.transform = '';
    }
    if (!cancelled) {
      const bin = swipeToBin(e.clientX - d.x, e.clientY - d.y, bins);
      if (bin != null) submit(bin);
    }
  };

  const labels = binLabels(rule, reversed);
  const locked = isLocked(s);
  const announcing = s.announceMs > 0;
  const mood = fb?.kind === 'wrong' ? 'oops' : happy ? 'happy' : 'idle';

  return (
    <div className="sc" data-testid="sort">
      <div className="sc-rulebox">
        <S.RulePanel rule={rule} reversed={reversed} hint={ruleHint(rule, reversed)} mood={mood} />
      </div>
      <div className="sc-infobox">
        <S.InfoBar index={s.index} goal={s.params.goal} mistakes={s.mistakes} maxMistakes={s.params.maxMistakes} bins={bins} />
      </div>

      <div
        className="sc-stage"
        data-testid="stage"
        data-rule={JSON.stringify({ kind: rule.kind, conds: rule.conds, reversed })}
        data-locked={locked ? '1' : '0'}
        data-index={s.index}
        data-goal={s.params.goal}
        data-mistakes={s.mistakes}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={(e) => endDrag(e, false)}
        onPointerCancel={(e) => endDrag(e, true)}
      >
        <div className="sc-stagedeco">
          <S.StageFrame locked={locked} reversed={reversed} />
        </div>
        {next && !announcing && (
          <div className="sc-slot sc-slot-next">
            <S.Friend card={next.card} />
          </div>
        )}
        {leaving && (
          <div key={`l${leaving.id}`} className={`sc-slot sc-slot-leaving sc-fly-${leaving.bins === 2 && leaving.bin === 1 ? 2 : leaving.bin}`}>
            <S.Friend card={leaving.card} />
          </div>
        )}
        {rc && (
          <div
            className={`sc-slot sc-slot-current${announcing ? ' sc-hidden' : ''}`}
            ref={cardRef}
            key={`c${s.index}`}
            data-testid="card"
            data-color={rc.card.color}
            data-face={rc.card.face}
            data-feature={rc.card.feature}
          >
            <S.Friend card={rc.card} />
          </div>
        )}
        {fb && (
          <div className="sc-fb-wrap" data-testid="feedback" data-kind={fb.kind} key={`f${fb.id}`}>
            <S.Feedback kind={fb.kind} text={fb.text} sub={fb.sub} />
          </div>
        )}
        {announcing && (
          <div className="sc-announce-wrap" data-testid="announce">
            <S.Announce title="⇄ 규칙 반전!" sub="왼쪽과 오른쪽이 바뀌어요" />
          </div>
        )}
      </div>

      <div className="sc-bins" ref={binsRef} data-bins={bins} data-locked={locked ? '1' : '0'}>
        {labels.map((label, i) => (
          <button
            key={i}
            type="button"
            className="mgl-hit sc-bin"
            data-testid={`bin-${i}`}
            data-bin={i}
            aria-label={`${bins === 3 ? ['왼쪽', '가운데', '오른쪽'][i] : ['왼쪽', '오른쪽'][i]} 분류함: ${label}`}
            onPointerDown={(e) => {
              e.stopPropagation();
              submit(i);
            }}
            onClick={(e) => e.detail === 0 && submit(i)}
          >
            <span className="mgl-face">
              <S.BinFace index={i} bins={bins} label={label} locked={locked} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
