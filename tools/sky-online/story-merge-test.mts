/* 스토리 체크포인트 병합 규칙 검사: node --experimental-strip-types tools/sky-online/story-merge-test.mts */
import { mergeStory, type StoryStore } from '../../src/sky/story-merge.ts';
const S = (o: Partial<StoryStore>): StoryStore => ({ v: 1, slots: {}, arcade: {}, cont: {}, ...o });
const sl = (fam: string, diff: string, stage: number, at: string) => ({ fam, diff, stage, at, score: stage * 1000, hp: 5, bombs: 3, power: 2, arcade: false, v: 1 });
const r: string[] = [];
const ok = (n: string, c: boolean) => r.push(`${c ? 'PASS' : 'FAIL'} · ${n}`);
let m = mergeStory(S({ slots: { 'mom:easy': sl('mom', 'easy', 3, '2026-11-26T10:00') }, last: 'mom:easy' }), S({ slots: { 'halabeoji:hard': sl('halabeoji', 'hard', 5, '2026-11-25T09:00') }, last: 'halabeoji:hard' }))!;
ok('다른 조합은 둘 다 남음 (18칸 합집합)', !!m.slots['mom:easy'] && !!m.slots['halabeoji:hard']);
ok('최근 진행 = 더 최근 저장 칸', m.last === 'mom:easy');
m = mergeStory(S({ slots: { 'dad:normal': sl('dad', 'normal', 2, '2026-11-26T08:00') } }), S({ slots: { 'dad:normal': sl('dad', 'normal', 4, '2026-11-26T12:00') } }))!;
ok('같은 조합 = 더 최근에 저장한 쪽 (다른 기기에서 STAGE 4 까지 진행)', m.slots['dad:normal'].stage === 4);
m = mergeStory(S({ cont: { 'imo:hard': { score: 900000, at: '2026-11-20' } } }), S({ cont: { 'imo:hard': { score: 1200000, at: '2026-11-26' } }, arcade: { 'imo:hard': { score: 1500000, at: '2026-11-26' } } }))!;
ok('완주 기록 = 모드별 더 높은 점수 · ARCADE/CONTINUE 분리 유지', m.cont['imo:hard'].score === 1200000 && m.arcade['imo:hard'].score === 1500000);
m = mergeStory(S({ slots: { 'samchon:easy': sl('samchon', 'easy', 6, '2026-11-24T10:00') } }), S({ cont: { 'samchon:easy': { score: 800000, at: '2026-11-26' } } }))!;
ok('다른 기기에서 완주해 비운 칸 → 예전 칸 지움', !m.slots['samchon:easy']);
ok('한쪽이 비어 있으면 다른 쪽 그대로', mergeStory(null, S({ slots: { 'a:b': sl('a', 'b', 2, 'x') } }))!.slots['a:b'].stage === 2);
console.log(r.join('\n'));
