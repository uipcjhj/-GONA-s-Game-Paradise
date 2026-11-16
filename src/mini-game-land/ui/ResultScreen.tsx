import { useRef, type MouseEvent, type ReactNode } from 'react';
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
  // 판이 끝날 때 화면을 누르고 있던 손가락을 떼면 그 자리의 버튼이 눌려 '다시 도전'이 저절로 되던 문제 방지:
  // 결과 화면이 뜬 뒤 새로 누른 터치(또는 키보드)만 버튼으로 인정
  const armed = useRef(false);
  const guard = (fn: () => void) => (e: MouseEvent) => {
    if (!armed.current && e.detail !== 0) return;
    fn();
  };
  return (
    <div className="mgl-screen mgl-result" data-testid="result" data-tone={tone} onPointerDownCapture={() => (armed.current = true)}>
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
          <Button key={a.label} variant={a.primary ? 'primary' : 'normal'} data-testid={a.testId} onClick={guard(a.onClick)}>
            {a.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
