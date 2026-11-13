/**
 * 픽셀 스킨 (pixel) — 코드로 그린 오리지널 도트 에셋(tools/build-pixel-art.py)을 쓰는 기본 스킨.
 * 이미지 생성 도구 미사용. 승인 원본 gona.png 는 그대로(temp 의 Mascot 재사용).
 * 슬롯 계약(입력 없음 · 부모 크기 채움 · 충돌/터치 영역은 기반 소유)은 temp 와 같음 → 같은 E2E 로 검증.
 */
import type { Skin, UiSlots } from '../types';
import type { SortSlots } from '../../games/sort/slots';
import type { TowerSlots, TowerPieceView } from '../../games/tower/slots';
import type { ToyRoomSlots } from '../../games/toyroom/slots';
import red from './art/friend-red.png';
import blue from './art/friend-blue.png';
import green from './art/friend-green.png';
import yellow from './art/friend-yellow.png';
import fSmile from './art/face-smile.png';
import fCry from './art/face-cry.png';
import fAngry from './art/face-angry.png';
import fSleepy from './art/face-sleepy.png';
import hat from './art/feat-hat.png';
import ribbon from './art/feat-ribbon.png';
import glasses from './art/feat-glasses.png';
import basket from './art/basket.png';
import basketHot from './art/basket-hot.png';
import heart from './art/heart.png';
import heartOff from './art/heart-off.png';
import tBall from './art/toy-ball.png';
import tBlock from './art/toy-block.png';
import tRobot from './art/toy-robot.png';
import tCar from './art/toy-car.png';
import tBear from './art/toy-bear.png';
import tDuck from './art/toy-duck.png';
import tStar from './art/toy-star.png';
import tLock from './art/toy-lock.png';
import tPin from './art/toy-pin.png';
import './pixel.css';

const BODY: Record<string, string> = { red, blue, green, yellow };
const FACE: Record<string, string> = { smile: fSmile, cry: fCry, angry: fAngry, sleepy: fSleepy };
const FEAT: Record<string, string | undefined> = { hat, ribbon, glasses, none: undefined };
const TOY = [tBall, tBlock, tRobot, tCar, tBear, tDuck];
const img = (src: string, cls: string) => <img src={src} className={cls} alt="" draggable={false} />;

// ─────────────────────────── 공통 UI
const Background: UiSlots['Background'] = ({ scene }) => (
  <div className="px-bg" data-scene={scene}>
    <i className="px-cloud c1" />
    <i className="px-cloud c2" />
    <i className="px-cloud c3" />
    <i className="px-grass" />
  </div>
);
const ButtonFace: UiSlots['ButtonFace'] = ({ variant, size, disabled, children }) => (
  <span className={`mgl-face px-btn px-btn-${variant} px-btn-${size}${disabled ? ' off' : ''}`}>{children}</span>
);
const Panel: UiSlots['Panel'] = ({ tone, className = '', children }) => <div className={`px-panel px-${tone} ${className}`}>{children}</div>;
const Lives: UiSlots['Lives'] = ({ lives, max }) => (
  <span className="mgl-lives px-lives" data-lives={lives} aria-label={`목숨 ${lives}개`}>
    {Array.from({ length: max }, (_, i) => (
      <img key={i} src={i < lives ? heart : heartOff} className={i < lives ? 'on' : 'off'} alt="" draggable={false} />
    ))}
  </span>
);

/** 전광판: 콤보 단계(2·5·10·20↑)에 따라 표시가 커지고 색이 바뀜 */
const comboTier = (c: number) => (c >= 20 ? 4 : c >= 10 ? 3 : c >= 5 ? 2 : c >= 2 ? 1 : 0);
const Scoreboard: UiSlots['Scoreboard'] = ({ view, pauseButton }) => (
  <div className="mgl-hud px-hud" data-tier={comboTier(view.combo)}>
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
      {view.combo >= 2 && (
        <span key={view.combo} className="mgl-combo">
          COMBO ×{view.combo}
        </span>
      )}
      <span className="mgl-grow" />
      {view.lives != null ? <Lives lives={view.lives} max={view.maxLives ?? 5} /> : <span className="mgl-label">LV {view.level}</span>}
    </div>
  </div>
);

