import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ModalSize = 'md' | 'lg' | 'xl';

type ModalShellProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: ModalSize;
  closeDisabled?: boolean;
  overlayClassName?: string;
};

const sizeClass: Record<ModalSize, string> = {
  md: 'max-w-md',
  lg: 'max-w-3xl',
  xl: 'max-w-4xl'
};

export function ModalShell({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'lg',
  closeDisabled = false,
  overlayClassName = 'bg-black/40'
}: ModalShellProps) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    bodyRef.current?.scrollTo({ top: 0 });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !closeDisabled) onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeDisabled, onClose, open]);

  if (!open) return null;

  return createPortal(
    <div className={`fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto p-4 sm:items-center ${overlayClassName}`}>
      <button
        type="button"
        aria-label="Fechar modal"
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={() => {
          if (!closeDisabled) onClose();
        }}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`relative my-0 flex max-h-[calc(100dvh-32px)] w-full ${sizeClass[size]} flex-col overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-2xl`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-gray-100 p-5">
          <div>
            <h3 id="modal-title" className="text-lg font-semibold text-[#17324d]">
              {title}
            </h3>
            {description && <p className="text-sm text-[#86868B]">{description}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={closeDisabled}>
            <X className="h-4 w-4" />
          </Button>
        </header>
        <div ref={bodyRef} className="flex-1 overflow-y-auto p-5">
          {children}
        </div>
        {footer && <footer className="shrink-0 border-t border-gray-100 p-5">{footer}</footer>}
      </section>
    </div>,
    document.body
  );
}
