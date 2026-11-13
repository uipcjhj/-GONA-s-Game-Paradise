import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import './tower.css';
import { FX, FX_CLEANUP_MARGIN_MS } from '../../core/fx';
import type { GameViewProps } from '../../core/types';
import { Button } from '../../skin/components';
import { useSkin } from '../../skin/context';
import { TowerGame, type TowerEvent } from './game';
import { CLEAR_BONUS, keepsCombo, placementPoints, type Quality, type TowerParams } from './logic';
import { PIECES, type PieceDef } from './pieces';
import { PLATE_X, WORLD_W } from './physics';
import type { TowerPieceView } from './slots';

/**
 * 아슬아슬 탑 화면 — 물리 진행(game.ts)·입력(드래그→놓기, 회전, 교환)·카메라만 담당하고 겉모습은 스킨 슬롯에 넘깁니다.
 * 월드는 폭 180 단위. 정수 배율 k = floor(스테이지 폭 / 180) 로 확대해 도트 아트도 선명하게 유지합니다.
 * 슬롯이 바뀌어도 아래 data-* 속성과 터치 영역은 그대로입니다(점검 스크립트가 읽음).
 */
const views = new Map<string, TowerPieceView>();
export function pieceView(def: PieceDef): TowerPieceView {
  let v = views.get(def.kind);
  if (!v) {
    const xs = def.points.map((p) => p[0]), ys = def.points.map((p) => p[1]);
    v = { kind: def.kind, label: def.label, points: def.points, bbox: { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }, weight: def.weight };
    views.set(def.kind, v);
  }
  return v;
}

interface Fb { id: number; kind: Quality; text: string; sub?: string }

