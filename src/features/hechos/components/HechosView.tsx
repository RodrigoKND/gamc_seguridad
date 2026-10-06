'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { History, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { Pagination } from '@/components/ui/Pagination';
import { PageContainer } from '@/components/layout/PageContainer';
import { RISK_LEVEL_LABELS, RISK_LEVELS, type RiskLevel } from '@/types/risk';
import { getHechosPage, getMandados, type Mandado } from '@/lib/data-source';
import { canWrite } from '@/lib/permissions';
import { useRealtimeEvent } from '@/lib/realtime/RealtimeProvider';
import { REALTIME_EVENTS } from '@/lib/api/realtime';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
import type { AsyncStatus } from '@/features/dashboard/types';
import { exportExcel } from '@/features/reportes/actions/exportExcel';
import { exportPDF, hechosToPrint } from '@/features/reportes/actions/exportPDF';
import { HECHO_ESTADOS, HECHO_ESTADO_LABELS, type Hecho, type HechoEstado } from '../types';
import { updateHechoEstadoAction } from '../actions/updateEstado';
import { IncidentTable } from './IncidentTable';
import { IncidentDetailDrawer } from './IncidentDetailDrawer';

// RF-G3-02 a 08, RF-10 (MASTER.md sección 7.3, 13.5, 15.1). Datos desde el
// adaptador (lib/data-source.ts) — reemplaza el import directo de
// sampleData.ts (MASTER.md sección 13, instrucción 10). El cambio de
// estado pasa por un Server Action que revalida el rol (sección 15.5).
//
// Esta es la primera pantalla del módulo: los reportes que van entrando el
// día de hoy desde los guardias, con acción sobre el estado. La segunda
// pantalla (/reportes, botón "Historial") es el archivo histórico
// filtrable para exportación — no un ítem de nav aparte, la sección 7.2
// funde ambos bajo un solo ítem de sidebar ("Reporte").
//
// Paginación real por servidor (2026-09-19: "falta paginación... tardan
// demasiado"): igual que Guardias, esta tabla pide solo la página actual
// con el filtro/búsqueda aplicado en el backend en vez de traer toda la
// bitácora para filtrar/paginar en el navegador.

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 350;