// ─────────────────────────── 편가르기
const Friend: SortSlots['Friend'] = ({ card }) => (
  <div className="sc-card px-friend" data-color={card.color} data-face={card.face} data-feature={card.feature}>
    <i className="px-shadow" />
    <span className="px-sprite">
      {img(BODY[card.color] ?? red, 'l0')}
      {img(FACE[card.face] ?? fSmile, 'l1')}
      {FEAT[card.feature] && img(FEAT[card.feature]!, 'l2')}
    </span>
  </div>
);
const ARROW = ['◀', '▲', '▶'];
const BinFace: SortSlots['BinFace'] = ({ index, bins, label, locked }) => (
  <span className="tf-bin px-bin" data-locked={locked ? '1' : '0'}>
    <span className="px-bin-top">
      <span className="sc-arrow">{bins === 2 ? ARROW[index === 0 ? 0 : 2] : ARROW[index]}</span>
      <span className="sc-bin-label">{label}</span>
    </span>
    <img className="px-basket" src={basket} alt="" draggable={false} />
    <img className="px-basket hot" src={basketHot} alt="" draggable={false} />
  </span>
);
const StageFrame: SortSlots['StageFrame'] = ({ reversed }) => (
  <div className="tf-stage px-stage" data-reversed={reversed ? '1' : '0'}>
    <i className="px-curtain" />
    <i className="px-floor" />
  </div>
);

// ─────────────────────────── 아슬아슬 탑: 충돌 모양(points) 그대로 그리고, 도트 느낌의 윗면·부스러기만 더함
const SNACK: Record<string, { fill: string; edge: string; top: string; dot: string }> = {
  toast: { fill: '#f0c987', edge: '#7a4a24', top: '#fbe3b0', dot: '#c9944f' },
  macaron: { fill: '#ff9fb8', edge: '#8a3456', top: '#ffd0dc', dot: '#fff4d6' },
  pudding: { fill: '#f9e49a', edge: '#7a5a1a', top: '#b8642e', dot: '#fff4b0' },
  cake: { fill: '#ffe9d0', edge: '#7a3a24', top: '#ef6a5b', dot: '#ef6a5b' },
  banana: { fill: '#ffd84a', edge: '#7a5a10', top: '#fff0a0', dot: '#a8841a' },
  cone: { fill: '#e7b56a', edge: '#6b4020', top: '#fff4d6', dot: '#b57b4e' },
  slice: { fill: '#fff1d0', edge: '#7a3a24', top: '#ff9fb8', dot: '#ef6a5b' },
  donut: { fill: '#e98fb0', edge: '#7a2a54', top: '#ffd0e0', dot: '#4aa3f0' },
};
const PieceArt: TowerSlots['PieceArt'] = ({ piece, ghost }: { piece: TowerPieceView; ghost?: boolean }) => {
  const c = SNACK[piece.kind] ?? SNACK.toast;
  const { x0, y0, x1, y1 } = piece.bbox;
  const pts = piece.points.map(([x, y]) => `${x},${y}`).join(' ');
  const w = x1 - x0, h = y1 - y0;
  const id = `px-${piece.kind}`;
  const sprinkles = [0.22, 0.48, 0.74].map((f, i) => ({ x: Math.round(x0 + w * f) - 1, y: Math.round(y0 + h * (i % 2 ? 0.55 : 0.4)) - 1 }));
  return (
    <svg className={`tw-art px-piece${ghost ? ' ghost' : ''}`} width={w} height={h} viewBox={`${x0} ${y0} ${w} ${h}`} style={{ left: x0, top: y0 }} aria-label={piece.label} shapeRendering="crispEdges">
      <defs>
        <clipPath id={id + (ghost ? 'g' : '')}>
          <polygon points={pts} />
        </clipPath>
      </defs>
      <polygon points={pts} fill={c.fill} />
      <g clipPath={`url(#${id}${ghost ? 'g' : ''})`}>
        <rect x={x0} y={y0} width={w} height={Math.max(3, Math.round(h * 0.28))} fill={c.top} />
        <rect x={x0} y={y1 - 3} width={w} height={3} fill={c.edge} opacity={0.35} />
        {sprinkles.map((s, i) => (
          <rect key={i} x={s.x} y={s.y} width={2} height={2} fill={c.dot} />
        ))}
        <rect x={x0 + 2} y={y0 + 2} width={Math.max(2, Math.round(w * 0.2))} height={2} fill="#ffffff" opacity={0.7} />
      </g>
      <polygon points={pts} fill="none" stroke={c.edge} strokeWidth={2} strokeLinejoin="miter" />
      {Array.from({ length: piece.weight }, (_, i) => (
        <rect key={i} x={-((piece.weight * 4 - 1) / 2) + i * 4} y={-1} width={3} height={3} fill={c.edge} />
      ))}
    </svg>
  );
};
const TowerBackdrop: TowerSlots['Backdrop'] = () => (
  <div className="px-tw-sky">
    <i className="px-cloud c1" />
    <i className="px-cloud c2" />
  </div>
);
const PlateArt: TowerSlots['PlateArt'] = ({ width }: { width: number }) => (
  <div className="tf-tw-plate px-plate" style={{ width }}>
    <i className="tf-tw-leg px-leg" />
  </div>
);

