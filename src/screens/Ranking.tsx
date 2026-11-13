import { useState } from 'react';
import PixelIcon from '../components/PixelIcon';
import { ISLANDS } from '../data/islands';
import { NullRankingProvider, type RankingPeriod } from '../services/ranking';
import PixelPanel from '../ui/PixelPanel';

/** Phase 1: 탭 구조만 제공. 서버 미연결 → "준비 중" 안내만 (가짜 플레이어·샘플 점수 없음) */
export default function Ranking() {
  const games = [...ISLANDS.map((i) => ({ id: i.id, label: i.id === 'food-island' ? 'Food' : i.id === 'sky-battle' ? 'Sky' : 'Mini', soon: i.status === 'soon', title: i.gameTitle })), { id: 'overall', label: '종합', soon: false, title: '종합 랭킹' }];
  const [game, setGame] = useState(games[0].id);
  const [period, setPeriod] = useState<RankingPeriod>('weekly');
  const g = games.find((x) => x.id === game)!;
  const provider = NullRankingProvider;
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
        <PixelPanel>
          <div className="p-empty">
            <PixelIcon name={g.soon ? 'lock' : 'trophy'} size={5} />
            <b>{g.soon ? 'COMING SOON' : '온라인 랭킹 준비 중'}</b>
            <p className="p-muted">{g.soon ? `${g.title}이(가) 열리면 랭킹도 함께 열려요.` : provider.connected ? '' : '온라인 점수 서버가 아직 연결되지 않았어요. 연결되면 여기에서 다른 플레이어와 겨룰 수 있어요.'}</p>
            <p className="p-muted">아직 기록이 없어서 순위를 보여주지 않아요.</p>
          </div>
        </PixelPanel>
      </div>
    </div>
  );
}
