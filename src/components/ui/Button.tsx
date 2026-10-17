'use client';

import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

// RF/RNF: Grupo 4 (Dashboard Estadístico) — reglas de componentes MASTER.md sección 10.
// Botón primitivo compartido — no duplicar por feature (MASTER.md sección 6).

// Paleta del logo (MASTER.md sección 4): 'primary' = tinta media
// (primary-700, 11.3:1 con blanco) para acciones generales; 'brand' = tinta
// profunda (primary-900) con filete dorado, para el CTA principal de
// formularios/modales de marca (Login, credenciales, wizard). Foco siempre
// en anillo dorado accent-600.
export type ButtonVariant = 'primary' | 'brand' | 'secondary' | 'destructive';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  isLoading?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-primary-700 text-white hover:bg-primary-800 focus-visible:ring-accent-600',
  brand:
    'bg-primary-900 text-white border border-accent-500/40 hover:bg-primary-800 hover:border-accent-500/70 focus-visible:ring-accent-600',
  secondary:
    'bg-white text-primary-900 border border-neutral-border hover:bg-neutral-bg focus-visible:ring-accent-600',
  // destructive: reservado exclusivamente a SOS/eliminar, nunca decorativo (MASTER.md sección 10).
  destructive: 'bg-risk-critical text-white hover:opacity-90 focus-visible:ring-accent-600',
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
          'text-sm font-medium transition-[background-color,color,box-shadow,transform] duration-200',
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
