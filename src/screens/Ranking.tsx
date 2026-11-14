import { useCallback, useEffect, useState } from 'react';
import PixelIcon from '../components/PixelIcon';
import { getGame } from '../platform/games';
import { MINI_GAMES } from '../platform/games';
import { usePlayer } from '../platform/PlayerContext';
import { overallIndex, rankingGames, weeklyBest } from '../platform/ranking';
import type { RankingPeriod, RankingResult } from '../services/ranking';
import Avatar from '../ui/Avatar';
import { NamePlate, TitlePlate } from '../ui/Cosmetics';
import PixelButton from '../ui/PixelButton';
import PixelPanel from '../ui/PixelPanel';
import Podium from '../ui/Podium';
import { fmtDate } from './Profile';

type Load = { state: 'idle' } | { state: 'loading' } | { state: 'done'; res: RankingResult };

/**
 * 랭킹: 서버가 연결된 빌드에서는 온라인 순위(시상대·내 순위)를, 아니면 로컬 기록만 보여준다.
 * 다른 플레이어의 순위는 서버 응답으로만 표시하고, 서버가 없거나 실패하면 "준비 중/불러오지 못함" 안내만 한다(가짜 순위 금지).
 */
export default function Ranking() {
  const { player, online, rankingProvider } = usePlayer();
  const games = rankingGames();
  const [game, setGame] = useState(games[0].id);
  const [sub, setSub] = useState<string>('');
  const [period, setPeriod] = useState<RankingPeriod>('weekly');
  const [load, setLoad] = useState<Load>({ state: 'idle' });
  const [tick, setTick] = useState(0);
  const g = games.find((x) => x.id === game)!;
  const def = getGame(game);
  const playable = def?.status === 'live';
  const subs = game === 'minigame-paradise' && playable ? MINI_GAMES : [];

  const fetchBoard = useCallback(async () => {
    if (!online.enabled || !playable && game !== 'overall') return;
    setLoad({ state: 'loading' });
    const res = await rankingProvider.getRanking({ gameId: game, subGameId: sub || undefined, period });
    setLoad({ state: 'done', res });
  }, [online.enabled, playable, game, sub, period, rankingProvider]);
  useEffect(() => {
    void fetchBoard();
  }, [fetchBoard, tick, online.status === 'online']); // eslint-disable-line react-hooks/exhaustive-deps

  if (!player) return null;
  const rec = player.gameRecords[game];
  const srec = sub ? rec?.subGames?.[sub] : rec;
  const wk = weeklyBest(srec, Date.now());
  const mine = period === 'weekly' ? wk : srec ? { score: srec.bestScore, at: srec.bestScoreAt } : null;
  const ov = overallIndex(player);
  const res = load.state === 'done' ? load.res : null;
  const onlineBoard = res && res.status === 'ok' ? res : null;
  const myId = clientIdFromRes(onlineBoard);

  return (
    <div className="p-screen">
      <div className="p-scroll">
        <div className="p-tabs" role="tablist" aria-label="게임 선택">
          {games.map((x) => <button key={x.id} type="button" role="tab" aria-selected={game === x.id} className={game === x.id ? 'on' : ''} onClick={() => { setGame(x.id); setSub(''); }}>{x.label}</button>)}
        </div>
        {subs.length > 0 && (
          <div className="p-tabs" role="tablist" aria-label="미니게임 선택">
            <button type="button" role="tab" aria-selected={sub === ''} className={sub === '' ? 'on' : ''} onClick={() => setSub('')}>전체</button>
            {subs.map((m) => <button key={m.id} type="button" role="tab" aria-selected={sub === m.id} className={sub === m.id ? 'on' : ''} onClick={() => setSub(m.id)}>{m.name}</button>)}
          </div>
        )}
        {game !== 'overall' && (
          <div className="p-tabs" role="tablist" aria-label="기간 선택">
            <button type="button" role="tab" aria-selected={period === 'weekly'} className={period === 'weekly' ? 'on' : ''} onClick={() => setPeriod('weekly')}>주간 (월~일)</button>
            <button type="button" role="tab" aria-selected={period === 'all-time'} className={period === 'all-time' ? 'on' : ''} onClick={() => setPeriod('all-time')}>역대 최고</button>
          </div>
        )}

        {/* ── 온라인 순위 영역 ── */}
        {!online.enabled || (!playable && game !== 'overall') ? (
          <PixelPanel>
            <div className="p-empty">
              <PixelIcon name={g.soon ? 'lock' : 'trophy'} size={5} />
              <b>{g.soon ? 'COMING SOON' : '온라인 랭킹 준비 중'}</b>
              <p className="p-muted">{g.soon ? `${g.name}이(가) 열리면 랭킹도 함께 열려요.` : '온라인 점수 서버가 아직 연결되지 않았어요. 다른 플레이어 순위는 서버가 연결된 뒤에 보여요. 지금은 내 기록만 볼 수 있어요.'}</p>
            </div>
          </PixelPanel>
        ) : load.state === 'loading' || load.state === 'idle' ? (
          <PixelPanel><div className="p-empty"><div className="p-spin" /><b>랭킹을 불러오는 중…</b></div></PixelPanel>
        ) : res && res.status === 'ok' ? (
          <>
            {period === 'weekly' && game !== 'overall' && res.weekEndsAt && <p className="p-muted">이번 주 랭킹 · {fmtDate(res.weekEndsAt)} 00:00(한국 시간)에 새로 시작해요 · 참가 {res.total ?? res.entries.length}명</p>}
            {game === 'overall' && <p className="p-muted">종합 랭킹은 게임별 순위를 백분위로 환산해 합쳐요(원점수 합산 아님). 참가자가 충분한 게임만 반영돼요{res.gamesUsed?.length ? ` · 반영 게임 ${res.gamesUsed.length}개` : ''}.</p>}
            {res.entries.length === 0 ? (
              <PixelPanel><div className="p-empty"><PixelIcon name="trophy" size={5} /><b>아직 순위가 없어요</b><p className="p-muted">{game === 'overall' ? '종합 순위는 참가자가 충분히 모이면 열려요.' : '첫 기록의 주인공이 되어 보세요! 온라인 기록은 서버 연결 상태로 플레이한 판부터 올라가요.'}</p></div></PixelPanel>
            ) : (
              <>
                <Podium entries={res.entries} meId={myId} />
                <div className="p-list" style={{ gap: 0 }}>
                  {res.entries.slice(3).map((e) => (
                    <div key={e.playerId} className={`p-lbrow${e.playerId === myId ? ' me' : ''}`}>
                      <span className="rk">{e.rank}</span><Avatar id={e.avatarId} size={28} /><span className="nm">{e.nickname}<small>#{e.publicCode}</small></span><span className="sc">{e.score.toLocaleString('ko-KR')}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            {res.me ? <div className="p-lbrow me" style={{ position: 'sticky', bottom: 0 }}><span className="rk">{res.me.rank}</span><Avatar id={player.avatarId} size={28} /><span className="nm">{player.nickname} (나)<small>#{player.publicCode}{res.total ? ` · ${res.total}명 중` : ''}</small></span><span className="sc">{res.me.score.toLocaleString('ko-KR')}</span></div> : <p className="p-muted">내 온라인 기록이 아직 없어요. 서버에 연결된 상태로 플레이한 판이 올라가요. (이전에 쌓인 로컬 기록은 올라가지 않아요)</p>}
          </>
        ) : (
          <PixelPanel>
            <div className="p-empty">
              <PixelIcon name="lock" size={5} />
              <b>{res?.status === 'unavailable' ? '지금은 랭킹이 쉬고 있어요' : '랭킹을 불러오지 못했어요'}</b>
              <p className="p-muted">{res?.status === 'unavailable' ? '서버가 바쁘거나 잠시 쉬는 중이에요. 잠시 후 다시 시도해 주세요.' : '인터넷 연결을 확인하고 다시 시도해 주세요. 내 로컬 기록은 그대로 안전해요.'}</p>
              <PixelButton small onClick={() => setTick((t) => t + 1)}>다시 시도</PixelButton>
            </div>
          </PixelPanel>
        )}

        {/* ── 내 로컬 기록 ── */}
        {game === 'overall' ? (
          <PixelPanel title="내 종합 지수 (로컬 · 참고용)">
            <p className="p-muted">게임마다 점수 규모가 달라서 원점수를 더하지 않고 0~1 로 정규화해 평균한 내 지표예요. 온라인 순위가 아니에요.</p>
            <div className="p-list" style={{ marginTop: 8 }}>
              {ov.entries.map((e) => <div key={e.gameId} className="p-row" style={{ justifyContent: 'space-between', fontSize: 11 }}><span>{e.name}</span><b>{e.played ? `${Math.round(e.normalized * 100)}%` : '기록 없음'}</b></div>)}
            </div>
            <div className="p-stat" style={{ marginTop: 8 }}><b>{ov.index}</b><span>내 종합 지수 / 1000</span></div>
          </PixelPanel>
        ) : (
          <PixelPanel title={`내 ${period === 'weekly' ? '이번 주' : '역대'} 최고 · ${g.label}${sub ? ` · ${subs.find((m) => m.id === sub)?.name ?? sub}` : ''} (로컬)`}>
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
        {game !== 'overall' && srec && (
          <PixelPanel title="내 최근 기록">
            <div className="p-list">
              {srec.recent.slice(0, 8).map((r) => <div key={r.resultId} className="p-row" style={{ justifyContent: 'space-between', fontSize: 11, borderBottom: '2px dashed #e2c08a', paddingBottom: 4 }}><span>{fmtDate(r.at)}{r.cleared ? ' · 클리어' : ''}{r.stage ? ` · ${r.stage}단계` : ''}</span><b>{r.score.toLocaleString('ko-KR')}</b></div>)}
            </div>
          </PixelPanel>
        )}
        {online.enabled && <p className="p-muted" style={{ textAlign: 'center' }}>온라인 연결: {online.status === 'online' ? '연결됨' : online.status === 'connecting' ? '연결 중' : '오프라인(로컬 모드 유지)'}{online.pending > 0 ? ` · 전송 대기 ${online.pending}건` : ''}</p>}
      </div>
    </div>
  );
}

/** 서버 응답의 me 에서 내 playerId 를 알 수 없으므로 me 항목과 같은 점수·순위 행을 강조하기 위해 me.playerId 사용 */
function clientIdFromRes(r: Extract<RankingResult, { status: 'ok' }> | null): string | undefined {
  return r?.me?.playerId;
}
