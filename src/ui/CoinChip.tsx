import { useEffect, useRef, useState } from 'react';
import PixelIcon from '../components/PixelIcon';

/** 코인 표시: 값이 바뀌면 살짝 튀어 오름(획득·소비 피드백) */
export default function CoinChip({ value }: { value: number }) {
  const prev = useRef(value);
  const [bump, setBump] = useState(false);
  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    setBump(true);
    const t = window.setTimeout(() => setBump(false), 420);
    return () => window.clearTimeout(t);
  }, [value]);
  return (
    <div className={`p-coinchip${bump ? ' bump' : ''}`} aria-label={`고나 코인 ${value}`}>
      <PixelIcon name="coin" size={1.5} />
      {value.toLocaleString('ko-KR')}
    </div>
  );
}
