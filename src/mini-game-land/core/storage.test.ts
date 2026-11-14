import { describe, expect, it } from 'vitest';
import { STORAGE_KEY, SaveStore, emptySave, gameRecord, parseSave, recordChallenge, recordFreeRound, type StorageLike } from './storage';

const fake = (init: Record<string, string> = {}, failWrite = false): StorageLike & { data: Record<string, string> } => {
  const data = { ...init };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      if (failWrite) throw new Error('quota');
      data[k] = v;
    },
  };
};

describe('storage', () => {
  it('손상된 데이터·구버전은 빈 기록으로', () => {
    expect(parseSave('{{{')).toEqual(emptySave());
    expect(parseSave(JSON.stringify({ v: 0 }))).toEqual(emptySave());
    expect(parseSave(null)).toEqual(emptySave());
  });
  it('필드 단위 검증: 음수·문자열은 0', () => {
    const s = parseSave(JSON.stringify({ v: 1, games: { a: { bestScore: -5, bestLevel: 'x', plays: 3.9 } }, challenge: { bestScore: 10 } }));
    expect(s.games.a).toEqual({ bestScore: 0, bestLevel: 0, plays: 3 });
    expect(s.challenge).toEqual({ bestScore: 10, bestRound: 0, plays: 0 });
  });
  it('자유 플레이 기록: 최고 점수·클리어 레벨 갱신과 NEW 표시', () => {
    let save = emptySave();
    let r = recordFreeRound(save, 'a', { level: 1, cleared: true, runScore: 200 });
    expect(r).toMatchObject({ newBestScore: true, newBestLevel: true });
    save = r.save;
    r = recordFreeRound(save, 'a', { level: 2, cleared: false, runScore: 150 });
    expect(r.newBestScore).toBe(false);
    expect(gameRecord(r.save, 'a')).toEqual({ bestScore: 200, bestLevel: 1, plays: 2 });
  });
  it('챌린지 기록', () => {
    const r = recordChallenge(emptySave(), { score: 500, rounds: 7 });
    expect(r.newBestScore).toBe(true);
    const r2 = recordChallenge(r.save, { score: 400, rounds: 9 });
    expect(r2.newBestScore).toBe(false);
    expect(r2.record).toEqual({ bestScore: 500, bestRound: 9, plays: 2 });
  });
  it('SaveStore: 저장 후 다시 불러오기', () => {
    const be = fake();
    const a = new SaveStore(be);
    a.set(recordChallenge(a.get(), { score: 99, rounds: 3 }).save);
    expect(JSON.parse(be.data[STORAGE_KEY]).challenge.bestScore).toBe(99);
    expect(new SaveStore(be).get().challenge.bestScore).toBe(99);
    expect(a.persistent).toBe(true);
  });
  it('저장 불가(null)·쓰기 실패여도 죽지 않고 메모리로 동작', () => {
    const mem = new SaveStore(null);
    expect(mem.persistent).toBe(false);
    mem.set(recordChallenge(mem.get(), { score: 5, rounds: 1 }).save);
    expect(mem.get().challenge.bestScore).toBe(5);

    const bad = new SaveStore(fake({}, true));
    bad.set(recordChallenge(bad.get(), { score: 7, rounds: 1 }).save);
    expect(bad.persistent).toBe(false);
    expect(bad.get().challenge.bestScore).toBe(7);
  });
});
