import type { PlayerData } from '../platform/types';
import Avatar from './Avatar';

/** 헤더 좌측: 아바타 · 닉네임 · LV (XP 는 프로필에서만) */
export default function PlayerButton({ player, onClick }: { player: PlayerData; onClick: () => void }) {
  return (
    <button type="button" className="p-pbtn" onClick={onClick} aria-label={`프로필 열기: ${player.nickname} 레벨 ${player.playerLevel}`}>
      <Avatar id={player.avatarId} size={28} />
      <span className="meta">
        <span className="nm">{player.nickname}</span>
        <span className="lv">LV{player.playerLevel}</span>
      </span>
    </button>
  );
}
