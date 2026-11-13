import { describe, expect, it } from 'vitest';
import { createGame } from './game';
import { difficulty } from './logic';
import { lcg, play, type BotOpts } from './bot';

const SIM = () => !!(globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.SIM;

function rate(level: number, o: BotOpts, N: number) {
  let win = 0;
  for (let s = 0; s < N; s++) if (play(createGame(level, 1000 + s * 17 + level), lcg(s + 1), o).phase === 'won') win++;
  return win / N;
}

describe('난이도 곡선 — 실제 물리로 헤드리스 봇이 플레이 (SIM=1 이면 전체 표 출력)', () => {
  it('정확한 봇: 쉬운 레벨은 거의 항상 성공', () => {
    for (const l of [1, 2, 3]) expect(rate(l, { smart: true }, 8), `L${l}`).toBeGreaterThanOrEqual(0.85);
  }, 120000);

  it('흔들림 ±4 봇(교환 사용): 초반은 쉽고 후반은 눈에 띄게 어려움', () => {
    const o: BotOpts = { smart: true, jitter: 4, useSwap: true };
    const early = (rate(1, o, 8) + rate(2, o, 8) + rate(3, o, 8)) / 3;
    const late = (rate(8, o, 8) + rate(9, o, 8) + rate(10, o, 8)) / 3;
    expect(early).toBeGreaterThanOrEqual(0.85);
    expect(late).toBeLessThan(early - 0.3);
  }, 180000);

  it.runIf(SIM())('전체 표', () => {
    for (const [jitter, useSwap] of [[0, false], [4, false], [4, true]] as const) {
      const rows: string[] = [];
      for (let level = 1; level <= 10; level++) {
        let win = 0, falls = 0, placed = 0, ms = 0; const N = 14;
        for (let s = 0; s < N; s++) { const r = play(createGame(level, 1000 + s * 17 + level), lcg(s + 1), { smart: true, jitter, useSwap }); if (r.phase === 'won') win++; falls += r.falls; placed += r.placed; ms += r.ms; }
        rows.push(`L${level}: 성공 ${win}/${N} · 낙하 ${(falls / N).toFixed(1)} · 조각 ${(placed / N).toFixed(1)}/${difficulty(level).budget} · ${(ms / N / 1000).toFixed(0)}s`);
      }
      console.log(`\n[똑똑한 봇 · 흔들림 ±${jitter}${useSwap ? ' · 교환' : ''}]\n` + rows.join('\n'));
    }
  }, 300000);
});
