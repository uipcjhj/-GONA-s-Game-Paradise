import { useEffect, useLayoutEffect, useReducer, useRef, type PointerEvent as RPointerEvent } from 'react';
import type { GameViewProps } from '../../core/types';
import { FX } from '../../core/fx';
import { useSkin } from '../../skin/context';
import { CATCH_Y, ITEM_R, WORLD_H, WORLD_W, botTarget, createState, setBasket, status, step, type CatchParams } from './logic';
import './catch.css';

interface Pop { id: number; x: number; y: number; kind: 'good' | 'bad' | 'star'; text: string; until: number }
const CATCHER_W = 44, CATCHER_H = 40;

/** 간식 받아라 화면: 입력(손가락 x → 바구니 x)·진행·연출 타이밍은 여기, 겉모습은 스킨 슬롯 */
export default function CatchView({ params, seed, ctx }: GameViewProps<CatchParams>) {
  const { catch: S } = useSkin();
  const st = useRef(createState(params, seed));
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const stage = useRef<HTMLDivElement>(null);
  const size = useRef({ w: 0, h: 0 });
  const pops = useRef<Pop[]>([]);
  const mood = useRef<{ m: 'idle' | 'happy' | 'oops'; until: number }>({ m: 'idle', until: 0 });
  const clock = useRef(0);
  const ended = useRef(false);
  const popId = useRef(0);

  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      size.current = { w: el.clientWidth, h: el.clientHeight };
      bump();
    });
    ro.observe(el);
    size.current = { w: el.clientWidth, h: el.clientHeight };
    return () => ro.disconnect();
  }, []);

  useEffect(
    () =>
      ctx.onFrame((dt) => {
        const s = st.current;
        clock.current += dt;
        if (ended.current) return;
        step(s, dt);
        for (const e of s.events) {
          if (e.type === 'catch') {
            ctx.setCombo(s.combo);
            const pts = ctx.addScore(e.points);
            ctx.sfx(e.kind === 'star' ? 'lifeup' : 'good');
            pops.current.push({ id: ++popId.current, x: e.x, y: CATCH_Y - 14, kind: e.kind === 'star' ? 'star' : 'good', text: `+${pts}`, until: clock.current + FX.catch.popMs });
            mood.current = { m: 'happy', until: clock.current + FX.catch.moodMs };
          } else {
            ctx.setCombo(0);
            ctx.sfx('bad');
            pops.current.push({ id: ++popId.current, x: e.x, y: e.reason === 'pepper' ? CATCH_Y - 14 : WORLD_H - 20, kind: 'bad', text: e.reason === 'pepper' ? '매워!' : '놓쳤다!', until: clock.current + FX.catch.popMs });
            mood.current = { m: 'oops', until: clock.current + FX.catch.moodMs };
          }
        }
        s.events = [];
        pops.current = pops.current.filter((p) => p.until > clock.current);
        if (mood.current.until <= clock.current) mood.current.m = 'idle';
        const res = status(s);
        if (res !== 'playing') {
          ended.current = true;
          ctx.finish({ outcome: res, stats: { caught: s.caught, miss: s.miss, bestCombo: s.bestCombo } });
        }
        bump();
      }),
    [ctx],
  );

  const { w, h } = size.current;
  const k = w && h ? Math.min(w / WORLD_W, h / WORLD_H) : 0;
  const left = (w - WORLD_W * k) / 2;
  const toWorldX = (clientX: number) => {
    const r = stage.current?.getBoundingClientRect();
    return r && k ? (clientX - r.left - left) / k : st.current.basketX;
  };
  const drag = useRef<number | null>(null);
  const onDown = (e: RPointerEvent) => {
    if (!ctx.isPlaying() || drag.current !== null) return;
    drag.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    setBasket(st.current, toWorldX(e.clientX)); // 누른 곳으로 바로(손가락 = 고나 위치)
  };
  const onMove = (e: RPointerEvent) => {
    if (drag.current !== e.pointerId || !ctx.isPlaying()) return;
    setBasket(st.current, toWorldX(e.clientX));
  };
  const onUp = (e: RPointerEvent) => {
    if (drag.current === e.pointerId) drag.current = null;
  };

  const s = st.current;
  return (
    <div className="ct">
      <div className="ct-meter">
        <S.Meter caught={s.caught} goal={s.params.goal} miss={s.miss} maxMiss={s.params.maxMiss} />
      </div>
      <div
        ref={stage}
        className="ct-stage"
        data-testid="catch-stage"
        data-phase={ended.current ? 'done' : 'play'}
        data-basket-x={s.basketX.toFixed(1)}
        data-target-x={botTarget(s).toFixed(1)}
        data-scale={k.toFixed(3)}
        data-offset={left.toFixed(1)}
        data-caught={s.caught}
        data-goal={s.params.goal}
        data-miss={s.miss}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <div className="ct-layer">
          <S.Backdrop />
        </div>
        {k > 0 && (
          <div className="ct-world" style={{ width: WORLD_W, height: WORLD_H, transform: `translateX(${-WORLD_W * k / 2}px) scale(${k})` }}>
            {s.items.map((it) => (
              <div key={it.id} className="ct-item" data-kind={it.kind} style={{ left: it.x - ITEM_R, top: it.y - ITEM_R, width: ITEM_R * 2, height: ITEM_R * 2 }}>
                <S.Item kind={it.kind} />
              </div>
            ))}
            <div className="ct-catcher" data-testid="catcher" style={{ left: s.basketX - CATCHER_W / 2, top: CATCH_Y - CATCHER_H + 14, width: CATCHER_W, height: CATCHER_H }}>
              <S.Catcher mood={mood.current.m} />
            </div>
            {pops.current.map((p) => (
              <div key={p.id} className="ct-pop" style={{ left: p.x, top: p.y }}>
                <S.Pop kind={p.kind} text={p.text} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
