import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import './toyroom.css';
import type { GameViewProps } from '../../core/types';
import { Button } from '../../skin/components';
import { useSkin } from '../../skin/context';
import { codeOf, isFixed, isWild, typeOf, type Step } from './engine';
import { ToyGame, type ToyEvent } from './game';
import { CLEAR_BONUS, type ToyParams } from './logic';
import type { ToyView } from './slots';

/**
 * 장난감방 화면 — 선택·이동(탭 → 탭)과 애니메이션 타이밍만 담당하고 겉모습은 스킨 슬롯에 넘깁니다.
 * 점수·상태는 이동 즉시 확정하고, 엔진이 돌려주는 단계(lift → pop → clear → place)를 순서대로 재생합니다(재생 중에는 입력 잠금).
 * 점검용 data-*: [data-testid=board] (data-shelves/caps/moves/left/limit/par/sets/total/undo/selected/busy/status)
 */
const STEP_MS: Record<Step['kind'], number> = { lift: 90, pop: 240, clear: 110, place: 120 };

export const toyView = (code: string): ToyView => ({ type: typeOf(code), wild: isWild(code), fixed: isFixed(code) });
const shelfHeight = (shelves: number) => (shelves <= 3 ? 84 : shelves === 4 ? 76 : shelves === 5 ? 68 : 62);

interface Fb { id: number; kind: 'set' | 'chain' | 'info' | 'warn'; text: string; sub?: string }

