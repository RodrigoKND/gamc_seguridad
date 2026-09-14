'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, MapPin, X } from 'lucide-react';
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

  useRealtimeEvent(REALTIME_EVENTS.sosNuevo, loadSos);
  useRealtimeEvent(REALTIME_EVENTS.guardiaEstado, loadSos);

  const visible = sosList.filter((s) => !dismissedIds.has(s.guardiaId));
  if (visible.length === 0) return null;

  return (
    <div className="sticky top-0 z-[1060] animate-fade-in">
      <div className="flex flex-col gap-1 bg-risk-critical px-4 py-2.5 text-white shadow-md md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 animate-pulse">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-bold leading-tight">
              {visible.length === 1 ? '¡SOS ACTIVO!' : `¡${visible.length} SOS ACTIVOS!`} Atención inmediata requerida
            </p>
            <p className="text-xs opacity-90 leading-tight">
              {visible.map((s) => s.guardiaNombre).join(', ')} — toque para ver en el mapa
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {visible.map((s) => (
            <button
              key={s.guardiaId}
              type="button"
              onClick={() => router.push(`/mapas?guardiaId=${s.guardiaId}`)}
              className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-risk-critical shadow hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <MapPin className="h-3 w-3" aria-hidden="true" />
              {s.guardiaNombre}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setDismissedIds(new Set(visible.map((s) => s.guardiaId)))}
            aria-label="Ocultar aviso SOS"
            className="ml-1 rounded-full p-1 hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
