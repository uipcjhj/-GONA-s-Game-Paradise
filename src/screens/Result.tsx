import { useEffect, useState } from 'react';
import PixelIcon from '../components/PixelIcon';
import { playUi } from '../sfx';
import { ISLANDS } from '../data/islands';
import { getAchievement } from '../platform/achievements';
import { CODEX } from '../platform/codex';
import type { ResultOutcome } from '../platform/engine';
import { gameName } from '../platform/registry';
import { usePlayer } from '../platform/PlayerContext';
import { getItem } from '../platform/shop';
import { fmtDuration, fmtScore } from '../ui/format';
import PixelButton from '../ui/PixelButton';
import PixelPanel from '../ui/PixelPanel';

/** 게임이 끝나고 돌아왔을 때 한 번만 보여 주는 결과 화면. 여러 판이 쌓여 있으면 가장 최근 판 + 합산 보상 */
export default function Result({ outcomes, onClose, onProfile }: { outcomes: ResultOutcome[]; onClose: () => void; onProfile: () => void }) {
  const { launch, player } = usePlayer();
  const last = outcomes[outcomes.length - 1];
  const r = last.result;
  const island = ISLANDS.find((i) => i.id === r.gameId);
  const xp = outcomes.reduce((s, o) => s + o.xp, 0);
  const coins = outcomes.reduce((s, o) => s + o.coins, 0);
  const ach = outcomes.flatMap((o) => o.achievements);
  const cdx = outcomes.flatMap((o) => o.codex);
  const newBest = outcomes.some((o) => o.isNewBest && !o.first);
  const first = outcomes.some((o) => o.first);
  const capped = outcomes.some((o) => o.capped);
  const lvFrom = outcomes[0].levelFrom;
  const lvTo = last.levelTo;
  const rec = last.record;
  const cleared = r.outcome === 'cleared';
  const reduce = !!player?.settings.reduceMotion;
  // 점수 카운트업 + 효과음(클리어·신기록=팡파레 / 게임 오버=하강음 → 레벨업 → 업적)
  const [shown, setShown] = useState(reduce ? r.score : 0);
  useEffect(() => {
    const timers: number[] = [];
    playUi(cleared || newBest ? 'fanfare' : 'over');
    if (lvTo > lvFrom) timers.push(window.setTimeout(() => playUi('levelup'), 900));
    if (ach.length) timers.push(window.setTimeout(() => playUi('achieve'), lvTo > lvFrom ? 1700 : 900));
    if (reduce) return () => timers.forEach(clearTimeout);
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 800);
      setShown(Math.round(r.score * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const play = () => {
    if (island?.url) window.location.href = launch(island.id, island.url);
  };
  return (
    <div className="p-result" role="dialog" aria-label="게임 결과" data-testid="result" data-best={newBest ? '1' : '0'}>
      <div className="p-scroll">
        <div className="p-ribbon">RESULT</div>
        <PixelPanel>
          <div className="p-resultcard">
            <p className="p-muted" data-testid="result-game">
              {gameName(r.gameId, r.subGameId)}
            </p>
            <span className={`p-chip ${cleared ? 'gold' : 'soon'}`}>{cleared ? '★ CLEAR!' : 'GAME OVER'}</span>
            <b className="p-bigscore" data-testid="result-score" data-value={r.score} aria-label={`점수 ${fmtScore(r.score)}`}>
              {fmtScore(shown)}
            </b>
            {newBest && (
              <span className="p-chip ok" data-testid="result-newbest">
                ★ NEW BEST! {last.prevBest > 0 ? `+${fmtScore(Math.max(0, rec.bestScore - last.prevBest))}` : ''}
              </span>
            )}
            {first && !newBest && <span className="p-chip blue">첫 기록!</span>}
            <p className="p-muted">
              {r.stageLabel ?? '단계'}
              {r.stage !== undefined ? ` ${r.stage}` : ''} · 플레이 {fmtDuration(r.durationMs / 1000)}
              {outcomes.length > 1 ? ` · ${outcomes.length}판이 기록됐어요` : ''}
            </p>
          </div>
        </PixelPanel>
        <PixelPanel title="획득">
          <div className="p-row p-gain" data-testid="result-gain">
            <span>
              <b>+{xp}</b> XP
            </span>
            <span>
              <i className="p-coinpop" aria-hidden="true" /> <b>+{coins}</b> 코인
            </span>
          </div>
          {lvTo > lvFrom && (
            <div className="p-row" style={{ justifyContent: 'center', marginTop: 8 }}>
              <span className="p-levelup" data-testid="result-levelup">
                LEVEL UP! LV{lvFrom} → LV{lvTo}
              </span>
            </div>
          )}
          {capped && <p className="p-muted">오늘 이 게임의 보상 한도(또는 최소 플레이 시간)에 닿아 일부만 받았어요. 기록은 그대로 남아요.</p>}
          {ach.map((id) => (
            <p key={id} className="p-gainline">
              <PixelIcon name="star" size={1.5} /> 업적 달성! <b>{getAchievement(id)?.name}</b> (+{getAchievement(id)?.rewardCoins} 코인{getAchievement(id)?.rewardTitle ? ` · 칭호 ${getItem(getAchievement(id)!.rewardTitle!)?.name}` : ''})
            </p>
          ))}
          {cdx.map((id) => (
            <p key={id} className="p-gainline">
              <PixelIcon name="book" size={1.5} /> 도감 등록 <b>{CODEX.find((c) => c.id === id)?.name}</b>
            </p>
          ))}
        </PixelPanel>
        <PixelPanel title="내 기록">
          <div className="p-stats">
            <div className="p-stat">
              <b>{rec.bestScore > 0 ? fmtScore(rec.bestScore) : '-'}</b>
              <span>최고 점수</span>
            </div>
            <div className="p-stat">
              <b>{rec.plays}</b>
              <span>플레이</span>
            </div>
            <div className="p-stat">
              <b>{rec.clears}</b>
              <span>클리어</span>
            </div>
            <div className="p-stat">
              <b>{rec.bestStage ?? '-'}</b>
              <span>최고 단계</span>
            </div>
          </div>
        </PixelPanel>
        <div className="p-row">
          {island?.url && (
            <PixelButton className="fill" onClick={play} data-testid="result-again">
              ▶ 다시 도전
            </PixelButton>
          )}
          <PixelButton variant="sub" className="fill" onClick={onClose} data-testid="result-map">
            월드맵으로
          </PixelButton>
        </div>
        <PixelButton small variant="sub" block onClick={onProfile}>
          프로필에서 기록 보기
        </PixelButton>
      </div>
    </div>
  );
}
