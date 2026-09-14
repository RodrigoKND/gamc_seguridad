'use client';

import { FileWarning, Image as ImageIcon } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/feedback/Skeleton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { RISK_LEVEL_BADGE_CLASS, RISK_LEVEL_LABELS } from '@/types/risk';
import { EPI_ZONE_LABELS } from '@/types/epi';
import type { AsyncStatus } from '@/features/dashboard/types';
import { HECHO_ESTADO_BADGE_CLASS, HECHO_ESTADO_LABELS, type Hecho } from '../types';

// RF-G3-02 a 08, RF-10 (MASTER.md sección 7.3): tabla (ID, tipo,
// severidad, ubicación/EPI, timestamp, reportante, estado, evidencia).

export interface IncidentTableProps {
  hechos: Hecho[];
  status: AsyncStatus;
  onRetry?: () => void;
  onSelect: (hecho: Hecho) => void;
}

const COLUMNS = ['TIPO', 'SEVERIDAD', 'UBICACIÓN / EPI', 'FECHA / HORA', 'REPORTADO POR', 'ESTADO', 'EVIDENCIA'];

export function IncidentTable({ hechos, status, onRetry, onSelect }: IncidentTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-border bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse">
          <thead>
            <tr className="border-b border-neutral-border bg-neutral-bg">
              {COLUMNS.map((col) => (
                <th key={col} scope="col" className="px-3.5 py-2.5 text-left text-[11px] font-semibold text-neutral-text-muted">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {status === 'loading' &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-neutral-bg">
                  <td colSpan={COLUMNS.length} className="px-3.5 py-3.5">
                    <Skeleton className="h-4 w-full" />
                  </td>
                </tr>
              ))}

            {status === 'error' && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-3.5 py-10">
                  <ErrorBanner message="No se pudo cargar la bitácora de hechos." onRetry={onRetry} className="border-none bg-transparent" />
                </td>
              </tr>
            )}

            {status === 'empty' && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-3.5 py-10">
                  <EmptyState icon={FileWarning} title="No hay hechos reportados con los filtros seleccionados." className="border-none" />
                </td>
              </tr>
            )}

            {status === 'ready' &&
              hechos.map((hecho) => (
                <tr
                  key={hecho.id}
                  onClick={() => onSelect(hecho)}
                  tabIndex={0}
                  role="button"
                  aria-label={`Ver detalle del hecho: ${hecho.tipo}, ${hecho.timestamp}`}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') onSelect(hecho);
                  }}
                  className="cursor-pointer border-b border-neutral-bg transition-colors duration-200 last:border-0 hover:bg-neutral-bg/60 focus:outline-none focus-visible:bg-brand-blue-600/5"
                >
                  <td className="px-3.5 py-3">
                    <p className="text-[12.5px] font-semibold text-brand-blue-600">{hecho.tipo}</p>
                  </td>
                  <td className="px-3.5 py-3">
                    <Badge className={RISK_LEVEL_BADGE_CLASS[hecho.severidad]}>{RISK_LEVEL_LABELS[hecho.severidad]}</Badge>
                  </td>
                  <td className="px-3.5 py-3 text-xs text-neutral-text">
                    {hecho.ubicacion}
                    <span className="block text-neutral-text-muted">EPI {EPI_ZONE_LABELS[hecho.epi]}</span>
                  </td>
                  <td className="px-3.5 py-3 text-xs text-neutral-text">{hecho.timestamp}</td>
                  <td className="px-3.5 py-3 text-xs text-neutral-text">{hecho.reportante}</td>
                  <td className="px-3.5 py-3">
                    <Badge className={HECHO_ESTADO_BADGE_CLASS[hecho.estado]}>{HECHO_ESTADO_LABELS[hecho.estado]}</Badge>
                  </td>
                  <td className="px-3.5 py-3">
                    {hecho.tieneEvidencia ? (
                      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-neutral-border/60 text-neutral-text-muted">
                        <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    ) : (
                      <span className="text-xs text-neutral-text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
