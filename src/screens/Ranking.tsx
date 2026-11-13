import { useState } from 'react';
import PixelIcon from '../components/PixelIcon';
import { ISLANDS } from '../data/islands';
import { localBoard } from '../platform/localRanking';
import { getGame } from '../platform/registry';
import { usePlayer } from '../platform/PlayerContext';
import { NullRankingProvider, type RankingPeriod } from '../services/ranking';
import Avatar from '../ui/Avatar';
import { fmtDay, fmtScore } from '../ui/format';
import PixelPanel from '../ui/PixelPanel';

const SUBS = [
  { id: 'sort', label: '편가르기' },
  { id: 'tower', label: '탑' },
  { id: 'toyroom', label: '장난감방' },
  { id: 'challenge', label: '챌린지' },
];

/**
 * 랭킹: 온라인(공유) 랭킹은 서버가 없어 "미연결"로 솔직하게 표시(가짜 순위 없음).
 * 대신 이 기기에서 내가 낸 기록의 순위(주간·역대)는 실제 데이터로 보여 줌.
 */
export default function Ranking() {
  const { player } = usePlayer();
  const games = [...ISLANDS.map((i) => ({ id: i.id, label: getGame(i.id)?.short ?? i.name, soon: i.status === 'soon', title: i.gameTitle })), { id: 'overall', label: '종합', soon: false, title: '종합 랭킹' }];
  const [game, setGame] = useState(games[0].id);
  const [sub, setSub] = useState('sort');
  const [period, setPeriod] = useState<RankingPeriod>('weekly');
  const g = games.find((x) => x.id === game)!;
  const provider = NullRankingProvider;
  const hasSub = game === 'minigame-paradise';
  const rows = player && game !== 'overall' && !g.soon ? localBoard(player, game, period, hasSub ? sub : undefined) : [];
  return (
    <div className="p-screen">
      <div className="p-scroll">
        <div className="p-tabs" role="tablist" aria-label="게임 선택">
          {games.map((x) => (
            <button key={x.id} type="button" role="tab" aria-selected={game === x.id} className={game === x.id ? 'on' : ''} onClick={() => setGame(x.id)}>
              {x.label}
            </button>
          ))}
        </div>
        {game !== 'overall' && (
          <div className="p-tabs" role="tablist" aria-label="기간 선택">
            <button type="button" role="tab" aria-selected={period === 'weekly'} className={period === 'weekly' ? 'on' : ''} onClick={() => setPeriod('weekly')}>
              주간
            </button>
            <button type="button" role="tab" aria-selected={period === 'all-time'} className={period === 'all-time' ? 'on' : ''} onClick={() => setPeriod('all-time')}>
              역대 최고
            </button>
          </div>
        )}
        {hasSub && (
          <div className="p-tabs" role="tablist" aria-label="미니게임 선택">
            {SUBS.map((x) => (
              <button key={x.id} type="button" role="tab" aria-selected={sub === x.id} className={sub === x.id ? 'on' : ''} onClick={() => setSub(x.id)}>
                {x.label}
              </button>
            ))}
          </div>
        )}
        <div className="p-notice" data-testid="rank-offline">
          <b>온라인 랭킹 미연결</b> — {provider.connected ? '' : '점수 서버가 아직 없어서 다른 플레이어의 순위는 보여줄 수 없어요. 아래는 이 기기에서 내가 기록한 점수예요.'}
        </div>
        {g.soon ? (
          <PixelPanel>
            <div className="p-empty">
              <PixelIcon name="lock" size={5} />
              <b>COMING SOON</b>
              <p className="p-muted">{g.title}이(가) 열리면 기록도 함께 쌓여요.</p>
            </div>
          </PixelPanel>
        ) : game === 'overall' ? (
          <PixelPanel>
            <div className="p-empty">
              <PixelIcon name="trophy" size={5} />
              <b>종합 랭킹은 온라인 전용</b>
              <p className="p-muted">여러 게임의 순위를 합치려면 다른 플레이어의 기록이 필요해서, 서버가 연결되면 열려요.</p>
            </div>
          </PixelPanel>
        ) : (
          <PixelPanel title={`이 기기 순위 · ${period === 'weekly' ? '이번 주' : '역대'}`}>
            {rows.length === 0 ? (
              <p className="p-muted" data-testid="rank-empty">
                {period === 'weekly' ? '이번 주에는 아직 기록이 없어요.' : '아직 기록이 없어요.'} 게임을 끝까지 하면 여기에 올라가요.
              </p>
            ) : (
              <ol className="p-ranklist" data-testid="rank-list">
                {rows.map((r) => (
                  <li key={`${r.rank}-${r.at}`} className={r.rank === 1 ? 'first' : ''}>
                    <span className="p-rk">{r.rank}</span>
                    {player && <Avatar id={player.avatarId} size={28} />}
                    <b>{fmtScore(r.score)}</b>
                    <small>
                      {fmtDay(r.at)}
                      {r.source === 'import' ? ' · 가져옴' : ''}
                    </small>
                  </li>
                ))}
              </ol>
            )}
          </PixelPanel>
        )}
      </div>
    </div>
  );
}
