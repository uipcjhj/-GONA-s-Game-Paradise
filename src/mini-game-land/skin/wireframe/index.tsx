/**
 * 와이어프레임 스킨 (점검용) — '슬롯 하나씩 독립 교체'가 실제로 되는지 증명하기 위한 스킨.
 * 임시 스킨을 바탕으로 배경·버튼·점수판·캐릭터·분류함·게임판 장식만 덮어쓰고, 나머지는 그대로 둠.
 * 카드 크기 토큰도 다르게(96px) 줘서 크기 계약도 확인. 최종 디자인이 아님. ?skin=wireframe 으로만 열림.
 */
import type { Skin, UiSlots } from '../types';
import type { SortSlots } from '../../games/sort/slots';
import { LABEL } from '../../games/sort/logic';
import './wireframe.css';

const Background: UiSlots['Background'] = () => <div className="wf-bg" />;

const ButtonFace: UiSlots['ButtonFace'] = ({ variant, size, children }) => (
  <span className={`mgl-face wf-btn wf-btn-${variant} wf-btn-${size}`}>{children}</span>
);

const Scoreboard: UiSlots['Scoreboard'] = ({ view, pauseButton }) => (
  <div className="wf-hud">
    {pauseButton}
    <div className="wf-hud-main">
      <b>SCORE {view.score}</b>
      <span>{view.timeSec == null ? '∞' : `${view.timeSec}s`}{view.combo >= 2 ? ` · COMBO ${view.combo}` : ''}</span>
      <span>{view.label} {view.lives != null ? `· HP ${view.lives}` : `· LV ${view.level}`}</span>
    </div>
    <div className="wf-bar"><i style={{ width: `${view.timePct}%` }} /></div>
  </div>
);

const Friend: SortSlots['Friend'] = ({ card }) => (
  <div className="wf-friend" data-color={card.color}>
    <b>{LABEL[card.color]}</b>
    <span>{LABEL[card.face]}</span>
    <span>{card.feature === 'none' ? '—' : LABEL[card.feature]}</span>
  </div>
);

const StageFrame: SortSlots['StageFrame'] = ({ reversed }) => <div className="wf-stage" data-reversed={reversed ? '1' : '0'} />;

const BinFace: SortSlots['BinFace'] = ({ index, label }) => (
  <span className="wf-bin">
    <i>{index + 1}</i>
    {label}
  </span>
);

const wireframe: Skin = {
  id: 'wireframe',
  name: '와이어프레임 (점검용)',
  temporary: true,
  extends: 'temp',
  tokens: { '--mgl-page-bg': '#ffffff', '--sc-card-w': '96px', '--sc-card-h': '96px', '--mgl-btn-depth': '2px' },
  ui: { Background, ButtonFace, Scoreboard },
  sort: { Friend, StageFrame, BinFace },
};
export default wireframe;
