'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHeader } from '@/components/layout/PageHeader';
import { KpiGrid } from './KpiGrid';
import { ChartCard } from './ChartCard';
import { HechosPorDiaChart } from './HechosPorDiaChart';
import { HechosPorTipoChart } from './HechosPorTipoChart';
import { HechosPorZonaChart } from './HechosPorZonaChart';
import { AccessDeniedBanner } from './AccessDeniedBanner';
import { DashboardDetailDrawer, type DetailData } from './DashboardDetailDrawer';
import { getDashboardHechosPorDia, getDashboardHechosPorTipo, getDashboardHechosPorZona, getDashboardKpis, getHechosActivos, getGuardias } from '@/lib/data-source';
import { useRealtimeEvent } from '@/lib/realtime/RealtimeProvider';
import { REALTIME_EVENTS } from '@/lib/api/realtime';
import type { HechoPorDiaPoint, HechoPorTipoItem, HechoPorZonaItem, KpiCardData } from '../types';

function buildKpiItems(kpis: { hechosHoy: number; hechosEnRevision: number; guardiasEnServicio: number; sosPendientes: number }): KpiCardData[] {
  return [
    { id: 'hechos-hoy', label: 'Hechos Hoy', value: kpis.hechosHoy, periodLabel: 'Hoy' },
    { id: 'hechos-revision', label: 'En Revisión', value: kpis.hechosEnRevision, periodLabel: 'Pendientes de cierre' },
    { id: 'sos-pendientes', label: 'Alertas SOS', value: kpis.sosPendientes, periodLabel: 'Sin atender' },
    { id: 'guardias-servicio', label: 'Guardias Activos', value: kpis.guardiasEnServicio, periodLabel: 'En servicio' },
  ];
}

