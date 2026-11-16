/**
 * 고나의 폴짝폴짝 줄넘기 (jump) — 규칙·판정(순수, 헤드리스 테스트).
 * 줄이 한 바퀴 돌 때마다 발밑을 지나감(pass). 화면을 탭하면 고나가 AIR_MS 동안 공중에 뜸.
 * 줄이 지나가는 순간 공중이면 성공(점프 한가운데에 가까울수록 PERFECT), 땅에 있으면 MISS(걸림).
 * 입력 지연 보정: 터치 → 이벤트 도착까지의 지연(INPUT_LAG_MS)만큼 탭 시각을 앞당겨 판정.
 */
import { mulberry32 } from '../../core/rng';

export const MAX_LEVEL = 10;
export const AIR_MS = 440;
/** 판정 창: 줄이 지날 때 점프 중심과의 차이 */
export const PERFECT_MS = 70;
/** 모바일 브라우저 터치 지연 보정(임시값 — 실제 기기 측정으로 조정) */
export const INPUT_LAG_MS = 35;

export interface JumpParams {
  goal: number;
  maxMiss: number;
  /** 한 바퀴 시간(ms) 시작값 → 판 안에서 끝값까지 점점 빨라짐 */
  periodStart: number;
  periodEnd: number;
  /** 박자 바꾸기: 이 확률로 한 바퀴가 짧거나 길어짐(L5~) */
  rhythm: number;
  /** 두 번 연속 빠른 줄(더블) 확률(L7~) */
  double: number;
}
/** 임시 설계값(실제 플레이로 조정 필요) */
export const TUNING: JumpParams[] = [
  { goal: 18, maxMiss: 3, periodStart: 1150, periodEnd: 1050, rhythm: 0, double: 0 },
  { goal: 20, maxMiss: 3, periodStart: 1100, periodEnd: 950, rhythm: 0, double: 0 },
  { goal: 22, maxMiss: 3, periodStart: 1050, periodEnd: 880, rhythm: 0, double: 0 },
  { goal: 24, maxMiss: 3, periodStart: 1000, periodEnd: 820, rhythm: 0.12, double: 0 },
  { goal: 26, maxMiss: 3, periodStart: 960, periodEnd: 780, rhythm: 0.2, double: 0 },
  { goal: 28, maxMiss: 3, periodStart: 930, periodEnd: 740, rhythm: 0.25, double: 0.06 },
  { goal: 30, maxMiss: 3, periodStart: 900, periodEnd: 710, rhythm: 0.28, double: 0.1 },
  { goal: 32, maxMiss: 3, periodStart: 870, periodEnd: 690, rhythm: 0.3, double: 0.13 },
  { goal: 34, maxMiss: 3, periodStart: 850, periodEnd: 670, rhythm: 0.33, double: 0.16 },
  { goal: 36, maxMiss: 3, periodStart: 830, periodEnd: 650, rhythm: 0.36, double: 0.2 },
];
export const difficulty = (level: number): JumpParams => ({ ...TUNING[Math.min(MAX_LEVEL, Math.max(1, level)) - 1] });
export function timeLimitSec(level: number): number {
  const p = difficulty(level);
  return Math.min(60, Math.round(((p.goal + p.maxMiss) * (p.periodStart + p.periodEnd)) / 2 / 1000 + 8));
}

