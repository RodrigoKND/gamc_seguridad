'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Siren, MapPin, X } from 'lucide-react';
import { useRealtimeEvent } from '@/lib/realtime/RealtimeProvider';
import { REALTIME_EVENTS } from '@/lib/api/realtime';

interface SosGuard {
  guardiaId: string;
  guardiaNombre: string;
  lat: number;
  lng: number;
  direccion?: string | null;
}

export function GlobalSosBanner() {
  const router = useRouter();
  const [sosList, setSosList] = useState<SosGuard[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  async function loadSos() {
    try {
      const { getGuardMarkers } = await import('@/lib/data-source');
      const markers = await getGuardMarkers();
      const sos = markers
        .filter((m) => m.hasSos)
        .map((m) => ({
          guardiaId: m.id,
          guardiaNombre: m.nombre,
          lat: m.lat,
          lng: m.lng,
          direccion: m.ubicacionActual,
        }));
      setSosList(sos);
      // limpiar dismissed que ya no están en SOS
      setDismissedIds((prev) => {
        const next = new Set<string>();
        for (const id of prev) if (sos.some((s) => s.guardiaId === id)) next.add(id);
        return next;
      });
    } catch {}
  }

  useEffect(() => {
    loadSos();
    const iv = setInterval(loadSos, 30000);
    return () => clearInterval(iv);
  }, []);

  // guardiaUbicacion llega en CADA ping GPS de TODO el personal en
  // servicio (cada ~45-90s por guardia) — sin agrupar, este banner (más
  // el resto de listeners del mismo evento en toda la app) disparaba un
  // fetch por cada ping de cada guardia, aportando a la sensación de
  // "el sistema pide datos todo el tiempo". sosNuevo/guardiaEstado son
  // eventos poco frecuentes y urgentes — esos sí recargan al instante.
  const pendingUbicacion = useRef<ReturnType<typeof setTimeout> | null>(null);
  function loadSosDebounced() {
    if (pendingUbicacion.current) return;
    pendingUbicacion.current = setTimeout(() => {
      pendingUbicacion.current = null;
      loadSos();
    }, 4000);
  }

  useRealtimeEvent(REALTIME_EVENTS.sosNuevo, loadSos);
  useRealtimeEvent(REALTIME_EVENTS.guardiaEstado, loadSos);
  useRealtimeEvent(REALTIME_EVENTS.guardiaUbicacion, loadSosDebounced);

  const visible = sosList.filter((s) => !dismissedIds.has(s.guardiaId));
  if (visible.length === 0) return null;

  return (
    // F7 (2026-10-17): barra de tinta con filete rojo y sonar en el ícono, en
    // vez de una franja roja sólida — destaca igual sobre el fondo claro sin
    // "gritar"; el rojo queda en lo que importa (ícono, conteo, botones).
    // Fijo al desplazarse, justo debajo del Topbar (sticky top-3 + h-16 = 76 px, + 8 px de aire).
    <div className="sticky top-[84px] z-[1060] mx-3 animate-dropdown-in lg:mx-4">
      <div role="alert" className="flex flex-col gap-2 rounded-2xl border-l-4 border-risk-critical bg-primary-900 px-4 py-2.5 text-white shadow-[0_12px_30px_-14px_rgba(0,0,0,0.6)] md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-risk-critical" aria-hidden="true">
            <span className="absolute inset-0 animate-sos-ring rounded-full border-2 border-risk-critical motion-reduce:hidden" />
            <Siren className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-bold leading-tight">
              {visible.length === 1 ? 'SOS activo' : `${visible.length} SOS activos`}
              <span className="font-medium text-white/75"> · atención inmediata requerida</span>
            </p>
            <p className="text-xs leading-tight text-white/70">Toque un nombre para verlo en el mapa</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {visible.map((s) => (
            <button
              key={s.guardiaId}
              type="button"
              onClick={() => router.push(`/mapas?guardiaId=${s.guardiaId}`)}
              className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-risk-critical px-3 py-1 text-xs font-semibold text-white transition-colors duration-200 hover:bg-risk-critical-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary-900"
            >
              <MapPin className="h-3 w-3" aria-hidden="true" />
              {s.guardiaNombre}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setDismissedIds(new Set(visible.map((s) => s.guardiaId)))}
            aria-label="Ocultar aviso SOS"
            className="ml-1 cursor-pointer rounded-full p-1 text-white/70 transition-colors duration-200 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
