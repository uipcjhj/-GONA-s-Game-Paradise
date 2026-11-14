import { ISLANDS } from '../data/islands';
import { getGame, SKY_DEV } from '../platform/games';
import { usePlayer, type ResultView } from '../platform/PlayerContext';
import PixelButton from '../ui/PixelButton';
import PixelPanel from '../ui/PixelPanel';
import { fmtDate } from './Profile';

const fmtDur = (s: number): string => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const REASON: Record<string, string> = { short: '너무 짧은 판은 보상이 없어요', 'daily-cap': '오늘 보상 한도에 도달했어요 (기록은 저장돼요)', 'session-cap': '이번 실행의 보상 한도에 도달했어요 (기록은 저장돼요)' };

/** 게임에서 돌아온 뒤 보여 주는 결과 화면 (별도 화면). 기록 반영 직후 한 번만 표시 */
export default function Result({ view, onRetry, onMap, onRanking }: { view: ResultView; onRetry: (gameId: string, url: string) => void; onMap: () => void; onRanking: () => void }) {
  const { retryConsume, player } = usePlayer();
  const s = view.summaries[view.summaries.length - 1];
  const g = getGame(s.gameId);
  const island = ISLANDS.find((i) => i.id === s.gameId);
  const cleared = s.outcome === 'cleared';
  const first = s.isFirst;
  const tag = view.saveFailed ? null : cleared ? { t: '★ CLEAR! ★', c: 'clear' } : s.isNewBest && !first ? { t: '★ NEW BEST! ★', c: '' } : first ? { t: '첫 기록!', c: 'first' } : null;
  const rank = s.levelAfter > s.levelBefore;
  return (
    <div className="p-screen p-result-screen">
      <div className="p-scroll" style={{ paddingTop: 8, gap: 8 }}>
        <div className="p-ribbon" style={{ margin: '0 auto', padding: '3px 10px 4px' }}>{view.saveFailed ? 'RESULT · 저장 실패' : cleared ? 'ADVENTURE CLEAR' : 'RESULT'}</div>
        <div className="p-gamerow">
          <div className="th" style={{ backgroundImage: "url('./assets/gona-world-map.png')", backgroundSize: '640% auto', backgroundPosition: '6% 15%' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <b style={{ fontSize: 13 }}>{g?.name ?? s.gameId}</b>
            <p className="p-muted">{island?.name ?? ''}{view.summaries.length > 1 ? ` · ${view.summaries.length}판 기록됨` : ''}</p>
          </div>
          <span className={`p-chip ${cleared ? 'ok' : 'soon'}`}>{cleared ? '모험 완료!' : '게임 오버'}</span>
        </div>
        <div className="p-score" style={tag ? { marginTop: 12 } : undefined}>
          {tag && <span className={`tag ${tag.c}`}>{tag.t}</span>}
          <small>SCORE</small>
          <div className="n">{s.score.toLocaleString('ko-KR')}</div>
          <div className="delta" style={{ color: view.saveFailed ? '#b3261e' : s.isNewBest && !first ? '#2f7a1f' : '#5d3f86' }}>
            {view.saveFailed ? '아직 내 기록에 반영되지 않았어요' : first ? '이 게임의 첫 기록이에요' : s.isNewBest ? `이전 최고 ${s.prevBest.toLocaleString('ko-KR')} → +${(s.score - s.prevBest).toLocaleString('ko-KR')}` : `내 최고 ${s.bestScore.toLocaleString('ko-KR')}까지 ${(s.bestScore - s.score).toLocaleString('ko-KR')}점`}
          </div>
          {!view.saveFailed && (
            <div className="p-reward">
              {s.reward.xp > 0 && <span className="p-chip blue">XP +{s.reward.xp}</span>}
              {s.reward.coins > 0 && <span className="p-chip gold">코인 +{s.reward.coins}</span>}
              {s.reward.bonuses.includes('clear') && <span className="p-chip ok">클리어 보너스</span>}
              {s.reward.bonuses.includes('best') && <span className="p-chip soon">신기록 보너스</span>}
              {rank && <span className="p-chip ok">LEVEL UP! {s.levelBefore}→{s.levelAfter}</span>}
              {s.reward.skipped && <span className="p-muted" style={{ width: '100%' }}>{REASON[s.reward.skipped]}</span>}
            </div>
          )}
        </div>
        <div className="p-grid3">
          <div className="p-stat"><b>{s.stage ? `${s.stage}단계` : '—'}</b><span>{s.stageLabel ?? '도달 단계'}</span></div>
          <div className="p-stat"><b>{s.snacks !== undefined ? `${s.snacks}개` : '—'}</b><span>먹은 간식</span></div>
          <div className="p-stat"><b>{fmtDur(s.durationSec)}</b><span>플레이 시간</span></div>
        </div>
        {view.saveFailed ? (
          <>
            <PixelPanel title="결과를 저장하지 못했어요">
              <p className="p-muted">이 브라우저의 저장 공간이 가득 찼거나 막혀 있을 수 있어요. 결과는 잠시 보관돼 있어서 다시 시도할 수 있어요. 계속 안 되면 설정 &gt; 백업으로 기록을 먼저 보관해 주세요.</p>
            </PixelPanel>
            <PixelButton big block onClick={retryConsume}>다시 시도</PixelButton>
            <PixelButton variant="sub" block onClick={onMap}>월드맵으로</PixelButton>
          </>
        ) : (
          <>
            <PixelPanel title={`내 기록 · ${g?.short ?? ''}`}>
              <div className="p-grid4">
                <div className="p-stat"><b>{s.bestScore.toLocaleString('ko-KR')}</b><span>최고 점수</span></div>
                <div className="p-stat"><b>{s.plays}회</b><span>플레이</span></div>
                <div className="p-stat"><b>{s.clears}회</b><span>클리어</span></div>
                <div className="p-stat"><b>{fmtDate(s.lastPlayedAt).slice(5)}</b><span>마지막 플레이</span></div>
              </div>
            </PixelPanel>
            <PixelButton big block disabled={!(island?.url || (island?.id === 'sky-battle' && SKY_DEV))} onClick={() => island && onRetry(island.id, island.url ?? '')}>
              ▶ {cleared ? '한 번 더!' : '다시 도전'}
            </PixelButton>
            <div className="p-row">
              <PixelButton variant="sub" className="fill" onClick={onMap}>월드맵으로</PixelButton>
              <PixelButton variant="sub" className="fill" onClick={onRanking}>내 기록 · 랭킹</PixelButton>
            </div>
          </>
        )}
        <p className="p-muted" style={{ textAlign: 'center', marginTop: 4 }}>이 기록은 이 기기에 저장된 로컬 기록이에요{player ? '' : ''}. 온라인 검증 기록이 아니에요.</p>
      </div>
    </div>
  );
}
