/**
 * 배지 그림 (사용자 확정 픽셀아트 훈장 32종 · art-src/sky-poop/badges-v2/badges-32-original.png → tools/sky-badges/split.py)
 *  - 배지 ID · 획득 조건 · 기록은 records.ts 그대로. 여기서는 '어느 그림으로 보여 줄지'만 정함
 *  - 시트 순서 (왼→오, 위→아래): 1 EASY 정복 · 2 NORMAL 정복 · 3 HARD 정복 · 4 MASTER · 5 스토리 클리어 · 6 추억 사냥 완료 · 7 오늘의 도전 · 8 S랭크
 *    9 노미스 · 10 노폭탄 · 11 올클리어 · 12 스테이지 완주 · 13 전 부위 파괴 · 14 보스 정복 · 15 고난도 도전 · 16 연속 클리어
 *    17 엄마 · 18 아빠 · 19 이모 · 20 삼촌 · 21 할머니 · 22 할아버지 · 23 고나의 용기 · 24 가족의 힘
 *    25 추억사진 수집 · 26 엽서 18장 · 27 사진 108장 · 28 완전 수집 · 29 난이도 전부 정복 · 30 전 캐릭터 정복 · 31 하늘 왕국의 영웅 · 32 레전드 컴플리트
 */
import type { FamilyId } from './engine';
import type { Difficulty } from './stages';
import { photos, clears } from './records';

const BASE = `${import.meta.env.BASE_URL}assets/sky/v3-poop/badges/`;
export const badgeSrc = (n: number): string => `${BASE}badge-${String(n).padStart(2, '0')}.png`;
/** 업적(achievements) ID → 시트 번호 · 같은 뜻의 디자인만 연결 */
export const ACH_BADGE: Record<string, number> = {
  first: 5, easy: 1, normal: 2, hard: 3,
  'fam-mom': 17, 'fam-dad': 18, 'fam-imo': 19, 'fam-samchon': 20, 'fam-halmeoni': 21, 'fam-halabeoji': 22,
  allfam: 24, alldiff: 29, hardall: 30,
  nobomb1: 10, nomiss: 9, rankS: 8, parts: 13, daily: 7,
  boss1: 14, boss2: 14, boss3: 14, boss4: 14, boss5: 14, boss6: 14,
  bossall1: 25, bossall2: 25, bossall3: 25, bossall4: 25, bossall5: 25, bossall6: 25,
  runs: 26, album: 27,
};
/** 쓰지 않는 디자인 (예비 · 해당 업적 없음) */
export const SPARE_BADGES = [6, 11, 12, 15, 16, 23, 28, 31, 32];
export const MASTER_BADGE = 4;
export const DIFF_BADGE: Record<Difficulty, number> = { easy: 1, normal: 2, hard: 3 };
export const FAM_BADGE: Record<FamilyId, number> = { mom: 17, dad: 18, imo: 19, samchon: 20, halmeoni: 21, halabeoji: 22 };
export const achBadge = (id: string): string => badgeSrc(ACH_BADGE[id] ?? 5);
/** 획득일: 실제로 남아 있는 날짜 기록(사진 · 완주)에서만 계산 — 날짜 기록이 없는 업적은 undefined (꾸며 내지 않음) */
export function achDate(id: string): string | undefined {
  const ph = Object.entries(photos());
  const cl = Object.entries(clears());
  const min = (xs: (string | undefined)[]): string | undefined => xs.filter(Boolean).sort()[0];
  const max = (xs: (string | undefined)[]): string | undefined => xs.filter(Boolean).sort().pop();
  let m: RegExpMatchArray | null;
  if ((m = id.match(/^boss(\d)$/))) return min(ph.filter(([k]) => k.endsWith(`:${m![1]}`)).map(([, v]) => v.at));
  if ((m = id.match(/^bossall(\d)$/))) return max(ph.filter(([k]) => k.endsWith(`:${m![1]}`)).map(([, v]) => v.at));
  if ((m = id.match(/^fam-(\w+)$/))) return min(cl.filter(([k]) => k.startsWith(`${m![1]}:`)).map(([, v]) => v.at));
  if (id === 'easy' || id === 'normal' || id === 'hard') return min(cl.filter(([k]) => k.endsWith(`:${id}`)).map(([, v]) => v.at));
  if (id === 'first') return min(cl.map(([, v]) => v.at));
  if (id === 'runs' || id === 'allfam' || id === 'alldiff' || id === 'hardall') return max(cl.map(([, v]) => v.at));
  if (id === 'album') return max(ph.map(([, v]) => v.at));
  return undefined;
}
