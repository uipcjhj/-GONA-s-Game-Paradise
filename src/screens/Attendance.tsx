import { BALANCE } from '../platform/balance';
import { effectiveDate } from '../platform/engine';
import { usePlayer } from '../platform/PlayerContext';
import PixelButton from '../ui/PixelButton';
import PixelPanel from '../ui/PixelPanel';

export default function Attendance({ onBack }: { onBack: () => void }) {
  const { player, checkIn } = usePlayer();
  if (!player) return null;
  const a = player.attendance;
  const today = effectiveDate(player, Date.now());
  const checked = a.lastDate === today;
  const cycle = BALANCE.attendance.coins;
  const dayInCycle = a.streak > 0 ? ((a.streak - 1) % cycle.length) + 1 : 0;
  return (
    <div className="p-screen">
      <div className="p-bar"><button type="button" className="p-back" onClick={onBack} aria-label="뒤로">‹</button><h2>출석 CHECK-IN</h2></div>
      <div className="p-scroll">
        <PixelPanel title="출석 현황" right={<span className={`p-chip ${checked ? 'ok' : 'soon'}`}>{checked ? '오늘 출석 완료' : '오늘 미출석'}</span>}>
          <div className="p-grid3">
            <div className="p-stat"><b>{a.streak}일</b><span>연속 출석</span></div>
            <div className="p-stat"><b>{a.longest}일</b><span>최장 연속</span></div>
            <div className="p-stat"><b>{a.total}일</b><span>누적 출석</span></div>
          </div>
        </PixelPanel>
        <PixelPanel title="7일 출석 보상">
          <div className="p-days">
            {cycle.map((c, i) => {
              const n = i + 1;
              const done = dayInCycle > 0 && (n < dayInCycle || (n === dayInCycle && checked));
              const isToday = !checked && n === (dayInCycle % cycle.length) + 1;
              return (
                <div key={n} className={`${done ? 'done' : ''} ${isToday ? 'today' : ''} ${n === 7 ? 'big' : ''}`}>
                  <span>{n}일</span><b>🪙{c}</b>{done ? <span>✔</span> : null}
                </div>
              );
            })}
          </div>
          <p className="p-muted" style={{ marginTop: 8 }}>하루 한 번, 처음 접속하면 자동으로 출석돼요. 하루(한국 시간 00:00 기준)를 건너뛰면 연속 일수가 1부터 다시 시작해요. 7일을 채우면 큰 보상!</p>
        </PixelPanel>
        {!checked && <PixelButton big block onClick={checkIn}>출석 체크</PixelButton>}
        <p className="p-muted">출석은 이 기기의 시계를 기준으로 해서 온라인 검증이 아니에요. 같은 날 여러 번 열거나 시계를 되돌려도 보상은 한 번만 받아요.</p>
      </div>
    </div>
  );
}
