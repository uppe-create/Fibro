import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

export function ActionGrid({ children }: { children: ReactNode }) {
  return <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:flex xl:w-auto xl:flex-wrap xl:justify-end">{children}</div>;
}

export function ActionButton({
  children,
  onClick,
  tone = 'default',
  disabled = false
}: {
  children: ReactNode;
  onClick: () => void;
  tone?: 'default' | 'danger' | 'primary';
  disabled?: boolean;
}) {
  const className =
    tone === 'danger'
      ? 'min-w-0 px-3 text-sm xl:min-w-[112px]'
      : tone === 'primary'
        ? 'min-w-0 px-3 text-sm xl:min-w-[112px]'
        : 'dashboard-action-button min-w-0 px-3 text-sm xl:min-w-[104px]';

  return (
    <Button variant={tone === 'primary' ? 'default' : tone === 'danger' ? 'destructive' : 'outline'} onClick={onClick} disabled={disabled} className={className}>
      {children}
    </Button>
  );
}
