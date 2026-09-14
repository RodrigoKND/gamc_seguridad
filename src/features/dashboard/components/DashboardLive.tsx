'use client';

// El Dashboard se cargaba una sola vez en el servidor y quedaba estático
// hasta un refresh manual — un hecho nuevo, un cambio de estado de guardia o
// una alerta SOS atendida no se reflejaban solos. Este wrapper toma los
// datos iniciales (ya renderizados server-side, sin parpadeo al entrar) y
// los mantiene al día suscribiéndose al canal compartido de RealtimeProvider.

import { useRef, useState } from 'react';
import { ChartCard } from './ChartCard';
import { HechosPorDiaChart } from './HechosPorDiaChart';
import { HechosPorTipoChart } from './HechosPorTipoChart';
import { HechosPorZonaChart } from './HechosPorZonaChart';
import { KpiGrid } from './KpiGrid';
import { useRealtimeEvent } from '@/lib/realtime/RealtimeProvider';
import { REALTIME_EVENTS } from '@/lib/api/realtime';
import {
  getDashboardHechosPorDia,
  getDashboardHechosPorTipo,
  getDashboardHechosPorZona,
  getDashboardKpis,
} from '@/lib/data-source';
import type { HechoPorDiaPoint, HechoPorTipoItem, HechoPorZonaItem, KpiCardData } from '../types';

interface DashboardKpis {
  hechosHoy: number;
  hechosEnRevision: number;
  guardiasEnServicio: number;
  sosPendientes: number;
}

function buildKpiItems(kpis: DashboardKpis): KpiCardData[] {
  return [
    { id: 'hechos-hoy', label: 'Hechos Hoy', value: kpis.hechosHoy, periodLabel: 'Hoy' },
    { id: 'hechos-revision', label: 'En Revisión', value: kpis.hechosEnRevision, periodLabel: 'Pendientes de cierre' },
    { id: 'sos-pendientes', label: 'Alertas SOS', value: kpis.sosPendientes, periodLabel: 'Sin atender' },
    { id: 'guardias-servicio', label: 'Guardias Activos', value: kpis.guardiasEnServicio, periodLabel: 'En servicio' },
  ];
}

export interface DashboardLiveProps {
  initialKpis: DashboardKpis;
  initialHechosPorDia: HechoPorDiaPoint[];
  initialHechosPorTipo: HechoPorTipoItem[];
  initialHechosPorZona: HechoPorZonaItem[];
}

export function DashboardLive({ initialKpis, initialHechosPorDia, initialHechosPorTipo, initialHechosPorZona }: DashboardLiveProps) {
  const [kpis, setKpis] = useState(initialKpis);
  const [hechosPorDia, setHechosPorDia] = useState(initialHechosPorDia);
  const [hechosPorTipo, setHechosPorTipo] = useState(initialHechosPorTipo);
  const [hechosPorZona, setHechosPorZona] = useState(initialHechosPorZona);

  // Varios eventos pueden llegar juntos (ej. un hecho nuevo dispara
  // hecho:actualizado y guardia:estado casi a la vez) — se agrupan en una
  // sola recarga en vez de disparar 4 fetches por cada evento individual.
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  function scheduleRefresh() {
    if (pending.current) return;
    pending.current = setTimeout(() => {
      pending.current = null;
      Promise.all([
        getDashboardKpis(),
        getDashboardHechosPorDia(7),
        getDashboardHechosPorTipo(),
        getDashboardHechosPorZona(),
      ]).then(([k, d, t, z]) => {
        setKpis(k);
        setHechosPorDia(d);
        setHechosPorTipo(t);
        setHechosPorZona(z);
      });
    }, 500);
  }

  useRealtimeEvent(REALTIME_EVENTS.hechoActualizado, scheduleRefresh);
  useRealtimeEvent(REALTIME_EVENTS.guardiaEstado, scheduleRefresh);
  useRealtimeEvent(REALTIME_EVENTS.guardiaUbicacion, scheduleRefresh);
  useRealtimeEvent(REALTIME_EVENTS.sosNuevo, scheduleRefresh);

  return (
    <>
      <KpiGrid items={buildKpiItems(kpis)} status="ready" />

      <ChartCard title="Hechos por Día" subtitle="Últimos 7 días" status="ready" className="col-span-12">
        <HechosPorDiaChart data={hechosPorDia} />
      </ChartCard>

      <ChartCard title="Hechos por Tipo" status="ready" className="col-span-12 lg:col-span-6">
        <HechosPorTipoChart data={hechosPorTipo} />
      </ChartCard>

      <ChartCard title="Hechos por Zona" subtitle="Zonas EPI" status="ready" className="col-span-12 lg:col-span-6">
        <HechosPorZonaChart data={hechosPorZona} />
      </ChartCard>
    </>
  );
}
