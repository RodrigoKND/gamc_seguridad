'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { Pagination } from '@/components/ui/Pagination';
import { PageContainer } from '@/components/layout/PageContainer';
import { getGuardias, getGuardiasPage } from '@/lib/data-source';
import { canWrite } from '@/lib/permissions';
import { useRealtimeEvent } from '@/lib/realtime/RealtimeProvider';
import { REALTIME_EVENTS } from '@/lib/api/realtime';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
import { exportPDF, guardiasToPrint } from '@/features/reportes/actions/exportPDF';
import type { AsyncStatus } from '@/features/dashboard/types';
import type { EpiZone } from '@/types/epi';
import { useEpiCatalogo } from '@/lib/epis/EpiCatalogProvider';
import { OPERATIONAL_STATUS_LABELS, type Guard, type OperationalStatus } from '../types';
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
//
// Paginación real por servidor (2026-09-19: "falta paginación... tardan
// demasiado"): la tabla ya no trae la base completa de guardias en cada
// carga — pide solo la página actual con el filtro/búsqueda aplicado en
// el backend (que además ya ordena en_servicio/emergencia primero, ver
// guardias.service.ts). El Catálogo y la Exportación sí necesitan el
// universo completo — se piden aparte, al vuelo, no en cada render de la
// tabla.

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

export function GuardiasView() {
  const { user } = useAuthSession();
  const canEdit = user ? canWrite(user.role, 'guardias') : false;
  const searchParams = useSearchParams();

  const [rows, setRows] = useState<Guard[]>([]);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState<AsyncStatus>('loading');
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [operationalFilter, setOperationalFilter] = useState<OperationalStatus | 'todos'>('todos');
  const [epiFilter, setEpiFilter] = useState<EpiZone | 'todos'>('todos');
  const { epis, nombre: nombreEpi } = useEpiCatalogo();
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [catalogGuards, setCatalogGuards] = useState<Guard[]>([]);
  const [editingGuard, setEditingGuard] = useState<Guard | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q !== null) setQuery(q);
  }, [searchParams]);

  // Debounce de la búsqueda: cada tecla no debe disparar un fetch propio.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  // Resetear a la página 1 cuando cambia el filtro/búsqueda — si no, se
  // puede quedar en una página que ya no existe para el nuevo resultado.
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, operationalFilter, epiFilter]);

  function currentFilters() {
    return {
      q: debouncedQuery.trim() || undefined,
      estadoOperativo: operationalFilter === 'todos' ? undefined : operationalFilter,
      epiCodigo: epiFilter === 'todos' ? undefined : epiFilter,
    };
  }

  function load(quiet = false) {
    if (!quiet) setStatus('loading');
    getGuardiasPage({ page, pageSize: PAGE_SIZE, ...currentFilters() })
      .then(({ rows: data, total: t }) => {
        setRows(data);
        setTotal(t);
        setStatus((prev) => (quiet && prev !== 'loading' ? prev : t === 0 ? 'empty' : 'ready'));
      })
      .catch(() => setStatus('error'));
  }

  useEffect(load, [page, debouncedQuery, operationalFilter, epiFilter]);

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
      load(true);
    }, 800);
  }
  useRealtimeEvent(REALTIME_EVENTS.guardiaEstado, scheduleQuietRefresh);
  useRealtimeEvent(REALTIME_EVENTS.guardiaUbicacion, scheduleQuietRefresh);

  // El Catálogo es un directorio buscable de TODOS los guardias (no solo
  // la página actual) — se carga bajo demanda, solo cuando el Operador
  // realmente lo abre, no en cada visita a /guardias.
  function openCatalog() {
    setIsCatalogOpen(true);
    getGuardias().then(setCatalogGuards).catch(() => {});
  }

  // La exportación también es sobre TODO lo que matchea el filtro actual,
  // no solo la página visible — se pide aparte al momento de exportar.
  async function exportAllFiltered(): Promise<Guard[]> {
    const { rows: all } = await getGuardiasPage({ page: 1, pageSize: 500, ...currentFilters() });
    return all;
  }

  return (
    <PageContainer>
      <div className="col-span-12 mb-1 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-primary-900">Guardias</h1>
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
            className="w-full rounded-md border border-neutral-border py-2 pl-9 pr-3 text-[12.5px] transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-700"
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
          {epis.map((e) => (
            <option key={e.codigo} value={e.codigo}>
              {e.nombre}{e.operativa ? '' : ' (histórica)'}
            </option>
          ))}
        </Select>

        <div className="flex-1" />

        <ExportMenu
          onExportExcel={() => exportAllFiltered().then((all) => exportGuardiasExcel(all, undefined, nombreEpi))}
          onExportPDF={() => exportAllFiltered().then((all) => exportPDF(guardiasToPrint(all, nombreEpi)))}
          disabled={total === 0}
        />
        <Button variant="secondary" onClick={openCatalog}>
          Ver Catálogo
        </Button>
      </div>

      <div className="col-span-12">
        <GuardTable
          guards={rows}
          status={status}
          onRetry={() => load()}
          onEdit={canEdit ? (guard) => setEditingGuard(guard) : undefined}
        />
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </div>

      {canEdit && (
        <GuardEditModal
          isOpen={Boolean(editingGuard)}
          onClose={() => setEditingGuard(null)}
          guard={editingGuard}
          onSaved={(updated) => {
            setRows((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
            setCatalogGuards((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
            setEditingGuard(updated);
          }}
        />
      )}
      <GuardCatalogModal
        isOpen={isCatalogOpen}
        onClose={() => setIsCatalogOpen(false)}
        guards={catalogGuards}
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
