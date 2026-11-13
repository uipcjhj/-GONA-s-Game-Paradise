import PixelIcon from '../components/PixelIcon';
import { getMission } from '../platform/content';
import { missionsForDate } from '../platform/engine';
import { getGame } from '../platform/games';
import { usePlayer } from '../platform/PlayerContext';
import PixelButton from '../ui/PixelButton';

export default function Missions({ onBack }: { onBack: () => void }) {
  const { player, claimMission } = usePlayer();
  if (!player) return null;
  const defs = missionsForDate(player.daily.dateKST);
  const linkPending = getGame('food-island')?.link === 'pending';
  const done = defs.filter((d) => player.daily.missions[d.id]?.claimed).length;
  return (
    <div className="p-screen">
      <div className="p-bar"><button type="button" className="p-back" onClick={onBack} aria-label="뒤로">‹</button><h2>미션 MISSIONS</h2></div>
      <div className="p-scroll">
        <section className="p-panel">
          <h3>오늘의 미션 <span style={{ flex: 1 }} /><span className="p-chip blue">{player.daily.dateKST} · 한국 시간 00:00 초기화</span></h3>
          <p className="p-muted">완료 {done} / {defs.length} · 보상은 한 번만 받을 수 있어요.</p>
        </section>
        {linkPending && <div className="p-link-note">🔌 Food Adventure 기록 연동 준비 중이라 <b>게임을 끝까지 해야 하는 미션</b>은 아직 진행할 수 없어요. (표시: 연동 대기)</div>}
        <div className="p-list">
          {defs.map((d) => {
            const m = player.daily.missions[d.id] ?? { progress: 0, claimed: false };
            const def = getMission(d.id)!;
            const ready = m.progress >= def.target && !m.claimed;
            const blocked = def.needsGameLink && linkPending && m.progress < def.target;
            return (
              <div key={d.id} className={`p-item${m.claimed ? '' : blocked ? ' lock' : ''}`} style={{ gridTemplateColumns: '40px 1fr auto' }}>
                <span className="ic"><PixelIcon name={m.claimed ? 'check' : blocked ? 'lock' : 'list'} size={3} /></span>
                <div>
                  <b>{def.title}</b>
                  <p>{def.desc}</p>
                  <div className="p-prog"><span className="p-bar-xp" style={{ height: 7 }}><i style={{ width: `${(Math.min(m.progress, def.target) / def.target) * 100}%` }} /></span><small>{Math.min(m.progress, def.target)}/{def.target}</small></div>
                  {blocked && <span className="p-chip soon" style={{ marginTop: 3 }}>게임 연동 대기 · 진행 불가</span>}
                </div>
                <div className="rw">
                  <span>🪙 {def.coins} · XP {def.xp}</span>
                  {m.claimed ? <span className="p-chip ok">수령 완료</span> : <PixelButton small className={ready ? '' : 'off'} disabled={!ready} onClick={() => claimMission(d.id)}>{ready ? '받기' : '진행중'}</PixelButton>}
                </div>
              </div>
            );
          })}
        </div>
        <p className="p-muted">날짜는 이 기기의 시계(한국 시간 기준)로 계산해요. 시계를 되돌려도 보상은 다시 지급되지 않아요.</p>
      </div>
    </div>
  );
}
