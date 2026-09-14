import type { ReactNode } from 'react';
import { BarChart3 } from 'lucide-react';
import { Skeleton } from '@/components/feedback/Skeleton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import type { AsyncStatus } from '../types';

// RF/RNF: Dashboard Estadístico — Grupo 4 (MASTER.md sección 7.3).
// Card: rounded-xl border border-neutral-border shadow-sm p-6 (MASTER.md sección 10).
// Envoltorio compartido de los 3 gráficos del Dashboard — evita duplicar la
// lógica de loading/error/empty en cada uno (MASTER.md sección 6).

export interface ChartCardProps {
  title: string;
  subtitle?: string;
  status: AsyncStatus;
  onRetry?: () => void;
  emptyLabel?: string;
  className?: string;
  children: ReactNode;
}

export function ChartCard({
  title,
  subtitle,
  status,
  onRetry,
  emptyLabel = 'Sin datos para este periodo',
  className = '',
  children,
}: ChartCardProps) {
  return (
    <div
      className={[
        'animate-fade-in-up rounded-2xl border border-neutral-border bg-white p-6 shadow-sm transition-shadow duration-200 hover:shadow-md',
        className,
      ].join(' ')}
      style={{ animationDelay: '180ms' }}
    >
      <p className="text-lg font-medium text-neutral-text">{title}</p>
      {subtitle && <p className="text-xs text-neutral-text-muted">{subtitle}</p>}

      <div className="mt-4">
        {status === 'loading' && <Skeleton className="h-56 w-full" />}
        {status === 'error' && <ErrorBanner message="No se pudo cargar este gráfico." onRetry={onRetry} />}
        {status === 'empty' && <EmptyState icon={BarChart3} title={emptyLabel} className="border-none p-4" />}
        {status === 'ready' && children}
      </div>
    </div>
  );
}
