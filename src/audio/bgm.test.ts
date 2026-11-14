import { describe, expect, it } from 'vitest';
import { TRACKS } from './bgm';

describe('오리지널 BGM 악보', () => {
  it('곡마다 모든 성부의 길이가 같아 반복 때 박자가 어긋나지 않음(마디 단위)', () => {
    for (const [id, t] of Object.entries(TRACKS)) {
      const lens = t.voices.map((v) => v.notes.reduce((s, n) => s + n[1], 0));
      expect(new Set(lens).size, id).toBe(1);
      expect(lens[0] % 16, id).toBe(0);
    }
  });
  it('음높이는 사람이 듣기 편한 범위(노이즈 제외 80~1600Hz), 음량은 작게', () => {
    for (const t of Object.values(TRACKS))
      for (const v of t.voices) {
        expect(v.vol).toBeLessThanOrEqual(0.12);
        if (v.wave === 'noise') continue;
        for (const [f] of v.notes) if (f !== null) expect(f > 80 && f < 1600).toBe(true);
      }
  });
});
