'use client';

import { useEffect, useMemo, useState } from 'react';
import { BatteryMedium, CheckCircle2, Clock, MapPin, Radio, Route, Siren, Users, AlertTriangle } from 'lucide-react';
import { Drawer } from '@/components/ui/Drawer';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ImageLightbox } from '@/components/ui/ImageLightbox';
import { OPERATIONAL_STATUS_BADGE_CLASS, OPERATIONAL_STATUS_LABELS } from '@/features/guardias/types';
import { EpiNombre } from '@/lib/epis/EpiNombre';
import { useRelativeTime } from '@/lib/hooks/useRelativeTime';
import type { GuardMarker } from '../types';
import type { PatrullaRow } from '@/types/patrulla';
import type { RouteGroup } from '../lib/routeGroups';
import { DESVIO_ESTILO } from './DesviacionesPanel';
import { callesGuardadas, claveCalles, muestrasDe, resolverCalles } from '../lib/callesRuta';
import { EtaDetalle } from './EtaIncorporacion';
import type { TrayectoIncorporacion } from '../hooks/useTrayectosIncorporacion';

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
  /** Camino y tiempo estimado de llegada si se está incorporando. */
  trayecto?: TrayectoIncorporacion | null;
}

function RouteStreets({ path }: { path: { lat: number; lng: number }[] }) {
  // Clave por coordenadas (no por la referencia de `path`, que cambia con cada
  // ping de GPS): así no se vuelve a consultar mientras el detalle está abierto.
  const muestras = useMemo(() => muestrasDe(path ?? []), [path]);
  const puntos = useMemo(() => muestras.map((m) => m.punto), [muestras]);
  const clave = claveCalles(puntos);
  // Lo ya resuelto se muestra al instante, sin "Resolviendo calles…" (callesRuta.ts).
  const [resultado, setResultado] = useState<{ clave: string; calles: string[] } | null>(() => {
    const guardadas = clave ? callesGuardadas(clave) : null;
    return guardadas ? { clave, calles: guardadas } : null;
  });
  useEffect(() => {
    if (muestras.length < 2) return;
    const guardadas = callesGuardadas(clave);
    if (guardadas) {
      setResultado({ clave, calles: guardadas });
      return;
    }
    let vigente = true;
    void resolverCalles(puntos).then((r) => {
      if (vigente) setResultado({ clave, calles: r.calles });
    });
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `clave` resume `muestras`
  }, [clave]);
  if (muestras.length < 2) return null;
  const streets = resultado?.clave === clave ? resultado.calles : null;
  if (!streets) return <p className="text-[11.5px] text-neutral-text-muted">Resolviendo calles…</p>;
  if (streets.length === 0) return null;
  return (
    <ol className="flex flex-col">
      {streets.map((s, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="flex flex-col items-center">
            {/* Rombo: el mismo símbolo que marca esta calle en el mapa. */}
            <span className="mt-1 h-2 w-2 shrink-0 rotate-45 bg-primary-700" />
            {i < streets.length - 1 && <span className="w-px flex-1 bg-neutral-border" />}
          </span>
          <div className="pb-3">
            <p className="text-[12.5px] text-neutral-text">{s}</p>
            <p className="text-[11px] text-neutral-text-muted">{muestras[i]?.etiqueta ?? 'Pasa por'}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function TelemetryDrawer({ guard, onClose, onAssignRoute, onClearSos, patrullas = [], routeGroups = [], trayecto = null }: TelemetryDrawerProps) {
  const isSos = guard?.hasSos === true;
  const isOffDuty = guard?.operationalStatus === 'fuera_de_servicio';
  const [isClearing, setIsClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);
  const [fotoExpandida, setFotoExpandida] = useState(false);
  const ultimoSyncEnVivo = useRelativeTime(guard?.capturadoEnIso ?? new Date().toISOString(), guard?.ultimoSync ?? '—');
  // Estado respecto a su ruta (F2): lo calcula el servidor en cada ping, con
  // umbrales por modalidad. Antes se medía acá la distancia desde el INICIO
  // del trazado (avance), que no es desvío.
  const estadoRuta = guard?.rutaAsignada || guard?.ejecucionId ? (guard.estadoRuta ?? null) : null;
  // Sin medición del servidor todavía (recién asignado, sin GPS nuevo): la distancia del trayecto por calles.
  const distanciaRuta = guard?.distanciaRutaM ?? (trayecto ? Math.round(trayecto.distanciaM) : null);
  // F7: plazo del servidor para llegar; vencido sin llegar ya no es "incorporándose" sino desvío.
  const plazoTexto = guard?.incorporacionLimite ? new Date(guard.incorporacionLimite).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' }) : null;
  const fueraDePlazo = Boolean(plazoTexto && !guard?.incorporadaEn && (estadoRuta === 'advertencia' || estadoRuta === 'alerta'));
  const destinoTexto = patrullas.some((p) => p.guardiaId === guard?.id && p.puntoFijo && ['asignada', 'en_curso'].includes(p.estado)) ? 'su punto' : 'su ruta';

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
        // SOS (F7): cabecera de tinta con filete rojo abajo, no roja pulsante entera.
        isSos ? 'bg-primary-900 border-b-[3px] border-risk-critical' : 'bg-primary-900',
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
              <p className="truncate text-[11.5px] opacity-80"><EpiNombre codigo={guard.zone} /></p>
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
            <div role="status" className="mb-4 flex items-center gap-3 rounded-lg border border-risk-critical/25 border-l-[3px] border-l-risk-critical bg-risk-critical/[0.06] px-3 py-2.5">
              <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-risk-critical text-white" aria-hidden="true">
                <span className="absolute inset-0 animate-sos-ring rounded-full border-2 border-risk-critical motion-reduce:hidden" />
                <Siren className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-risk-critical-700">SOS activo</p>
                <p className="text-[11.5px] text-neutral-text">Atención inmediata requerida.</p>
              </div>
            </div>
          )}

          {/* Indicador de desviación de ruta (RF-G3-09) */}
          {estadoRuta && estadoRuta !== 'en_ruta' && (
            <div className="mb-4 rounded-md border border-neutral-border bg-neutral-bg/60 px-3 py-2.5">
              <div className="mb-1 flex items-center gap-2">
                <AlertTriangle className={`h-3.5 w-3.5 shrink-0 ${DESVIO_ESTILO[estadoRuta].texto}`} aria-hidden="true" />
                <p className={`text-[11.5px] font-bold uppercase ${DESVIO_ESTILO[estadoRuta].texto}`}>{DESVIO_ESTILO[estadoRuta].etiqueta}</p>
              </div>
              <p className="text-[11px] text-neutral-text-muted">
                {estadoRuta === 'incorporandose'
                  ? `Se dirige a ${destinoTexto} (a ${distanciaRuta ?? '?'} m).${plazoTexto ? ` Plazo para llegar: ${plazoTexto}.` : ''} Si no llega a tiempo, pasa a advertencia o alerta según su distancia.`
                  : fueraDePlazo
                    ? `No llegó a ${destinoTexto} dentro del plazo (${plazoTexto}). Está a ${distanciaRuta ?? '?'} m.`
                    : `A ${distanciaRuta ?? '?'} m de ${destinoTexto}.`}
              </p>
              {estadoRuta === 'incorporandose' && trayecto && <EtaDetalle trayecto={trayecto} gpsSinActualizacionSeg={guard.gpsSinActualizacionSeg} />}
              {estadoRuta === 'incorporandose' && !trayecto && <p className="mt-1 text-[11px] text-neutral-text-muted">Calculando tiempo de llegada…</p>}
            </div>
          )}
          {estadoRuta === 'en_ruta' && (
            <div className="mb-4 rounded-md border border-risk-low/20 bg-risk-low/5 px-3 py-2.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-risk-low" aria-hidden="true" />
                <p className="text-[11.5px] font-bold text-risk-low">EN RUTA — a {distanciaRuta ?? 0} m del trazado</p>
              </div>
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
                Atender alerta SOS
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
              <p className="text-lg font-bold text-neutral-text">{guard.bateria !== null ? `${guard.bateria}%` : 'N/D'}</p>
            </div>
            <div className="rounded-lg border border-neutral-border p-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] text-neutral-text-muted">
                <Radio className="h-3.5 w-3.5" aria-hidden="true" />
                ÚLTIMO SYNC GPS
              </p>
              <p className="text-sm font-bold text-neutral-text">{ultimoSyncEnVivo}</p>
            </div>
          </div>

          {/* Alerta de GPS desactualizado o deshabilitado (RF-G3-09) */}
          {guard.gpsSinActualizacionSeg !== null && guard.gpsSinActualizacionSeg > 300 && (
            <div className={`mb-4 rounded-md border px-3 py-2.5 ${
              guard.gpsSinActualizacionSeg > 900
                ? 'bg-risk-critical/10 border-risk-critical/30'
                : 'bg-risk-low/10 border-risk-low/20'
            }`}>
              <div className="flex items-center gap-2">
                <Radio className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <p className={`text-[11.5px] font-bold ${
                  guard.gpsSinActualizacionSeg > 900 ? 'text-risk-critical' : 'text-risk-low'
                }`}>
                  {guard.gpsSinActualizacionSeg > 900
                    ? '⚠ GPS SIN ACTUALIZAR — Posible dispositivo apagado o geolocalización desactivada'
                    : '⚠ GPS desactualizado — Última posición hace más de 5 minutos'}
                </p>
              </div>
              <p className="text-[11px] text-neutral-text-muted mt-1">
                Hace {Math.round(guard.gpsSinActualizacionSeg / 60)} min sin reportar posición.
              </p>
            </div>
          )}

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
            const clave = patrulla?.ejecucionId ?? patrulla?.rutaPlantillaId;
            const group = clave ? routeGroups.find((g) => g.id === clave) : null;
            const rutaNombre = group?.nombre ?? patrulla?.rutaNombre ?? patrulla?.nombre ?? null;
            const trazado = group?.path ?? (patrulla?.trazado ? patrulla.trazado.map(([lng, lat]) => ({ lat, lng })) : null);
            // F4: un punto fijo no tiene trazado ni calles por recorrer.
            const esPunto = Boolean(group?.puntoFijo ?? patrulla?.puntoFijo);
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
                  <p className="text-xs font-bold text-primary-900">{esPunto ? 'PUNTO FIJO ASIGNADO' : 'RUTA ASIGNADA'}</p>
                  <span className={['ml-auto rounded px-1.5 py-0.5 text-[10px] font-semibold', patrulla.estado === 'en_curso' ? 'bg-risk-low/10 text-risk-low' : 'bg-primary-100 text-primary-800'].join(' ')}>
                    {patrulla.estado === 'en_curso' ? 'En curso' : 'Asignada'}
                  </span>
                </div>
                <p className="text-[13px] font-semibold text-neutral-text">{rutaNombre ?? 'Ruta sin nombre'}</p>
                {patrulla.descripcion && <p className="mt-0.5 text-[11.5px] text-neutral-text-muted">{patrulla.descripcion}</p>}
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                  <span className="rounded bg-neutral-bg px-1.5 py-0.5"><EpiNombre codigo={patrulla.epiId} /></span>
                  {group && <span className="rounded bg-neutral-bg px-1.5 py-0.5">{group.guards.length} guardia(s) en {esPunto ? 'el punto' : 'la misma ruta'}</span>}
                  {esPunto && patrulla.puntoFijo?.esSubpunto && <span className="rounded bg-neutral-bg px-1.5 py-0.5">Subpunto: {patrulla.puntoFijo.nombre}</span>}
                  {!esPunto && trazado && trazado.length > 0 && <span className="rounded bg-neutral-bg px-1.5 py-0.5">{trazado.length} puntos · trazado por calles</span>}
                </div>
                {esPunto ? (
                  <p className="mt-3 text-[11.5px] text-neutral-text-muted">
                    Servicio fijo: debe permanecer en el punto. A más de 30 m pasa a advertencia y a más de 100 m, a fuera de su punto.
                  </p>
                ) : (
                <div className="mt-3">
                  <p className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-text-muted">
                    <MapPin className="h-3 w-3" aria-hidden="true" /> Zona y calles por donde pasará
                  </p>
                  <p className="mb-2 text-[11.5px] text-neutral-text-muted">
                    Zona asignada: <span className="font-medium text-neutral-text"><EpiNombre codigo={guard.zone} /> — calles y avenidas del sector</span>. El recorrido sigue la red vial real (no líneas rectas).
                  </p>
                  {trazado ? (
                    <RouteStreets path={trazado} />
                  ) : (
                    <p className="text-[11.5px] text-neutral-text-muted">Trazado no disponible para esta asignación (ruta antigua).</p>
                  )}
                </div>
                )}
              </div>
            );
          })()}

          {guard.ruta.length > 0 && (
            <>
              <p className="mb-2.5 mt-4 text-xs font-bold text-primary-900">BREADCRUMB HISTÓRICO</p>
              <ol className="flex flex-col">
                {guard.ruta.map((pt, index) => (
                  <li key={index} className="flex gap-2.5">
                    <span className="flex flex-col items-center">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-primary-700" />
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