export default function TowerView({ params, seed, ctx }: GameViewProps<TowerParams>) {
  const { tower: S } = useSkin();
  const [game] = useState(() => new TowerGame(params, seed));
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const [fb, setFb] = useState<Fb | null>(null);
  const [wind, setWind] = useState(0);
  const [shake, setShake] = useState(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const aimRef = useRef<HTMLDivElement>(null);
  const guideRef = useRef<HTMLDivElement>(null);
  const comRef = useRef<HTMLDivElement>(null);
  const els = useRef(new Map<number, HTMLDivElement>());
  const size = useRef({ w: 0, h: 0 });
  const cam = useRef<number | null>(null);
  const drag = useRef<{ id: number; x: number } | null>(null);
  /** 화면에 닿아 있는 손가락들 / 두 번째 손가락으로 회전한 제스처는 놓아도 낙하하지 않음 */
  const pointers = useRef(new Set<number>());
  const suppress = useRef(false);
  const stats = useRef({ combo: 0, bestCombo: 0, fbId: 0 });

  // 스테이지 크기 측정
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const on = () => { size.current = { w: el.clientWidth, h: el.clientHeight }; };
    on();
    const ro = new ResizeObserver(on);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!fb) return;
    const t = window.setTimeout(() => setFb(null), fb.kind === 'fell' ? FX.tower.feedbackFellMs : FX.tower.feedbackMs);
    return () => window.clearTimeout(t);
  }, [fb]);
  useEffect(() => {
    if (!shake) return;
    const t = window.setTimeout(() => setShake(0), FX.tower.shakeMs + FX_CLEANUP_MARGIN_MS);
    return () => window.clearTimeout(t);
  }, [shake]);

  const showFb = useCallback((kind: Quality, text: string, sub?: string) => setFb({ id: ++stats.current.fbId, kind, text, sub }), []);

  const handle = useCallback(
    (e: TowerEvent) => {
      const st = stats.current;
      switch (e.type) {
        case 'drop': ctx.sfx('drop'); bump(); break;
        case 'landed': {
          ctx.sfx('thud');
          if (e.impact > 2.5) setShake((n) => n + 1);
          try { navigator.vibrate?.(Math.min(22, 6 + Math.round(e.impact * 2))); } catch { /* iOS 등 미지원 */ }
          break;
        }
        case 'fall':
          ctx.sfx('bad'); st.combo = 0; ctx.setCombo(0);
          showFb('fell', '와르르! 떨어졌어요', `기회 ${Math.max(0, game.params.maxFalls - e.total)}번 남음`);
          bump();
          break;
        case 'placed': {
          const q = e.quality;
          if (q === 'fell') { st.combo = 0; ctx.setCombo(0); bump(); break; }
          st.combo = keepsCombo(q) ? st.combo + 1 : 0;
          st.bestCombo = Math.max(st.bestCombo, st.combo);
          ctx.setCombo(st.combo);
          const got = ctx.addScore(placementPoints(q));
          ctx.sfx(q === 'shaky' ? 'tap' : 'good');
          showFb(q, q === 'perfect' ? `완벽! +${got}` : q === 'stable' ? `안정 +${got}` : `아슬아슬! +${got}`, st.combo >= 2 ? `콤보 ×${st.combo}` : undefined);
          bump();
          break;
        }
        case 'won':
          ctx.setCombo(0); ctx.addScore(CLEAR_BONUS);
          ctx.finish({ outcome: 'clear', stats: { placed: game.placed, falls: game.falls, bestCombo: st.bestCombo, height: Math.round(game.height) } });
          bump();
          break;
        case 'lost':
          ctx.finish({ outcome: 'fail', stats: { placed: game.placed, falls: game.falls, bestCombo: st.bestCombo, height: Math.round(game.height), reason: e.reason === 'falls' ? 1 : 2 } });
          bump();
          break;
      }
    },
    [ctx, game, showFb],
  );

  // 공통 프레임 루프: 물리 → 이벤트 → 카메라 → DOM 위치(React 상태 거치지 않음)
  useEffect(() => {
    const frame = (dt: number) => {
      for (const e of game.step(dt)) handle(e);
      const st = stageRef.current, world = worldRef.current;
      const { w, h } = size.current;
      if (!st || !world || !w) return;
      const k = Math.max(1, Math.floor(w / WORLD_W));
      const baseCam = -(h / k - 30);
      const target = Math.min(baseCam, game.hoverY - game.box.h / 2 - 16);
      cam.current = cam.current == null ? target : cam.current + (target - cam.current) * (1 - Math.exp(-dt / 120));
      world.style.transform = `translate(${(w - WORLD_W * k) / 2}px, ${-cam.current * k}px) scale(${k})`;
      st.style.setProperty('--tw-climb', String(Math.max(0, baseCam - cam.current).toFixed(1)));

      let top = 0, supportX = PLATE_X;
      for (const p of game.world.pieces.values()) {
        const el = els.current.get(p.id);
        if (el) el.style.transform = `translate(${p.body.position.x.toFixed(2)}px, ${p.body.position.y.toFixed(2)}px) rotate(${p.body.angle.toFixed(4)}rad)`;
        if (p.id !== game.activeIdPublic && p.body.position.y < 40 && p.body.bounds.min.y < top) { top = p.body.bounds.min.y; supportX = p.body.position.x; }
      }
      const aim = aimRef.current;
      if (aim) aim.style.transform = `translate(${game.aimX.toFixed(2)}px, ${game.hoverY.toFixed(2)}px) rotate(${game.angle}rad)`;
      const guide = guideRef.current;
      if (guide) {
        if (game.phase === 'aim' && game.params.guide) {
          const bx = game.box, x0 = game.aimX - bx.w / 2, bottom = game.hoverY + bx.h / 2;
          const surf = game.world.surfaceBelow(x0, x0 + bx.w, bottom).y;
          guide.style.cssText = `display:block;left:${x0}px;top:${bottom}px;width:${bx.w}px;height:${Math.max(0, surf - bottom)}px`;
        } else guide.style.display = 'none';
      }
      const com = comRef.current;
      if (com) {
        const cx = game.world.comX();
        if (game.params.showCom && cx != null) {
          com.style.display = 'block'; com.style.transform = `translate(${cx.toFixed(2)}px, 0px)`;
          com.dataset.danger = Math.abs(cx - PLATE_X) > game.params.plateW / 2 - 4 ? '1' : '0';
        } else com.style.display = 'none';
      }
      if (game.params.wind) { const b = Math.round(game.windNow * 3) / 3; setWind((cur) => (cur === b ? cur : b)); }
      const d = st.dataset;
      d.phase = game.phase; d.aimX = game.aimX.toFixed(1); d.supportX = supportX.toFixed(1); d.height = game.height.toFixed(1);
      d.falls = String(game.falls); d.left = String(game.piecesLeft); d.swaps = String(game.swaps); d.scale = String(k); d.rot = String(game.rot); d.kind = game.current.kind;
    };
    return ctx.onFrame(frame);
  }, [ctx, game, handle]);

  // ── 입력: 화면을 밀면 조각이 따라오고(상대 이동), 손을 떼면 낙하
  const scaleK = () => Math.max(1, Math.floor((size.current.w || WORLD_W) / WORLD_W));
  const onDown = (e: RPointerEvent) => {
    pointers.current.add(e.pointerId);
    if (pointers.current.size >= 2) {
      // 한 손가락으로 조각을 잡은 채 다른 손가락으로 탭 → 회전 (놓아도 낙하하지 않음)
      suppress.current = true;
      if (ctx.isPlaying() && game.rotate()) { ctx.sfx('tap'); bump(); }
      return;
    }
    if (!ctx.isPlaying() || drag.current) return;
    drag.current = { id: e.pointerId, x: e.clientX };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: RPointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    d.x = e.clientX;
    if (game.canAim) game.moveAim(dx / scaleK());
  };
  const onUp = (e: RPointerEvent, cancelled: boolean) => {
    pointers.current.delete(e.pointerId);
    const d = drag.current;
    if (d && d.id === e.pointerId) {
      drag.current = null;
      if (!cancelled && !suppress.current && ctx.isPlaying() && game.release()) bump();
    }
    if (pointers.current.size === 0) suppress.current = false;
  };
  const doRotate = () => { if (ctx.isPlaying() && game.rotate()) { ctx.sfx('tap'); bump(); } };
  const doSwap = () => { if (ctx.isPlaying() && game.swap()) { ctx.sfx('tap'); bump(); } };

  useEffect(() => {
    const on: EventListener = (ev) => {
      const k = (ev as KeyboardEvent).key;
      if (!ctx.isPlaying()) return;
      if (k === 'ArrowLeft') game.moveAim(-4);
      else if (k === 'ArrowRight') game.moveAim(4);
      else if (k === 'ArrowUp' || k === 'r') { if (game.rotate()) bump(); }
      else if (k === 's') { if (game.swap()) bump(); }
      else if (k === ' ' || k === 'ArrowDown') { if (game.release()) bump(); }
    };
    return ctx.listen(window, 'keydown', on);
  }, [ctx, game]);

  const pieces = game.pieces();
  const aiming = game.phase === 'aim';
  const sidePress = (fn: () => void) => ({ onPointerDown: fn, onClick: (e: React.MouseEvent) => e.detail === 0 && fn() });

  return (
    <div className="tw" data-testid="tower">
      <div className="tw-metabox">
        <S.Meter height={game.height} goal={params.goalH} piecesLeft={game.piecesLeft} budget={params.budget} falls={game.falls} maxFalls={params.maxFalls} swaps={game.swaps} />
      </div>

      <div
        ref={stageRef}
        className={`tw-stage${shake ? ' tw-shake' : ''}`}
        data-testid="stage"
        data-goal={params.goalH}
        data-plate-w={params.plateW}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={(e) => onUp(e, false)}
        onPointerCancel={(e) => onUp(e, true)}
      >
        <div className="tw-bg"><S.Backdrop /></div>
        <div className="tw-world" ref={worldRef}>
          <div className="tw-plate" style={{ left: PLATE_X - params.plateW / 2, top: 0 }}><S.PlateArt width={params.plateW} /></div>
          <div className="tw-goal" style={{ left: 0, width: WORLD_W, top: -params.goalH }}><S.GoalLine goalH={params.goalH} /></div>
          {params.showCom && <div className="tw-band" style={{ left: PLATE_X - params.plateW / 2, width: params.plateW, top: -3, height: 2 }}><S.PlateBand /></div>}
          <div className="tw-guide" ref={guideRef} style={{ display: 'none' }}><S.Guide /></div>
          <div className="tw-com" ref={comRef} style={{ display: 'none' }}><S.ComMarker /></div>
          {pieces.map((p) => (
            <div key={p.id} className="tw-piece" data-kind={p.kind} ref={(el) => { if (el) els.current.set(p.id, el); else els.current.delete(p.id); }}
              style={{ transform: `translate(${p.body.position.x}px, ${p.body.position.y}px) rotate(${p.body.angle}rad)` }}>
              <S.PieceArt piece={pieceView(p.def)} />
            </div>
          ))}
          {aiming && (
            <div className="tw-aim" ref={aimRef} data-testid="aim-piece" data-kind={game.current.kind}>
              <S.PieceArt piece={pieceView(PIECES[game.current.kind])} />
            </div>
          )}
        </div>
        {fb && <div className="tw-fb-wrap" key={fb.id} data-testid="feedback" data-kind={fb.kind}><S.Feedback kind={fb.kind} text={fb.text} sub={fb.sub} /></div>}
        {params.wind > 0 && <div className="tw-notice" data-testid="wind"><S.Notice wind={wind} /></div>}
      </div>

      <div className="tw-controls">
        <Button size="lg" data-testid="rotate" aria-label="회전" {...sidePress(doRotate)}>⟳ 회전</Button>
        <S.NextQueue next={game.next.map((k) => pieceView(PIECES[k]))} />
        <Button size="lg" data-testid="swap" aria-label="교환" disabled={game.swaps <= 0 || !aiming} {...sidePress(doSwap)}>⇄ 교환</Button>
      </div>
    </div>
  );
}
