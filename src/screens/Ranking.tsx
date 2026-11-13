import { useState } from 'react';
import PixelIcon from '../components/PixelIcon';
import { getGame } from '../platform/games';
import { usePlayer } from '../platform/PlayerContext';
import { overallIndex, rankingGames, weeklyBest } from '../platform/ranking';
import { NullRankingProvider, type RankingPeriod } from '../services/ranking';
import Avatar from '../ui/Avatar';
import { NamePlate, TitlePlate } from '../ui/Cosmetics';
import PixelPanel from '../ui/PixelPanel';
import { fmtDate } from './Profile';

/**
 * 로컬 기록 기반 랭킹: 게임별/주간·역대/종합 구조 + 내 최고 기록.
 * 다른 플레이어의 순위는 온라인 서버가 연결되기 전까지 만들어 보여주지 않는다(가짜 순위 금지).
 */
export default function Ranking() {
  const { player } = usePlayer();
  const games = rankingGames();
  const [game, setGame] = useState(games[0].id);
  const [period, setPeriod] = useState<RankingPeriod>('weekly');
  if (!player) return null;
  const g = games.find((x) => x.id === game)!;
  const def = getGame(game);
  const rec = player.gameRecords[game];
  const provider = NullRankingProvider;
  const wk = weeklyBest(rec, Date.now());
  const mine = period === 'weekly' ? wk : rec ? { score: rec.bestScore, at: rec.bestScoreAt } : null;
  const ov = overallIndex(player);
  return (
    <div className="p-screen">
      <div className="p-scroll">
        <div className="p-tabs" role="tablist" aria-label="게임 선택">
          {games.map((x) => <button key={x.id} type="button" role="tab" aria-selected={game === x.id} className={game === x.id ? 'on' : ''} onClick={() => setGame(x.id)}>{x.label}</button>)}
        </div>
        {game !== 'overall' && (
          <div className="p-tabs" role="tablist" aria-label="기간 선택">
            <button type="button" role="tab" aria-selected={period === 'weekly'} className={period === 'weekly' ? 'on' : ''} onClick={() => setPeriod('weekly')}>주간 (월~일)</button>
            <button type="button" role="tab" aria-selected={period === 'all-time'} className={period === 'all-time' ? 'on' : ''} onClick={() => setPeriod('all-time')}>역대 최고</button>
          </div>
        )}
        <PixelPanel>
          <div className="p-empty">
            <PixelIcon name={g.soon ? 'lock' : 'trophy'} size={5} />
            <b>{g.soon ? 'COMING SOON' : '온라인 랭킹 준비 중'}</b>
            <p className="p-muted">{g.soon ? `${g.name}이(가) 열리면 랭킹도 함께 열려요.` : provider.connected ? '' : '온라인 점수 서버가 아직 연결되지 않았어요. 다른 플레이어 순위는 서버가 연결된 뒤에 보여요.'}</p>
          </div>
        </PixelPanel>
        {game === 'overall' ? (
          <PixelPanel title="내 종합 지수 (참고용)">
            <p className="p-muted">게임마다 점수 규모가 달라서 원점수를 더하지 않고, 게임별 점수를 0~1 로 정규화한 뒤 평균해요. 순위가 아니라 내 지표예요.</p>
            <div className="p-list" style={{ marginTop: 8 }}>
              {ov.entries.map((e) => (
                <div key={e.gameId} className="p-row" style={{ justifyContent: 'space-between', fontSize: 11 }}><span>{e.name}</span><b>{e.played ? `${Math.round(e.normalized * 100)}%` : '기록 없음'}</b></div>
              ))}
            </div>
            <div className="p-stat" style={{ marginTop: 8 }}><b>{ov.index}</b><span>내 종합 지수 / 1000</span></div>
          </PixelPanel>
        ) : (
          <PixelPanel title={`내 ${period === 'weekly' ? '이번 주' : '역대'} 최고 · ${g.label}`}>
            <div className="p-row" style={{ background: '#fff2a8', border: '3px solid var(--ink)', padding: '7px 8px' }}>
              <Avatar id={player.avatarId} size={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="p-row" style={{ gap: 5, flexWrap: 'wrap' }}><NamePlate p={player} /><span className="p-chip blue">#{player.publicCode}</span></div>
                <TitlePlate p={player} />
              </div>
              <b style={{ fontSize: 15 }}>{mine ? mine.score.toLocaleString('ko-KR') : '—'}</b>
            </div>
            <p className="p-muted" style={{ marginTop: 6 }}>{mine ? `${fmtDate(mine.at)} 달성 · 이 기기의 로컬 기록 (온라인 검증 아님)` : def?.status === 'soon' ? '출시 전이에요.' : def?.link === 'pending' ? '아직 기록이 없어요. Food 기록 연동이 열리면 여기에 쌓여요.' : '아직 기록이 없어요.'}</p>
          </PixelPanel>
        )}
        {game !== 'overall' && rec && (
          <PixelPanel title="내 최근 기록">
            <div className="p-list">
              {rec.recent.slice(0, 8).map((r) => (
                <div key={r.resultId} className="p-row" style={{ justifyContent: 'space-between', fontSize: 11, borderBottom: '2px dashed #e2c08a', paddingBottom: 4 }}>
                  <span>{fmtDate(r.at)}{r.cleared ? ' · 클리어' : ''}{r.stage ? ` · ${r.stage}단계` : ''}</span><b>{r.score.toLocaleString('ko-KR')}</b>
                </div>
              ))}
            </div>
          </PixelPanel>
        )}
      </div>
    </div>
  );
}
