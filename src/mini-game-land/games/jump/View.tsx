import { useEffect, useLayoutEffect, useReducer, useRef } from 'react';
import type { GameViewProps } from '../../core/types';
import { FX } from '../../core/fx';
import { useSkin } from '../../skin/context';
import { POINTS, airborne, createState, jumpHeight, ropePhase, status, step, tap, type JumpParams } from './logic';
import './jump.css';

/** 월드(단위) — 발밑 y = FEET, 줄 손잡이 높이 = HAND */
const W = 180, H = 220, FEET = 196, HAND = 120, TOP = 34, JUMP_UP = 44;
const JW = 30, JH = 38;
interface Pop { id: number; kind: 'perfect' | 'good' | 'miss' | 'cue'; text: string; until: number; y: number }
const CUE: Record<string, string> = { fast: '빨라져요!', slow: '느려져요~', double: '두 번!' };

/** 줄넘기 화면: 입력(탭 = 점프)·판정·연출 타이밍은 여기, 겉모습은 스킨 슬롯 */
export default function JumpView({ params, seed, ctx }: GameViewProps<JumpParams>) {
  const { jump: S } = useSkin();
  const st = useRef(createState(params, seed));
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const stage = useRef<HTMLDivElement>(null);
  const size = useRef({ w: 0, h: 0 });
  const pops = useRef<Pop[]>([]);
  const mood = useRef<{ m: 'idle' | 'happy' | 'oops'; until: number }>({ m: 'idle', until: 0 });
  const ended = useRef(false);
  const ids = useRef(0);
  const cued = useRef(0);

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
        if (ended.current) return;
        step(s, dt);
        for (const e of s.events) {
          if (e.judge === 'miss') {
            ctx.setCombo(0);
            ctx.sfx('bad');
            mood.current = { m: 'oops', until: s.t + FX.jump.moodMs };
            pops.current.push({ id: ++ids.current, kind: 'miss', text: 'MISS', until: s.t + FX.jump.popMs, y: 60 });
          } else {
            ctx.setCombo(s.combo);
            ctx.addScore(POINTS[e.judge]);
            ctx.sfx(e.judge === 'perfect' ? 'good' : 'tap');
            mood.current = { m: 'happy', until: s.t + FX.jump.moodMs };
            pops.current.push({ id: ++ids.current, kind: e.judge, text: e.judge === 'perfect' ? 'PERFECT!' : 'GOOD', until: s.t + FX.jump.popMs, y: 60 });
          }
        }
        s.events = [];
        // 박자 변화 예고(다음 바퀴가 바뀔 때 한 번)
        if (s.nextKind !== 'normal' && cued.current !== s.nextPass) {
          cued.current = s.nextPass;
          pops.current.push({ id: ++ids.current, kind: 'cue', text: CUE[s.nextKind], until: s.t + FX.jump.popMs * 1.6, y: 22 });
        }
        pops.current = pops.current.filter((p) => p.until > s.t);
        if (mood.current.until <= s.t) mood.current.m = 'idle';
        const res = status(s);
        if (res !== 'playing') {
          ended.current = true;
          ctx.finish({ outcome: res, stats: { ok: s.ok, perfect: s.perfect, miss: s.miss, bestCombo: s.bestCombo } });
        }
        bump();
      }),
    [ctx],
  );

  const onDown = () => {
    if (!ctx.isPlaying() || ended.current) return;
    if (tap(st.current)) ctx.sfx('drop');
  };

  const s = st.current;
  const { w, h } = size.current;
  const k = w && h ? Math.min(w / W, h / H) : 0;
  const ph = ropePhase(s);
  const ropeY = FEET - ((1 - Math.cos(ph * Math.PI * 2)) / 2) * (FEET - TOP);
  const ctrlY = 2 * ropeY - HAND; // 2차 베지어의 꼭짓점이 ropeY 를 지나도록
  const d = `M 26 ${HAND} Q 90 ${ctrlY.toFixed(1)} 154 ${HAND}`;
  const front = ph < 0.25 || ph > 0.75; // 아래쪽 반 바퀴는 고나 앞, 위쪽은 뒤
  const warn = s.nextKind !== 'normal';
  const lift = jumpHeight(s);
  const rope = (
    <svg className="jp-svg" width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <S.Rope d={d} front={front} warn={warn} />
    </svg>
  );
  return (
    <div className="jp">
      <div className="jp-meter">
        <S.Meter ok={s.ok} goal={s.params.goal} miss={s.miss} maxMiss={s.params.maxMiss} perfect={s.perfect} />
      </div>
      <div
        ref={stage}
        className="jp-stage"
        data-testid="jump-stage"
        data-phase={ended.current ? 'done' : 'play'}
        data-rope={ph.toFixed(3)}
        data-next-pass={Math.round(s.nextPass - s.t)}
        data-air={airborne(s) ? '1' : '0'}
        data-ok={s.ok}
        data-miss={s.miss}
        data-perfect={s.perfect}
        onPointerDown={onDown}
      >
        <div className="jp-layer">
          <S.Backdrop />
        </div>
        {k > 0 && (
          <div className="jp-world" style={{ width: W, height: H, top: Math.max(0, h * 0.935 - (FEET + 2) * k), transform: `translateX(${(-W * k) / 2}px) scale(${k})` }}>
            {!front && rope}
            <div className="jp-turner" style={{ left: 4, top: HAND - 22, width: 26, height: 30 }}>
              <S.Turner side="left" phase={ph} />
            </div>
            <div className="jp-turner" style={{ left: W - 30, top: HAND - 22, width: 26, height: 30 }}>
              <S.Turner side="right" phase={ph} />
            </div>
            <div className="jp-jumper" data-testid="jumper" style={{ left: 90 - JW / 2, top: FEET - JH - lift * JUMP_UP, width: JW, height: JH }}>
              <S.Jumper lift={lift} mood={mood.current.m} />
            </div>
            {front && rope}
            {pops.current.map((p) => (
              <div key={p.id} className="jp-pop" style={{ left: 90, top: p.y }}>
                <S.Pop kind={p.kind} text={p.text} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
