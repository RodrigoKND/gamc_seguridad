'use client';

import { useMemo, useState } from 'react';
import { Pencil, Search } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { ImageLightbox } from '@/components/ui/ImageLightbox';
import { EPI_ZONE_LABELS } from '@/types/epi';
import { normalizeSearch } from '@/lib/text';
import { exportPDF, guardiasToPrint } from '@/features/reportes/actions/exportPDF';
import { exportGuardiasExcel } from '../actions/exportGuardias';
import { GuardStatusBadges } from './GuardStatusBadges';
import { guardFullName, guardInitials, type Guard } from '../types';

// RF-01 (MASTER.md sección 7.3): directorio buscable histórico + activos,
// dos badges de estado por fila (MASTER.md sección 13.1). "Editar" solo se
// muestra si el rol puede escribir guardias (onEdit ausente para Operador
// — MASTER.md sección 15.1, la misma regla que la tabla principal).

export interface GuardCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  guards: Guard[];
  onEdit?: (guard: Guard) => void;
}

export function GuardCatalogModal({ isOpen, onClose, guards, onEdit }: GuardCatalogModalProps) {
  const [query, setQuery] = useState('');
  const [fotoExpandida, setFotoExpandida] = useState<{ src: string; alt: string } | null>(null);

  const filtered = useMemo(() => {
    const q = normalizeSearch(query.trim());
    if (!q) return guards;
    return guards.filter(
      (g) => normalizeSearch(guardFullName(g)).includes(q) || normalizeSearch(g.id).includes(q) || g.ci.includes(q),
    );
  }, [guards, query]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Catálogo de Guardias Registrados" widthClassName="max-w-[640px]">
      <ImageLightbox
        src={fotoExpandida?.src ?? null}
        alt={fotoExpandida?.alt ?? ''}
        onClose={() => setFotoExpandida(null)}
      />
      <div className="p-5">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-text-muted" aria-hidden="true" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar en el directorio…"
              aria-label="Buscar en el directorio de guardias"
              className="w-full rounded-md border border-neutral-border py-2 pl-9 pr-3 text-sm transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-600"
            />
          </div>
          <ExportMenu onExportExcel={() => exportGuardiasExcel(filtered)} onExportPDF={() => exportPDF(guardiasToPrint(filtered))} disabled={filtered.length === 0} />
        </div>

        {filtered.length === 0 ? (
          <p className="py-9 text-center text-sm text-neutral-text-muted">No se encontraron guardias con ese criterio.</p>
        ) : (
          <ul className="scrollbar-hidden flex max-h-[50vh] flex-col divide-y divide-neutral-bg overflow-y-auto">
            {filtered.map((guard) => (
              <li key={guard.id} className="flex items-center gap-3 py-2.5">
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
                    <img src={guard.fotoUrl} alt="" className="h-[30px] w-[30px] object-cover" />
                  </button>
                ) : (
                  <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-brand-navy-800 text-[10.5px] font-bold text-brand-gold-500">
                    {guardInitials(guard)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-neutral-text">{guardFullName(guard)}</p>
                  <p className="truncate text-[11px] text-neutral-text-muted">
                    CI {guard.ci} · EPI {EPI_ZONE_LABELS[guard.epi]}
                  </p>
                </div>
                <GuardStatusBadges accountStatus={guard.accountStatus} operationalStatus={guard.operationalStatus} />
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(guard)}
                    aria-label={`Editar ${guardFullName(guard)}`}
                    className="shrink-0 rounded-md p-1.5 text-neutral-text-muted transition-colors duration-200 hover:bg-neutral-bg hover:text-neutral-text focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-600 focus-visible:ring-offset-2"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
