import { describe, expect, it } from 'vitest';
import { MAX_LEVEL, TUNING, answer, createState, difficulty, makeBoard, status, step, timeLimitSec, type Friend } from './logic';
import { mulberry32 } from '../../core/rng';

const diff = (a: Friend, b: Friend) => (['color', 'face', 'feature', 'mirror'] as const).filter((k) => a[k] !== b[k]);

describe('가짜 친구 찾기', () => {
  it('판마다 가짜는 정확히 하나, 진짜들과 정확히 한 군데만 다름(레벨이 정한 축)', () => {
    for (let l = 1; l <= MAX_LEVEL; l++) {
      const p = difficulty(l);
      const r = mulberry32(l);
      for (let i = 0; i < 200; i++) {
        const b = makeBoard(p, r);
        expect(b.cells).toHaveLength(p.cols * p.rows);
        const real = b.cells.filter((_, j) => j !== b.fake);
        for (const c of real) expect(diff(c, real[0])).toEqual([]);
        const d = diff(b.cells[b.fake], real[0]);
        expect(d, `L${l}`).toHaveLength(1);
        expect(p.axes).toContain(d[0]);
        if (d[0] === 'mirror') expect(real[0].feature).toBe('ribbon'); // 반전이 눈에 보이는 소품
      }
    }
  });
  it('정답이면 다음 판·콤보, 오답이면 실수·콤보 끊김, 실수 한도면 실패', () => {
    const s = createState(difficulty(2), 3);
    const first = s.board;
    expect(answer(s, s.board.fake).kind).toBe('correct');
    expect(s.board).not.toBe(first);
    expect(s.combo).toBe(1);
    const wrong = (s.board.fake + 1) % s.board.cells.length;
    expect(answer(s, wrong).kind).toBe('wrong');
    expect(s.combo).toBe(0);
    answer(s, wrong);
    answer(s, wrong);
    expect(status(s)).toBe('fail');
    expect(answer(s, s.board.fake).kind).toBe('ignored');
  });
  it('빨리 찾으면(1.5초 이내) 보너스', () => {
    const s = createState(difficulty(1), 4);
    step(s, 800);
    expect(answer(s, s.board.fake)).toMatchObject({ kind: 'correct', quick: true });
    step(s, 2000);
    expect(answer(s, s.board.fake)).toMatchObject({ kind: 'correct', quick: false });
  });
  it('섞기 레벨: 시간이 지나면 가짜 자리가 바뀌고 정답 인덱스도 따라감', () => {
    const s = createState(difficulty(9), 5);
    let moved = 0;
    for (let i = 0; i < 20; i++) {
      const before = s.board.fake;
      step(s, difficulty(9).shuffleMs);
      if (s.board.fake !== before) moved++;
      expect(diff(s.board.cells[s.board.fake], s.board.cells[(s.board.fake + 1) % s.board.cells.length])).toHaveLength(1);
    }
    expect(moved).toBeGreaterThan(10);
  });
  it('난이도: 친구 수 증가, 쉬운 색 차이는 초반만, 섞기는 L8~, 제한시간 20~60초', () => {
    for (let i = 1; i < MAX_LEVEL; i++) expect(TUNING[i].cols * TUNING[i].rows).toBeGreaterThanOrEqual(TUNING[i - 1].cols * TUNING[i - 1].rows);
    expect(TUNING[9].axes).not.toContain('color');
    expect(TUNING.slice(0, 7).every((t) => t.shuffleMs === 0)).toBe(true);
    for (let l = 1; l <= MAX_LEVEL; l++) expect(timeLimitSec(l)).toBeGreaterThanOrEqual(20), expect(timeLimitSec(l)).toBeLessThanOrEqual(60);
  });
});
