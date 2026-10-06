'use client';

import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

// RF/RNF: Grupo 4 (Dashboard Estadístico) — reglas de componentes MASTER.md sección 10.
// Botón primitivo compartido — no duplicar por feature (MASTER.md sección 6).

// Paleta Innova (MASTER.md sección 4): 'primary' = púrpura medio
// (primary-700, el tono de la barra de Innova) para acciones generales;
// 'brand' = púrpura profundo (primary-900) con anillo primary-700, para el
// CTA principal de formularios/modales de marca (Login, credenciales, wizard).
export type ButtonVariant = 'primary' | 'brand' | 'secondary' | 'destructive';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  isLoading?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-primary-700 text-white hover:opacity-90 focus-visible:ring-primary-700',
  brand: 'bg-primary-900 text-white hover:bg-primary-800 focus-visible:ring-primary-700',
  secondary:
    'bg-white text-primary-900 border border-neutral-border hover:bg-neutral-bg focus-visible:ring-primary-700',
  // destructive: reservado exclusivamente a SOS/eliminar, nunca decorativo (MASTER.md sección 10).
  destructive: 'bg-risk-critical text-white hover:opacity-90 focus-visible:ring-primary-700',
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
