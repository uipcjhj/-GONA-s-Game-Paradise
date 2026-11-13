/**
 * 화면 코드가 쓰는 '기반 컴포넌트'. 동작(터치 영역·접근성)은 여기서, 겉모습은 현재 스킨의 슬롯에 위임합니다.
 */
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';
import { useSkin } from './context';
import type { ButtonSize, ButtonVariant, MascotPose, PanelTone, Scene } from './types';

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
