import type { EngineSnapshot } from '../core/engine';

export interface HudInfo {
  /** 왼쪽 위 작은 글씨(예: ROUND 3 · 고나 콕콕) */
  label: string;
  /** 챌린지: 목숨 */
  lives?: number;
  maxLives?: number;
  /** 챌린지 누적 점수(이번 라운드 점수는 별도 표시) */
  baseScore?: number;
  /** 자유 플레이: 레벨 */
  level?: number;
}

export function LivesBar({ lives, max }: { lives: number; max: number }) {
  return (
    <span className="mgl-lives" data-testid="lives" aria-label={`목숨 ${lives}개`} data-lives={lives}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < lives ? 'on' : 'off'}>
          {i < lives ? '♥' : '♡'}
        </span>
      ))}
    </span>
  );
}

export default function Hud({ snap, info, onPause }: { snap: EngineSnapshot; info: HudInfo; onPause: () => void }) {
  const unlimited = snap.limitMs == null;
  const pct = unlimited ? 100 : Math.max(0, Math.min(100, ((snap.remainingMs ?? 0) / (snap.limitMs ?? 1)) * 100));
  const sec = unlimited ? null : Math.ceil((snap.remainingMs ?? 0) / 1000);
  const warn = sec != null && sec <= 5;
  const total = (info.baseScore ?? 0) + snap.score;
  return (
    <div className="mgl-hud">
      <div className="mgl-hud-row">
        <button type="button" className="mgl-btn mgl-icon-btn" data-testid="pause" aria-label="일시정지" onClick={onPause} disabled={snap.phase === 'done'}>
          Ⅱ
        </button>
        <div className={`mgl-time${warn ? ' warn' : ''}`} data-testid="time" aria-label={unlimited ? '시간 무제한' : `남은 시간 ${sec}초`}>
          <div className="mgl-time-fill" style={{ width: `${pct}%` }} />
          <span className="mgl-time-num">{unlimited ? '∞' : sec}</span>
        </div>
        <div className="mgl-score" data-testid="score">
          {total.toLocaleString('en-US')}
        </div>
      </div>
      <div className="mgl-hud-row mgl-hud-sub">
        <span className="mgl-label">{info.label}</span>
        {snap.combo >= 2 && (
          <span className="mgl-combo" data-testid="combo">
            COMBO ×{snap.combo}
          </span>
        )}
        <span className="mgl-grow" />
        {info.lives != null ? <LivesBar lives={info.lives} max={info.maxLives ?? 5} /> : <span className="mgl-label">LV {info.level}</span>}
      </div>
    </div>
  );
}
