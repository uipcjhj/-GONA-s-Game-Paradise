/**
 * 퍼즐 생성기 — '완성 상태에서 거꾸로' 만들고, 만든 풀이를 실제 규칙 엔진으로 다시 재생해 검증합니다.
 * 그래서 항상 풀 수 있고(운 아님), 풀이 길이(par)와 이동 제한이 확실합니다. 풀이는 퍼즐과 함께 반환(힌트·검증용).
 *
 * 거꾸로 만드는 한 단계(= 정답 풀이의 이동 1번)를 '패턴'이라 부름:
 *   single  : 장난감 1개를 어느 선반 가운데 끼워 두고, 다른 선반 끝에 같은 종류 2개를 둠 → 옮겨 끝에 놓으면 세트
 *   source  : 같은 종류 3개 사이에 다른 장난감을 끼워 둠 → 그것을 빼면 양옆이 붙어 세트
 *   double  : source + single 을 한 이동에 → 한 번에 두 곳 정리(연쇄 반응)
 *   cascade : 정리로 양옆이 또 붙어 같은 선반에서 연달아 정리(칸이 7개 이상 필요)
 *   (relocation) 세트와 무관한 준비 이동
 * 각 단계는 후보를 만든 뒤 엔진으로 '앞으로' 실행해 직전 상태와 정확히 같아지는지 확인하고, 아니면 버립니다.
 */
import { mixSeed, mulberry32, shuffle, type Rng } from '../../core/rng';
import { WILD, applyMove, codeOf, isFixed, isLegal, isWon, typeOf, validState, type Move, type RoomConfig, type RoomState } from './engine';
import type { ToyParams } from './logic';

export interface Puzzle {
  cfg: RoomConfig;
  /** 시작 상태 */
  initial: RoomState;
  /** 정답 풀이(앞으로 실행하면 모두 정리됨) */
  witness: Move[];
  /** 정답 풀이 길이 — 3별 기준 */
  par: number;
  /** 이동 제한 = par + slack */
  limit: number;
  sets: number;
  params: ToyParams;
}

interface SetDesc { type: number; wild: boolean; fixed: boolean }
type Macro = 'single' | 'source' | 'double' | 'cascade' | 'reloc';

const ri = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));

/** 세트의 '남아 있는' 장난감들(별·고정 표시 포함). need 개 */
function stays(d: SetDesc, need: number, rng: Rng): string[] {
  const arr = Array.from({ length: need }, () => codeOf(d.type));
  const idx = shuffle([...Array(need).keys()], rng);
  if (d.wild) arr[idx[0]] = WILD;
  if (d.fixed) arr[idx[d.wild ? 1 : 0]] = codeOf(d.type, true);
  return arr;
}
const lastOf = (s: string) => (s.length ? s[s.length - 1] : '');

function lockOrderFor(p: ToyParams, rng: Rng): number[] {
  return Array.from({ length: p.locked }, () => Math.floor(rng() * p.shelves));
}

function balancedTypes(sets: number, types: number, rng: Rng): number[] {
  const out: number[] = [];
  while (out.length < sets) out.push(...shuffle([...Array(types).keys()], rng));
  return out.slice(0, sets);
}

interface Proposal { shelves: string[]; move: Move; sets: number }

function propose(kind: Macro, Q: RoomState, cfg: RoomConfig, descs: SetDesc[], rng: Rng): Proposal | null {
  const S = cfg.shelves;
  // 자리가 빠듯해질수록 실패가 늘므로, 무작위 두 후보 중 더 비어 있는 선반을 고름(삽입 선반 s · 도착 선반 d)
  const roomy = () => { const a = Math.floor(rng() * S), b = Math.floor(rng() * S); return Q.shelves[a].length <= Q.shelves[b].length ? a : b; };
  const s = roomy();
  let d = roomy(); if (d === s) d = (s + 1 + Math.floor(rng() * (S - 1))) % S;
  const Qs = Q.shelves[s], Qd = Q.shelves[d];
  const shelves = Q.shelves.slice();
  if (kind === 'reloc') {
    const x = lastOf(Qd);
    if (!x || isFixed(x)) return null;
    const i = ri(rng, 0, Qs.length);
    shelves[s] = Qs.slice(0, i) + x + Qs.slice(i);
    shelves[d] = Qd.slice(0, -1);
    return { shelves, move: { from: s, index: i, to: d }, sets: 0 };
  }
  const A = descs[0];
  if (kind === 'single') {
    if (typeOf(lastOf(Qd)) === A.type) return null;
    const x = codeOf(A.type);
    const i = ri(rng, 0, Qs.length);
    shelves[s] = Qs.slice(0, i) + x + Qs.slice(i);
    shelves[d] = Qd + stays(A, 2, rng).join('');
    return { shelves, move: { from: s, index: i, to: d }, sets: 1 };
  }
  // source / double / cascade: 도착 선반의 '맨 끝 장난감'이 옮겨지는 장난감 x
  if (kind === 'source' || kind === 'cascade') {
    const x = lastOf(Qd);
    if (!x || isFixed(x) || typeOf(x) === A.type) return null;
    const a = stays(A, 3, rng);
    if (kind === 'source') {
      const p = ri(rng, 0, Qs.length);
      shelves[s] = Qs.slice(0, p) + a[0] + a[1] + x + a[2] + Qs.slice(p);
      shelves[d] = Qd.slice(0, -1);
      return { shelves, move: { from: s, index: p + 2, to: d }, sets: 1 };
    }
    const U = descs[1];
    if (!U || U.type === A.type) return null;
    const u = stays(U, 3, rng);
    const l = ri(rng, 1, 2);
    const p = ri(rng, 0, Qs.length);
    shelves[s] = Qs.slice(0, p) + u.slice(0, l).join('') + a[0] + a[1] + x + a[2] + u.slice(l).join('') + Qs.slice(p);
    shelves[d] = Qd.slice(0, -1);
    return { shelves, move: { from: s, index: p + l + 2, to: d }, sets: 2 };
  }
  // double: A 세트는 s 에서 x 를 빼서, B 세트는 x 를 d 에 놓아 정리
  const B = descs[1];
  if (!B || B.type === A.type || typeOf(lastOf(Qd)) === B.type) return null;
  const a = stays(A, 3, rng), b = stays(B, 2, rng);
  const x = codeOf(B.type);
  const p = ri(rng, 0, Qs.length);
  shelves[s] = Qs.slice(0, p) + a[0] + a[1] + x + a[2] + Qs.slice(p);
  shelves[d] = Qd + b.join('');
  return { shelves, move: { from: s, index: p + 2, to: d }, sets: 2 };
}

