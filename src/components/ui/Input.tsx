'use client';

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';

// Input primitivo compartido — no duplicar por feature (MASTER.md sección
// 6). Label visible siempre (ux: input-labels — nunca solo placeholder),
// error inline bajo el campo (ux: error-placement), foco con anillo púrpura
// por defecto (MASTER.md sección 9). `accent="rose"` (anillo accent-500, rosa Innova) e
// `icon` son opt-in para formularios de marca (Login, credenciales, guardias).

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
  icon?: ReactNode;
  accent?: 'purple' | 'rose';
}

const RING_CLASSES: Record<'purple' | 'rose', string> = {
  purple: 'focus-visible:ring-primary-700',
  rose: 'focus-visible:ring-accent-500',
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, icon, accent = 'purple', required, className = '', id, ...rest }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = error ? `${inputId}-error` : undefined;
    const helperId = helperText ? `${inputId}-helper` : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-xs font-semibold text-neutral-text">
          {label}
          {required && <span className="ml-0.5 text-risk-critical">*</span>}
        </label>
        <div className="relative">
          {icon && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-text-muted">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            required={required}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={[errorId, helperId].filter(Boolean).join(' ') || undefined}
            className={[
              'w-full rounded-md border px-3 py-2 text-sm text-neutral-text placeholder:text-neutral-text-muted',
              'transition-colors duration-200',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              RING_CLASSES[accent],
              'disabled:cursor-not-allowed disabled:opacity-50',
              error ? 'border-risk-critical' : 'border-neutral-border',
              icon ? 'pl-9' : '',
              className,
            ].join(' ')}
            {...rest}
          />
        </div>
        {error && (
          <p id={errorId} role="alert" className="text-xs text-risk-critical">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={helperId} className="text-xs text-neutral-text-muted">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
