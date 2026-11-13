import type { ReactNode } from 'react';

export default function PixelPanel({ title, right, children }: { title?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="p-panel">
      {title && (
        <h3>
          {title}
          <span style={{ flex: 1 }} />
          {right}
        </h3>
      )}
      {children}
    </section>
  );
}
