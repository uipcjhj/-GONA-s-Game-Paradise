/**
 * 고나의 편가르기 대소동 — 순수 로직(렌더링과 분리, 전부 단위 테스트 대상).
 *
 * 카드(고나 친구)는 색 · 표정 · 특징 3축을 가지고, 규칙에 따라 2~3개 분류함 중 하나로 보냅니다.
 * 난이도: 단일 조건 → 복합(그리고/또는) → 제외 → 3분류 → 규칙 반전(도중에 좌우가 뒤집힘)
 */
import { mixSeed, mulberry32, shuffle, type Rng } from '../../core/rng';

// ───────────────────────── 카드와 조건
export type Axis = 'color' | 'face' | 'feature';

export const AXES: readonly Axis[] = ['color', 'face', 'feature'];
export const AXIS_VALUES: Record<Axis, readonly string[]> = {
  color: ['red', 'blue', 'green', 'yellow'],
  face: ['smile', 'cry', 'angry', 'sleepy'],
  feature: ['ribbon', 'hat', 'glasses', 'none'],
};
/** 비활성 축의 고정값(낮은 레벨에서는 색만, 그다음 표정까지 달라짐) */
const NEUTRAL: Card = { color: 'red', face: 'smile', feature: 'none' };

export const LABEL: Record<string, string> = {
  red: '빨강', blue: '파랑', green: '초록', yellow: '노랑',
  smile: '웃는 얼굴', cry: '우는 얼굴', angry: '화난 얼굴', sleepy: '졸린 얼굴',
  ribbon: '리본', hat: '모자', glasses: '안경', none: '없음',
};

export interface Card { color: string; face: string; feature: string }
export interface Cond { axis: Axis; value: string }
export type RuleKind = 'single' | 'and' | 'or' | 'exclude' | 'three';
/**
 * single : conds[0] 이면 왼쪽, 아니면 오른쪽
 * and    : conds[0] 그리고 conds[1]
 * or     : conds[0] 또는 conds[1]
 * exclude: conds[0] 이면서 conds[1] 은 아닌 것(제외)
 * three  : conds[0] → 왼쪽, conds[1] → 오른쪽, 둘 다 아니면 가운데(위로)  (같은 축의 서로 다른 값 → 겹침 없음)
 */
export interface Rule { kind: RuleKind; conds: Cond[] }

export const has = (card: Card, c: Cond) => card[c.axis] === c.value;
export const binCount = (rule: Rule) => (rule.kind === 'three' ? 3 : 2);
export const mirrorBin = (bin: number, bins: number) => bins - 1 - bin;

/** 반전 전 기준 정답 분류함 (0=왼쪽 · 1=오른쪽/가운데 · 2=오른쪽) */
export function baseBin(card: Card, rule: Rule): number {
  const [a, b] = rule.conds;
  switch (rule.kind) {
    case 'single': return has(card, a) ? 0 : 1;
    case 'and': return has(card, a) && has(card, b) ? 0 : 1;
    case 'or': return has(card, a) || has(card, b) ? 0 : 1;
    case 'exclude': return has(card, a) && !has(card, b) ? 0 : 1;
    case 'three': return has(card, a) ? 0 : has(card, b) ? 2 : 1;
  }
}

/** 실제(눈에 보이는) 정답 분류함. 반전 중이면 좌우가 뒤바뀜 */
export const answerBin = (card: Card, rule: Rule, reversed: boolean) =>
  reversed ? mirrorBin(baseBin(card, rule), binCount(rule)) : baseBin(card, rule);

/** 함정 규칙인지: 조건이 둘인 규칙에서 '반만 맞는' 카드(제외는 제외 특징을 가진 카드)가 함정 */
export function isTricky(card: Card, rule: Rule): boolean {
  const [a, b] = rule.conds;
  if (rule.kind === 'and' || rule.kind === 'or') return has(card, a) !== has(card, b);
  if (rule.kind === 'exclude') return has(card, b);
  return false;
}
/** 함정 카드가 존재하는 기준 분류함(반전 전): 그리고/제외 → 오른쪽(반만 맞음·제외 특징), 또는 → 왼쪽 */
const TRICKY_BASE_BINS: Partial<Record<RuleKind, number[]>> = { and: [1], or: [0], exclude: [1] };
const hasTrickyCards = (rule: Rule) => rule.kind === 'and' || rule.kind === 'or' || rule.kind === 'exclude';

