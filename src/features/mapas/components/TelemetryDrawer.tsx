'use client';

import { useEffect, useState } from 'react';
import { BatteryMedium, CheckCircle2, Clock, MapPin, Radio, Route, Users } from 'lucide-react';
import { Drawer } from '@/components/ui/Drawer';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ImageLightbox } from '@/components/ui/ImageLightbox';
import { OPERATIONAL_STATUS_BADGE_CLASS, OPERATIONAL_STATUS_LABELS } from '@/features/guardias/types';
import { EPI_ZONE_LABELS } from '@/types/epi';
import { useRelativeTime } from '@/lib/hooks/useRelativeTime';
import type { GuardMarker } from '../types';
import type { PatrullaRow } from '@/types/patrulla';
import type { RouteGroup } from '../lib/routeGroups';

// RF-G3-09/10 (MASTER.md sección 7.3, 9 y 13.3): nombre, badge operativo,
// ubicación en lenguaje natural, hora inicio/fin de turno, batería, último
// ping GPS. Header completo en rojo pulsante si emergencia — no solo un
// ícono aislado (MASTER.md sección 9 y 10).
//
// Bug reportado tras la defensa: "Asignar Ruta" ya NO se muestra si el
// guardia está en SOS o fuera de servicio (assignRoute.ts repite la misma
// regla en el servidor). En SOS aparece en su lugar "Marcar como resuelto",
// que llama a onClearSos — cambia el estado operativo real, no solo la
// vista. Al confirmar se cierra todo el desplegable (onClose, vía el
// `onClearSos` del padre) en vez de dejar el botón desapareciendo solo,
// para que el cambio no se sienta brusco.
//
// Bug 2026-09-13: `isSos` comparaba solo `operationalStatus === 'emergencia'`,
// mientras que el pin del mapa (`GuardMarker.hasSos`, ver data-source.ts
// getGuardMarkers) se pinta en rojo con `esSos || estadoOperativo ===
// 'emergencia'` — dos condiciones distintas para "¿está en SOS?". Cuando
// alguien corregía el estado operativo del guardia directo en la BD (sin
// pasar por "Marcar como resuelto") el pin seguía rojo (esSos seguía true)
// pero el desplegable ya no mostraba el botón para resolverlo, dejando al
// guardia sin forma de salir de ese estado desde la UI. Ahora ambos usan la
// misma fuente de verdad: `guard.hasSos`.

export interface TelemetryDrawerProps {
  guard: GuardMarker | null;
  onClose: () => void;
  onAssignRoute?: (guardId: string) => void;
  onClearSos?: (guardId: string) => Promise<boolean>;
  patrullas?: PatrullaRow[];
  routeGroups?: RouteGroup[];
}

