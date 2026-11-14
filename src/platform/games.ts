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

/** 개발 테스트 전용: 모의 게임으로 Sky/Mini 연동 흐름을 검증할 때만 켠다(운영 빌드 기본 꺼짐) */
export const TEST_GAMES: boolean = import.meta.env.VITE_TEST_GAMES === '1';

/**
 * Sky Adventure(슈팅게임) 개발판 플래그: 개발 서버 · 주소에 ?dev · #sky · VITE_SKY_PREVIEW=1 일 때만 플레이 가능. 정식 배포 화면은 COMING SOON 유지.
 * (Sky 개발 브랜치 gonas-sky-adventure-dev 의 게이팅을 그대로 따름 — 사용자 승인 전에는 운영에서 열리지 않음)
 */
export const SKY_DEV: boolean = typeof location !== 'undefined' && (import.meta.env.VITE_SKY_PREVIEW === '1' || import.meta.env.DEV || /[?&]dev(=|&|$)/.test(location.search) || location.hash === '#sky');

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
    rules: { higherIsBetter: true, maxScore: 10_000_000, maxScorePerSec: 1000, stageCount: 1, hasClear: true, scoreSchemaVersion: 1, referenceScore: 100000, weight: 1 },
    status: TEST_GAMES || SKY_DEV ? 'live' : 'soon',
    link: TEST_GAMES || SKY_DEV ? 'live' : 'pending',
  },
  {
    gameId: 'minigame-paradise',
    name: 'GONA Mini Game Land',
    short: 'Mini',
    rules: { higherIsBetter: true, maxScore: 1_000_000, maxScorePerSec: 1000, hasClear: true, scoreSchemaVersion: 1, referenceScore: 10000, weight: 1 },
    status: TEST_GAMES || SKY_DEV ? 'live' : 'soon',
    link: TEST_GAMES || SKY_DEV ? 'live' : 'pending',
  },
];

/** Mini Game Land 의 개별 미니게임 목록(subGameId). 실제 미니게임이 생기면 여기에 등록한다 — 지금은 비어 있음(임의 제작 없음) */
export interface MiniGameDef { id: string; name: string }
export const MINI_GAMES: MiniGameDef[] = [
  { id: 'sort', name: '편가르기' },
  { id: 'tower', name: '아슬아슬 탑' },
  { id: 'toyroom', name: '장난감방' },
  { id: 'challenge', name: '랜덤 챌린지' },
  ...(TEST_GAMES ? [{ id: 'cat-jump', name: '캣 점프(모의)' }, { id: 'fish-catch', name: '물고기 잡기(모의)' }] : []),
];

export const getGame = (id: string): GameDef | undefined => GAMES.find((g) => g.gameId === id);

/** 허용 점수 상한: 시간 기반 + 이어하기 허용치, 절대 상한과 중 작은 값 */
export function scoreLimit(g: GameDef, durationSec: number): number {
  return Math.min(g.rules.maxScore, Math.ceil(g.rules.maxScorePerSec * Math.max(durationSec, 10)) + BALANCE.validation.carryAllowance);
}