// ───────────────────────── 표시 문구
export const condLabel = (c: Cond) => LABEL[c.value];

function matchLabel(rule: Rule): string {
  const [a, b] = rule.conds;
  switch (rule.kind) {
    case 'single': return condLabel(a);
    case 'and': return `${condLabel(a)} + ${condLabel(b)}`;
    case 'or': return `${condLabel(a)} 또는 ${condLabel(b)}`;
    case 'exclude': return `${condLabel(a)} (${condLabel(b)} 제외)`;
    case 'three': return condLabel(a);
  }
}

/** 분류함 라벨(왼쪽 → 오른쪽 순서). 반전 중이면 위치가 바뀜 */
export function binLabels(rule: Rule, reversed: boolean): string[] {
  const base = rule.kind === 'three' ? [condLabel(rule.conds[0]), '나머지', condLabel(rule.conds[1])] : [matchLabel(rule), '나머지'];
  return reversed ? base.slice().reverse() : base;
}

export const SIDES_2 = ['왼쪽', '오른쪽'] as const;
export const SIDES_3 = ['왼쪽', '가운데', '오른쪽'] as const;
export const sideName = (bin: number, bins: number) => (bins === 3 ? SIDES_3[bin] : SIDES_2[bin]);

export function ruleHint(rule: Rule, reversed: boolean): string {
  const side = sideName(reversed ? 1 : 0, 2);
  const text = {
    single: `이 특징이면 ${side}으로!`,
    and: `둘 다 가졌으면 ${side}으로!`,
    or: `하나라도 있으면 ${side}으로!`,
    exclude: `앞 특징만! 제외 특징이 있으면 안 돼요`,
    three: '세 쪽으로 나눠요! 나머지는 위로',
  }[rule.kind];
  return text;
}

export interface Explain {
  parts: { label: string; ok: boolean; excluded: boolean }[];
  side: string;
  text: string;
}

/** 오답 설명: 어느 특징이 맞고 틀렸는지 + 정답 방향 */
export function explain(card: Card, rule: Rule, reversed: boolean): Explain {
  const bins = binCount(rule);
  const side = sideName(answerBin(card, rule, reversed), bins);
  const parts = rule.conds.map((c, i) => ({ label: condLabel(c), ok: has(card, c), excluded: rule.kind === 'exclude' && i === 1 }));
  const body = parts.map((p) => `${p.label}${p.excluded ? '(제외)' : ''} ${p.ok ? '○' : '×'}`).join(' · ');
  return { parts, side, text: `${body} → 정답은 ${side}${reversed ? ' (반전 중!)' : ''}` };
}

// ───────────────────────── 난이도
export const MAX_LEVEL = 10;

export interface SortParams {
  level: number;
  /** 처리해야 하는 카드 수(= 라운드 목표) */
  goal: number;
  maxMistakes: number;
  kinds: RuleKind[];
  axes: Axis[];
  /** 라운드 중 규칙 반전 횟수 */
  reversals: number;
  /** 함정 카드 비율(복합·제외 규칙) */
  trickyRate: number;
  /** 이 시간 안에 답하면 빠른 판단 보너스(ms) */
  fastMs: number;
  /** 오답 뒤 입력 잠금(ms) — 연타 방지 */
  lockMs: number;
  /** 규칙 반전 예고 시간(ms) */
  announceMs: number;
}

const KINDS_BY_LEVEL: RuleKind[][] = [
  ['single'], ['single'], ['single'],
  ['and'], ['and', 'or'], ['and', 'or', 'exclude'],
  ['exclude', 'three'],
  ['and', 'or', 'exclude', 'three'], ['and', 'or', 'exclude', 'three'], ['and', 'or', 'exclude', 'three'],
];
const TRICKY_BY_LEVEL = [0, 0, 0, 0.3, 0.4, 0.5, 0.6, 0.6, 0.6, 0.6];

export function difficulty(level: number): SortParams {
  const l = Math.min(Math.max(1, Math.floor(level)), MAX_LEVEL);
  return {
    level: l,
    goal: 10 + Math.round(((l - 1) * 6) / 9),
    maxMistakes: 3,
    kinds: KINDS_BY_LEVEL[l - 1],
    axes: l === 1 ? ['color'] : l === 2 ? ['color', 'face'] : ['color', 'face', 'feature'],
    reversals: l < 8 ? 0 : l - 7,
    trickyRate: TRICKY_BY_LEVEL[l - 1],
    fastMs: 800,
    lockMs: 350,
    announceMs: 700,
  };
}