export default function ToyRoomView({ params, seed, ctx }: GameViewProps<ToyParams>) {
  const { toyroom: S } = useSkin();
  const [game] = useState(() => new ToyGame(params, seed));
  const [, bump] = useReducer((n: number) => n + 1, 0);
  const [anim, setAnim] = useState<{ steps: Step[]; i: number } | null>(null);
  const [fb, setFb] = useState<Fb | null>(null);
  const pending = useRef<ToyEvent | null>(null);
  const fbId = useRef(0);
  const dev = useRef(typeof location !== 'undefined' && new URLSearchParams(location.search).has('dev')).current;

  // 재생 타이머(정리 함수로 해제)
  useEffect(() => {
    if (!anim) return;
    const step = anim.steps[anim.i];
    const t = window.setTimeout(() => {
      if (anim.i + 1 < anim.steps.length) setAnim({ steps: anim.steps, i: anim.i + 1 });
      else setAnim(null);
    }, STEP_MS[step.kind]);
    return () => window.clearTimeout(t);
  }, [anim]);

  // 재생이 끝난 뒤 성공/실패 확정
  useEffect(() => {
    if (anim || !pending.current) return;
    const e = pending.current; pending.current = null;
    const stats = { moves: game.movesUsed, par: game.par, bestCombo: game.bestCombo, sets: game.setsCleared };
    if (e.type === 'won') {
      ctx.setCombo(0);
      ctx.addScore(CLEAR_BONUS + e.bonus);
      ctx.finish({ outcome: 'clear', stats: { ...stats, stars: e.stars } });
    } else if (e.type === 'lost') ctx.finish({ outcome: 'fail', stats: { ...stats, stuck: e.reason === 'stuck' ? 1 : 0 } });
  }, [anim, ctx, game]);

  useEffect(() => {
    if (!fb) return;
    const t = window.setTimeout(() => setFb(null), fb.kind === 'warn' ? 1400 : 1100);
    return () => window.clearTimeout(t);
  }, [fb]);

  const say = useCallback((kind: Fb['kind'], text: string, sub?: string) => setFb({ id: ++fbId.current, kind, text, sub }), []);

  const handle = useCallback(
    (evs: ToyEvent[]) => {
      for (const e of evs) {
        switch (e.type) {
          case 'select': case 'deselect': ctx.sfx('tap'); break;
          case 'reject':
            ctx.sfx('bad');
            say('warn', e.reason === 'fixed' ? '고정된 장난감은 못 옮겨요' : e.reason === 'locked' ? '아직 잠긴 칸이에요' : '자리가 없어요');
            break;
          case 'undo': ctx.sfx('pause'); say('info', '한 수 되돌렸어요'); break;
          case 'reset': ctx.sfx('pause'); say('info', '처음부터 다시!'); break;
          case 'move': {
            ctx.setCombo(game.combo);
            if (e.points > 0) ctx.addScore(e.points);
            ctx.sfx(e.result.setsCleared === 0 ? 'drop' : e.result.chain >= 2 ? 'lifeup' : 'good');
            if (e.result.setsCleared > 0) {
              say(e.result.chain >= 2 ? 'chain' : 'set', e.result.chain >= 2 ? `연쇄 ×${e.result.chain}! +${e.points}` : `정리! +${e.points}`, [e.combo >= 2 ? `콤보 ×${e.combo}` : '', e.unlocked > 0 ? '칸이 열렸어요!' : ''].filter(Boolean).join(' · ') || undefined);
            }
            setAnim({ steps: e.result.steps, i: 0 });
            break;
          }
          case 'won': case 'lost': pending.current = e; break;
        }
      }
      bump();
    },
    [ctx, game, say],
  );

  const busy = anim !== null;
  const onShelf = (shelf: number) => (ev: React.PointerEvent) => {
    if (!ctx.isPlaying() || busy || !game.playing) return;
    const slotEl = (ev.target as Element).closest('[data-slot]');
    const slot = slotEl ? Number(slotEl.getAttribute('data-slot')) : -1;
    handle(slot >= 0 && game.state.shelves[shelf][slot] !== undefined ? game.tapToy(shelf, slot) : game.tapShelf(shelf));
  };
  const press = (fn: () => void) => ({ onPointerDown: () => { if (ctx.isPlaying() && !busy) fn(); }, onClick: (e: React.MouseEvent) => { if (e.detail === 0 && ctx.isPlaying() && !busy) fn(); } });

  const shown = anim ? anim.steps[anim.i].shelves : game.state.shelves;
  const popping = anim && anim.steps[anim.i].kind === 'pop' ? anim.steps[anim.i].clear : null;
  const sel = game.selected;
  const C = params.capacity;

  return (
    <div className="tr" data-testid="toyroom">
      <div className="tr-metabox">
        <S.Meter movesLeft={game.movesLeft} limit={game.limit} par={game.par} sets={game.setsCleared} total={game.totalSets} undoLeft={game.undoLeft} />
      </div>

      <div
        className="tr-board"
        data-testid="board"
        style={{ ['--tr-shelf-h' as string]: `${shelfHeight(params.shelves)}px`, ['--tr-cap' as string]: C }}
        data-shelves={game.state.shelves.join('|')}
        data-caps={Array.from({ length: params.shelves }, (_, i) => game.capacity(i)).join(',')}
        data-moves={game.movesUsed}
        data-left={game.movesLeft}
        data-limit={game.limit}
        data-par={game.par}
        data-sets={game.setsCleared}
        data-total={game.totalSets}
        data-undo={game.undoLeft}
        data-selected={sel ? `${sel.shelf}:${sel.index}` : ''}
        data-busy={busy ? '1' : '0'}
        data-status={game.status}
        data-solution={dev ? JSON.stringify(game.puzzle.witness.map((m) => [m.from, m.index, m.to])) : undefined}
      >
        <div className="tr-bg"><S.Backdrop /></div>
        {Array.from({ length: params.shelves }, (_, i) => {
          const cap = game.capacity(i);
          const state = sel ? (sel.shelf === i ? 'source' : game.state.shelves[i].length < cap ? 'target' : 'blocked') : 'idle';
          return (
            <div key={i} className="tr-shelf" data-shelf={i} data-state={state} onPointerDown={onShelf(i)}>
              <div className="tr-frame"><S.ShelfFrame index={i} capacity={C} locked={C - cap} state={state} /></div>
              <div className="tr-slots">
                {Array.from({ length: C }, (_, j) => {
                  const code = shown[i][j];
                  const isPop = !!popping && popping.shelf === i && j >= popping.start && j < popping.start + 3;
                  const lifted = !!sel && sel.shelf === i && sel.index === j && !anim;
                  return (
                    <div key={j} className="tr-slot" data-slot={j} data-locked={j >= cap ? '1' : '0'}>
                      {code !== undefined && (
                        <div className={`tr-toy${lifted ? ' lifted' : ''}${isPop ? ' pop' : ''}`} data-code={code}>
                          <S.ToyArt toy={toyView(code)} state={isPop ? 'pop' : lifted ? 'lifted' : 'idle'} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {fb && <div className="tr-fb-wrap" key={fb.id} data-testid="feedback" data-kind={fb.kind}><S.Feedback kind={fb.kind} text={fb.text} sub={fb.sub} /></div>}
      </div>

      <div className="tr-controls">
        <Button size="lg" data-testid="undo" aria-label="되돌리기" disabled={!game.canUndo || busy} {...press(() => handle(game.undo()))}>↶ 되돌리기 {game.undoLeft}</Button>
        <Button size="lg" data-testid="reset" aria-label="처음부터" disabled={busy} {...press(() => handle(game.reset()))}>↺ 처음부터</Button>
      </div>
    </div>
  );
}

export { codeOf };
