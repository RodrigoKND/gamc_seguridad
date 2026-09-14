'use client';

import { forwardRef, useId, type ReactNode, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';

// Select primitivo compartido — filtros de tabla (sin label visible, usar
// aria-label) y formularios (con label visible). No duplicar por feature
// (MASTER.md sección 6). `accent="gold"` es opt-in para pantallas migradas
// a la paleta 2026 (MASTER.md sección 4) — no afecta a los demás consumidores.

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  children: ReactNode;
  accent?: 'blue' | 'gold';
}

const RING_CLASSES: Record<'blue' | 'gold', string> = {
  blue: 'focus-visible:ring-brand-blue-600',
  gold: 'focus-visible:ring-brand-gold-600',
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, required, accent = 'blue', className = '', id, children, ...rest }, ref) => {
    const generatedId = useId();
    const selectId = id ?? generatedId;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="text-xs font-semibold text-neutral-text">
            {label}
            {required && <span className="ml-0.5 text-risk-critical">*</span>}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            required={required}
            aria-invalid={Boolean(error) || undefined}
            className={[
              'w-full appearance-none rounded-md border bg-white px-3 py-2 pr-8 text-sm text-neutral-text',
              'transition-colors duration-200',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              RING_CLASSES[accent],
              error ? 'border-risk-critical' : 'border-neutral-border',
              className,
            ].join(' ')}
            {...rest}
          >
            {children}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-text-muted"
            aria-hidden="true"
          />
        </div>
        {error && (
          <p role="alert" className="text-xs text-risk-critical">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
