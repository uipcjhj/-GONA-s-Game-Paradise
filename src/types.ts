export interface Point {
  x: number;
  y: number;
}

/** 월드맵 이미지(gona-world-map.png) 픽셀 좌표계 기준 */
export interface IslandMap {
  /** 터치 영역(사각형). clip: 사각형 안에서 %로 지정하는 다각형(다리 등 겹침 제외용) */
  hit: { x: number; y: number; w: number; h: number; clip?: string };
  /** 중앙 광장 → 섬 도착 지점까지 다리의 꺾임을 따라가는 경로. 첫 점은 광장, 마지막 점이 고나가 서는 곳 */
  path: Point[];
}

/** 게임 한 개 = 섬 한 개. 새 게임은 src/data/islands.ts 에 항목만 추가하면 됩니다. */
export interface Island {
  /** 고유 ID. 향후 점수·업적·랭킹의 gameId 로 그대로 사용 */
  id: string;
  name: string;
  gameTitle: string;
  tagline: string;
  /** 'open' = 입장 가능 / 'soon' = COMING SOON */
  status: 'open' | 'soon';
  /** 게임 주소. 비어 있으면 입장 버튼이 잠깁니다. */
  url?: string;
  /** 게임천국 기록 연동 상태: 'live' = 결과가 자동 기록됨 / 'pending' = 게임 쪽 연동 대기(플레이는 되지만 기록은 아직 안 쌓임) */
  sdk?: 'live' | 'pending';
  map: IslandMap;
}
