'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ExportMenu } from '@/components/ui/ExportMenu';
import { PageContainer } from '@/components/layout/PageContainer';
import { getHechosActivos } from '@/lib/data-source';
import { useRealtimeEvent } from '@/lib/realtime/RealtimeProvider';
import { REALTIME_EVENTS } from '@/lib/api/realtime';
import type { Hecho } from '@/features/hechos/types';
import { exportExcel } from '../actions/exportExcel';
import { exportPDF, hechosToPrint } from '../actions/exportPDF';
import type { ReportFilters } from '../types';
import { ExportFiltersBar } from './ExportFilters';
import { ReportTable } from './ReportTable';

// RF-XX Exportación de Reportes (MASTER.md sección 7.3 y 12). Datos desde
// el adaptador (lib/data-source.ts) — reemplaza el import directo de
// SAMPLE_HECHOS (MASTER.md sección 13, instrucción 10).
//
// Historial = archivo completo filtrable/exportable de la bitácora (vs.
// /hechos, que son los reportes del día con acción sobre el estado).

// hecho.timestamp es "DD/MM/AAAA HH:mm" — <input type="date"> entrega
// "AAAA-MM-DD". Se normaliza a "AAAA-MM-DD" para poder comparar como texto.
function toIsoDateKey(timestamp: string): string {
  const [datePart] = timestamp.split(' ');
  const [dd, mm, yyyy] = datePart.split('/');
  return `${yyyy}-${mm}-${dd}`;
}

export function ReportesView() {
  const [hechos, setHechos] = useState<Hecho[]>([]);
  const [filters, setFilters] = useState<ReportFilters>({ from: '', to: '', epi: 'todos', tipo: 'todos' });
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  function load() {
    setStatus('loading');
    setErrorMsg(null);
    getHechosActivos()
      .then((data) => {
        setHechos(data);
        setStatus('ready');
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Error de conexión con el API. Verifica que el backend esté en http://localhost:4000';
        setErrorMsg(msg);
        setStatus('error');
        console.error('[ReportesView] getHechosActivos failed', err);
      });
  }

  useEffect(load, []);

  // Tiempo real: recarga cuando se reporta un hecho nuevo o cambia de
  // estado — mismo socket compartido del layout (RealtimeProvider), nunca
  // pasa por 'loading' para no perder los filtros/scroll ya aplicados.
  useRealtimeEvent(REALTIME_EVENTS.hechoActualizado, () => {
    getHechosActivos()
      .then((data) => setHechos(data))
      .catch(() => {});
  });

  const tipos = useMemo(() => Array.from(new Set(hechos.map((h) => h.tipo))), [hechos]);

  const filtered = useMemo(() => {
    return hechos.filter((h) => {
      let dateKey = '';
      try { dateKey = toIsoDateKey(h.timestamp); } catch { dateKey = ''; }
      const matchesFrom = !filters.from || !dateKey || dateKey >= filters.from;
      const matchesTo = !filters.to || !dateKey || dateKey <= filters.to;
      const matchesEpi = filters.epi === 'todos' || h.epi === filters.epi;
      // tipo case-insensitive para evitar "Robo" vs "robo"
      const matchesTipo = filters.tipo === 'todos' || h.tipo.toLowerCase() === filters.tipo.toLowerCase();
      return matchesFrom && matchesTo && matchesEpi && matchesTipo;
    });
  }, [hechos, filters]);

  return (
    <PageContainer>
      <div className="col-span-12 mb-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-4xl font-bold text-brand-navy-950">Historial</h1>
          <p className="mt-0.5 text-sm text-neutral-text-muted">
            Archivo completo de reportes para exportación y reportería institucional
          </p>
        </div>
        <Link href="/hechos">
          <Button variant="secondary">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Volver
          </Button>
        </Link>
      </div>

      <div className="col-span-12">
        <ExportFiltersBar value={filters} onChange={setFilters} tipos={tipos} />
      </div>

      <div className="col-span-12 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-neutral-text-muted">{filtered.length} resultado(s) para exportar</p>
        <ExportMenu onExportExcel={() => exportExcel(filtered)} onExportPDF={() => exportPDF(hechosToPrint(filtered))} disabled={filtered.length === 0} />
      </div>

      <div className="col-span-12">
        {status === 'loading' && <p className="py-10 text-center text-sm text-neutral-text-muted">Cargando bitácora…</p>}
        {status === 'error' && (
          <div className="rounded-xl border border-risk-critical/20 bg-risk-critical/10 p-4 text-center">
            <p className="text-sm font-medium text-risk-critical">No se pudo cargar la bitácora</p>
            {errorMsg && <p className="mx-auto mt-1 max-w-xl text-xs text-risk-critical/80">{errorMsg}</p>}
            <p className="mt-1 text-xs text-neutral-text-muted">Verifica: 1) backend en :4000, 2) sesión activa (vuelve a loguearte), 3) consola (F12) para detalles</p>
            <button type="button" onClick={load} className="mt-2 text-xs font-semibold text-risk-critical underline">Reintentar</button>
          </div>
        )}
        {status === 'ready' && <ReportTable rows={filtered} />}
      </div>
    </PageContainer>
  );
}