export function DashboardClient({ denied }: { denied?: string }) {
  const router = useRouter();
  const [kpis, setKpis] = useState<{ hechosHoy: number; hechosEnRevision: number; guardiasEnServicio: number; sosPendientes: number } | null>(null);
  const [hechosPorDia, setHechosPorDia] = useState<HechoPorDiaPoint[]>([]);
  const [hechosPorTipo, setHechosPorTipo] = useState<HechoPorTipoItem[]>([]);
  const [hechosPorZona, setHechosPorZona] = useState<HechoPorZonaItem[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [detail, setDetail] = useState<DetailData | null>(null);

  async function load() {
    try {
      const [k, dia, tipo, zona] = await Promise.all([getDashboardKpis(), getDashboardHechosPorDia(7), getDashboardHechosPorTipo(), getDashboardHechosPorZona()]);
      setKpis(k); setHechosPorDia(dia); setHechosPorTipo(tipo); setHechosPorZona(zona); setStatus('ready');
    } catch { setStatus('error'); }
  }

  function isToday(timestamp: string): boolean {
    // timestamp es "DD/MM/YYYY HH:mm"
    const [datePart] = timestamp.split(' ');
    const [dd, mm, yyyy] = datePart.split('/').map(Number);
    const d = new Date(yyyy, mm - 1, dd);
    const now = new Date();
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }

  async function handleKpiClick(id: string) {
    try {
      if (id === 'hechos-hoy') {
        const hechos = await getHechosActivos();
        const filtered = hechos.filter((h) => isToday(h.timestamp));
        setDetail({ title: 'Hechos de hoy', subtitle: `${filtered.length} reportes de hoy`, hechos: filtered });
      } else if (id === 'hechos-revision') {
        const hechos = await getHechosActivos();
        const filtered = hechos.filter((h) => h.estado === 'en_proceso');
        setDetail({ title: 'En revisión', subtitle: `${filtered.length} pendientes de cierre`, hechos: filtered });
      } else if (id === 'sos-pendientes') {
        const guards = await getGuardias();
        const filtered = guards.filter((g) => g.operationalStatus === 'emergencia');
        setDetail({ title: 'Alertas SOS', subtitle: `${filtered.length} guardias en emergencia`, guards: filtered });
      } else if (id === 'guardias-servicio') {
        const guards = await getGuardias();
        const filtered = guards.filter((g) => g.operationalStatus === 'en_servicio');
        setDetail({ title: 'Guardias activos', subtitle: `${filtered.length} en servicio`, guards: filtered });
      }
    } catch {
      if (id === 'sos-pendientes') router.push('/mapas');
      else if (id.startsWith('guardias')) router.push('/guardias');
      else router.push('/hechos');
    }
  }

  async function handleDiaSelect(point: HechoPorDiaPoint) {
    const hechos = await getHechosActivos().catch(() => []);
    // filtra exacto por fecha YYYY-MM-DD usando rawDia
    const filtered = hechos.filter((h) => {
      const [datePart] = h.timestamp.split(' ');
      const [dd, mm, yyyy] = datePart.split('/').map(Number);
      const iso = `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
      return iso === point.rawDia;
    });
    setDetail({ title: `Hechos del ${point.day} (${point.rawDia})`, subtitle: `${filtered.length} reportes — esperado ${point.total}`, hechos: filtered });
  }

  async function handleTipoSelect(item: HechoPorTipoItem) {
    const hechos = await getHechosActivos().catch(() => []);
    const filtered = hechos.filter((h) => h.tipo.toLowerCase() === item.tipo.toLowerCase());
    setDetail({ title: `Tipo: ${item.tipo}`, subtitle: `${filtered.length} hechos`, hechos: filtered });
  }

  async function handleZonaSelect(item: HechoPorZonaItem) {
    const hechos = await getHechosActivos().catch(() => []);
    const filtered = hechos.filter((h) => h.epi === item.zone);
    setDetail({ title: `Zona: ${item.zone}`, subtitle: `${filtered.length} hechos`, hechos: filtered });
  }

  useEffect(() => { load(); }, []);
  // Respaldo por si el socket compartido (RealtimeProvider) no está
  // disponible (API caído, red bloqueada) — el push en vivo de abajo es la
  // vía normal, este intervalo es solo la red de seguridad. Antes 30s, ahora 60s para no saturar KPIs.
  useEffect(() => {
    const iv = setInterval(load, 60000);
    return () => clearInterval(iv);
  }, []);

  const lastUbicacionRef = useRef(0);
  const debouncedLoad = useCallback(() => {
    const now = Date.now();
    if (now - lastUbicacionRef.current < 5000) return;
    lastUbicacionRef.current = now;
    load();
  }, []);

  useRealtimeEvent(REALTIME_EVENTS.hechoActualizado, load);
  useRealtimeEvent(REALTIME_EVENTS.guardiaEstado, load);
  useRealtimeEvent(REALTIME_EVENTS.sosNuevo, load);
  useRealtimeEvent(REALTIME_EVENTS.guardiaUbicacion, debouncedLoad);

  return (
    <PageContainer>
      {denied && <AccessDeniedBanner deniedPath={denied} />}
      <PageHeader title="Dashboard" />
      <KpiGrid items={kpis ? buildKpiItems(kpis) : []} status={status === 'ready' ? 'ready' : status} onSelect={handleKpiClick} />
      <ChartCard title="Hechos por Día" subtitle="Últimos 7 días — toca un punto para ver detalle" status={status} className="col-span-12">
        <HechosPorDiaChart data={hechosPorDia} onSelect={handleDiaSelect} />
      </ChartCard>
      <ChartCard title="Hechos por Tipo — toca una barra" status={status} className="col-span-12 lg:col-span-6">
        <HechosPorTipoChart data={hechosPorTipo} onSelect={handleTipoSelect} />
      </ChartCard>
      <ChartCard title="Hechos por Zona — toca una barra" subtitle="Zonas EPI" status={status} className="col-span-12 lg:col-span-6">
        <HechosPorZonaChart data={hechosPorZona} onSelect={handleZonaSelect} />
      </ChartCard>
      <DashboardDetailDrawer data={detail} onClose={() => setDetail(null)} />
    </PageContainer>
  );
}
