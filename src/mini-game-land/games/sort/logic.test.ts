import { describe, expect, it } from 'vitest';
import {
  AXIS_VALUES, FAST_BONUS, BASE_POINTS, MAX_LEVEL, answer, answerBin, baseBin, binCount, binLabels, buildRound, createState, currentCard, difficulty,
  explain, isLocked, isReversed, isTricky, mirrorBin, reversalIndexes, reversedAt, status, swipeToBin, tick, timeLimitSec,
  type Card, type Rule, type SortState,
} from './logic';

const c = (color: string, face = 'smile', feature = 'none'): Card => ({ color, face, feature });
const red = { axis: 'color', value: 'red' } as const;
const blue = { axis: 'color', value: 'blue' } as const;
const glasses = { axis: 'feature', value: 'glasses' } as const;
const angry = { axis: 'face', value: 'angry' } as const;

const SINGLE: Rule = { kind: 'single', conds: [red] };
const AND: Rule = { kind: 'and', conds: [red, glasses] };
const OR: Rule = { kind: 'or', conds: [red, glasses] };
const EXCL: Rule = { kind: 'exclude', conds: [red, angry] };
const THREE: Rule = { kind: 'three', conds: [red, blue] };

describe('분류 규칙', () => {
  it('단일: 해당 특징이면 왼쪽(0), 아니면 오른쪽(1)', () => {
    expect(baseBin(c('red'), SINGLE)).toBe(0);
    expect(baseBin(c('blue'), SINGLE)).toBe(1);
  });
  it('그리고: 둘 다 있어야 왼쪽 (하나만 있으면 오른쪽 = 함정)', () => {
    expect(baseBin(c('red', 'smile', 'glasses'), AND)).toBe(0);
    expect(baseBin(c('red'), AND)).toBe(1);
    expect(baseBin(c('blue', 'smile', 'glasses'), AND)).toBe(1);
    expect(isTricky(c('red'), AND)).toBe(true);
    expect(isTricky(c('red', 'smile', 'glasses'), AND)).toBe(false);
    expect(isTricky(c('blue'), AND)).toBe(false);
  });
  it('또는: 하나라도 있으면 왼쪽', () => {
    expect(baseBin(c('red'), OR)).toBe(0);
    expect(baseBin(c('blue', 'smile', 'glasses'), OR)).toBe(0);
    expect(baseBin(c('blue'), OR)).toBe(1);
  });
  it('제외: 앞 특징이면서 제외 특징이 없어야 왼쪽', () => {
    expect(baseBin(c('red', 'smile'), EXCL)).toBe(0);
    expect(baseBin(c('red', 'angry'), EXCL)).toBe(1);
    expect(baseBin(c('blue', 'smile'), EXCL)).toBe(1);
    expect(isTricky(c('red', 'angry'), EXCL)).toBe(true);
  });
  it('3분류: 왼쪽/오른쪽/나머지(가운데), 같은 축이라 겹치지 않음', () => {
    expect(binCount(THREE)).toBe(3);
    expect(baseBin(c('red'), THREE)).toBe(0);
    expect(baseBin(c('blue'), THREE)).toBe(2);
    expect(baseBin(c('green'), THREE)).toBe(1);
  });
  it('반전: 좌우만 뒤바뀌고 가운데는 그대로', () => {
    expect(mirrorBin(0, 2)).toBe(1);
    expect(answerBin(c('red'), SINGLE, true)).toBe(1);
    expect(answerBin(c('blue'), SINGLE, true)).toBe(0);
    expect(answerBin(c('red'), THREE, true)).toBe(2);
    expect(answerBin(c('green'), THREE, true)).toBe(1);
  });
  it('분류함 라벨: 반전 시 위치가 바뀜', () => {
    expect(binLabels(SINGLE, false)).toEqual(['빨강', '나머지']);
    expect(binLabels(SINGLE, true)).toEqual(['나머지', '빨강']);
    expect(binLabels(AND, false)[0]).toBe('빨강 + 안경');
    expect(binLabels(OR, false)[0]).toBe('빨강 또는 안경');
    expect(binLabels(EXCL, false)[0]).toBe('빨강 (화난 얼굴 제외)');
    expect(binLabels(THREE, false)).toEqual(['빨강', '나머지', '파랑']);
    expect(binLabels(THREE, true)).toEqual(['파랑', '나머지', '빨강']);
  });
  it('오답 설명: 각 특징의 ○/× 와 정답 방향', () => {
    const e = explain(c('red', 'smile', 'none'), AND, false);
    expect(e.parts.map((p) => p.ok)).toEqual([true, false]);
    expect(e.side).toBe('오른쪽');
    expect(e.text).toContain('빨강 ○');
    expect(e.text).toContain('안경 ×');
    expect(explain(c('red'), SINGLE, true).text).toContain('반전');
    expect(explain(c('red', 'angry'), EXCL, false).text).toContain('(제외) ○');
  });
});

