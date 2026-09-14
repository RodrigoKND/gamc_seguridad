'use client';

import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

// RF/RNF: Grupo 4 (Dashboard Estadístico) — reglas de componentes MASTER.md sección 10.
// Botón primitivo compartido — no duplicar por feature (MASTER.md sección 6).

// 'ink': variante de la paleta 2026 (MASTER.md sección 4) — botón primario
// para pantallas ya migradas (por ahora, Login). 'primary' se mantiene sin
// cambios para no alterar el resto de la plataforma, todavía en brand-blue-600.
export type ButtonVariant = 'primary' | 'ink' | 'secondary' | 'destructive';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  isLoading?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-brand-blue-600 text-white hover:opacity-90 focus-visible:ring-brand-blue-600',
  ink: 'bg-brand-ink-900 text-white hover:bg-brand-ink-800 focus-visible:ring-brand-gold-600',
  secondary:
    'bg-white text-brand-navy-950 border border-neutral-border hover:bg-neutral-bg focus-visible:ring-brand-blue-600',
  // destructive: reservado exclusivamente a SOS/eliminar, nunca decorativo (MASTER.md sección 10).
  destructive: 'bg-risk-critical text-white hover:opacity-90 focus-visible:ring-brand-blue-600',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'primary', isLoading = false, disabled, className = '', children, ...rest },
    ref
  ) => {
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        type={rest.type ?? 'button'}
        disabled={isDisabled}
        aria-busy={isLoading || undefined}
        className={[
          'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2',
          'text-sm font-medium transition-colors duration-200',
          'active:scale-[0.98]',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          // disabled: opacity-50 cursor-not-allowed, sin eventos hover (MASTER.md sección 8).
          isDisabled ? 'cursor-not-allowed opacity-50 pointer-events-none' : '',
          VARIANT_CLASSES[variant],
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...rest}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

// Nota: los estados "empty" y "error" del catálogo de 8 estados (MASTER.md sección 8)
// no aplican a este átomo — un botón no tiene contenido ni resultado propio que
// pueda estar vacío o fallar; esos estados los expresan EmptyState y ErrorBanner.
