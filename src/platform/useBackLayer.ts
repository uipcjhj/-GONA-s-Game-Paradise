import { useEffect, useRef } from 'react';
import { pushLayer } from './backStack';

/** active 인 동안 브라우저 뒤로가기 = onBack 호출 */
export function useBackLayer(active: boolean, onBack: () => void): void {
  const ref = useRef(onBack);
  ref.current = onBack;
  useEffect(() => {
    if (!active) return;
    return pushLayer(() => ref.current());
  }, [active]);
}
