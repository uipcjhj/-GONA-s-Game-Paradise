/** 브라우저 저장 키 앞부분. 공개 테스트판(VITE_SKY_NS)은 개발판·정식 사이트와 기록이 섞이지 않도록 따로 저장 */
export const NS: string = (import.meta.env.VITE_SKY_NS as string | undefined) || 'gona.sky';
/** 공개 테스트판 빌드 여부 — 화면 구석에 BETA TEST 표시 */
export const BETA: boolean = import.meta.env.VITE_SKY_BETA === '1';
/** 정식 플레이판 빌드(VITE_SKY_PROD=1 · /sky-adventure/): 테스트 허브 · ?dev 치트 · 테스트 버튼을 빌드에서 끔 */
export const PROD: boolean = import.meta.env.VITE_SKY_PROD === '1';

/**
 * 개발자용 컷신 미리보기 (?preview=menu|opening|ending|epilogue|credits|full)
 *  - 기록·사진·배지·미션·업적·클리어·설정·프로필 등 'gona.' 로 시작하는 브라우저 저장은 이 탭에서 전부 무시(쓰기·삭제 차단)
 *  - 온라인 제출·동기화 끔 (online.ts) · PWA 등록 안 함
 *  ⚠ 공개 정적 사이트라 URL 을 아는 사람은 누구나 열 수 있음 → '접근 제한'이 아니라 '열어도 아무 기록도 바뀌지 않게' 만드는 방식
 */
export type PreviewMode = 'menu' | 'opening' | 'ending' | 'epilogue' | 'credits' | 'full' | 'stage5';
export const PREVIEW: PreviewMode | null = ((): PreviewMode | null => {
  if (typeof location === 'undefined') return null;
  const m = /[?&]preview(?:=(\w+))?(?:&|$)/.exec(location.search);
  if (!m) return null;
  const v = (m[1] ?? 'menu') as PreviewMode;
  return (['menu', 'opening', 'ending', 'epilogue', 'credits', 'full', 'stage5'] as const).includes(v) ? v : 'menu';
})();
if (PREVIEW && typeof Storage !== 'undefined') {
  const P = Storage.prototype;
  const set = P.setItem, rm = P.removeItem;
  const blocked: string[] = [];
  const isGame = (k: unknown): boolean => String(k).startsWith('gona.');
  P.setItem = function (this: Storage, k: string, v: string): void { if (isGame(k)) { blocked.push(`set ${k}`); return; } set.call(this, k, v); };
  P.removeItem = function (this: Storage, k: string): void { if (isGame(k)) { blocked.push(`remove ${k}`); return; } rm.call(this, k); };
  P.clear = function (): void { blocked.push('clear'); };
  Object.assign(window, { __skyPreviewBlocked: blocked });
}
