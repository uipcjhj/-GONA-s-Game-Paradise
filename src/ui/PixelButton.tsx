import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'sub' | 'danger';
export default function PixelButton({ variant = 'primary', small, big, block, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; small?: boolean; big?: boolean; block?: boolean }) {
  const cls = ['p-btn', variant === 'sub' ? 'sub' : variant === 'danger' ? 'danger' : '', small ? 'sm' : '', big ? 'big' : '', block ? 'block' : '', className].filter(Boolean).join(' ');
  return <button type="button" className={cls} {...rest} />;
}
