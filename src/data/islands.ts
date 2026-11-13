import type { Island } from '../types';

/**
 * 게임천국의 섬 목록 — 배열 순서 = 월드맵의 아래 → 위 순서.
 * 게임을 추가하려면 여기에 항목 하나만 넣으면 됩니다 (기존 게임 코드 수정 불필요).
 * 새 그림이 필요하면 src/art/painters.ts 에 painter 를 등록하고 theme 에 그 이름을 쓰세요.
 */
export const ISLANDS: Island[] = [
  {
    id: 'food-adventure',
    theme: 'food',
    name: '푸드 아일랜드',
    gameTitle: "GONA's Food Adventure",
    tagline: '간식을 먹으며 달리는 고나의 대모험!',
    status: 'open',
    // TODO: 실제 배포 주소를 확인한 뒤 등록 (확인 전에는 비워 둡니다)
    url: undefined,
  },
  {
    id: 'puzzle-island',
    theme: 'puzzle',
    name: '퍼즐 아일랜드',
    gameTitle: '퍼즐 놀이공원',
    tagline: '알록달록 미니게임 모음',
    status: 'soon',
  },
  {
    id: 'sky-island',
    theme: 'sky',
    name: '스카이 아일랜드',
    gameTitle: '구름 위 슈팅',
    tagline: '비행선을 타고 하늘을 지켜요',
    status: 'soon',
    floating: true,
  },
];