function RouteStreets({ path }: { path: { lat: number; lng: number }[] }) {
  const [streets, setStreets] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!path || path.length < 2) {
      setStreets(null);
      return;
    }
    // Muestreo: inicio, 1/3, 2/3 y fin — no pide 100 reversas si la ruta es larga (OSRM).
    const idxs = [0, Math.floor(path.length / 3), Math.floor((2 * path.length) / 3), path.length - 1].filter((v, i, a) => a.indexOf(v) === i);
    const sampled = idxs.map((i) => path[i]!).slice(0, 4);
    let cancelled = false;
    setLoading(true);
    Promise.all(
      sampled.map(async (p) => {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${p.lat}&lon=${p.lng}&zoom=16&addressdetails=1`, {
            headers: { 'Accept-Language': 'es' },
          });
          const data = await res.json();
          const addr = data.address ?? {};
          const road = addr.road || addr.pedestrian || addr.footway || addr.neighbourhood || addr.suburb || '';
          const city = addr.city || addr.town || addr.village || '';
          if (road) return city ? `${road}, ${city}` : road;
          return data.display_name?.split(',').slice(0, 2).join(',').trim() || `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`;
        } catch {
          return `${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`;
        }
      }),
    ).then((names) => {
      if (!cancelled) {
        // Deduplica calles consecutivas iguales
        const dedup: string[] = [];
        for (const n of names) if (dedup[dedup.length - 1] !== n) dedup.push(n);
        setStreets(dedup);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [path]);
  if (!path || path.length < 2) return null;
  if (loading) return <p className="text-[11.5px] text-neutral-text-muted">Resolviendo calles…</p>;
  if (!streets || streets.length === 0) return null;
  return (
    <ol className="flex flex-col">
      {streets.map((s, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="flex flex-col items-center">
            <span className="h-2 w-2 shrink-0 rounded-full bg-brand-gold-600" />
            {i < streets.length - 1 && <span className="w-px flex-1 bg-neutral-border" />}
          </span>
          <div className="pb-3">
            <p className="text-[12.5px] text-neutral-text">{s}</p>
            <p className="text-[11px] text-neutral-text-muted">Punto {i + 1} de la ruta</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function TelemetryDrawer({ guard, onClose, onAssignRoute, onClearSos, patrullas = [], routeGroups = [] }: TelemetryDrawerProps) {
  const isSos = guard?.hasSos === true;
  const isOffDuty = guard?.operationalStatus === 'fuera_de_servicio';
  const [isClearing, setIsClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);
  const [fotoExpandida, setFotoExpandida] = useState(false);
  const ultimoSyncEnVivo = useRelativeTime(guard?.capturadoEnIso ?? new Date().toISOString(), guard?.ultimoSync ?? '—');

  useEffect(() => {
    setIsClearing(false);
    setClearError(null);
    setFotoExpandida(false);
  }, [guard?.id]);

  async function handleClearSos() {
    if (!guard || !onClearSos) return;
    setIsClearing(true);
    setClearError(null);
    try {
      const ok = await onClearSos(guard.id);
      if (!ok) {
        setClearError('No se pudo actualizar el estado. Intente nuevamente.');
        setIsClearing(false);
      } else {
        // éxito: el padre cerrará el drawer, reseteamos por si acaso
        setIsClearing(false);
      }
    } catch {
      setClearError('No se pudo actualizar el estado. Intente nuevamente.');
      setIsClearing(false);
    }
  }

  return (
    <Drawer
      isOpen={Boolean(guard)}
      onClose={onClose}
      widthClassName="w-[400px]"
      headerClassName={[
        'text-white',
        isSos ? 'bg-risk-critical animate-pulse-emergency' : 'bg-brand-ink-900',
      ].join(' ')}
      header={
        guard && (
          <div className="flex items-center gap-2.5">
            {guard.fotoUrl ? (
              <button
                type="button"
                onClick={() => setFotoExpandida(true)}
                aria-label={`Ampliar foto de ${guard.nombre}`}
                className="shrink-0 overflow-hidden rounded-full transition-opacity duration-200 hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- foto remota del backend */}
                <img src={guard.fotoUrl} alt="" className="h-[30px] w-[30px] object-cover" />
              </button>
            ) : (
              <Users className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
            )}
            <div className="min-w-0">
              <p className="truncate text-[14.5px] font-bold">{guard.nombre}</p>
              <p className="truncate text-[11.5px] opacity-80">EPI {EPI_ZONE_LABELS[guard.zone]}</p>
            </div>
          </div>
        )
      }
    >
      {guard && (
        <ImageLightbox
          src={fotoExpandida ? (guard.fotoUrl ?? null) : null}
          alt={`Foto de ${guard.nombre}`}
          onClose={() => setFotoExpandida(false)}
        />
      )}
      {guard && (
        <div className="animate-fade-in">
          {isSos && (
            <div className="mb-4 rounded-md bg-risk-critical px-3 py-2 text-center text-xs font-bold text-white">
              ⚠ SOS ACTIVO — ATENCIÓN INMEDIATA REQUERIDA
            </div>
          )}

          {isSos && onClearSos && (
            <div className="mb-4">
              <Button
                variant="destructive"
                onClick={handleClearSos}
                isLoading={isClearing}
                className="w-full"
              >
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                Marcar como resuelto (volver a servicio normal)
              </Button>
              {clearError && (
                <p role="alert" className="mt-2 text-center text-xs text-risk-critical">
                  {clearError}
                </p>
              )}
            </div>
          )}

          <Badge className={[OPERATIONAL_STATUS_BADGE_CLASS[guard.operationalStatus], 'mb-4'].join(' ')}>
            {OPERATIONAL_STATUS_LABELS[guard.operationalStatus]}
          </Badge>

          <p className="mb-4 text-[12.5px] text-neutral-text">
            Ubicación actual: <span className="font-medium text-neutral-text">{guard.ubicacionActual}</span>
          </p>

          <div className="mb-5 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-neutral-border p-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] text-neutral-text-muted">
                <BatteryMedium className="h-3.5 w-3.5" aria-hidden="true" />
                BATERÍA
              </p>
              <p className="text-lg font-bold text-neutral-text">{guard.bateria}%</p>
            </div>
            <div className="rounded-lg border border-neutral-border p-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] text-neutral-text-muted">
                <Radio className="h-3.5 w-3.5" aria-hidden="true" />
                ÚLTIMO SYNC GPS
              </p>
              <p className="text-sm font-bold text-neutral-text">{ultimoSyncEnVivo}</p>
            </div>
          </div>

          <div className="mb-5 flex items-center gap-2 text-[12.5px] text-neutral-text">
            <Clock className="h-4 w-4 shrink-0 text-neutral-text-muted" aria-hidden="true" />
            Turno: {guard.turnoInicio} — {guard.turnoFin}
          </div>

          {onAssignRoute && !isSos && !isOffDuty && (
            <Button variant="secondary" onClick={() => onAssignRoute(guard.id)} className="mb-5 w-full">
              <Route className="h-3.5 w-3.5" aria-hidden="true" />
              Asignar Ruta a este Guardia
            </Button>
          )}

          {onAssignRoute && isSos && (
            <p className="mb-5 text-[12px] text-neutral-text-muted">
              Resuelva la alerta SOS antes de asignar una nueva ruta a este guardia.
            </p>
          )}

          {onAssignRoute && isOffDuty && (
            <p className="mb-5 text-[12px] text-neutral-text-muted">
              Este guardia está fuera de servicio — no se le puede asignar una ruta.
            </p>
          )}

          {(() => {
            const patrulla = patrullas.find((p) => p.guardiaId === guard.id && ['asignada', 'en_curso'].includes(p.estado));
            const group = patrulla?.rutaPlantillaId ? routeGroups.find((g) => g.id === patrulla.rutaPlantillaId) : null;
            const rutaNombre = group?.nombre ?? patrulla?.rutaNombre ?? patrulla?.nombre ?? null;
            const trazado = group?.path ?? (patrulla?.trazado ? patrulla.trazado.map(([lng, lat]) => ({ lat, lng })) : null);
            if (!patrulla) {
              return (
                <div className="rounded-lg border border-dashed border-neutral-border bg-neutral-bg/50 p-3">
                  <p className="text-xs font-semibold text-neutral-text">Sin ruta asignada</p>
                  <p className="mt-1 text-[11.5px] text-neutral-text-muted">Este guardia aún no tiene una ruta de patrullaje. Use &quot;Asignar Ruta&quot; para asignarle un recorrido por calles.</p>
                </div>
              );
            }
            return (
              <div className="rounded-lg border border-neutral-border bg-white p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: group?.color ?? '#A97F52' }} aria-hidden="true" />
                  <p className="text-xs font-bold text-brand-ink-900">RUTA ASIGNADA</p>
                  <span className={['ml-auto rounded px-1.5 py-0.5 text-[10px] font-semibold', patrulla.estado === 'en_curso' ? 'bg-risk-low/10 text-risk-low' : 'bg-brand-gold-600/10 text-brand-gold-700'].join(' ')}>
                    {patrulla.estado === 'en_curso' ? 'En curso' : 'Asignada'}
                  </span>
                </div>
                <p className="text-[13px] font-semibold text-neutral-text">{rutaNombre ?? 'Ruta sin nombre'}</p>
                {patrulla.descripcion && <p className="mt-0.5 text-[11.5px] text-neutral-text-muted">{patrulla.descripcion}</p>}
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                  <span className="rounded bg-neutral-bg px-1.5 py-0.5">EPI {(EPI_ZONE_LABELS as Record<string,string>)[patrulla.epiId] ?? patrulla.epiId}</span>
                  {group && <span className="rounded bg-neutral-bg px-1.5 py-0.5">{group.guards.length} guardia(s) en la misma ruta</span>}
                  {trazado && <span className="rounded bg-neutral-bg px-1.5 py-0.5">{trazado.length} puntos · trazado por calles</span>}
                </div>
                <div className="mt-3">
                  <p className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-text-muted">
                    <MapPin className="h-3 w-3" aria-hidden="true" /> Zona y calles por donde pasará
                  </p>
                  <p className="mb-2 text-[11.5px] text-neutral-text-muted">
                    Zona asignada: <span className="font-medium text-neutral-text">EPI {EPI_ZONE_LABELS[guard.zone]} — calles y avenidas del sector</span>. El recorrido sigue la red vial real (no líneas rectas).
                  </p>
                  {trazado ? (
                    <RouteStreets path={trazado} />
                  ) : (
                    <p className="text-[11.5px] text-neutral-text-muted">Trazado no disponible para esta asignación (ruta antigua).</p>
                  )}
                </div>
              </div>
            );
          })()}

          {guard.ruta.length > 0 && (
            <>
              <p className="mb-2.5 mt-4 text-xs font-bold text-brand-ink-900">BREADCRUMB HISTÓRICO</p>
              <ol className="flex flex-col">
                {guard.ruta.map((pt, index) => (
                  <li key={index} className="flex gap-2.5">
                    <span className="flex flex-col items-center">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-brand-gold-600" />
                      {index < guard.ruta.length - 1 && <span className="w-px flex-1 bg-neutral-border" />}
                    </span>
                    <div className="pb-4">
                      <p className="text-[12.5px] text-neutral-text">{pt.lugar}</p>
                      <p className="text-xs text-neutral-text-muted">{pt.hora}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      )}
    </Drawer>
  );
}
