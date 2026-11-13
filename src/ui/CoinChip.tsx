import PixelIcon from '../components/PixelIcon';

export default function CoinChip({ value }: { value: number }) {
  return (
    <div className="p-coinchip" aria-label={`고나 코인 ${value}`}>
      <PixelIcon name="coin" size={1.5} />
      {value.toLocaleString('ko-KR')}
    </div>
  );
}
