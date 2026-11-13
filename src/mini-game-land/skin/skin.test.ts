import { describe, expect, it } from 'vitest';
import { SKIN_LOADERS, loadSkin, mergeSkin, missingSlots, resolveSkinId, type SkinLoader } from './skins';
import { UI_SLOT_KEYS, type ResolvedSkin, type Skin } from './types';
import { SORT_SLOT_KEYS } from '../games/sort/slots';
import { scoreboardView } from './viewmodel';
import type { EngineSnapshot } from '../core/engine';

const dummy = () => null;
const fullUi = Object.fromEntries(UI_SLOT_KEYS.map((k) => [k, dummy]));
const fullSort = Object.fromEntries(SORT_SLOT_KEYS.map((k) => [k, dummy]));
const full = (id: string, extra: Partial<Skin> = {}): Skin => ({ id, name: id, ui: fullUi, sort: fullSort, tokens: { '--a': '1' }, ...extra }) as Skin;
const loaderOf = (m: Record<string, Skin>): Record<string, SkinLoader> => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, async () => ({ default: v })]));

describe('스킨 선택', () => {
  it('?skin= 값이 알려진 스킨이면 사용, 아니면 기본(temp)', () => {
    expect(resolveSkinId('')).toBe('temp');
    expect(resolveSkinId('?skin=wireframe')).toBe('wireframe');
    expect(resolveSkinId('?skin=nope')).toBe('temp');
    expect(resolveSkinId('?skin=x', ['x'])).toBe('x');
  });
});

describe('스킨 합성(슬롯 단위 독립 교체)', () => {
  it('덮어쓴 슬롯만 바뀌고 나머지는 base 그대로', () => {
    const base = mergeSkin(null, full('base'));
    const Btn = () => null;
    const merged = mergeSkin(base, { id: 'over', name: 'over', ui: { ButtonFace: Btn } });
    expect(merged.ui.ButtonFace).toBe(Btn);
    expect(merged.ui.Background).toBe(base.ui.Background);
    expect(merged.sort.Friend).toBe(base.sort.Friend);
    expect(merged.id).toBe('over');
  });
  it('토큰은 병합(위 스킨이 우선)', () => {
    const base = mergeSkin(null, full('base', { tokens: { '--a': '1', '--b': '2' } }));
    expect(mergeSkin(base, { id: 'o', name: 'o', tokens: { '--b': '9' } }).tokens).toEqual({ '--a': '1', '--b': '9' });
  });
  it('빠진 슬롯 검출', () => {
    const partial = mergeSkin(null, { id: 'p', name: 'p', ui: { Background: dummy } });
    const missing = missingSlots(partial);
    expect(missing).toContain('ui.ButtonFace');
    expect(missing).toContain('sort.Friend');
    expect(missingSlots(mergeSkin(null, full('f')))).toEqual([]);
  });
});

describe('스킨 로더(extends 체인)', () => {
  it('extends 로 일부 슬롯만 덮어쓴 스킨을 완성된 스킨으로 합침', async () => {
    const Face = () => null;
    const loaders = loaderOf({ a: full('a'), b: { id: 'b', name: 'b', extends: 'a', ui: { ButtonFace: Face } } });
    const b = await loadSkin('b', loaders);
    expect(b.ui.ButtonFace).toBe(Face);
    expect(missingSlots(b)).toEqual([]);
  });
  it('순환 참조·알 수 없는 스킨·미완성 스킨은 오류', async () => {
    await expect(loadSkin('a', loaderOf({ a: full('a', { extends: 'b' }), b: full('b', { extends: 'a' }) }))).rejects.toThrow('순환');
    await expect(loadSkin('zzz', {})).rejects.toThrow('알 수 없는');
    await expect(loadSkin('p', loaderOf({ p: { id: 'p', name: 'p', ui: { Background: dummy } } }))).rejects.toThrow('빠진 슬롯');
  });
  it('실제 스킨(temp · wireframe)이 모든 슬롯을 갖춘 완성 스킨으로 로드됨', async () => {
    for (const id of Object.keys(SKIN_LOADERS)) {
      const s: ResolvedSkin = await loadSkin(id);
      expect(missingSlots(s), id).toEqual([]);
      expect(s.id).toBe(id);
    }
  });
  it('wireframe 은 일부 슬롯만 교체하고 나머지는 temp 와 같은 구현', async () => {
    const temp = await loadSkin('temp');
    const wf = await loadSkin('wireframe');
    for (const k of ['Background', 'ButtonFace', 'Scoreboard'] as const) expect(wf.ui[k], k).not.toBe(temp.ui[k]);
    for (const k of ['Friend', 'StageFrame', 'BinFace'] as const) expect(wf.sort[k], k).not.toBe(temp.sort[k]);
    for (const k of ['Panel', 'Lives', 'Mascot'] as const) expect(wf.ui[k], k).toBe(temp.ui[k]);
    for (const k of ['RulePanel', 'InfoBar', 'Feedback', 'Announce'] as const) expect(wf.sort[k], k).toBe(temp.sort[k]);
    expect(wf.tokens['--sc-card-w']).not.toBe(temp.tokens['--sc-card-w']);
  });
});

describe('점수판 표시값(스킨은 계산하지 않음)', () => {
  const snap = (over: Partial<EngineSnapshot> = {}): EngineSnapshot => ({ phase: 'playing', score: 120, combo: 3, limitMs: 20000, remainingMs: 4200, elapsedMs: 15800, gateSec: 0, ...over });
  it('누적 점수·남은 초(올림)·비율·경고', () => {
    const v = scoreboardView(snap(), { label: 'L', baseScore: 500, lives: 2, maxLives: 5 });
    expect(v).toMatchObject({ score: 620, combo: 3, timeSec: 5, timeWarn: true, lives: 2, maxLives: 5, label: 'L' });
    expect(v.timePct).toBeCloseTo(21);
    expect(scoreboardView(snap({ remainingMs: 15000 }), { label: '' }).timeWarn).toBe(false);
  });
  it('무제한이면 시간 null·100%', () => {
    expect(scoreboardView(snap({ limitMs: null, remainingMs: null }), { label: '', level: 3 })).toMatchObject({ timeSec: null, timePct: 100, timeWarn: false, level: 3 });
  });
});
