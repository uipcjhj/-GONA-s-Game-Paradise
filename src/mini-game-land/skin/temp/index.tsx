/**
 * 임시 스킨 (TEMP) — 기능 검증용. 최종 디자인이 아닙니다.
 * 파란 배경 · 사각형 캐릭터 · 기본 버튼은 모두 나중에 픽셀아트 UI 로 교체됩니다.
 * 승인된 에셋(gona.png)만 그대로 사용합니다.
 */
import type { Skin, UiSlots } from '../types';
import type { SortSlots } from '../../games/sort/slots';
import type { TowerSlots, TowerPieceView } from '../../games/tower/slots';
import type { ToyRoomSlots } from '../../games/toyroom/slots';
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

// ─────────────────────────── 장난감방 슬롯 (임시: 단순 도형 장난감 6종 + 별 + 자물쇠)
const TOY_COL = ['#ef6a5b', '#4a8fe8', '#9aa5b5', '#ffd84a', '#b57b4e', '#ffb347'];
const ToyArt: ToyRoomSlots['ToyArt'] = ({ toy, state }) => {
  const line = '#3b2a3f';
  const col = toy.wild ? '#ffd84a' : TOY_COL[toy.type] ?? '#aaa';
  let body: React.ReactNode;
  if (toy.wild) body = <polygon points="16,3 20,12 29,12 22,18 25,28 16,22 7,28 10,18 3,12 12,12" fill={col} stroke={line} strokeWidth="2" strokeLinejoin="miter" />;
  else if (toy.type === 0) body = (<><circle cx="16" cy="16" r="12" fill={col} stroke={line} strokeWidth="2" /><path d="M16 4 C9 10 9 22 16 28" fill="none" stroke="#fff" strokeWidth="2.5" /><path d="M16 4 C23 10 23 22 16 28" fill="none" stroke="#4a8fe8" strokeWidth="2.5" /><circle cx="11" cy="11" r="2" fill="#fff" opacity="0.8" /></>);
  else if (toy.type === 1) body = (<><rect x="5" y="5" width="22" height="22" fill={col} stroke={line} strokeWidth="2" /><text x="16" y="23" textAnchor="middle" fontSize="16" fontWeight="700" fill="#fff" fontFamily="Galmuri11, sans-serif">A</text></>);
  else if (toy.type === 2) body = (<><rect x="7" y="9" width="18" height="16" fill={col} stroke={line} strokeWidth="2" /><rect x="15" y="3" width="2" height="6" fill={line} /><rect x="10" y="13" width="4" height="4" fill="#fff" /><rect x="18" y="13" width="4" height="4" fill="#fff" /><rect x="11" y="20" width="10" height="2" fill={line} /></>);
  else if (toy.type === 3) body = (<><rect x="3" y="14" width="26" height="9" fill={col} stroke={line} strokeWidth="2" /><rect x="9" y="8" width="13" height="7" fill={col} stroke={line} strokeWidth="2" /><circle cx="9" cy="25" r="3.5" fill={line} /><circle cx="23" cy="25" r="3.5" fill={line} /></>);
  else if (toy.type === 4) body = (<><circle cx="9" cy="8" r="4" fill={col} stroke={line} strokeWidth="2" /><circle cx="23" cy="8" r="4" fill={col} stroke={line} strokeWidth="2" /><circle cx="16" cy="18" r="11" fill={col} stroke={line} strokeWidth="2" /><rect x="11" y="15" width="3" height="3" fill={line} /><rect x="18" y="15" width="3" height="3" fill={line} /><rect x="14" y="21" width="4" height="3" fill={line} /></>);
  else body = (<><polygon points="6,24 6,15 12,8 20,8 22,13 29,15 22,17 25,24" fill={col} stroke={line} strokeWidth="2" strokeLinejoin="miter" /><rect x="14" y="11" width="3" height="3" fill={line} /><polygon points="22,13 29,15 22,17" fill="#ef6a5b" /></>);
  return (
    <svg className={`tf-toy ${state}`} viewBox="0 0 32 32" width="100%" height="100%" aria-hidden="true">
      {body}
      {toy.fixed && (<g><rect x="19" y="19" width="11" height="9" fill="#ffe7a0" stroke={line} strokeWidth="1.5" /><path d="M21.5 19 V16 a3 3 0 0 1 6 0 V19" fill="none" stroke={line} strokeWidth="1.5" /></g>)}
    </svg>
  );
};
const Shelf: ToyRoomSlots['ShelfFrame'] = ({ capacity, locked, state }) => (
  <div className={`tf-shelf ${state}`}>
    <div className="tf-shelf-cells" style={{ gridTemplateColumns: `repeat(${capacity}, 1fr)` }}>
      {Array.from({ length: capacity }, (_, j) => (
        <i key={j} className={j >= capacity - locked ? 'lock' : ''}>{j >= capacity - locked ? '🔒' : ''}</i>
      ))}
    </div>
  </div>
);
const RoomBackdrop: ToyRoomSlots['Backdrop'] = () => <div className="tf-room" />;
const ToyMeter: ToyRoomSlots['Meter'] = ({ movesLeft, limit, par, sets, total, undoLeft }) => (
  <div className="tf-tr-meter">
    <span className={`tf-tr-chip big${movesLeft <= 2 ? ' warn' : ''}`}>이동 {movesLeft}/{limit}</span>
    <span className="tf-tr-chip">세트 {sets}/{total}</span>
    <span className="tf-tr-chip" title="3별 기준">★ {par}</span>
    <span className="tf-tr-chip">되돌리기 {undoLeft}</span>
  </div>
);
const ToyFeedback: ToyRoomSlots['Feedback'] = ({ kind, text, sub }) => (
  <div className={`tf-tr-fb ${kind}`}>
    <b>{text}</b>
    {sub && <span>{sub}</span>}
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
  toyroom: { Backdrop: RoomBackdrop, ShelfFrame: Shelf, ToyArt, Meter: ToyMeter, Feedback: ToyFeedback },
};
export default temp;
