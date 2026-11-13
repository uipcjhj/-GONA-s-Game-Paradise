import { useState } from 'react';
import PixelIcon from '../components/PixelIcon';
import { ACHIEVEMENTS, metric, TITLES } from '../platform/content';
import { getGame } from '../platform/games';
import { usePlayer } from '../platform/PlayerContext';
import PixelButton from '../ui/PixelButton';
import { fmtDate } from './Profile';

export default function Achievements({ onBack }: { onBack: () => void }) {
  const { player, pinAchievement } = usePlayer();
  const [tab, setTab] = useState<'all' | 'common' | 'food'>('all');
  if (!player) return null;
  const list = ACHIEVEMENTS.filter((a) => tab === 'all' || a.group === tab);
  const got = Object.keys(player.achievements).length;
  const linkPending = getGame('food-island')?.link === 'pending';
  return (
    <div className="p-screen">
      <div className="p-bar"><button type="button" className="p-back" onClick={onBack} aria-label="뒤로">‹</button><h2>업적 ACHIEVEMENTS</h2></div>
      <div className="p-scroll">
        <section className="p-panel p-row"><b style={{ flex: 1, fontSize: 13 }}>달성 {got} / {ACHIEVEMENTS.length}</b><span className="p-bar-xp" style={{ flex: 2 }}><i style={{ width: `${(got / ACHIEVEMENTS.length) * 100}%` }} /></span></section>
        {linkPending && <div className="p-link-note">🔌 Food Adventure 기록 연동 준비 중이라 <b>게임 플레이 기록이 필요한 업적</b>은 아직 진행되지 않아요.</div>}
        <div className="p-tabs" role="tablist">
          {([['all', '전체'], ['common', '공통'], ['food', 'Food']] as const).map(([id, l]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{l}</button>
          ))}
        </div>
        <div className="p-list">
          {list.map((a) => {
            const done = player.achievements[a.id];
            const v = Math.min(a.target, metric(player, a.metric));
            const title = a.titleId ? TITLES.find((t) => t.id === a.titleId) : undefined;
            const blocked = !done && a.needsGameLink && linkPending && v === 0;
            return (
              <div key={a.id} className={`p-item${done ? '' : ' lock'}`}>
                <span className="ic"><PixelIcon name={done ? 'star' : 'lock'} size={3} /></span>
                <div style={{ minWidth: 0 }}>
                  <b>{a.name}</b>
                  <p>{a.desc}</p>
                  {done ? <span className="p-chip ok">달성 {fmtDate(done.at)}</span> : (
                    <div className="p-prog"><span className="p-bar-xp" style={{ height: 7 }}><i style={{ width: `${(v / a.target) * 100}%` }} /></span><small>{v.toLocaleString('ko-KR')}/{a.target.toLocaleString('ko-KR')}</small></div>
                  )}
                  {blocked && <span className="p-chip soon" style={{ marginTop: 3 }}>게임 연동 대기</span>}
                </div>
                <div className="rw">
                  <span>🪙 {a.coins}{a.xp ? ` · XP ${a.xp}` : ''}</span>
                  {title && <span className="p-chip gold">칭호 {title.name}</span>}
                  {done && <PixelButton small variant="sub" style={{ minHeight: 28 }} onClick={() => pinAchievement(player.pinnedAchievement === a.id ? undefined : a.id)}>{player.pinnedAchievement === a.id ? '대표 ✔' : '대표로'}</PixelButton>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