describe('난이도: 단일 → 복합 → 제외 → 3분류 → 반전', () => {
  it('레벨별 규칙 종류가 점진적으로 확장', () => {
    for (const l of [1, 2, 3]) expect(difficulty(l).kinds).toEqual(['single']);
    expect(difficulty(4).kinds).toContain('and');
    expect(difficulty(4).kinds).not.toContain('single');
    expect(difficulty(5).kinds).toContain('or');
    expect(difficulty(6).kinds).toContain('exclude');
    expect(difficulty(7).kinds).toContain('three');
    expect(difficulty(10).kinds).toEqual(expect.arrayContaining(['and', 'or', 'exclude', 'three']));
  });
  it('활성 특징 축: 색 → 색+표정 → 전체', () => {
    expect(difficulty(1).axes).toEqual(['color']);
    expect(difficulty(2).axes).toEqual(['color', 'face']);
    expect(difficulty(3).axes).toEqual(['color', 'face', 'feature']);
  });
  it('반전은 L8 부터: 1·2·3회', () => {
    expect([1, 7, 8, 9, 10].map((l) => difficulty(l).reversals)).toEqual([0, 0, 1, 2, 3]);
  });
  it('목표 카드 10 → 16, 함정 비율 0 → 0.6, 단조 증가', () => {
    expect(difficulty(1).goal).toBe(10);
    expect(difficulty(MAX_LEVEL).goal).toBe(16);
    for (let l = 2; l <= MAX_LEVEL; l++) {
      expect(difficulty(l).goal).toBeGreaterThanOrEqual(difficulty(l - 1).goal);
      expect(difficulty(l).trickyRate).toBeGreaterThanOrEqual(difficulty(l - 1).trickyRate);
    }
    expect(difficulty(1).trickyRate).toBe(0);
    expect(difficulty(99)).toEqual(difficulty(MAX_LEVEL));
    expect(difficulty(0)).toEqual(difficulty(1));
  });
  it('제한시간은 목표를 처리할 수 있을 만큼 충분(카드당 ≥ 2초)', () => {
    for (let l = 1; l <= MAX_LEVEL; l++) expect(timeLimitSec(l) / difficulty(l).goal).toBeGreaterThanOrEqual(2);
  });
  it('반전 위치: 첫 카드 제외·균등 간격', () => {
    expect(reversalIndexes(16, 3)).toEqual([4, 8, 12]);
    expect(reversalIndexes(10, 0)).toEqual([]);
    for (const i of reversalIndexes(11, 3)) expect(i).toBeGreaterThanOrEqual(1);
    expect(reversedAt([4, 8], 3)).toBe(false);
    expect(reversedAt([4, 8], 4)).toBe(true);
    expect(reversedAt([4, 8], 8)).toBe(false);
  });
});