const NextQueue: TowerSlots['NextQueue'] = ({ next }) => (
  <div className="tf-tw-next px-next">
    <span>NEXT</span>
    {next.map((p, i) => {
      const w = p.bbox.x1 - p.bbox.x0, h = p.bbox.y1 - p.bbox.y0, k = Math.min(1, 34 / Math.max(w, h));
      return (
        <div key={i} className="tf-tw-next-slot" style={{ width: 40, height: 40 }}>
          <div style={{ transform: `scale(${k})`, position: 'absolute', left: 20, top: 20 }}>
            <PieceArt piece={p} />
          </div>
        </div>
      );
    })}
  </div>
);

// ─────────────────────────── 장난감방
const ToyArt: ToyRoomSlots['ToyArt'] = ({ toy, state }) => (
  <span className={`tf-toy px-toy ${state}`} data-fixed={toy.fixed ? '1' : '0'}>
    {img(toy.wild ? tStar : TOY[toy.type] ?? tBall, 'px-toy-img')}
    {toy.fixed && img(tPin, 'px-pin')}
  </span>
);
const Shelf: ToyRoomSlots['ShelfFrame'] = ({ capacity, locked, state }) => (
  <div className={`tf-shelf px-shelf ${state}`}>
    <div className="tf-shelf-cells" style={{ gridTemplateColumns: `repeat(${capacity}, 1fr)` }}>
      {Array.from({ length: capacity }, (_, j) => (
        <i key={j} className={j >= capacity - locked ? 'lock' : ''}>
          {j >= capacity - locked && img(tLock, 'px-lock')}
        </i>
      ))}
    </div>
  </div>
);
const RoomBackdrop: ToyRoomSlots['Backdrop'] = () => <div className="px-room" />;

const pixel: Skin = {
  id: 'pixel',
  name: '고나 픽셀 UI (코드 도트)',
  extends: 'temp',
  tokens: { '--mgl-page-bg': '#5ec4f5', '--sc-card-w': '112px', '--sc-card-h': '120px', '--mgl-btn-depth': '4px' },
  ui: { Background, ButtonFace, Panel, Lives, Scoreboard },
  sort: { Friend, BinFace, StageFrame },
  tower: { Backdrop: TowerBackdrop, PieceArt, PlateArt, NextQueue },
  toyroom: { Backdrop: RoomBackdrop, ShelfFrame: Shelf, ToyArt },
};
export default pixel;
