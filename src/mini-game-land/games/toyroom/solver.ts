/** 독립 솔버(테스트·개발용): 너비 우선 탐색으로 최소 이동 풀이를 찾음. 앱 실행 중에는 쓰지 않음(생성은 역방향 + 검증). */
import { applyMove, isWon, legalMoves, stateKey, type Move, type RoomConfig, type RoomState } from './engine';

export interface SolveOpts { maxDepth?: number; maxNodes?: number }
/** capped=true 면 탐색 노드 한도 때문에 중단(해가 없다는 뜻이 아님). moves=null 이고 capped=false 면 깊이 한도 안에 해가 없음이 확정 */
export interface SolveResult { moves: Move[] | null; nodes: number; exhausted: boolean; capped: boolean }

export function solve(cfg: RoomConfig, start: RoomState, { maxDepth = 30, maxNodes = 300000 }: SolveOpts = {}): SolveResult {
  if (isWon(start)) return { moves: [], nodes: 1, exhausted: true, capped: false };
  const seen = new Set<string>([stateKey(start)]);
  let frontier: { state: RoomState; path: Move[] }[] = [{ state: start, path: [] }];
  let nodes = 1;
  for (let depth = 0; depth < maxDepth && frontier.length; depth++) {
    const next: typeof frontier = [];
    for (const { state, path } of frontier) {
      for (const m of legalMoves(cfg, state, true)) {
        const r = applyMove(cfg, state, m);
        if (isWon(r.state)) return { moves: [...path, m], nodes, exhausted: true, capped: false };
        const k = stateKey(r.state);
        if (seen.has(k)) continue;
        seen.add(k);
        if (++nodes > maxNodes) return { moves: null, nodes, exhausted: false, capped: true };
        next.push({ state: r.state, path: [...path, m] });
      }
    }
    frontier = next;
  }
  return { moves: null, nodes, exhausted: frontier.length === 0, capped: false };
}