export function HechosView() {
  const { user } = useAuthSession();
  const canEditEstado = user ? canWrite(user.role, 'hechos') : false;
  const searchParams = useSearchParams();

  const [rows, setRows] = useState<Hecho[]>([]);
  const [total, setTotal] = useState(0);
  const [mandados, setMandados] = useState<Mandado[]>([]);
  const [status, setStatus] = useState<AsyncStatus>('loading');
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [estadoFilter, setEstadoFilter] = useState<HechoEstado | 'todos'>('todos');
  const [severidadFilter, setSeveridadFilter] = useState<RiskLevel | 'todos'>('todos');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q !== null) setQuery(q);
  }, [searchParams]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, estadoFilter, severidadFilter]);

  function currentFilters() {
    return {
      q: debouncedQuery.trim() || undefined,
      estado: estadoFilter === 'todos' ? undefined : estadoFilter,
      nivelRiesgo: severidadFilter === 'todos' ? undefined : severidadFilter,
    };
  }

  function load(quiet = false) {
    if (!quiet) setStatus('loading');
    Promise.all([
      getHechosPage({ page, pageSize: PAGE_SIZE, ...currentFilters() }),
      getMandados(20).catch(() => [] as Mandado[]),
    ])
      .then(([{ rows: data, total: t }, mands]) => {
        setRows(data);
        setTotal(t);
        setMandados(mands);
        setStatus((prev) => (quiet && prev !== 'loading' ? prev : t === 0 && mands.length === 0 ? 'empty' : 'ready'));
      })
      .catch(() => setStatus('error'));
  }

  useEffect(load, [page, debouncedQuery, estadoFilter, severidadFilter]);

  // Un hecho nuevo reportado desde el móvil (o un cambio de estado hecho
  // por otro operador) llega por socket.io — recarga silenciosa, sin pasar
  // por 'loading' para no parpadear la tabla ya poblada.
  const pendingRefresh = useRef<ReturnType<typeof setTimeout> | null>(null);
  useRealtimeEvent(REALTIME_EVENTS.hechoActualizado, () => {
    if (pendingRefresh.current) return;
    pendingRefresh.current = setTimeout(() => {
      pendingRefresh.current = null;
      load(true);
    }, 500);
  });
  useRealtimeEvent(REALTIME_EVENTS.mandadoNuevo, () => load(true));

  const selected = rows.find((h) => h.id === selectedId) ?? null;

  async function handleEstadoChange(id: string, estado: HechoEstado) {
    const previous = rows;
    setRows((prev) => prev.map((h) => (h.id === id ? { ...h, estado } : h)));

    const result = await updateHechoEstadoAction(id, estado);
    if (!result.success) {
      setRows(previous); // el Server Action rechazó el cambio — revierte la UI optimista
    }
  }

  // Exportar es sobre TODO lo que matchea el filtro actual, no solo la
  // página visible — se pide aparte al momento de exportar.
  async function exportAllFiltered(): Promise<Hecho[]> {
    const { rows: all } = await getHechosPage({ page: 1, pageSize: 500, ...currentFilters() });
    return all;
  }

  return (
    <PageContainer>
      <div className="col-span-12 mb-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-4xl font-bold text-primary-900">Reportes</h1>
          <p className="mt-0.5 text-sm text-neutral-text-muted">
            Reportes enviados por los guardias de campo, con acción sobre su estado
          </p>
        </div>
        <Link href="/reportes">
          <Button variant="secondary">
            <History className="h-3.5 w-3.5" aria-hidden="true" />
            Historial
          </Button>
        </Link>
      </div>

      <div className="col-span-12 flex flex-wrap items-center gap-2.5">
        <div className="relative max-w-[320px] flex-1 basis-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-text-muted" aria-hidden="true" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por código o dirección…"
            aria-label="Buscar por código o dirección"
            className="w-full rounded-md border border-neutral-border py-2 pl-9 pr-3 text-[12.5px] transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-700"
          />
        </div>

        <Select aria-label="Filtrar por estado" value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value as HechoEstado | 'todos')} className="w-auto">
          <option value="todos">Todos los estados</option>
          {HECHO_ESTADOS.map((estado) => (
            <option key={estado} value={estado}>
              {HECHO_ESTADO_LABELS[estado]}
            </option>
          ))}
        </Select>

        <Select aria-label="Filtrar por severidad" value={severidadFilter} onChange={(e) => setSeveridadFilter(e.target.value as RiskLevel | 'todos')} className="w-auto">
          <option value="todos">Toda severidad</option>
          {RISK_LEVELS.map((level) => (
            <option key={level} value={level}>
              {RISK_LEVEL_LABELS[level]}
            </option>
          ))}
        </Select>

        <div className="flex-1" />

        <ExportMenu
          onExportExcel={() => exportAllFiltered().then(exportExcel)}
          onExportPDF={() => exportAllFiltered().then((all) => exportPDF(hechosToPrint(all)))}
          disabled={total === 0}
        />
      </div>

      <div className="col-span-12">
        <IncidentTable hechos={rows} status={status} onRetry={() => load()} onSelect={(hecho) => setSelectedId(hecho.id)} />
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </div>

      {mandados.length > 0 && (
        <div className="col-span-12 mt-2 rounded-xl border border-neutral-border bg-white shadow-sm">
          <div className="border-b border-neutral-border px-4 py-3">
            <h2 className="text-sm font-semibold text-neutral-text">Tareas / Mandados de guardias</h2>
            <p className="text-xs text-neutral-text-muted">Comisiones puntuales enviadas desde la app móvil (visible en tiempo real)</p>
          </div>
          <ul className="divide-y divide-neutral-border">
            {mandados.map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-text">{m.descripcion}</p>
                  <p className="text-xs text-neutral-text-muted">{m.guardiaNombre ?? m.guardiaId} — {new Date(m.creadoEn).toLocaleString('es-BO')} — {m.lat.toFixed(4)}, {m.lng.toFixed(4)}</p>
                </div>
                <a href={`https://www.google.com/maps?q=${m.lat},${m.lng}`} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-md border border-primary-300 px-2.5 py-1 text-xs font-semibold text-primary-800 transition-colors duration-200 hover:border-primary-700 hover:bg-primary-700 hover:text-white">Ver en mapa</a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <IncidentDetailDrawer
        hecho={selected}
        onClose={() => setSelectedId(null)}
        onEstadoChange={canEditEstado ? handleEstadoChange : undefined}
      />
    </PageContainer>
  );
}
