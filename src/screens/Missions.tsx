import PixelIcon from '../components/PixelIcon';
import { addDays, dateKST } from '../platform/kst';
import { attendanceReward, getMission, weekDays } from '../platform/missions';
import { usePlayer } from '../platform/PlayerContext';
import { TUNING } from '../platform/tuning';
import PixelButton from '../ui/PixelButton';
import PixelPanel from '../ui/PixelPanel';
import SubBar from '../ui/SubBar';

export default function Missions({ onBack, onToast }: { onBack: () => void; onToast: (t: string) => void }) {
  const { player, claimMission, claimAttendance } = usePlayer();
  const m = player?.missions;
  if (!player) return null;
  if (!m)
    return (
      <div className="p-screen">
        <SubBar title="미션" onBack={onBack} />
        <div className="p-scroll">
          <PixelPanel>
            <p className="p-muted">미션을 준비하고 있어요. 잠시 후 다시 열어 주세요.</p>
          </PixelPanel>
        </div>
      </div>
    );
  const today = dateKST(new Date());
  const claimedToday = m.attendance.claimedDateKST === today;
  const streak = m.attendance.streak;
  const doClaim = (id: string) => {
    const r = claimMission(id);
    if (r.ok) onToast(`미션 완료! +${r.coins} 코인 · +${r.xp} XP`);
  };
  const row = (id: string, value: number, claimed: boolean) => {
    const def = getMission(id);
    if (!def) return null;
    const done = value >= def.target;
    return (
      <div key={id} className="p-mission" data-testid={`mission-${id}`} data-state={claimed ? 'claimed' : done ? 'done' : 'todo'}>
        <div className="p-mission-main">
          <b>{def.name}</b>
          <span className="p-bar-xp">
            <i style={{ width: `${Math.round((Math.min(value, def.target) / def.target) * 100)}%` }} />
          </span>
          <small>
            {Math.min(value, def.target)}/{def.target} · 코인 {def.rewardCoins} · XP {def.rewardXP}
          </small>
        </div>
        <PixelButton small variant={done && !claimed ? 'primary' : 'sub'} disabled={!done || claimed} onClick={() => doClaim(id)}>
          {claimed ? '받음' : done ? '받기' : '진행 중'}
        </PixelButton>
      </div>
    );
  };
  const rewards = TUNING.attendanceCoins;
  return (
    <div className="p-screen">
      <SubBar title="미션 · 출석" onBack={onBack} />
      <div className="p-scroll">
        <PixelPanel title="출석 체크" right={<span className="p-chip blue">연속 {streak}일</span>}>
          <div className="p-days" data-testid="attendance">
            {rewards.map((c, i) => {
              const dayNo = ((streak - 1) % rewards.length) + 1;
              const got = i + 1 < dayNo || (i + 1 === dayNo && claimedToday);
              return (
                <div key={i} className={`p-day${got ? ' got' : ''}${i + 1 === dayNo ? ' cur' : ''}`}>
                  <small>{i + 1}일</small>
                  <PixelIcon name="coin" size={1.5} />
                  <b>{c}</b>
                </div>
              );
            })}
          </div>
          <PixelButton
            block
            disabled={claimedToday}
            data-testid="attendance-claim"
            onClick={() => {
              const r = claimAttendance();
              if (r.ok) onToast(`출석 보상! +${r.coins} 코인`);
            }}
          >
            {claimedToday ? '오늘 출석 완료' : `출석 보상 받기 (+${attendanceReward(streak)})`}
          </PixelButton>
          <p className="p-muted">기기 시계를 기준으로 해서 보상은 소액이에요. 내일 {addDays(today, 1).slice(5).replace('-', '/')} 에 다시 올 수 있어요.</p>
        </PixelPanel>
        <PixelPanel title="오늘의 미션">{m.daily.map((x) => row(x.id, x.value, x.claimed))}</PixelPanel>
        <PixelPanel title="이번 주 미션" right={<span className="p-chip">접속 {weekDays(m)}일</span>}>
          {m.weekly.map((x) => row(x.id, x.value, x.claimed))}
        </PixelPanel>
      </div>
    </div>
  );
}
