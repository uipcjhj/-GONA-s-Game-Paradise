import { BALANCE } from './balance';

/** 결과 규칙 + 표시 정보 (섬 목록 `data/islands.ts` 의 id = gameId) */
export interface GameDef {
  gameId: string;
  name: string;
  short: string;
  /** 점수 규칙 */
  rules: {
    higherIsBetter: true;
    maxScore: number;
    maxScorePerSec: number;
    stageCount?: number;
    stageLabels?: string[];
    hasClear: boolean;
    scoreSchemaVersion: number;
    /** 종합 지수 계산용: 이 점수면 만점(1.0) — 임시 기준값 */
    referenceScore: number;
    weight: number;
  };
  /** live = 플레이 가능(랭킹/기록 대상) · soon = COMING SOON */
  status: 'live' | 'soon';
  /** 기록 연동 상태: pending = 게임 쪽 패치 전(기록 안 쌓임) · live = 연동 완료 */
  link: 'pending' | 'live';
}

/**
 * Food 연동 상태. Food 쪽 최소 패치(docs/platform/food-patch)가 정식 배포되기 전에는 'pending'.
 * 패치 배포 후 이 값을 'live' 로 바꾸면 PLAY 가 세션을 만들어 `?gp=` 로 실행한다.
 */
export const PROD_FOOD_URL = 'https://uipcjhj.github.io/GoNa/';
/**
 * 개발 테스트에서만 켠다: 빌드 시 VITE_FOOD_LINK=live **그리고** VITE_FOOD_URL 이 운영 주소가 아닌 개발/로컬 주소일 때만 'live'.
 * 운영 주소(PROD_FOOD_URL)를 대상으로는 어떤 설정이어도 활성화되지 않는다 — Food 패치 정식 배포 후 아래 조건을 수정할 것.
 */
export const FOOD_URL: string = (import.meta.env.VITE_FOOD_URL as string | undefined) || PROD_FOOD_URL;
export const FOOD_LINK: 'pending' | 'live' = import.meta.env.VITE_FOOD_LINK === 'live' && FOOD_URL !== PROD_FOOD_URL ? 'live' : 'pending';

export const GAMES: GameDef[] = [
  {
    gameId: 'food-island',
    name: "GONA's Food Adventure",
    short: 'Food',
    rules: {
      higherIsBetter: true,
      maxScore: 2_000_000,
      maxScorePerSec: 120,
      stageCount: 4,
      stageLabels: ['갓난아기 고나', '기어 다니는 고나', '직립보행 고나', '자이언트 곤룡 고나'],
      hasClear: true,
      scoreSchemaVersion: 1,
      referenceScore: 20000,
      weight: 1,
    },
    status: 'live',
    link: FOOD_LINK,
  },
  {
    gameId: 'sky-battle',
    name: 'GONA Sky Battle',
    short: 'Sky',
    rules: { higherIsBetter: true, maxScore: 10_000_000, maxScorePerSec: 1000, hasClear: true, scoreSchemaVersion: 1, referenceScore: 100000, weight: 1 },
    status: 'soon',
    link: 'pending',
  },
  {
    gameId: 'minigame-paradise',
    name: 'GONA Mini Game Land',
    short: 'Mini',
    rules: { higherIsBetter: true, maxScore: 1_000_000, maxScorePerSec: 1000, hasClear: false, scoreSchemaVersion: 1, referenceScore: 10000, weight: 1 },
    status: 'soon',
    link: 'pending',
  },
];

export const getGame = (id: string): GameDef | undefined => GAMES.find((g) => g.gameId === id);

/** 허용 점수 상한: 시간 기반 + 이어하기 허용치, 절대 상한과 중 작은 값 */
export function scoreLimit(g: GameDef, durationSec: number): number {
  return Math.min(g.rules.maxScore, Math.ceil(g.rules.maxScorePerSec * Math.max(durationSec, 10)) + BALANCE.validation.carryAllowance);
}
