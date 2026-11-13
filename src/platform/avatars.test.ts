import { afterEach, describe, expect, it } from 'vitest';
import { AVATARS, canUseAvatar, isAvatarUnlocked, unlockConditionMet } from './avatars';
import { applyResult, recordLaunch, type Notice } from './engine';
import type { GameResult } from './result';
import { createPlayer, withProfile } from './store';
import { parsePlayerObject } from './schema';

const T0 = Date.parse('2026-11-13T03:00:00Z');
const mk = () => {
  const r = createPlayer('고나짱', 'gona', new Date(T0));
  if (!r.ok) throw new Error('x');
  return r.player;
};
let n = 0;
const res = (o: Partial<GameResult> = {}): GameResult => ({ resultId: `av-${String(++n).padStart(8, '0')}`, sessionId: 'sess-av000001', gameId: 'food-island', gameVersion: '1', scoreSchemaVersion: 1, outcome: 'failed', score: 1000, stage: 2, startedAt: new Date(T0 - 120000).toISOString(), endedAt: new Date(T0).toISOString(), durationMs: 120000, ...o });
const byId = (id: string) => AVATARS.find((a) => a.id === id)!;
const orig = AVATARS.map((a) => a.asset);
afterEach(() => AVATARS.forEach((a, i) => (a.asset = orig[i])));

describe('몬스터·보스 아바타 (정식 에셋 준비 전)', () => {
  it('4종이 등록돼 있고 모두 pending(그림 없음) + 업적 해금 조건', () => {
    for (const id of ['kiss', 'sniff', 'glasses', 'farter']) {
      const a = byId(id);
      expect(a.asset).toBe('pending');
      expect(a.unlock.kind).toBe('achievement');
      expect(a.hint).toBeTruthy();
    }
  });
  it('신규 가입자는 선택 불가 · 가족 7종은 처음부터 선택 가능', () => {
    const p = mk();
    for (const id of ['kiss', 'sniff', 'glasses', 'farter']) expect(canUseAvatar(id, p)).toBe(false);
    for (const id of ['gona', 'mom', 'dad', 'imo', 'halmeoni', 'halabeoji', 'samchon']) expect(canUseAvatar(id, p)).toBe(true);
    expect(withProfile(p, { avatarId: 'kiss' })!.avatarId).toBe('gona'); // 선택 시도는 무시
  });
  it('업적을 달성하면 해금 상태가 영구 저장되지만, 정식 에셋 전에는 선택 불가 · 알림 없음', () => {
    let p = mk();
    const o = applyResult(p, res({ stage: 3, score: 100 }), T0); // 성장 3단계 → food_stage_3
    p = o.player;
    expect(p.achievements.food_stage_3).toBeTruthy();
    expect(p.unlockedAvatarIds).toContain('kiss');
    expect(isAvatarUnlocked(byId('kiss'), p)).toBe(true);
    expect(canUseAvatar('kiss', p)).toBe(false); // asset pending
    expect(o.notices.some((x: Notice) => x.kind === 'avatar')).toBe(false);
    expect(withProfile(p, { avatarId: 'kiss' })!.avatarId).toBe('gona');
  });
  it('정식 PNG 가 준비되면(asset=ready) 해금된 플레이어는 바로 선택 가능, 미해금자는 불가', () => {
    byId('kiss').asset = 'ready';
    byId('sniff').asset = 'ready';
    let p = applyResult(mk(), res({ stage: 3 }), T0).player; // kiss 해금, sniff 미해금
    expect(canUseAvatar('kiss', p)).toBe(true);
    expect(canUseAvatar('sniff', p)).toBe(false);
    expect(withProfile(p, { avatarId: 'kiss' })!.avatarId).toBe('kiss');
    expect(withProfile(p, { avatarId: 'sniff' })!.avatarId).toBe('gona');
    p = applyResult(p, res({ outcome: 'cleared', stage: 4 }), T0 + 1000).player; // first_clear → sniff
    expect(canUseAvatar('sniff', p)).toBe(true);
  });
  it('에셋이 준비된 아바타를 해금하면 알림(🎭)이 한 번만', () => {
    byId('farter').asset = 'ready';
    const o = applyResult(mk(), res({ score: 5200 }), T0); // food_score_5000 → farter
    expect(o.notices.filter((x: Notice) => x.kind === 'avatar' && x.id === 'farter')).toHaveLength(1);
    const again = applyResult(o.player, res({ score: 6000 }), T0 + 1000);
    expect(again.notices.filter((x: Notice) => x.kind === 'avatar')).toHaveLength(0);
  });
  it('조건 판정: 업적/레벨', () => {
    const p = mk();
    expect(unlockConditionMet(byId('kiss'), p)).toBe(false);
    expect(unlockConditionMet({ ...byId('kiss'), unlock: { kind: 'level', level: 2 } }, { ...p, playerLevel: 2 })).toBe(true);
  });
  it('백업/저장 데이터에 제작 전 아바타가 들어 있으면 기본 아바타로 대체', () => {
    const p = mk();
    const r = parsePlayerObject({ ...p, avatarId: 'kiss' });
    expect(r.ok && r.player.avatarId).toBe('gona');
  });
  it('출시 전 아바타 이미지 파일은 운영에 포함되지 않음(임시 도트 노출 금지)', async () => {
    const { existsSync } = await import('node:fs');
    for (const id of ['kiss', 'sniff', 'glasses', 'farter']) expect(existsSync(`public/assets/avatars/${id}.png`), id).toBe(false);
  });
  it('가족 7종 PNG 존재(기존 아바타 유지)', async () => {
    const { existsSync } = await import('node:fs');
    for (const a of AVATARS.filter((x) => x.asset === 'ready')) {
      expect(existsSync(`public/${a.src.replace('./', '')}`), a.id).toBe(true);
      expect(existsSync(`public/${a.src.replace('./', '').replace('.png', '-s.png')}`), `${a.id}-s`).toBe(true);
    }
    void recordLaunch;
  });
});
