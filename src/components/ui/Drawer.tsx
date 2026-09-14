'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

// Drawer lateral compartido — telemetría de guardia y detalle de hecho
// (MASTER.md sección 6: 2+ módulos -> components/ui/). 400/460px, desliza
// desde la derecha, transition-transform duration-200 (MASTER.md sección 10).

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  widthClassName?: string;
  headerClassName?: string;
  header: ReactNode;
  children: ReactNode;
}

export function Drawer({
  isOpen,
  onClose,
  widthClassName = 'w-[400px]',
  headerClassName = '',
  header,
  children,
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    panelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[5000] flex justify-end">
      <div
        onClick={onClose}
        aria-hidden="true"
        className="absolute inset-0 animate-fade-in bg-brand-navy-950/40"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={[
          'relative flex h-full max-w-[92vw] flex-col bg-white shadow-lg',
          'animate-slide-in-right outline-none',
          widthClassName,
        ].join(' ')}
      >
        <div className={['flex items-center gap-3 px-5 py-4', headerClassName].join(' ')}>
          <div className="min-w-0 flex-1">{header}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 rounded-md p-1 transition-colors duration-200 hover:bg-black/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  );
}
