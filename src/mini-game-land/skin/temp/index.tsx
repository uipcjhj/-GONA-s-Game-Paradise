/**
 * 임시 스킨 (TEMP) — 기능 검증용. 최종 디자인이 아닙니다.
 * 파란 배경 · 사각형 캐릭터 · 기본 버튼은 모두 나중에 픽셀아트 UI 로 교체됩니다.
 * 승인된 에셋(gona.png)만 그대로 사용합니다.
 */
import type { Skin, UiSlots } from '../types';
import type { SortSlots } from '../../games/sort/slots';
import { gonaUrl } from '../../assets';
import { Mascot as BaseMascot } from '../components';
import { condLabel, type Card, type Cond } from '../../games/sort/logic';
import './temp.css';

// ─────────────────────────── 공통 UI 슬롯
const Background: UiSlots['Background'] = ({ scene }) => <div className="tf-bg" data-scene={scene} />;

const ButtonFace: UiSlots['ButtonFace'] = ({ variant, size, children }) => (
  <span className={`mgl-face tf-btn tf-btn-${variant} tf-btn-${size}`}>{children}</span>
);

const Panel: UiSlots['Panel'] = ({ tone, className = '', children }) => <div className={`tf-panel tf-${tone} ${className}`}>{children}</div>;

const Lives: UiSlots['Lives'] = ({ lives, max }) => (
  <span className="mgl-lives" data-lives={lives} aria-label={`목숨 ${lives}개`}>
    {Array.from({ length: max }, (_, i) => (
      <span key={i} className={i < lives ? 'on' : 'off'}>
        {i < lives ? '♥' : '♡'}
      </span>
    ))}
  </span>
);

const Mascot: UiSlots['Mascot'] = ({ pose, scale = 3, className = '' }) => (
  <img src={gonaUrl} alt="고나" className={`tf-mascot ${className}`} data-pose={pose} style={{ width: 27 * scale, height: 34 * scale }} draggable={false} />
);

const Scoreboard: UiSlots['Scoreboard'] = ({ view, pauseButton }) => (
  <div className="mgl-hud">
    <div className="mgl-hud-row">
      {pauseButton}
      <div className={`mgl-time${view.timeWarn ? ' warn' : ''}`} aria-label={view.timeSec == null ? '시간 무제한' : `남은 시간 ${view.timeSec}초`}>
        <div className="mgl-time-fill" style={{ width: `${view.timePct}%` }} />
        <span className="mgl-time-num">{view.timeSec == null ? '∞' : view.timeSec}</span>
      </div>
      <div className="mgl-score">{view.score.toLocaleString('en-US')}</div>
    </div>
    <div className="mgl-hud-row mgl-hud-sub">
      <span className="mgl-label">{view.label}</span>
      {view.combo >= 2 && <span className="mgl-combo">COMBO ×{view.combo}</span>}
      <span className="mgl-grow" />
      {view.lives != null ? <Lives lives={view.lives} max={view.maxLives ?? 5} /> : <span className="mgl-label">LV {view.level}</span>}
    </div>
  </div>
);

// ─────────────────────────── 편가르기 슬롯 (임시 도형: 색 블록 + 이모티콘 표정 + 도형 소품)
const EYES: Record<string, [string, string]> = { smile: ['^', '^'], cry: ['T', 'T'], angry: ['>', '<'], sleepy: ['-', '-'] };

const Friend: SortSlots['Friend'] = ({ card }: { card: Card }) => {
  const [l, r] = EYES[card.face];
  return (
    <div className="sc-card" data-color={card.color} data-face={card.face} data-feature={card.feature}>
      {card.feature === 'hat' && <i className="sc-hat" />}
      {card.feature === 'ribbon' && <i className="sc-ribbon" />}
      <div className="sc-eyes"><b>{l}</b><b>{r}</b></div>
      {card.feature === 'glasses' && <div className="sc-glasses"><i /><i /></div>}
      <div className="sc-mouth" />
    </div>
  );
};

const CondChip = ({ c }: { c: Cond }) => (
  <span className="sc-chip" data-axis={c.axis} data-value={c.value}>
    {c.axis === 'color' && <span className="sc-dot" data-color={c.value} />}
    {condLabel(c)}
  </span>
);

const RulePanel: SortSlots['RulePanel'] = ({ rule, reversed, hint, mood }) => (
  <div className="sc-rule">
    <BaseMascot pose={mood} scale={2} className="sc-judge" />
    <div className="sc-rule-body">
      <div className="sc-rule-hint" data-testid="rule-hint">
        {hint}
        {reversed && <em className="sc-rev" data-testid="reversed-chip">⇄ 반전 중</em>}
      </div>
      <div className="sc-chips">
        {rule.conds.map((c, i) => (
          <span key={i} className="sc-chip-wrap">
            {i > 0 && <span className="sc-join">{rule.kind === 'and' ? '그리고' : rule.kind === 'or' ? '또는' : rule.kind === 'exclude' ? '제외' : '/'}</span>}
            <CondChip c={c} />
          </span>
        ))}
      </div>
    </div>
  </div>
);

const StageFrame: SortSlots['StageFrame'] = ({ reversed }) => <div className="tf-stage" data-reversed={reversed ? '1' : '0'} />;

const ARROW = ['◀', '▲', '▶'];
const BinFace: SortSlots['BinFace'] = ({ index, bins, label, locked }) => (
  <span className="tf-bin" data-locked={locked ? '1' : '0'}>
    <span className="sc-arrow">{bins === 2 ? ARROW[index === 0 ? 0 : 2] : ARROW[index]}</span>
    <span className="sc-bin-label">{label}</span>
  </span>
);

const InfoBar: SortSlots['InfoBar'] = ({ index, goal, mistakes, maxMistakes }) => (
  <div className="sc-info">
    <span>카드 {Math.min(index + 1, goal)}/{goal}</span>
    <span className="sc-miss" aria-label={`실수 ${mistakes}/${maxMistakes}`}>
      실수 {Array.from({ length: maxMistakes }, (_, i) => (i < mistakes ? '✕' : '○')).join(' ')}
    </span>
  </div>
);

const Feedback: SortSlots['Feedback'] = ({ kind, text, sub }) => (
  <div className={`sc-fb ${kind}`}>
    <b>{text}</b>
    {sub && <span>{sub}</span>}
  </div>
);

const Announce: SortSlots['Announce'] = ({ title, sub }) => (
  <div className="sc-announce">
    {title}
    <small>{sub}</small>
  </div>
);

const temp: Skin = {
  id: 'temp',
  name: '임시 스킨 (기능 검증용)',
  temporary: true,
  tokens: { '--mgl-page-bg': '#6cc8fb', '--sc-card-w': '112px', '--sc-card-h': '112px', '--mgl-btn-depth': '5px' },
  ui: { Background, ButtonFace, Panel, Scoreboard, Lives, Mascot },
  sort: { Friend, RulePanel, StageFrame, BinFace, InfoBar, Feedback, Announce },
};
export default temp;