/** 제한시간(초): 카드당 3.2초(L1) → 2.0초(L10) + 4초 여유. 두 모드 공통 */
export function timeLimitSec(level: number): number {
  const p = difficulty(level);
  const perCard = 3.2 - ((p.level - 1) * 1.2) / 9;
  return Math.ceil(p.goal * perCard + 4);
}

// ───────────────────────── 라운드 생성 (시드 → 항상 같은 출제, 항상 정답이 하나)
export interface RoundCard { card: Card; bin: number }
export interface RoundPlan { rule: Rule; reverseAt: number[]; cards: RoundCard[] }

const condPool = (axis: Axis) => AXIS_VALUES[axis].filter((v) => v !== 'none');
const pick = <T,>(rng: Rng, xs: readonly T[]) => xs[Math.floor(rng() * xs.length)];
const randomCond = (rng: Rng, axis: Axis): Cond => ({ axis, value: pick(rng, condPool(axis)) });

export function makeRule(p: SortParams, rng: Rng): Rule {
  const feasible = p.kinds.filter((k) => k === 'single' || k === 'three' || p.axes.length >= 2);
  const kind = pick(rng, feasible.length ? feasible : (['single'] as RuleKind[]));
  if (kind === 'single') return { kind, conds: [randomCond(rng, pick(rng, p.axes))] };
  if (kind === 'three') {
    const axis = pick(rng, p.axes);
    const [a, b] = shuffle(condPool(axis), rng);
    return { kind, conds: [{ axis, value: a }, { axis, value: b }] };
  }
  const [x, y] = shuffle(p.axes, rng);
  return { kind, conds: [randomCond(rng, x), randomCond(rng, y)] };
}

/** 반전 위치: 카드 번호(0부터)로, 균등 간격. 첫 카드는 반전 없음 */
export function reversalIndexes(goal: number, n: number): number[] {
  return Array.from({ length: n }, (_, k) => Math.max(1, Math.floor((goal * (k + 1)) / (n + 1))));
}
export const reversedAt = (reverseAt: readonly number[], index: number) => reverseAt.filter((i) => i <= index).length % 2 === 1;

function allCards(axes: readonly Axis[]): Card[] {
  let out: Card[] = [{ ...NEUTRAL }];
  for (const ax of axes) out = out.flatMap((c) => AXIS_VALUES[ax].map((v) => ({ ...c, [ax]: v })));
  return out;
}
const sameCard = (a: Card | null, b: Card) => !!a && a.color === b.color && a.face === b.face && a.feature === b.feature;

function sampleCard(rng: Rng, p: SortParams, rule: Rule, wantBase: number, wantTricky: boolean, prev: Card | null): Card {
  const space = allCards(p.axes).filter((c) => baseBin(c, rule) === wantBase);
  const strict = space.filter((c) => (!wantTricky || isTricky(c, rule)) && !sameCard(prev, c));
  if (strict.length) return pick(rng, strict);
  const noRepeat = space.filter((c) => !sameCard(prev, c));
  return pick(rng, noRepeat.length ? noRepeat : space);
}

export function buildRound(p: SortParams, seed: number): RoundPlan {
  const rng = mulberry32(mixSeed(seed, 0x50727)); // 'sort' 전용 시드 공간
  const rule = makeRule(p, rng);
  const bins = binCount(rule);
  const reverseAt = reversalIndexes(p.goal, p.reversals);
  const maxRun = bins === 2 ? 3 : 2;
  const cards: RoundCard[] = [];
  let prev: Card | null = null;
  let last = -1;
  let run = 0;
  for (let i = 0; i < p.goal; i++) {
    const reversed = reversedAt(reverseAt, i);
    const toBase = (b: number) => (reversed ? mirrorBin(b, bins) : b);
    let options = [...Array(bins).keys()].filter((b) => !(b === last && run >= maxRun));
    // 함정을 먼저 정하고, 함정 카드가 실제로 존재하는 분류함 안에서 방향을 고름
    let tricky = hasTrickyCards(rule) && rng() < p.trickyRate;
    if (tricky) {
      const trickyOptions = options.filter((b) => TRICKY_BASE_BINS[rule.kind]?.includes(toBase(b)));
      if (trickyOptions.length) options = trickyOptions;
      else tricky = false;
    }
    const target = pick(rng, options);
    const wantBase = toBase(target);
    const card = sampleCard(rng, p, rule, wantBase, tricky, prev);
    cards.push({ card, bin: target });
    run = target === last ? run + 1 : 1;
    last = target;
    prev = card;
  }
  return { rule, reverseAt, cards };
}

