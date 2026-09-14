'use client';

import { useState } from 'react';
import { Pencil, Users } from 'lucide-react';
import { Skeleton } from '@/components/feedback/Skeleton';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorBanner } from '@/components/feedback/ErrorBanner';
import { ImageLightbox } from '@/components/ui/ImageLightbox';
import { EPI_ZONE_BG_CLASS, EPI_ZONE_LABELS } from '@/types/epi';
import type { AsyncStatus } from '@/features/dashboard/types';
import { GuardStatusBadges } from './GuardStatusBadges';
import { guardFullName, guardInitials, type Guard } from '../types';

// RF-01, RF-12 (MASTER.md sección 7.3): tabla con foto/iniciales, nombre
// completo, cédula, EPI, badge de cuenta + badge operativo (dos badges
// separados, MASTER.md sección 13.1).

export interface GuardTableProps {
  guards: Guard[];
  status: AsyncStatus;
  onRetry?: () => void;
  onEdit?: (guard: Guard) => void;
}

const BASE_COLUMNS = ['GUARDIA', 'EPI', 'UBICACIÓN ACTUAL', 'ESTADO', 'REPORTES'];

export function GuardTable({ guards, status, onRetry, onEdit }: GuardTableProps) {
  // Operador ve la tabla de solo lectura (MASTER.md sección 15.1) — sin
  // onEdit, la columna de acciones ni se renderiza (no un botón deshabilitado).
  const COLUMNS = onEdit ? [...BASE_COLUMNS, ''] : BASE_COLUMNS;
  const [fotoExpandida, setFotoExpandida] = useState<{ src: string; alt: string } | null>(null);

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-border bg-white">
      <ImageLightbox
        src={fotoExpandida?.src ?? null}
        alt={fotoExpandida?.alt ?? ''}
        onClose={() => setFotoExpandida(null)}
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b border-neutral-border bg-neutral-bg">
              {COLUMNS.map((col) => (
                <th
                  key={col}
                  scope="col"
                  className="px-3.5 py-2.5 text-left text-[11px] font-semibold tracking-wide text-neutral-text-muted"
                >
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
                  <ErrorBanner message="Error al cargar la lista de guardias." onRetry={onRetry} className="border-none bg-transparent" />
                </td>
              </tr>
            )}

            {status === 'empty' && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-3.5 py-10">
                  <EmptyState icon={Users} title="No hay guardias activos en este momento." className="border-none" />
                </td>
              </tr>
            )}

            {status === 'ready' &&
              guards.map((guard) => (
                <tr key={guard.id} className="border-b border-neutral-bg transition-colors duration-200 last:border-0 hover:bg-neutral-bg/60">
                  <td className="px-3.5 py-3">
                    <div className="flex items-center gap-2.5">
                      {guard.fotoUrl ? (
                        <button
                          type="button"
                          onClick={() =>
                            setFotoExpandida({ src: guard.fotoUrl!, alt: `Foto de ${guardFullName(guard)}` })
                          }
                          aria-label={`Ampliar foto de ${guardFullName(guard)}`}
                          className="shrink-0 overflow-hidden rounded-full transition-opacity duration-200 hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-600 focus-visible:ring-offset-2"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- foto remota del backend */}
                          <img
                            src={guard.fotoUrl}
                            alt=""
                            className="h-[34px] w-[34px] object-cover"
                          />
                        </button>
                      ) : (
                        <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-brand-navy-800 text-[11.5px] font-bold text-brand-gold-500">
                          {guardInitials(guard)}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-neutral-text">{guardFullName(guard)}</p>
                        <p className="truncate text-xs text-neutral-text-muted">CI {guard.ci}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3.5 py-3">
                    <span className="flex items-center gap-1.5 text-xs text-neutral-text">
                      <span className={['h-2 w-2 shrink-0 rounded-full', EPI_ZONE_BG_CLASS[guard.epi]].join(' ')} />
                      {EPI_ZONE_LABELS[guard.epi]}
                    </span>
                  </td>
                  <td className="px-3.5 py-3 text-xs text-neutral-text">{guard.ubicacionActual ?? '—'}</td>
                  <td className="px-3.5 py-3">
                    <GuardStatusBadges accountStatus={guard.accountStatus} operationalStatus={guard.operationalStatus} />
                  </td>
                  <td className="px-3.5 py-3">
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-bg px-1.5 text-[11px] font-semibold text-neutral-text">
                      {guard.reportesCount}
                    </span>
                  </td>
                  {onEdit && (
                    <td className="px-3.5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onEdit(guard)}
                        aria-label={`Editar ${guardFullName(guard)}`}
                        className="rounded-md p-1.5 text-neutral-text-muted transition-colors duration-200 hover:bg-neutral-bg hover:text-neutral-text focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-600 focus-visible:ring-offset-2"
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
