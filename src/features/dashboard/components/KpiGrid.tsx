import { Gauge } from 'lucide-react';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { KpiCard } from './KpiCard';
import type { AsyncStatus, KpiCardData } from '../types';

// RF/RNF: Dashboard Estadístico — Grupo 4 (MASTER.md sección 7.3).
//
// Cinta única de métricas ("hoja de registro", portado desde refactor/
// dashboard-design): una sola tarjeta blanca con columnas separadas por
// hairlines, en vez de N cards sueltas — más limpieza editorial y mismo
// tratamiento (rounded-2xl/border/shadow-sm) que el resto de tarjetas del
// dashboard (MASTER.md sección 4). Columnas 4 > sm 2 > 1 columna móvil.
// Entrada en cascada vía animate-rise-up (delay = índice, en KpiCard).
// Mantiene su contrato público (items, status, onRetry) e inyecta su celda
// en la columna 12 de PageContainer.

export interface KpiGridProps {
  items: KpiCardData[];
  status: AsyncStatus;
  onRetry?: () => void;
  onSelect?: (id: string) => void;
}

function CellBorders({ children }: { children: React.ReactNode[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {children.map((child, i) => (
        <div
          key={i}
          className={[
            'min-w-0',
            'border-t border-neutral-border first:border-t-0',
            'sm:even:border-l',
            'lg:border-t-0 lg:border-l lg:first:border-l-0',
          ].join(' ')}
        >
          {child}
        </div>
      ))}
    </div>
  );
}

export function KpiGrid({ items, status, onRetry, onSelect }: KpiGridProps) {
  if (status === 'error') {
    return (
      <div className="col-span-12">
        <ErrorBanner message="No se pudieron cargar los indicadores del dashboard." onRetry={onRetry} />
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="col-span-12 rounded-2xl border border-neutral-border bg-white shadow-sm">
        <CellBorders>
          {Array.from({ length: 4 }).map((_, i) => (
            <KpiCard key={i} isLoading variant="cell" />
          ))}
        </CellBorders>
      </div>
    );
  }

  if (status === 'empty' || items.length === 0) {
    return (
      <div className="col-span-12">
        <EmptyState icon={Gauge} title="Sin indicadores para este periodo" />
      </div>
    );
  }

  return (
    <div className="col-span-12 rounded-2xl border border-neutral-border bg-white shadow-sm">
      <CellBorders>
        {items.map((item, i) => (
          <KpiCard key={item.id} data={item} index={i} variant="cell" onClick={onSelect ? () => onSelect(item.id) : undefined} />
        ))}
      </CellBorders>
    </div>
  );
}
