import PixelIcon from '../components/PixelIcon';
import { getItem, TITLES } from '../platform/content';
import type { PlayerData, ShopSlot } from '../platform/types';
import Avatar from './Avatar';

export const equippedStyle = (p: PlayerData, slot: ShopSlot): string => getItem(p.inventory.equipped[slot] ?? '')?.style ?? 'basic';
export const titleName = (p: PlayerData): string => TITLES.find((t) => t.id === p.titleId)?.name ?? '고나 친구';

const DECO_ICON: Record<string, string> = { sprout: 'sprout', heart: 'heart', star: 'star', crown: 'crown' };

/** 아바타 장식(코드 도트 아이콘) */
export function Deco({ style, size = 2 }: { style: string; size?: number }) {
  const icon = DECO_ICON[style];
  return icon ? (
    <span className="p-deco" aria-hidden>
      <PixelIcon name={icon} size={size} />
    </span>
  ) : null;
}

/** 프로필 초상: 테두리 + 아바타 + 장식 (장착한 꾸미기 반영) */
export function Portrait({ p, size = 76, frame, deco }: { p: PlayerData; size?: number; frame?: string; deco?: string }) {
  const f = frame ?? equippedStyle(p, 'frame');
  const d = deco ?? equippedStyle(p, 'avatarDeco');
  return (
    <div className={`p-portrait sh-frame-${f}`} style={{ height: size + 8 }}>
      <Avatar id={p.avatarId} size={size} />
      <Deco style={d} size={size >= 60 ? 3 : 2} />
    </div>
  );
}

export function NamePlate({ p, name }: { p: PlayerData; name?: string }) {
  return <b className={`p-nameplate-text sh-nameplate-${equippedStyle(p, 'nameplate')}`}>{name ?? p.nickname}</b>;
}
export function TitlePlate({ p, titleId }: { p: PlayerData; titleId?: string }) {
  const name = titleId ? TITLES.find((t) => t.id === titleId)?.name : titleName(p);
  return <span className={`p-titleplate sh-titleStyle-${equippedStyle(p, 'titleStyle')}`}>{name}</span>;
}
