/**
 * 임시 스킨 (TEMP) — 기능 검증용. 최종 디자인이 아닙니다.
 * 파란 배경 · 사각형 캐릭터 · 기본 버튼은 모두 나중에 픽셀아트 UI 로 교체됩니다.
 * 승인된 에셋(gona.png)만 그대로 사용합니다.
 */
import type { Skin, UiSlots } from '../types';
import type { SortSlots } from '../../games/sort/slots';
import type { TowerSlots, TowerPieceView } from '../../games/tower/slots';
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


// ─────────────────────────── 아슬아슬 탑 슬롯 (임시: 색 다각형 + 무게 눈금)
const SNACK: Record<string, { fill: string; edge: string; top: string }> = {
  toast: { fill: '#f0c987', edge: '#a86f3a', top: '#fbe3b0' },
  macaron: { fill: '#ff9fb8', edge: '#c95a7c', top: '#ffd0dc' },
  pudding: { fill: '#f9e49a', edge: '#b08a2e', top: '#c8844a' },
  cake: { fill: '#ef845b', edge: '#a8452a', top: '#fff1d0' },
  banana: { fill: '#ffd84a', edge: '#a8841a', top: '#fff0a0' },
  cone: { fill: '#e7c58a', edge: '#8f5c3a', top: '#fff1d0' },
  slice: { fill: '#a8e6cf', edge: '#3f8f6e', top: '#e8fff5' },
  donut: { fill: '#e98fb0', edge: '#a84a74', top: '#ffd0e0' },
};
const PieceArt: TowerSlots['PieceArt'] = ({ piece, ghost }: { piece: TowerPieceView; ghost?: boolean }) => {
  const c = SNACK[piece.kind];
  const { x0, y0, x1, y1 } = piece.bbox;
  const pts = piece.points.map(([x, y]) => `${x},${y}`).join(' ');
  const pips = Array.from({ length: piece.weight }, (_, i) => i);
  return (
    <svg className={`tw-art${ghost ? ' ghost' : ''}`} width={x1 - x0} height={y1 - y0} viewBox={`${x0} ${y0} ${x1 - x0} ${y1 - y0}`} style={{ left: x0, top: y0 }} aria-label={piece.label}>
      <polygon points={pts} fill={c.fill} stroke={c.edge} strokeWidth={2} strokeLinejoin="miter" />
      <polyline points={`${piece.points[0][0] + 3},${y0 + 3} ${piece.points[piece.points.length - 1][0] - 3},${y0 + 3}`} stroke={c.top} strokeWidth={2} fill="none" opacity={0.9} />
      {pips.map((i) => (
        <rect key={i} x={-((piece.weight * 4 - 1) / 2) + i * 4} y={-1} width={3} height={3} fill={c.edge} />
      ))}
    </svg>
  );
};
const Backdrop: TowerSlots['Backdrop'] = () => <div className="tf-tw-sky" />;
const PlateArt: TowerSlots['PlateArt'] = ({ width }: { width: number }) => (
  <div className="tf-tw-plate" style={{ width }}>
    <i className="tf-tw-leg" />
  </div>
);
const TowerMeter: TowerSlots['Meter'] = ({ height, goal, piecesLeft, budget, falls, maxFalls, swaps }) => (
  <div className="tf-tw-meter">
    <div className="tf-tw-bar" aria-label={`높이 ${Math.round(height)}/${goal}`}>
      <i style={{ width: `${Math.min(100, (height / goal) * 100)}%` }} />
      <span>{Math.round(height)} / {goal}</span>
    </div>
    <span className="tf-tw-chip">조각 {piecesLeft}/{budget}</span>
    <span className="tf-tw-chip" aria-label={`떨어뜨림 ${falls}/${maxFalls}`}>
      {Array.from({ length: maxFalls }, (_, i) => (i < falls ? '✕' : '○')).join('')}
    </span>
    <span className="tf-tw-chip">교환 {swaps}</span>
  </div>
);
const NextQueue: TowerSlots['NextQueue'] = ({ next }) => (
  <div className="tf-tw-next">
    <span>NEXT</span>
    {next.map((p, i) => {
      const w = p.bbox.x1 - p.bbox.x0, h = p.bbox.y1 - p.bbox.y0, k = Math.min(1, 34 / Math.max(w, h));
      return (
        <div key={i} className="tf-tw-next-slot" style={{ width: 38, height: 38 }}>
          <div style={{ transform: `scale(${k})`, position: 'absolute', left: 19, top: 19 }}>
            <PieceArt piece={p} />
          </div>
        </div>
      );
    })}
  </div>
);
const TowerFeedback: TowerSlots['Feedback'] = ({ kind, text, sub }) => (
  <div className={`tf-tw-fb ${kind}`}>
    <b>{text}</b>
    {sub && <span>{sub}</span>}
  </div>
);
const Notice: TowerSlots['Notice'] = ({ wind }) => (
  <div className="tf-tw-wind" data-dir={wind === 0 ? '0' : wind > 0 ? '1' : '-1'}>
    바람 {wind === 0 ? '잔잔' : (wind > 0 ? '▶' : '◀').repeat(Math.max(1, Math.round(Math.abs(wind) * 3)))}
  </div>
);

const temp: Skin = {
  id: 'temp',
  name: '임시 스킨 (기능 검증용)',
  temporary: true,
  tokens: { '--mgl-page-bg': '#6cc8fb', '--sc-card-w': '112px', '--sc-card-h': '112px', '--mgl-btn-depth': '5px' },
  ui: { Background, ButtonFace, Panel, Scoreboard, Lives, Mascot },
  sort: { Friend, RulePanel, StageFrame, BinFace, InfoBar, Feedback, Announce },
  tower: { Backdrop, PieceArt, PlateArt, Meter: TowerMeter, NextQueue, Feedback: TowerFeedback, Notice },
};
export default temp;