function chooseKind(p: ToyParams, remaining: number, rng: Rng): Macro {
  const w: [Macro, number][] = [['single', p.mix.single], ['source', p.mix.source]];
  if (remaining >= 2) { w.push(['double', p.mix.double]); w.push(['cascade', p.mix.cascade]); }
  const total = w.reduce((a, [, x]) => a + x, 0);
  let r = rng() * total;
  for (const [k, x] of w) { r -= x; if (r < 0) return k; }
  return 'single';
}

function build(p: ToyParams, rng: Rng): Puzzle | null {
  const cfg: RoomConfig = { shelves: p.shelves, capacity: p.capacity, lockOrder: lockOrderFor(p, rng), unlockEvery: p.unlockEvery };
  const T = p.sets;
  // 세트 설계도(종류 균형, 별·고정을 가진 세트를 미리 지정)
  const types = balancedTypes(T, p.types, rng);
  const order = shuffle([...Array(T).keys()], rng);
  const descs: SetDesc[] = types.map((type) => ({ type, wild: false, fixed: false }));
  order.slice(0, p.wilds).forEach((j) => (descs[j].wild = true));
  order.slice(p.wilds, p.wilds + p.fixed).forEach((j) => (descs[j].fixed = true));
  // 패턴 순서: 세트를 소비하는 패턴들 + 준비 이동(relocation)을 임의 위치에 끼움
  const plan: Macro[] = [];
  let rem = T;
  while (rem > 0) { const k = chooseKind(p, rem, rng); plan.push(k); rem -= k === 'double' || k === 'cascade' ? 2 : 1; }
  for (let i = 0; i < p.relocations; i++) plan.splice(ri(rng, 0, plan.length), 0, 'reloc');

  let Q: RoomState = { shelves: Array(p.shelves).fill(''), cleared: T };
  const rev: Move[] = [];
  let setsIn = 0;
  for (const kind of plan) {
    const need = kind === 'double' || kind === 'cascade' ? 2 : kind === 'reloc' ? 0 : 1;
    let done = false;
    for (let attempt = 0; attempt < 250 && !done; attempt++) {
      const ds = descs.slice(setsIn, setsIn + need);
      const prop = propose(kind, Q, cfg, ds, rng);
      if (!prop) continue;
      const pre: RoomState = { shelves: prop.shelves, cleared: T - (setsIn + prop.sets) };
      // 검증: 앞으로 실행해 직전 상태(Q)와 정확히 같아야 함
      if (!validState(cfg, pre) || !isLegal(cfg, pre, prop.move)) continue;
      const res = applyMove(cfg, pre, prop.move);
      if (res.setsCleared !== prop.sets || res.state.cleared !== Q.cleared) continue;
      if (res.state.shelves.some((sh, i) => sh !== Q.shelves[i])) continue;
      Q = pre; rev.push(prop.move); setsIn += prop.sets; done = true;
    }
    if (!done) return null;
  }
  if (setsIn !== T) return null;
  const witness = rev.reverse();
  // 최종 재생 검증(처음부터 끝까지)
  let cur = Q; const first = Q;
  for (const m of witness) { if (!isLegal(cfg, cur, m)) return null; cur = applyMove(cfg, cur, m).state; }
  if (!isWon(cur)) return null;
  return { cfg, initial: first, witness, par: witness.length, limit: witness.length + p.slack, sets: T, params: p };
}

/**
 * 시드 → 항상 같은 퍼즐. 드물게 실패하면 시드를 바꿔 다시 시도하고,
 * 그래도 안 되면(자리가 빠듯한 설정) 준비 이동(relocation)을 하나씩 줄여가며 만든다 — 퍼즐은 항상 반환됨.
 */
export function generatePuzzle(p: ToyParams, seed: number): Puzzle {
  for (let reloc = p.relocations; reloc >= 0; reloc--) {
    const q = reloc === p.relocations ? p : { ...p, relocations: reloc };
    for (let attempt = 0; attempt < 120; attempt++) {
      const out = build(q, mulberry32(mixSeed(seed, 0x70e0 + attempt + reloc * 1000)));
      if (out) return { ...out, params: p };
    }
  }
  throw new Error(`퍼즐 생성 실패: level ${p.level}`);
}
