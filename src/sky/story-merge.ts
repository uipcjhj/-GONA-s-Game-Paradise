/** 스토리 체크포인트 클라우드 병합 규칙 (다른 모듈을 가져오지 않음 → node 로 바로 검사 가능) */
type Slot = { fam: string; diff: string; stage: number; at: string; [k: string]: unknown };
type Finish = { score: number; at: string };
export interface StoryStore { v: number; last?: string; slots: Record<string, Slot>; arcade: Record<string, Finish>; cont: Record<string, Finish> }
/** 스토리 체크포인트 병합: 칸마다 더 최근에 저장한 쪽 (다른 기기에서 이어서 진행했으면 그 진행) · 완주 기록 = 더 높은 점수 */
export function mergeStory(a?: StoryStore | null, b?: StoryStore | null): StoryStore | null {
  if (!a) return b ?? null;
  if (!b) return a;
  const out: StoryStore = { v: Math.max(a.v ?? 1, b.v ?? 1), slots: {}, arcade: {}, cont: {} };
  for (const k of new Set([...Object.keys(a.slots ?? {}), ...Object.keys(b.slots ?? {})])) {
    const x = a.slots?.[k]; const y = b.slots?.[k];
    out.slots[k] = (!x ? y : !y ? x : (y.at ?? '') > (x.at ?? '') ? y : x) as Slot;
  }
  for (const m of ['arcade', 'cont'] as const) {
    for (const k of new Set([...Object.keys(a[m] ?? {}), ...Object.keys(b[m] ?? {})])) {
      const x = a[m]?.[k]; const y = b[m]?.[k];
      out[m][k] = (!x ? y : !y ? x : y.score > x.score ? y : x) as Finish;
    }
  }
  // 한쪽에서 완주해 칸을 비웠는데 다른 쪽에 예전 칸이 남은 경우: 완주한 날보다 오래된 칸은 지움
  for (const k of Object.keys(out.slots)) {
    const fin = [out.arcade[k]?.at, out.cont[k]?.at].filter(Boolean).sort().pop();
    const inA = !!a.slots?.[k], inB = !!b.slots?.[k];
    if (fin && inA !== inB && (out.slots[k].at ?? '').slice(0, 10) < fin) delete out.slots[k];
  }
  const cands = [a.last, b.last].filter((k): k is string => !!k && !!out.slots[k]);
  out.last = cands.sort((x, y) => (out.slots[y].at ?? '').localeCompare(out.slots[x].at ?? ''))[0];
  return out;
}
