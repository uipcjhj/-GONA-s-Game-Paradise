/**
 * ToyGame — 한 판의 진행(React 무관, 헤드리스 테스트 가능): 선택·이동·되돌리기·점수·종료 판정.
 * 규칙은 engine.ts, 퍼즐은 generator.ts 가 맡고 여기서는 '플레이어 입력 → 상태 변화'만 다룹니다.
 */
import {
  applyMove, capacityOf, isFixed, isLegal, isStuck, isWon, lockedRemaining, stateKey, type Move, type MoveResult, type RoomConfig, type RoomState,
} from './engine';
import { generatePuzzle, type Puzzle } from './generator';
import { leftoverBonus, movePoints, stars, type ToyParams } from './logic';

export type RejectReason = 'fixed' | 'full' | 'locked' | 'same';

export type ToyEvent =
  | { type: 'select'; shelf: number; index: number }
  | { type: 'deselect' }
  | { type: 'reject'; reason: RejectReason }
  | { type: 'move'; move: Move; result: MoveResult; points: number; combo: number; unlocked: number }
  | { type: 'undo' }
  | { type: 'reset' }
  | { type: 'won'; stars: 1 | 2 | 3; bonus: number; movesUsed: number }
  | { type: 'lost'; reason: 'moves' | 'stuck' };

interface Snapshot { state: RoomState; movesUsed: number; combo: number }

export class ToyGame {
  readonly puzzle: Puzzle;
  readonly cfg: RoomConfig;
  state: RoomState;
  movesUsed = 0;
  undoLeft: number;
  selected: { shelf: number; index: number } | null = null;
  combo = 0;
  bestCombo = 0;
  status: 'playing' | 'won' | 'lost' = 'playing';
  private history: Snapshot[] = [];
  /** 같은 위치에서 같은 이동을 되돌렸다 다시 해도 점수는 한 번만 */
  private scored = new Set<string>();

  constructor(readonly params: ToyParams, seed: number) {
    this.puzzle = generatePuzzle(params, seed);
    this.cfg = this.puzzle.cfg;
    this.state = this.puzzle.initial;
    this.undoLeft = params.undo;
  }

  get limit() { return this.puzzle.limit; }
  get par() { return this.puzzle.par; }
  get movesLeft() { return Math.max(0, this.limit - this.movesUsed); }
  get totalSets() { return this.puzzle.sets; }
  get setsCleared() { return this.state.cleared; }
  get playing() { return this.status === 'playing'; }
  capacity(shelf: number) { return capacityOf(this.cfg, this.state, shelf); }
  locked(shelf: number) { return lockedRemaining(this.cfg, this.state.cleared, shelf); }
  get canUndo() { return this.playing && this.undoLeft > 0 && this.history.length > 0; }

  /** 장난감을 탭 */
  tapToy(shelf: number, index: number): ToyEvent[] {
    if (!this.playing) return [];
    const toy = this.state.shelves[shelf]?.[index];
    if (toy === undefined) return this.tapShelf(shelf);
    const sel = this.selected;
    if (!sel) {
      if (isFixed(toy)) return [{ type: 'reject', reason: 'fixed' }];
      this.selected = { shelf, index };
      return [{ type: 'select', shelf, index }];
    }
    if (sel.shelf === shelf) {
      if (sel.index === index) { this.selected = null; return [{ type: 'deselect' }]; }
      if (isFixed(toy)) return [{ type: 'reject', reason: 'fixed' }];
      this.selected = { shelf, index };
      return [{ type: 'select', shelf, index }];
    }
    return this.tapShelf(shelf); // 다른 선반의 장난감을 눌러도 그 선반으로 이동
  }

  /** 선반을 탭(선택한 장난감이 있으면 그 선반 끝으로 이동) */
  tapShelf(shelf: number): ToyEvent[] {
    if (!this.playing || !this.selected) return [];
    const from = this.selected;
    if (from.shelf === shelf) { this.selected = null; return [{ type: 'deselect' }]; }
    const move: Move = { from: from.shelf, index: from.index, to: shelf };
    if (!isLegal(this.cfg, this.state, move)) {
      const reason: RejectReason = this.locked(shelf) > 0 && this.state.shelves[shelf].length >= this.capacity(shelf) ? 'locked' : 'full';
      return [{ type: 'reject', reason }];
    }
    return this.perform(move);
  }

  /** 이동 실행(테스트·힌트에서도 직접 사용) */
  perform(move: Move): ToyEvent[] {
    if (!this.playing || !isLegal(this.cfg, this.state, move)) return [];
    const before = this.state;
    this.history.push({ state: before, movesUsed: this.movesUsed, combo: this.combo });
    const result = applyMove(this.cfg, before, move);
    this.state = result.state;
    this.movesUsed++;
    this.selected = null;
    let points = 0;
    if (result.setsCleared > 0) {
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      const key = `${stateKey(before)}>${move.from},${move.index}>${move.to}`;
      if (!this.scored.has(key)) { this.scored.add(key); points = movePoints(result.setsCleared); }
    } else this.combo = 0;
    const unlocked = this.lockedTotal(before) - this.lockedTotal(this.state);
    const events: ToyEvent[] = [{ type: 'move', move, result, points, combo: this.combo, unlocked }];
    if (isWon(this.state)) {
      this.status = 'won';
      events.push({ type: 'won', stars: stars(this.movesUsed, this.par, this.params.slack), bonus: leftoverBonus(this.movesLeft), movesUsed: this.movesUsed });
    } else if (this.movesLeft === 0) { this.status = 'lost'; events.push({ type: 'lost', reason: 'moves' }); }
    else if (isStuck(this.cfg, this.state)) { this.status = 'lost'; events.push({ type: 'lost', reason: 'stuck' }); }
    return events;
  }

  private lockedTotal(s: RoomState) { let n = 0; for (let i = 0; i < this.cfg.shelves; i++) n += lockedRemaining(this.cfg, s.cleared, i); return n; }

  /** 한 수 되돌리기(이동 수도 되돌려 줌, 횟수 제한) */
  undo(): ToyEvent[] {
    if (!this.canUndo) return [];
    const snap = this.history.pop()!;
    this.state = snap.state; this.movesUsed = snap.movesUsed; this.combo = snap.combo; this.selected = null; this.undoLeft--;
    return [{ type: 'undo' }];
  }

  /** 처음부터 다시(같은 퍼즐). 점수 중복 방지 기록은 유지 */
  reset(): ToyEvent[] {
    if (!this.playing) return [];
    this.state = this.puzzle.initial; this.movesUsed = 0; this.combo = 0; this.selected = null; this.history = [];
    return [{ type: 'reset' }];
  }
}
