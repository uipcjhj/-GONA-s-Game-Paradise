/** 브라우저 저장 키 앞부분. 공개 테스트판(VITE_SKY_NS)은 개발판·정식 사이트와 기록이 섞이지 않도록 따로 저장 */
export const NS: string = (import.meta.env.VITE_SKY_NS as string | undefined) || 'gona.sky';
/** 공개 테스트판 빌드 여부 — 화면 구석에 BETA TEST 표시 */
export const BETA: boolean = import.meta.env.VITE_SKY_BETA === '1';
