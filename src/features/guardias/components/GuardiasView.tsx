'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { PageContainer } from '@/components/layout/PageContainer';
import { getGuardias } from '@/lib/data-source';
import { canWrite } from '@/lib/permissions';
import { normalizeSearch } from '@/lib/text';
import { useRealtimeEvent } from '@/lib/realtime/RealtimeProvider';
import { REALTIME_EVENTS } from '@/lib/api/realtime';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
import { exportPDF, guardiasToPrint } from '@/features/reportes/actions/exportPDF';
import type { AsyncStatus } from '@/features/dashboard/types';
import { EPI_ZONE_LABELS, type EpiZone } from '@/types/epi';
import { OPERATIONAL_STATUS_LABELS, guardFullName, isDadoDeBaja, type Guard, type OperationalStatus } from '../types';
import { exportGuardiasExcel } from '../actions/exportGuardias';
import { GuardTable } from './GuardTable';
import { GuardEditModal } from './GuardEditModal';
import { GuardCatalogModal } from './GuardCatalogModal';

// RF-01, RF-12 (MASTER.md sección 7.3, 15.1). Datos desde el adaptador
// (lib/data-source.ts) — nunca un array hardcodeado en el componente
// (MASTER.md sección 13, instrucción 10).
//
// Gating por rol (MASTER.md sección 15.1): Super Admin/Admin editan y
// activan/desactivar, sin botón de crear (vive en Generar Credenciales,
// sección 15.2). Operador ve la tabla completamente de solo lectura.

export function GuardiasView() {
  const { user } = useAuthSession();
  const canEdit = user ? canWrite(user.role, 'guardias') : false;
  const searchParams = useSearchParams();

  const [guards, setGuards] = useState<Guard[]>([]);
  const [status, setStatus] = useState<AsyncStatus>('loading');
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const [operationalFilter, setOperationalFilter] = useState<OperationalStatus | 'todos'>('todos');
  const [epiFilter, setEpiFilter] = useState<EpiZone | 'todos'>('todos');
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [editingGuard, setEditingGuard] = useState<Guard | null>(null);

  function loadGuards() {
    setStatus('loading');
    getGuardias()
      .then((data) => {
        setGuards(data);
        setStatus(data.length === 0 ? 'empty' : 'ready');
      })
      .catch(() => setStatus('error'));
  }

  useEffect(loadGuards, []);
  useEffect(() => {
    const q = searchParams.get('q');
    if (q !== null) setQuery(q);
  }, [searchParams]);

  // Tiempo real: un guardia nuevo (Generar Credenciales), un cambio de
  // estado de cuenta/operativo, o su ubicación, llegan por socket.io en vez
  // de requerir recargar la página. Se agrupan ráfagas de eventos en una
  // sola recarga (guardiaUbicacion llega en cada ping GPS de todo el
  // personal), y NO pasa por 'loading' para no parpadear la tabla ya
  // poblada — solo el mount inicial muestra el spinner.
  const pendingRefresh = useRef<ReturnType<typeof setTimeout> | null>(null);
  function scheduleQuietRefresh() {
    if (pendingRefresh.current) return;
    pendingRefresh.current = setTimeout(() => {
      pendingRefresh.current = null;
      getGuardias()
        .then((data) => {
          setGuards(data);
          setStatus((prev) => (prev === 'loading' ? (data.length === 0 ? 'empty' : 'ready') : prev));
        })
        .catch(() => {});
    }, 800);
  }
  useRealtimeEvent(REALTIME_EVENTS.guardiaEstado, scheduleQuietRefresh);
  useRealtimeEvent(REALTIME_EVENTS.guardiaUbicacion, scheduleQuietRefresh);

  const filtered = useMemo(() => {
    const q = normalizeSearch(query.trim());
    return guards.filter((g) => {
      if (isDadoDeBaja(g)) return false;
      const matchesQuery = !q || normalizeSearch(guardFullName(g)).includes(q) || normalizeSearch(g.epi).includes(q) || normalizeSearch(g.ci).includes(q);
      const matchesOperational = operationalFilter === 'todos' || g.operationalStatus === operationalFilter;
      const matchesEpi = epiFilter === 'todos' || g.epi === epiFilter;
      return matchesQuery && matchesOperational && matchesEpi;
    });
  }, [guards, query, operationalFilter, epiFilter]);

  return (
    <PageContainer>
      <div className="col-span-12 mb-1 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-brand-navy-950">Guardias</h1>
          <p className="mt-0.5 text-sm text-neutral-text-muted">
            Personal de patrullaje activo por Estación Policial Integral
          </p>
        </div>
      </div>

      <div className="col-span-12 flex flex-wrap items-center gap-2.5">
        <div className="relative max-w-[320px] flex-1 basis-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-text-muted" aria-hidden="true" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nombre o EPI…"
            aria-label="Buscar por nombre o EPI"
            className="w-full rounded-md border border-neutral-border py-2 pl-9 pr-3 text-[12.5px] transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-600"
          />
        </div>

        <Select
          aria-label="Filtrar por estado operativo"
          value={operationalFilter}
          onChange={(event) => setOperationalFilter(event.target.value as OperationalStatus | 'todos')}
          className="w-auto"
        >
          <option value="todos">Todos los estados</option>
          {(Object.keys(OPERATIONAL_STATUS_LABELS) as OperationalStatus[]).map((key) => (
            <option key={key} value={key}>
              {OPERATIONAL_STATUS_LABELS[key]}
            </option>
          ))}
        </Select>

        <Select aria-label="Filtrar por zona" value={epiFilter} onChange={(e) => setEpiFilter(e.target.value as EpiZone | 'todos')} className="w-auto">
          <option value="todos">Todas las zonas</option>
          {(Object.keys(EPI_ZONE_LABELS) as EpiZone[]).map((z) => (
            <option key={z} value={z}>
              {EPI_ZONE_LABELS[z]}
            </option>
          ))}
        </Select>

        <div className="flex-1" />

        <ExportMenu onExportExcel={() => exportGuardiasExcel(filtered)} onExportPDF={() => exportPDF(guardiasToPrint(filtered))} disabled={filtered.length === 0} />
        <Button variant="secondary" onClick={() => setIsCatalogOpen(true)}>
          Ver Catálogo
        </Button>
      </div>

      <div className="col-span-12">
        <GuardTable
          guards={filtered}
          status={status}
          onRetry={loadGuards}
          onEdit={canEdit ? (guard) => setEditingGuard(guard) : undefined}
        />
      </div>

      {canEdit && (
        <GuardEditModal
          isOpen={Boolean(editingGuard)}
          onClose={() => setEditingGuard(null)}
          guard={editingGuard}
          onSaved={(updated) => {
            setGuards((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
            setEditingGuard(updated);
          }}
        />
      )}
      <GuardCatalogModal
        isOpen={isCatalogOpen}
        onClose={() => setIsCatalogOpen(false)}
        guards={guards}
        onEdit={
          canEdit
            ? (guard) => {
                setIsCatalogOpen(false);
                setEditingGuard(guard);
              }
            : undefined
        }
      />
    </PageContainer>
  );
}
