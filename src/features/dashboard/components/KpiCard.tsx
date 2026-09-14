import { ArrowDown, ArrowUp } from 'lucide-react';
import { Skeleton } from '@/components/feedback/Skeleton';
import type { KpiCardData } from '../types';

// RF/RNF: Dashboard Estadístico — Grupo 4 (MASTER.md sección 7.3).
//
// Métrica en estilo "hoja de registro" (portado desde refactor/dashboard-
// design, adaptado a la paleta 2026 — MASTER.md sección 4): sin íconos ni
// chips de color — el número grande (KPI principal, sección 3) es el
// protagonista, la etiqueta a la izquierda y el periodo en versalitas a la
// derecha; el delta va bajo una hairline con la flecha en brand-gold-600
// (único acento de color permitido — brand-gold-500 no pasa 3:1 sobre
// blanco, ver tabla de contraste de la sección 4).
//
// variant="card": celda suelta con marco propio (borde + sombra + hover).
// variant="cell": celda dentro de la cinta de KpiGrid — el marco lo dibuja
// el grid con hairlines divisorias; aquí solo hover cálido y entrada en
// cascada (animate-rise-up, delay = índice; respeta prefers-reduced-motion
// vía globals.css).

export interface KpiCardProps {
  data?: KpiCardData;
  index?: number;
  isLoading?: boolean;
  variant?: 'card' | 'cell';
  onClick?: () => void;
}

export function KpiCard({ data, index = 0, isLoading = false, variant = 'card', onClick }: KpiCardProps) {
  const cell = variant === 'cell';

  if (isLoading || !data) {
    return (
      <div className={cell ? 'p-6' : 'rounded-2xl border border-neutral-border bg-white p-6 shadow-sm'}>
        <div className="flex items-baseline justify-between gap-3">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-12" />
        </div>
        <Skeleton className="mt-4 h-9 w-24" />
        <Skeleton className="mt-5 h-4 w-36" />
      </div>
    );
  }

  const { label, value, periodLabel, deltaLabel, deltaDirection } = data;
  const DeltaIcon = deltaDirection === 'down' ? ArrowDown : ArrowUp;

  const clickable = Boolean(onClick);
  return (
    <article
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter') onClick?.(); } : undefined}
      className={[
        cell
          ? 'animate-rise-up p-6 transition-colors duration-200 hover:bg-brand-gold-100/40'
          : 'animate-rise-up rounded-2xl border border-neutral-border bg-white p-6 shadow-sm transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lg',
        clickable ? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-600' : '',
      ].join(' ')}
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] font-medium text-neutral-text">{label}</p>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-text-muted tabular-nums">
          {periodLabel}
        </p>
      </div>

      <p className="mt-3 text-3xl font-bold leading-none tracking-tight text-neutral-text tabular-nums">
        {value.toLocaleString('es-BO')}
      </p>

      {deltaLabel && (
        <p className="mt-5 flex items-center gap-1.5 border-t border-neutral-border pt-3 text-xs text-neutral-text-muted">
          <DeltaIcon className="h-3.5 w-3.5 text-brand-gold-600" aria-hidden="true" />
          <span className="font-medium text-neutral-text">{deltaLabel}</span>
        </p>
      )}
    </article>
  );
}

// Nota: "focus", "active/selected" y "disabled" (MASTER.md sección 8) no
// aplican — esta card es un display estático, no un control interactivo.
