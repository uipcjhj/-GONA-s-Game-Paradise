import { INBOX_PREFIX, REJECTED_PREFIX } from './keys';
import { applyResults, type Notice, type ResultSummary } from './engine';
import { validateEnvelope, type GameResult, type RejectReason } from './result';
import { getSession } from './session';
import type { KV, PlayerData } from './types';

const MAX_RAW = 4096;
const MAX_REJECTED = 20;

export interface ConsumePlan {
  player: PlayerData;
  summaries: ResultSummary[];
  notices: Notice[];
  /** 플레이어 데이터가 바뀌었는가(저장 필요) */
  changed: boolean;
  /** 저장이 성공한 뒤에 지울 inbox 키 */
  deleteKeys: string[];
  rejected: { key: string; resultId: string; reason: RejectReason | 'dup' }[];
  held: number;
}

/**
 * inbox(게임이 쓴 결과)를 읽어 검증하고 플레이어 데이터에 한 번에 반영할 '계획'을 만든다. 아직 아무것도 쓰거나 지우지 않는다.
 * 호출 순서: plan = planConsume() → 플레이어 저장 성공 → finishConsume(plan)
 * (저장이 실패하면 finishConsume 을 호출하지 않아 inbox 가 그대로 남아 재시도된다)
 */
export function planConsume(kv: KV, player: PlayerData, now: number): ConsumePlan {
  const keys = (kv.keys?.() ?? []).filter((k) => k.startsWith(INBOX_PREFIX)).sort();
  const results: GameResult[] = [];
  const deleteKeys: string[] = [];
  const rejected: ConsumePlan['rejected'] = [];
  let held = 0;
  const seen = new Set<string>();
  for (const key of keys) {
    let raw: string | null = null;
    try {
      raw = kv.getItem(key);
    } catch {
      continue;
    }
    if (raw === null) continue;
    const id = key.slice(INBOX_PREFIX.length);
    if (raw.length > MAX_RAW) {
      deleteKeys.push(key);
      rejected.push({ key, resultId: id, reason: 'format' });
      continue;
    }
    let obj: unknown;
    try {
      obj = JSON.parse(raw);
    } catch {
      deleteKeys.push(key);
      rejected.push({ key, resultId: id, reason: 'format' });
      continue;
    }
    // 키 이름의 resultId 와 내용이 다르면 거부
    const v = validateEnvelope(obj, { now, playerId: player.playerId, getSession: (sid) => getSession(kv, sid) });
    if (!v.ok) {
      if (v.hold) {
        held += 1; // 더 새로운 버전: 지우지 않고 보류
        continue;
      }
      deleteKeys.push(key);
      rejected.push({ key, resultId: id, reason: v.reason });
      continue;
    }
    if (v.result.resultId !== id) {
      deleteKeys.push(key);
      rejected.push({ key, resultId: id, reason: 'format' });
      continue;
    }
    deleteKeys.push(key);
    if (player.resultLedger.includes(id) || seen.has(id)) {
      rejected.push({ key, resultId: id, reason: 'dup' });
      continue;
    }
    seen.add(id);
    results.push(v.result);
  }
  const applied = applyResults(player, results, now);
  return { player: applied.player, summaries: applied.summaries, notices: applied.notices, changed: applied.changed, deleteKeys, rejected: rejected.filter((r) => r.reason !== 'dup' || true), held };
}

/** 저장이 끝난 뒤: 처리한 inbox 삭제 + 거부된 결과 요약 보관(최대 20개) */
export function finishConsume(kv: KV, plan: ConsumePlan, now: number): void {
  for (const k of plan.deleteKeys) {
    try {
      kv.removeItem(k);
    } catch {
      /* 다음 실행 때 원장으로 걸러짐 */
    }
  }
  const real = plan.rejected.filter((r) => r.reason !== 'dup');
  if (real.length) {
    try {
      const existing = (kv.keys?.() ?? []).filter((k) => k.startsWith(REJECTED_PREFIX)).sort();
      for (const old of existing.slice(0, Math.max(0, existing.length + real.length - MAX_REJECTED))) kv.removeItem(old);
      for (const r of real) kv.setItem(REJECTED_PREFIX + r.resultId, JSON.stringify({ at: now, reason: r.reason }));
    } catch {
      /* 보관 실패는 무시 */
    }
  }
}