describe('라운드 생성', () => {
  const seeds = Array.from({ length: 60 }, (_, i) => i * 7919 + 3);

  it('같은 시드 → 같은 출제, 다른 시드 → 다른 출제', () => {
    const p = difficulty(8);
    expect(buildRound(p, 42)).toEqual(buildRound(p, 42));
    expect(JSON.stringify(buildRound(p, 42))).not.toBe(JSON.stringify(buildRound(p, 43)));
  });

  it('모든 레벨·시드에서 정답이 규칙과 일치하고 카드 수가 목표와 같음', () => {
    for (let l = 1; l <= MAX_LEVEL; l++) {
      const p = difficulty(l);
      for (const seed of seeds) {
        const plan = buildRound(p, seed);
        expect(plan.cards).toHaveLength(p.goal);
        plan.cards.forEach((rc, i) => {
          expect(rc.bin).toBe(answerBin(rc.card, plan.rule, reversedAt(plan.reverseAt, i)));
          expect(rc.bin).toBeGreaterThanOrEqual(0);
          expect(rc.bin).toBeLessThan(binCount(plan.rule));
        });
        expect(p.kinds).toContain(plan.rule.kind);
        expect(plan.reverseAt).toHaveLength(p.reversals);
      }
    }
  });

  it('레벨 1~2: 비활성 특징은 카드에서 고정(색만/색+표정만 달라짐)', () => {
    for (const seed of seeds) {
      for (const rc of buildRound(difficulty(1), seed).cards) {
        expect(rc.card.face).toBe('smile');
        expect(rc.card.feature).toBe('none');
      }
      for (const rc of buildRound(difficulty(2), seed).cards) expect(rc.card.feature).toBe('none');
    }
  });

  it('조건 축·값이 유효하고 복합 규칙의 두 조건은 서로 다른 축, 3분류는 같은 축의 다른 값', () => {
    for (let l = 1; l <= MAX_LEVEL; l++)
      for (const seed of seeds) {
        const { rule } = buildRound(difficulty(l), seed);
        for (const cond of rule.conds) {
          expect(AXIS_VALUES[cond.axis]).toContain(cond.value);
          expect(cond.value).not.toBe('none');
        }
        if (rule.kind === 'three') {
          expect(rule.conds[0].axis).toBe(rule.conds[1].axis);
          expect(rule.conds[0].value).not.toBe(rule.conds[1].value);
        } else if (rule.kind !== 'single') expect(rule.conds[0].axis).not.toBe(rule.conds[1].axis);
      }
  });

  it('한쪽으로 쏠리지 않음: 같은 방향 연속 상한(2분류 3장 · 3분류 2장), L2+ 같은 카드 연속 없음', () => {
    // L1 은 색 4종뿐이라 '일치하는 카드'가 1장 → 같은 방향이 이어지면 같은 카드가 나올 수밖에 없음(상한은 그대로 지킴)
    for (let l = 1; l <= MAX_LEVEL; l++)
      for (const seed of seeds) {
        const { rule, cards } = buildRound(difficulty(l), seed);
        const maxRun = binCount(rule) === 2 ? 3 : 2;
        let run = 1;
        for (let i = 1; i < cards.length; i++) {
          run = cards[i].bin === cards[i - 1].bin ? run + 1 : 1;
          expect(run).toBeLessThanOrEqual(maxRun);
          if (l >= 2) expect(cards[i].card).not.toEqual(cards[i - 1].card);
        }
      }
  });

  it('함정 카드: 복합·제외 규칙에서 레벨이 오를수록 많아지고, L1~3 단일에는 없음', () => {
    const rate = (l: number) => {
      let tricky = 0, total = 0;
      for (const seed of seeds) {
        const { rule, cards } = buildRound(difficulty(l), seed);
        if (rule.kind !== 'and' && rule.kind !== 'or' && rule.kind !== 'exclude') continue;
        for (const rc of cards) { total++; if (isTricky(rc.card, rule)) tricky++; }
      }
      return total ? tricky / total : 0;
    };
    expect(rate(4)).toBeGreaterThan(0.25);
    expect(rate(7)).toBeGreaterThan(0.4);
    expect(rate(7)).toBeGreaterThan(rate(4));
  });

  it('반전 구간에서도 양쪽 분류함이 모두 쓰임', () => {
    for (const seed of seeds) {
      const plan = buildRound(difficulty(10), seed);
      expect(new Set(plan.cards.map((x) => x.bin)).size).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('입력 판정 · 점수 · 종료', () => {
  const stateAt = (level: number, seed = 5): SortState => createState(difficulty(level), seed);
  const right = (s: SortState) => currentCard(s)!.bin;
  const wrongBin = (s: SortState) => (right(s) === 0 ? binCount(s.plan.rule) - 1 : 0);

  it('정답: 기본 100점, 콤보 증가, 다음 카드로', () => {
    const s = stateAt(1);
    s.cardMs = 2000;
    const r = answer(s, right(s));
    expect(r).toMatchObject({ kind: 'correct', points: BASE_POINTS, fast: false, combo: 1 });
    expect(s).toMatchObject({ index: 1, correct: 1, mistakes: 0, combo: 1, cardMs: 0 });
  });
  it('빠른 판단(0.8초 이내): +50 보너스', () => {
    const s = stateAt(1);
    s.cardMs = 700;
    expect(answer(s, right(s))).toMatchObject({ points: BASE_POINTS + FAST_BONUS, fast: true });
  });
  it('연속 정답 콤보 누적 → 오답에서 리셋, 최고 콤보는 유지', () => {
    const s = stateAt(1);
    for (let i = 0; i < 4; i++) { s.lockMs = 0; answer(s, right(s)); }
    expect(s.combo).toBe(4);
    const w = answer(s, wrongBin(s));
    expect(w.kind).toBe('wrong');
    expect(s).toMatchObject({ combo: 0, bestCombo: 4, mistakes: 1, index: 5 });
  });
  it('오답: 설명 포함, 입력 잠금(연타 방지) 후 시간 지나면 해제', () => {
    const s = stateAt(4);
    const before = currentCard(s)!;
    const w = answer(s, wrongBin(s));
    expect(w).toMatchObject({ kind: 'wrong', expectedBin: before.bin });
    if (w.kind === 'wrong') expect(w.explain.text).toContain('정답은');
    expect(isLocked(s)).toBe(true);
    expect(answer(s, 0)).toEqual({ kind: 'ignored', reason: 'locked' });
    expect(s.index).toBe(1); // 잠금 중 입력은 무시
    expect(tick(s, 100)).toBe(false);
    expect(tick(s, 300)).toBe(true);
    expect(isLocked(s)).toBe(false);
  });
  it('실수 3번이면 즉시 실패, 이후 입력 무시', () => {
    const s = stateAt(1);
    for (let i = 0; i < 3; i++) { s.lockMs = 0; answer(s, wrongBin(s)); }
    expect(status(s)).toBe('fail');
    expect(answer(s, 0)).toEqual({ kind: 'ignored', reason: 'done' });
  });
  it('목표 카드를 모두 처리하면 클리어 (실수 2번까지는 허용)', () => {
    const s = stateAt(2);
    for (let i = 0; i < s.params.goal; i++) {
      s.lockMs = 0; s.announceMs = 0;
      answer(s, i < 2 ? wrongBin(s) : right(s));
    }
    expect(s.mistakes).toBe(2);
    expect(status(s)).toBe('clear');
    expect(currentCard(s)).toBeUndefined();
  });
  it('마지막 카드에서 3번째 실수면 실패가 우선', () => {
    const s = stateAt(1);
    for (let i = 0; i < s.params.goal; i++) {
      s.lockMs = 0;
      answer(s, i >= s.params.goal - 3 ? wrongBin(s) : right(s));
    }
    expect(status(s)).toBe('fail');
  });
  it('정답이 아닌 분류함(3분류 가운데 등)도 오답 처리', () => {
    for (let seed = 0; seed < 40; seed++) {
      const s = stateAt(7, seed);
      if (binCount(s.plan.rule) !== 3) continue;
      const bin = right(s);
      const other = [0, 1, 2].find((b) => b !== bin)!;
      expect(answer(s, other).kind).toBe('wrong');
      return;
    }
    throw new Error('3분류 라운드를 찾지 못함');
  });
  it('규칙 반전: 해당 카드에서 예고(입력 잠금) → 끝나면 반전 상태', () => {
    const s = createState(difficulty(8), 11);
    const at = s.plan.reverseAt[0];
    while (s.index < at) { s.lockMs = 0; answer(s, right(s)); }
    expect(s.index).toBe(at);
    expect(s.announceMs).toBe(s.params.announceMs);
    expect(isReversed(s)).toBe(true);
    expect(answer(s, right(s))).toEqual({ kind: 'ignored', reason: 'locked' });
    expect(tick(s, 400)).toBe(false);
    expect(tick(s, 400)).toBe(true);
    expect(answer(s, right(s)).kind).toBe('correct');
  });
  it('빠른 판단 시간은 잠금·예고 시간을 제외하고 센다', () => {
    const s = createState(difficulty(8), 11);
    s.announceMs = 700;
    tick(s, 600);
    expect(s.cardMs).toBe(0);
    tick(s, 200); // 예고 종료
    tick(s, 100);
    expect(s.cardMs).toBe(100);
  });
  it('끝까지 정답만 → 점수 합계 = 카드 수 × 100 이상, 실수 0', () => {
    for (let l = 1; l <= MAX_LEVEL; l++) {
      const s = stateAt(l, 77 + l);
      let pts = 0;
      while (status(s) === 'playing') {
        s.lockMs = 0; s.announceMs = 0; s.cardMs = 5000;
        const r = answer(s, right(s));
        if (r.kind === 'correct') pts += r.points;
      }
      expect(status(s)).toBe('clear');
      expect(s.mistakes).toBe(0);
      expect(pts).toBe(s.params.goal * BASE_POINTS);
      expect(s.bestCombo).toBe(s.params.goal);
    }
  });
});

describe('스와이프 입력', () => {
  it('가로로 충분히 밀면 좌/우 분류함', () => {
    expect(swipeToBin(-60, 5, 2)).toBe(0);
    expect(swipeToBin(60, -10, 2)).toBe(1);
    expect(swipeToBin(-60, 0, 3)).toBe(0);
    expect(swipeToBin(60, 0, 3)).toBe(2);
  });
  it('짧게 움직이면 취소(원위치)', () => {
    expect(swipeToBin(20, 3, 2)).toBeNull();
    expect(swipeToBin(0, 0, 3)).toBeNull();
    expect(swipeToBin(35, 0, 2)).toBeNull();
  });
  it('위로 밀기는 3분류에서만 가운데, 2분류에서는 무시', () => {
    expect(swipeToBin(5, -70, 3)).toBe(1);
    expect(swipeToBin(5, -70, 2)).toBeNull();
    expect(swipeToBin(0, 70, 3)).toBeNull(); // 아래로는 무효
  });
  it('대각선은 더 큰 쪽 축으로 판정', () => {
    expect(swipeToBin(-60, -40, 3)).toBe(0);
    expect(swipeToBin(-40, -60, 3)).toBe(1);
  });
});
