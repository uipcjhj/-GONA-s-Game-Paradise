import type { RankingEntry } from '../services/ranking';
import Avatar from './Avatar';

const MEDAL = ['1st', '2nd', '3rd'];
/** TOP 3 시상대 (2위-1위-3위 순서, 1위가 가장 높음) — 서버 응답이 있을 때만 사용 */
export default function Podium({ entries, meId }: { entries: RankingEntry[]; meId?: string }) {
  const top = entries.slice(0, 3);
  if (top.length === 0) return null;
  const order = [1, 0, 2].filter((i) => top[i]);
  return (
    <div className="p-podium" aria-label="TOP 3">
      {order.map((i) => {
        const e = top[i];
        return (
          <div key={e.playerId} className={`pod r${i + 1}${meId === e.playerId ? ' me' : ''}`}>
            <span className="medal">{MEDAL[i]}</span>
            <Avatar id={e.avatarId} size={36} />
            <b className="nm">{e.nickname}</b>
            <small>#{e.publicCode}</small>
            <b className="sc">{e.score.toLocaleString('ko-KR')}</b>
          </div>
        );
      })}
    </div>
  );
}
