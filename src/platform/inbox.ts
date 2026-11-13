import { applyGameResult, type ResultOutcome } from './engine';
import { INBOX_PREFIX, REJECTED_PREFIX } from './keys';
import { validateEnvelope, type RejectReason } from './result';
import { readSession } from './session';
import { listKeys, safeGet, safeRemove, safeSet, savePlayer } from './store';
import type { KV, PlayerData } from './types';

export interface ConsumeReport {
  player: PlayerData;
  /** 이번에 새로 반영된 결과(오래된 것 → 최신 순) */
  applied: ResultOutcome[];
  /** 이미 반영돼 있던 중복(inbox 만 정리) */
  duplicates: number;
  rejected: { resultId: string; reason: RejectReason }[];
  /** 더 새 버전이라 보류(지우지 않음) */
  held: number;
  /** 저장 실패 → inbox 를 지우지 않았고 player 는 메모리 값(저장 안 됨) */
  saveFailed: boolean;
}
const REJECT_KEEP = 20;
const REJECT_MS = 7 * 24 * 3600 * 1000;

/**
 * inbox 수신(§6): 전부 검증 → 메모리의 플레이어 데이터에 모두 적용 → 한 번만 저장 → 저장 성공 후 inbox 키 삭제.
 * 같은 resultId 는 원장(resultLedger) 이 막으므로 "저장 후 삭제 전 종료"에도 중복 반영되지 않음.
 */
export function consumeInbox(kv: KV, player: PlayerData, now: Date = new Date()): ConsumeReport {
  const keys = listKeys(kv, INBOX_PREFIX);
  const report: ConsumeReport = { player, applied: [], duplicates: 0, rejected: [], held: 0, saveFailed: false };
  if (!keys.length) return report;
  type Item = { key: string; endedAt: number; text: string | null };
  const items: Item[] = keys.map((key) => {
    const text = safeGet(kv, key);
    let endedAt = 0;
    try {
      endedAt = Date.parse(JSON.parse(text ?? '').result.endedAt) || 0;
    } catch {
      /* 정렬 불가: 0 */
    }
    return { key, endedAt, text };
  });
  items.sort((a, b) => a.endedAt - b.endedAt);
  let p = player;
  const toDelete: string[] = [];
  const toReject: { key: string; text: string | null; reason: RejectReason }[] = [];
  for (const it of items) {
    let sid = '';
    try {
      sid = String(JSON.parse(it.text ?? '').result.sessionId);
    } catch {
      /* 형식 오류는 검증에서 처리 */
    }
    const verdict = validateEnvelope(it.text, { now: now.getTime(), session: sid ? readSession(kv, sid) : null, playerId: p.playerId });
    if (!verdict.ok) {
      if (verdict.hold) report.held += 1;
      else {
        toReject.push({ key: it.key, text: it.text, reason: verdict.reason });
        report.rejected.push({ resultId: it.key.slice(INBOX_PREFIX.length), reason: verdict.reason });
      }
      continue;
    }
    const r = applyGameResult(p, verdict.result, now);
    if (r.outcome.duplicate) report.duplicates += 1;
    else report.applied.push(r.outcome);
    p = r.player;
    toDelete.push(it.key);
  }
  if (report.applied.length) {
    if (!savePlayer(kv, p)) {
      report.saveFailed = true;
      report.player = player; // 저장되지 않았으니 화면도 이전 값 유지, inbox 보존(재시도 가능)
      report.applied = [];
      return report;
    }
  }
  report.player = p;
  for (const k of toDelete) safeRemove(kv, k);
  for (const rj of toReject) {
    safeSet(kv, REJECTED_PREFIX + rj.key.slice(INBOX_PREFIX.length), JSON.stringify({ reason: rj.reason, at: now.toISOString(), size: rj.text?.length ?? 0 }));
    safeRemove(kv, rj.key);
  }
  pruneRejected(kv, now);
  return report;
}
export function pruneRejected(kv: KV, now: Date): void {
  const ks = listKeys(kv, REJECTED_PREFIX)
    .map((k) => {
      let at = 0;
      try {
        at = Date.parse(JSON.parse(safeGet(kv, k) ?? '').at);
      } catch {
        /* 0 */
      }
      return { k, at };
    })
    .sort((a, b) => b.at - a.at);
  ks.forEach((x, i) => {
    if (i >= REJECT_KEEP || now.getTime() - x.at > REJECT_MS) safeRemove(kv, x.k);
  });
}
