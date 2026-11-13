/**
 * 화면 코드가 쓰는 '기반 컴포넌트'. 동작(터치 영역·접근성)은 여기서, 겉모습은 현재 스킨의 슬롯에 위임합니다.
 */
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { useSkin } from './context';
import type { ButtonSize, ButtonVariant, CalloutTone, CaptionRole, HeadingRole, MascotPose, PanelTone, Scene } from './types';

type Common = { variant?: ButtonVariant; size?: ButtonSize };

const cls = (variant: ButtonVariant, size: ButtonSize, extra = '') => `mgl-hit mgl-hit-${variant} mgl-hit-${size} ${extra}`.trim();

export function Button({ variant = 'normal', size = 'md', className, children, ...rest }: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  const { Face } = useFace();
  return (
    <button type="button" className={cls(variant, size, className)} {...rest}>
      <Face variant={variant} size={size} disabled={rest.disabled}>
        {children}
      </Face>
    </button>
  );
}

export function LinkButton({ variant = 'normal', size = 'md', className, children, ...rest }: Common & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const { Face } = useFace();
  return (
    <a className={cls(variant, size, className)} {...rest}>
      <Face variant={variant} size={size}>
        {children}
      </Face>
    </a>
  );
}

function useFace() {
  return { Face: useSkin().ui.ButtonFace };
}

export function Panel({ tone = 'card', className, children }: { tone?: PanelTone; className?: string; children?: ReactNode }) {
  const P = useSkin().ui.Panel;
  return (
    <P tone={tone} className={className}>
      {children}
    </P>
  );
}

export function Background({ scene }: { scene: Scene }) {
  const B = useSkin().ui.Background;
  return (
    <div className="mgl-bg" aria-hidden="true">
      <B scene={scene} />
    </div>
  );
}

export function Mascot({ pose = 'idle', scale, className }: { pose?: MascotPose; scale?: number; className?: string }) {
  const M = useSkin().ui.Mascot;
  return <M pose={pose} scale={scale} className={className} />;
}

export function LivesBar({ lives, max }: { lives: number; max: number }) {
  const L = useSkin().ui.Lives;
  return <L lives={lives} max={max} />;
}

/** 텍스트·딱지류 슬롯 래퍼. 점검용 data-testid 는 기반이 소유(스킨이 바꿔도 유지) */
export function Heading({ role, tone, children }: { role: HeadingRole; tone?: 'clear' | 'fail'; children?: ReactNode }) {
  const H = useSkin().ui.Heading;
  return <H role={role} tone={tone}>{children}</H>;
}
export function Callout({ tone, children }: { tone: CalloutTone; children?: ReactNode }) {
  const C = useSkin().ui.Callout;
  return <C tone={tone}>{children}</C>;
}
export function Badge({ children, testId }: { children?: ReactNode; testId?: string }) {
  const B = useSkin().ui.Badge;
  return (
    <span style={{ display: 'contents' }} data-testid={testId}>
      <B>{children}</B>
    </span>
  );
}
export function Caption({ role, children }: { role: CaptionRole; children?: ReactNode }) {
  const C = useSkin().ui.Caption;
  return <C role={role}>{children}</C>;
}
export function Tag({ children }: { children?: ReactNode }) {
  const T = useSkin().ui.Tag;
  return <T>{children}</T>;
}
export function Logo({ lines, subtitle }: { lines: string[]; subtitle: string }) {
  const L = useSkin().ui.Logo;
  return <L lines={lines} subtitle={subtitle} />;
}
export function StatList({ lines }: { lines: { label: string; value: string; strong?: boolean }[] }) {
  const L = useSkin().ui.StatList;
  return <L lines={lines} />;
}
export function HowTo({ steps }: { steps: string[] }) {
  const H = useSkin().ui.HowTo;
  return <H steps={steps} />;
}
