import { useEffect } from 'react';
import { ACHIEVEMENTS, CODEX, MISSION_POOL, TITLES } from '../platform/content';
import { usePlayer, type Notice } from '../platform/PlayerContext';

const text = (n: Notice): { t: string; s?: string } => {
  switch (n.kind) {
    case 'achievement': { const a = ACHIEVEMENTS.find((x) => x.id === n.id); return { t: `🏆 업적 달성! ${a?.name ?? ''}`, s: `🪙 +${a?.coins ?? 0}${a?.xp ? ` · XP +${a.xp}` : ''}` }; }
    case 'title': return { t: `🎖 새 칭호 획득!`, s: TITLES.find((x) => x.id === n.id)?.name };
    case 'codex': return { t: `📖 도감에 등록!`, s: CODEX.find((x) => x.id === n.id)?.name };
    case 'mission': return { t: '✅ 미션 완료!', s: [...Object.values(MISSION_POOL).flat()].find((m) => m.id === n.id)?.title };
    case 'attendance': return { t: `📅 ${n.streak}일 연속 출석!`, s: `🪙 +${n.coins} · XP +${n.xp}` };
    default: return { t: '' };
  }
};

/** 알림 큐: 업적·칭호·도감·미션·출석은 작은 토스트, 레벨업은 짧은 연출(모션 줄이기 반영). 하나씩 차례로 */
export default function NoticeHost() {
  const { notices, dismissNotice } = usePlayer();
  const cur = notices[0];
  useEffect(() => {
    if (!cur || cur.kind === 'levelup') return;
    const id = window.setTimeout(dismissNotice, 2300);
    return () => window.clearTimeout(id);
  }, [cur, dismissNotice]);
  if (!cur) return null;
  if (cur.kind === 'levelup') {
    return (
      <div className="p-lvup" role="alertdialog" aria-label="레벨 업" onClick={dismissNotice}>
        <div className="box">
          <h2>LEVEL UP!</h2>
          <div className="lv">Lv {cur.from} → Lv {cur.to}</div>
          <small>{cur.coins > 0 ? `레벨 보너스 🪙 +${cur.coins}` : '축하해요!'}</small>
          <div style={{ marginTop: 10 }}><span className="p-chip gold">터치해서 닫기</span></div>
        </div>
      </div>
    );
  }
  const t = text(cur);
  return (
    <div className="p-notice-host" role="status">
      <div className="p-ntoast" onClick={dismissNotice}>
        <div>{t.t}{t.s && <small>{t.s}</small>}</div>
      </div>
    </div>
  );
}
