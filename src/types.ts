/** 게임 한 개 = 섬 한 개. 새 게임은 src/data/islands.ts 에 항목만 추가하면 됩니다. */
export interface Island {
  /** 고유 ID (소문자-영문). 향후 점수·업적·랭킹의 gameId 로 그대로 사용 */
  id: string;
  /** 섬 그림 종류 — src/art/painters.ts 의 PAINTERS 키. 없는 값이면 기본 섬 */
  theme: string;
  /** 월드맵 표지판 · 패널 제목 */
  name: string;
  /** 게임 이름 (패널에 크게 표시) */
  gameTitle: string;
  /** 한 줄 소개 */
  tagline: string;
  /** 'open' = 입장 가능 / 'soon' = COMING SOON */
  status: 'open' | 'soon';
  /**
   * 게임 주소. status 가 'open' 이어도 주소가 비어 있으면 입장 버튼이 잠깁니다.
   * 확인되지 않은 주소는 임의로 넣지 마세요.
   */
  url?: string;
  /** 하늘에 떠 있는 섬(그림자 표시) */
  floating?: boolean;
  /** (선택) 월드맵 좌표를 직접 지정. 생략하면 아래에서 위로 지그재그 자동 배치 */
  pos?: { x: number; y: number };
}
