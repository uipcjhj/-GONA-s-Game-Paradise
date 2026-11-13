import type { ReactNode } from 'react';
import { Badge, Button, Heading, Panel, StatList } from '../skin/components';

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
      <Heading role="result" tone={tone}>{heading}</Heading>
      {badges.map((b) => (
        <Badge key={b} testId="badge">
          {b}
        </Badge>
      ))}
      <Panel tone="board">
        <StatList lines={lines} />
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
