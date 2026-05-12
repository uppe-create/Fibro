import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'purple' | 'blue' | 'green' | 'amber' | 'red';

const toneClass: Record<Tone, string> = {
  purple: 'border-l-[var(--brand-primary)] text-[var(--brand-primary)]',
  blue: 'border-l-[var(--brand-primary)] text-[var(--brand-primary)]',
  green: 'border-l-[var(--brand-secondary)] text-[var(--brand-secondary)]',
  amber: 'border-l-[var(--brand-accent)] text-[#8a5a00]',
  red: 'border-l-red-500 text-red-700'
};

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  tone = 'purple',
  className
}: {
  eyebrow: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <header className={cn('cipf-page-header', className)}>
      <div className={cn('cipf-page-header-card flex flex-col justify-between gap-6 lg:flex-row lg:items-end', toneClass[tone])}>
        <div className="min-w-0">
          <p className="cipf-kicker">{eyebrow}</p>
          <h2 className="cipf-title mt-2 text-2xl sm:text-3xl">{title}</h2>
          {description && <p className="cipf-description mt-2 max-w-3xl text-sm">{description}</p>}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
    </header>
  );
}

export function SectionPanel({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={cn('cipf-panel p-6 sm:p-8', className)}>{children}</section>;
}

export function EmptyState({
  title,
  description,
  icon,
  className
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('cipf-empty text-center', className)}>
      {icon && <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center bg-[#edf4fb] text-[var(--brand-primary)]">{icon}</div>}
      <p className="font-semibold text-[var(--brand-ink)]">{title}</p>
      {description && <p className="mt-1 text-sm leading-6 text-[var(--brand-muted)]">{description}</p>}
    </div>
  );
}

export function ToolbarActions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('cipf-toolbar', className)}>{children}</div>;
}
