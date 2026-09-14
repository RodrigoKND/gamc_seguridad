'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { History, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { PageContainer } from '@/components/layout/PageContainer';
import { RISK_LEVEL_LABELS, RISK_LEVELS, type RiskLevel } from '@/types/risk';
import { getHechosActivos } from '@/lib/data-source';
import { canWrite } from '@/lib/permissions';
import { useRealtimeEvent } from '@/lib/realtime/RealtimeProvider';
import { REALTIME_EVENTS } from '@/lib/api/realtime';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
import type { AsyncStatus } from '@/features/dashboard/types';
import { exportExcel } from '@/features/reportes/actions/exportExcel';
import { normalizeSearch } from '@/lib/text';
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

export function HechosView() {
  const { user } = useAuthSession();
  const canEditEstado = user ? canWrite(user.role, 'hechos') : false;
  const searchParams = useSearchParams();

  const [hechos, setHechos] = useState<Hecho[]>([]);
  const [status, setStatus] = useState<AsyncStatus>('loading');
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const [estadoFilter, setEstadoFilter] = useState<HechoEstado | 'todos'>('todos');
  const [severidadFilter, setSeveridadFilter] = useState<RiskLevel | 'todos'>('todos');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function loadHechos() {
    setStatus('loading');
    getHechosActivos()
      .then((data) => {
        setHechos(data);
        setStatus(data.length === 0 ? 'empty' : 'ready');
      })
      .catch(() => setStatus('error'));
  }

  useEffect(loadHechos, []);
  useEffect(() => {
    const q = searchParams.get('q');
    if (q !== null) setQuery(q);
  }, [searchParams]);

  // Un hecho nuevo reportado desde el móvil (o un cambio de estado hecho
  // por otro operador) llega por socket.io — recarga silenciosa, sin pasar
  // por 'loading' para no parpadear la tabla ya poblada.
  const pendingRefresh = useRef<ReturnType<typeof setTimeout> | null>(null);
  useRealtimeEvent(REALTIME_EVENTS.hechoActualizado, () => {
    if (pendingRefresh.current) return;
    pendingRefresh.current = setTimeout(() => {
      pendingRefresh.current = null;
      getHechosActivos()
        .then((data) => {
          setHechos(data);
          setStatus((prev) => (prev === 'loading' ? (data.length === 0 ? 'empty' : 'ready') : prev));
        })
        .catch(() => {});
    }, 500);
  });

  const filtered = useMemo(() => {
    const q = normalizeSearch(query.trim());
    return hechos.filter((h) => {
      const matchesQuery = !q || normalizeSearch(h.id).includes(q) || normalizeSearch(h.ubicacion).includes(q);
      const matchesEstado = estadoFilter === 'todos' || h.estado === estadoFilter;
      const matchesSeveridad = severidadFilter === 'todos' || h.severidad === severidadFilter;
      return matchesQuery && matchesEstado && matchesSeveridad;
    });
  }, [hechos, query, estadoFilter, severidadFilter]);

  const selected = hechos.find((h) => h.id === selectedId) ?? null;

  async function handleEstadoChange(id: string, estado: HechoEstado) {
    const previous = hechos;
    setHechos((prev) => prev.map((h) => (h.id === id ? { ...h, estado } : h)));

    const result = await updateHechoEstadoAction(id, estado);
    if (!result.success) {
      setHechos(previous); // el Server Action rechazó el cambio — revierte la UI optimista
    }
  }

  return (
    <PageContainer>
      <div className="col-span-12 mb-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-4xl font-bold text-brand-navy-950">Reportes</h1>
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
            className="w-full rounded-md border border-neutral-border py-2 pl-9 pr-3 text-[12.5px] transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-600"
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

        <ExportMenu onExportExcel={() => exportExcel(filtered)} onExportPDF={() => exportPDF(hechosToPrint(filtered))} disabled={filtered.length === 0} />
      </div>

      <div className="col-span-12">
        <IncidentTable hechos={filtered} status={status} onRetry={loadHechos} onSelect={(hecho) => setSelectedId(hecho.id)} />
      </div>

      <IncidentDetailDrawer
        hecho={selected}
        onClose={() => setSelectedId(null)}
        onEstadoChange={canEditEstado ? handleEstadoChange : undefined}
      />
    </PageContainer>
  );
}
