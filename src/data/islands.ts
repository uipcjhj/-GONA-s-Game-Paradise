import type { Island } from '../types';
import { PLAZA } from './world';

/**
 * 게임천국의 섬 목록. 게임을 추가하려면 항목 하나만 넣으면 됩니다 (기존 게임 코드 수정 불필요).
 * 새 섬이 월드맵 이미지에 그려지면 map.hit(터치 영역) 과 map.path(다리 경로)를 이미지 좌표로 적어 주세요.
 */
export const ISLANDS: Island[] = [
  {
    id: 'food-island',
    name: '푸드 아일랜드',
    gameTitle: "GONA's Food Adventure",
    tagline: '간식을 먹으며 달리는 고나의 대모험!',
    status: 'open',
    url: 'https://uipcjhj.github.io/GoNa/',
    map: {
      hit: { x: 20, y: 225, w: 465, h: 435 },
      path: [PLAZA, { x: 450, y: 760 }, { x: 385, y: 700 }, { x: 330, y: 645 }, { x: 280, y: 590 }, { x: 305, y: 545 }],
    },
  },
  {
    id: 'sky-battle',
    name: '스카이 배틀',
    gameTitle: '스카이 배틀',
    tagline: '세로 스크롤 슈팅게임',
    status: 'soon',
    map: {
      hit: { x: 520, y: 150, w: 545, h: 410 },
      path: [PLAZA, { x: 640, y: 770 }, { x: 700, y: 700 }, { x: 750, y: 630 }, { x: 790, y: 560 }, { x: 800, y: 480 }],
    },
  },
  {
    id: 'minigame-paradise',
    name: '미니게임천국',
    gameTitle: '미니게임천국',
    tagline: '다양한 미니게임 모음 · 게임별 최고 점수 랭킹 예정',
    status: 'soon',
    map: {
      hit: { x: 565, y: 800, w: 505, h: 480, clip: 'polygon(46% 0,100% 0,100% 100%,0 100%,0 40%,46% 29%)' },
      path: [PLAZA, { x: 620, y: 870 }, { x: 690, y: 935 }, { x: 740, y: 985 }, { x: 765, y: 1050 }, { x: 790, y: 1115 }],
    },
  },
];
