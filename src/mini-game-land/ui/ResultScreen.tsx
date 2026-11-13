import type { ReactNode } from 'react';
import { Button, Panel } from '../skin/components';

export interface ResultLine {
  label: string;
  value: string;
  strong?: boolean;
}
export interface ResultAction {
  label: string;
  onClick: () => void;
  primary?: boolean;
  testId?: string;
}

/** 결과 화면 — 자유 플레이 · 챌린지 공통 */
export default function ResultScreen({
  heading,
  tone,
  lines,
  badges = [],
  actions,
  children,
}: {
  heading: string;
  tone: 'clear' | 'fail';
  lines: ResultLine[];
  badges?: string[];
  actions: ResultAction[];
  children?: ReactNode;
}) {
  return (
    <div className="mgl-screen mgl-result" data-testid="result" data-tone={tone}>
      <h2 className={`mgl-result-head ${tone}`}>{heading}</h2>
      {badges.map((b) => (
        <div key={b} className="mgl-badge" data-testid="badge">
          {b}
        </div>
      ))}
      <Panel tone="board">
        <dl className="mgl-lines">
          {lines.map((l) => (
            <div key={l.label} className={l.strong ? 'strong' : ''}>
              <dt>{l.label}</dt>
              <dd>{l.value}</dd>
            </div>
          ))}
        </dl>
      </Panel>
      {children}
      <div className="mgl-actions">
        {actions.map((a) => (
          <Button key={a.label} variant={a.primary ? 'primary' : 'normal'} data-testid={a.testId} onClick={a.onClick}>
            {a.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
