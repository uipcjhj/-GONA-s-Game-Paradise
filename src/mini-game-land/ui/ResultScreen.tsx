import type { ReactNode } from 'react';

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
      <dl className="mgl-lines">
        {lines.map((l) => (
          <div key={l.label} className={l.strong ? 'strong' : ''}>
            <dt>{l.label}</dt>
            <dd>{l.value}</dd>
          </div>
        ))}
      </dl>
      {children}
      <div className="mgl-actions">
        {actions.map((a) => (
          <button key={a.label} type="button" className={`mgl-btn${a.primary ? ' mgl-btn-primary' : ''}`} data-testid={a.testId} onClick={a.onClick}>
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
