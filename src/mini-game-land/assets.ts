/**
 * 승인된 기존 에셋을 그대로 재사용 (복사·변형 없음). Vite 가 해시 파일명으로 번들해
 * /mini-game-land/ 하위 경로에서도 주소가 어긋나지 않습니다.
 */
import gonaUrl from '../../public/assets/gona.png';

export { gonaUrl };
/** gona.png 원본 크기(27×34) */
export const GONA_SIZE = { w: 27, h: 34 } as const;