// ───────────────────────── 진행 상태 · 입력 판정
export const BASE_POINTS = 100;
export const FAST_BONUS = 50;
export const CLEAR_BONUS = 300;

export interface SortState {
  params: SortParams;
  plan: RoundPlan;
  /** 지금 보여 주는 카드 번호. goal 이 되면 모두 처리한 것 */
  index: number;
  correct: number;
  mistakes: number;
  combo: number;
  bestCombo: number;
  /** 현재 카드를 보여 준 뒤 흐른 시간(잠금·예고 시간 제외) */
  cardMs: number;
  lockMs: number;
  announceMs: number;
}

export function createState(params: SortParams, seed: number): SortState {
  return { params, plan: buildRound(params, seed), index: 0, correct: 0, mistakes: 0, combo: 0, bestCombo: 0, cardMs: 0, lockMs: 0, announceMs: 0 };
}

export const currentCard = (s: SortState): RoundCard | undefined => s.plan.cards[s.index];
export const isReversed = (s: SortState) => reversedAt(s.plan.reverseAt, Math.min(s.index, s.params.goal - 1));
export const isLocked = (s: SortState) => s.lockMs > 0 || s.announceMs > 0;

export type SortStatus = 'playing' | 'clear' | 'fail';
export const status = (s: SortState): SortStatus => (s.mistakes >= s.params.maxMistakes ? 'fail' : s.index >= s.params.goal ? 'clear' : 'playing');

export type AnswerResult =
  | { kind: 'ignored'; reason: 'locked' | 'done' }
  | { kind: 'correct'; points: number; fast: boolean; combo: number }
  | { kind: 'wrong'; explain: Explain; expectedBin: number };

/** 분류함 번호(왼쪽부터 0)로 답하기. 스와이프·분류함 탭·키보드 모두 이 함수로 합류 */
export function answer(s: SortState, bin: number): AnswerResult {
  if (status(s) !== 'playing') return { kind: 'ignored', reason: 'done' };
  if (isLocked(s)) return { kind: 'ignored', reason: 'locked' };
  const rc = s.plan.cards[s.index];
  let res: AnswerResult;
  if (bin === rc.bin) {
    s.correct++;
    s.combo++;
    s.bestCombo = Math.max(s.bestCombo, s.combo);
    const fast = s.cardMs <= s.params.fastMs;
    res = { kind: 'correct', points: BASE_POINTS + (fast ? FAST_BONUS : 0), fast, combo: s.combo };
  } else {
    s.mistakes++;
    s.combo = 0;
    s.lockMs = s.params.lockMs;
    res = { kind: 'wrong', explain: explain(rc.card, s.plan.rule, isReversed(s)), expectedBin: rc.bin };
  }
  s.index++;
  s.cardMs = 0;
  if (s.index < s.params.goal && s.plan.reverseAt.includes(s.index)) s.announceMs = s.params.announceMs;
  return res;
}

/** 시간 경과. 잠금/예고가 끝났으면 true(화면 갱신 필요) */
export function tick(s: SortState, dtMs: number): boolean {
  if (s.announceMs > 0) {
    s.announceMs = Math.max(0, s.announceMs - dtMs);
    return s.announceMs === 0;
  }
  if (s.lockMs > 0) {
    s.lockMs = Math.max(0, s.lockMs - dtMs);
    return s.lockMs === 0;
  }
  s.cardMs += dtMs;
  return false;
}

/** 스와이프 → 분류함. 가로가 우세하면 좌/우, 3분류에서만 위로 밀기 = 가운데. 짧거나 애매하면 null(원위치) */
export function swipeToBin(dx: number, dy: number, bins: number, min = 36): number | null {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax >= min && ax > ay) return dx < 0 ? 0 : bins - 1;
  if (bins === 3 && dy <= -min && ay >= ax) return 1;
  return null;
}
