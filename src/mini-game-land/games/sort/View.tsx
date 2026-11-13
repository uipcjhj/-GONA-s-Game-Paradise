import { useCallback, useEffect, useReducer, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import type { GameViewProps } from '../../core/types';
import { gonaUrl } from '../../assets';
import {
  CLEAR_BONUS, FAST_BONUS, answer, binCount, binLabels, condLabel, createState, currentCard, isLocked, isReversed,
  ruleHint, status, swipeToBin, tick, type Card, type Cond, type SortParams,
} from './logic';

/** 임시 도형으로 그린 고나 친구(색·표정·특징). 최종 에셋 도착 전 기능 확인용. */
const EYES: Record<string, [string, string]> = { smile: ['^', '^'], cry: ['T', 'T'], angry: ['>', '<'], sleepy: ['-', '-'] };

function CardView({ card, className = '', ...rest }: { card: Card; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  const [l, r] = EYES[card.face];
  return (
    <div className={`sc-card ${className}`} data-color={card.color} data-face={card.face} data-feature={card.feature} {...rest}>
      {card.feature === 'hat' && <i className="sc-hat" />}
      {card.feature === 'ribbon' && <i className="sc-ribbon" />}
      <div className="sc-eyes"><b>{l}</b><b>{r}</b></div>
      {card.feature === 'glasses' && <div className="sc-glasses"><i /><i /></div>}
      <div className="sc-mouth" />
    </div>
  );
}

function CondChip({ c }: { c: Cond }) {
  return (
    <span className="sc-chip" data-axis={c.axis} data-value={c.value}>
      {c.axis === 'color' && <span className="sc-dot" data-color={c.value} />}
      {condLabel(c)}
    </span>
  );
}

const ARROW = ['◀', '▲', '▶'];
const arrowOf = (bin: number, bins: number) => (bins === 2 ? ARROW[bin === 0 ? 0 : 2] : ARROW[bin]);

interface Leaving { id: number; card: Card; bin: number; bins: number }
interface Feedback { id: number; kind: 'correct' | 'wrong'; text: string; sub?: string }

export default function SortView({ params, seed, ctx }: GameViewProps<SortParams>) {
  const stateRef = useRef(createState(params, seed));
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const [leaving, setLeaving] = useState<Leaving | null>(null);
  const [fb, setFb] = useState<Feedback | null>(null);
  const [shake, setShake] = useState(0);
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
    const t = window.setTimeout(() => setLeaving(null), 220);
    return () => window.clearTimeout(t);
  }, [leaving]);
  useEffect(() => {
    if (!fb) return;
    const t = window.setTimeout(() => setFb(null), fb.kind === 'wrong' ? 2200 : 700);
    return () => window.clearTimeout(t);
  }, [fb]);

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
      } else {
        ctx.sfx('bad');
        setShake((n) => n + 1);
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

  return (
    <div className="sc" data-testid="sort" data-shake={shake % 2}>
      <div className="sc-rule">
        <img src={gonaUrl} alt="" className="sc-judge" draggable={false} />
        <div className="sc-rule-body">
          <div className="sc-rule-hint" data-testid="rule-hint">
            {ruleHint(rule, reversed)}
            {reversed && <em className="sc-rev" data-testid="reversed-chip">⇄ 반전 중</em>}
          </div>
          <div className="sc-chips">
            {rule.conds.map((c, i) => (
              <span key={i} className="sc-chip-wrap">
                {i > 0 && <span className="sc-join">{rule.kind === 'and' ? '그리고' : rule.kind === 'or' ? '또는' : rule.kind === 'exclude' ? '제외' : '/'}</span>}
                <CondChip c={c} />
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="sc-info">
        <span data-testid="progress">카드 {Math.min(s.index + 1, s.params.goal)}/{s.params.goal}</span>
        <span className="sc-miss" data-testid="mistakes" data-mistakes={s.mistakes} aria-label={`실수 ${s.mistakes}/${s.params.maxMistakes}`}>
          실수 {Array.from({ length: s.params.maxMistakes }, (_, i) => (i < s.mistakes ? '✕' : '○')).join(' ')}
        </span>
      </div>

      <div
        className="sc-stage"
        data-testid="stage"
        data-rule={JSON.stringify({ kind: rule.kind, conds: rule.conds, reversed })}
        data-locked={locked ? '1' : '0'}
        data-index={s.index}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={(e) => endDrag(e, false)}
        onPointerCancel={(e) => endDrag(e, true)}
      >
        {next && !announcing && <CardView card={next.card} className="sc-next" />}
        {leaving && <CardView key={`l${leaving.id}`} card={leaving.card} className={`sc-leaving sc-fly-${leaving.bins === 2 && leaving.bin === 1 ? 2 : leaving.bin}`} />}
        {rc && (
          <div className={`sc-card-wrap${announcing ? ' sc-hidden' : ''}`} ref={cardRef} key={`c${s.index}`}>
            <CardView card={rc.card} className="sc-current" data-testid="card" />
          </div>
        )}
        {fb && (
          <div className={`sc-fb ${fb.kind}`} data-testid="feedback" data-kind={fb.kind} key={`f${fb.id}`}>
            <b>{fb.text}</b>
            {fb.sub && <span>{fb.sub}</span>}
          </div>
        )}
        {announcing && (
          <div className="sc-announce" data-testid="announce">
            ⇄ 규칙 반전!
            <small>왼쪽과 오른쪽이 바뀌어요</small>
          </div>
        )}
      </div>

      <div className="sc-bins" ref={binsRef} data-bins={bins} data-locked={locked ? '1' : '0'}>
        {labels.map((label, i) => (
          <button
            key={i}
            type="button"
            className="sc-bin"
            data-testid={`bin-${i}`}
            data-bin={i}
            aria-label={`${bins === 3 ? ['왼쪽', '가운데', '오른쪽'][i] : ['왼쪽', '오른쪽'][i]} 분류함: ${label}`}
            onPointerDown={(e) => {
              e.stopPropagation();
              submit(i);
            }}
            onClick={(e) => e.detail === 0 && submit(i)}
          >
            <span className="sc-arrow">{arrowOf(i, bins)}</span>
            <span className="sc-bin-label">{label}</span>
          </button>
        ))}
      </div>
      <p className="sc-tip">{bins === 3 ? '카드를 ◀ ▲ ▶ 로 밀거나 분류함을 눌러요' : '카드를 ◀ ▶ 로 밀거나 분류함을 눌러요'} </p>
    </div>
  );
}