export type Judge = 'perfect' | 'good' | 'miss';
export interface JumpState {
  params: JumpParams;
  rand: () => number;
  t: number;
  /** 지난 통과 시각 · 다음 통과 시각 (줄 위상 계산용) */
  lastPass: number;
  nextPass: number;
  /** 다음 바퀴가 박자 변화(빠름/느림/더블)인지 — 화면 예고용 */
  nextKind: 'normal' | 'fast' | 'slow' | 'double';
  jumpAt: number | null;
  passes: number;
  ok: number;
  miss: number;
  perfect: number;
  combo: number;
  bestCombo: number;
  events: { type: 'pass'; judge: Judge; offset: number }[];
  pendingDouble: boolean;
}
const basePeriod = (s: JumpState) => {
  const k = Math.min(1, s.ok / Math.max(1, s.params.goal - 1));
  return s.params.periodStart + (s.params.periodEnd - s.params.periodStart) * k;
};
function planNext(s: JumpState): void {
  const p = basePeriod(s);
  let period = p;
  let kind: JumpState['nextKind'] = 'normal';
  if (s.pendingDouble) {
    period = Math.max(AIR_MS + 160, p * 0.62);
    kind = 'double';
    s.pendingDouble = false;
  } else if (s.passes >= 3 && s.rand() < s.params.double) {
    s.pendingDouble = true; // 다음 다음 바퀴가 빠른 두 번째
  } else if (s.passes >= 2 && s.rand() < s.params.rhythm) {
    const fast = s.rand() < 0.5;
    period = fast ? Math.max(AIR_MS + 180, p * 0.78) : p * 1.3;
    kind = fast ? 'fast' : 'slow';
  }
  s.lastPass = s.nextPass;
  s.nextPass = s.lastPass + period;
  s.nextKind = kind;
}
export function createState(params: JumpParams, seed: number): JumpState {
  const s: JumpState = { params, rand: mulberry32(seed), t: 0, lastPass: 0, nextPass: 0, nextKind: 'normal', jumpAt: null, passes: 0, ok: 0, miss: 0, perfect: 0, combo: 0, bestCombo: 0, events: [], pendingDouble: false };
  // 첫 통과는 시작 후 한 바퀴 반 뒤(줄 움직임을 보고 박자를 익힐 시간)
  s.lastPass = -params.periodStart * 0.5;
  s.nextPass = params.periodStart * 1.0;
  return s;
}
/** 줄 위상 0~1 (0 = 발밑 통과, 0.5 = 머리 위) */
export const ropePhase = (s: JumpState) => Math.max(0, Math.min(1, (s.t - s.lastPass) / (s.nextPass - s.lastPass)));
export const airborne = (s: JumpState, at = s.t) => s.jumpAt !== null && at >= s.jumpAt && at < s.jumpAt + AIR_MS;
/** 점프 높이 0~1 (포물선) */
export function jumpHeight(s: JumpState): number {
  if (!airborne(s)) return 0;
  const u = (s.t - (s.jumpAt as number)) / AIR_MS;
  return 4 * u * (1 - u);
}

/** 탭: 땅에 있을 때만 점프. 반환: 점프했는지 */
export function tap(s: JumpState): boolean {
  if (airborne(s)) return false;
  s.jumpAt = s.t - INPUT_LAG_MS;
  if (airborne(s)) return true;
  // 보정으로 이미 착지한 셈이면 지금 바로 점프
  s.jumpAt = s.t;
  return true;
}
export function step(s: JumpState, dtMs: number): void {
  s.t += dtMs;
  while (s.t >= s.nextPass) {
    const at = s.nextPass;
    s.passes++;
    let judge: Judge = 'miss';
    let offset = 0;
    if (airborne(s, at)) {
      offset = at - ((s.jumpAt as number) + AIR_MS / 2);
      judge = Math.abs(offset) <= PERFECT_MS ? 'perfect' : 'good';
    }
    if (judge === 'miss') {
      s.miss++;
      s.combo = 0;
    } else {
      s.ok++;
      s.combo++;
      s.bestCombo = Math.max(s.bestCombo, s.combo);
      if (judge === 'perfect') s.perfect++;
    }
    s.events.push({ type: 'pass', judge, offset });
    planNext(s);
  }
}
export type JumpStatus = 'playing' | 'clear' | 'fail';
export const status = (s: JumpState): JumpStatus => (s.miss >= s.params.maxMiss ? 'fail' : s.ok >= s.params.goal ? 'clear' : 'playing');
export const POINTS: Record<Exclude<Judge, 'miss'>, number> = { perfect: 150, good: 100 };
/** 테스트용: 다음 통과에 점프 중심을 맞추려면 탭해야 하는 시각(보정 포함) */
export const idealTapAt = (s: JumpState) => s.nextPass - AIR_MS / 2 + INPUT_LAG_MS;
