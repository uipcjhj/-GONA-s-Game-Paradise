import { useState } from 'react';
import { ACHIEVEMENTS } from '../platform/achievements';
import { GAMES } from '../platform/registry';
import { usePlayer } from '../platform/PlayerContext';
import { getItem } from '../platform/shop';
import { fmtDay } from '../ui/format';
import PixelPanel from '../ui/PixelPanel';
import SubBar from '../ui/SubBar';

export default function Achievements({ onBack }: { onBack: () => void }) {
  const { player } = usePlayer();
  const [tab, setTab] = useState<string>('common');
  if (!player) return null;
  const tabs = [{ id: 'common', label: '공통' }, ...GAMES.map((g) => ({ id: g.gameId, label: g.short }))];
  const list = ACHIEVEMENTS.filter((a) => (tab === 'common' ? !a.gameId : a.gameId === tab));
  const done = ACHIEVEMENTS.filter((a) => player.achievements[a.id]).length;
  return (
    <div className="p-screen">
      <SubBar title="업적" onBack={onBack} right={`${done}/${ACHIEVEMENTS.length}`} />
      <div className="p-scroll">
        <div className="p-tabs" role="tablist">
          {tabs.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        {list.length === 0 && (
          <PixelPanel>
            <p className="p-muted">이 게임의 업적은 게임이 열리면 추가돼요.</p>
          </PixelPanel>
        )}
        {list.map((a) => {
          const v = Math.min(a.target, a.value(player));
          const at = player.achievements[a.id];
          return (
            <PixelPanel key={a.id}>
              <div className="p-achv" data-done={at ? '1' : '0'} data-testid={`ach-${a.id}`}>
                <div className="p-achv-head">
                  <b>{a.name}</b>
                  {at ? <span className="p-chip ok">달성 {fmtDay(at)}</span> : <span className="p-chip">{v}/{a.target}</span>}
                </div>
                <p className="p-muted">{a.desc}</p>
                <span className="p-bar-xp" role="progressbar" aria-valuenow={v} aria-valuemax={a.target}>
                  <i style={{ width: `${Math.round((v / a.target) * 100)}%` }} />
                </span>
                <p className="p-muted">
                  보상 코인 {a.rewardCoins}
                  {a.rewardTitle ? ` · 칭호 ‘${getItem(a.rewardTitle)?.name}’` : ''}
                </p>
              </div>
            </PixelPanel>
          );
        })}
      </div>
    </div>
  );
}
