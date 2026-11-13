import { getAvatar } from '../platform/avatars';

/** 아바타 이미지: 작은 크기(≤36px)는 64px 사전 축소본을 써서 선명하게, 그 외에는 128px 원본(≤1x 로만 표시) */
export default function Avatar({ id, size = 32, className = '' }: { id: string; size?: number; className?: string }) {
  const a = getAvatar(id);
  const src = size <= 36 ? a.src.replace('.png', '-s.png') : a.src;
  return (
    <span className={`p-av ${className}`} style={{ width: size, height: size }}>
      <img src={src} alt={a.name} draggable={false} />
    </span>
  );
}
