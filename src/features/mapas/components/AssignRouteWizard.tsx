'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import { Marker, Polyline, useMapEvents } from 'react-leaflet';
import type { LatLng } from 'leaflet';
import L from 'leaflet';
import {
  Building2,
  Car,
  Check,
  CheckCircle2,
  Footprints,
  MapPin,
  ShieldCheck,
  Trash2,
  Undo2,
  Bike,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { EPI_ZONE_LABELS, type EpiZone } from '@/types/epi';
import { OPERATIONAL_STATUS_BADGE_CLASS, OPERATIONAL_STATUS_LABELS, guardFullName, guardInitials, type Guard } from '@/features/guardias/types';
import {
  PATRULLA_MODALIDAD_CAPACIDAD,
  PATRULLA_MODALIDAD_LABELS,
  PATRULLA_MODALIDADES,
  type PatrullaModalidad,
  type RutaPlantillaRow,
} from '@/types/patrulla';
import { distributeGuardsAlongRoute, type LatLng as RoutePoint } from '../lib/routeGeometry';
import { calcularRutaPorCalles } from '../lib/routing';
import { ROUTE_COLOR_PALETTE } from '../lib/routeColors';
import { safePhotoUrl } from '../lib/safeIconUrl';
import { assignRouteAction, type GuardPlacement } from '../actions/assignRoute';
import type { GuardMarker } from '../types';
import { MapCanvas } from './MapCanvas';
import { MapSearch } from './MapSearch';

// RF-G3-09 (MASTER.md sección 7.3 y 10, "Rediseño de Asignación de Rutas").
//
// Rediseño 2026-09-14: la versión anterior hacía que el Operador "ubicara"
// a cada guardia con un clic/arrastre — eso generaba dos problemas
// reportados: (1) se sentía como si se estuviera moviendo el pin real del
// guardia (que en realidad solo se mueve con telemetría GPS real, ver
// assignRoute.ts) y (2) no existía el concepto de "ruta" como trazado, solo
// un polígono chico por guardia. Ahora: el Operador dibuja el TRAZADO (2 a
// 5 puntos, en orden) y el sistema reparte a los guardias seleccionados en
// puntos estratégicos a lo largo de ese trazado según su ubicación GPS
// actual (routeGeometry.ts) — el Operador ya no elige dónde va cada
// guardia a mano.

type EntryMode = 'nueva' | 'plantilla';
type Step = 'inicio' | 'guardias' | 'ruta' | 'confirmacion' | 'exito';
type Placements = Record<string, RoutePoint>;

const MODALIDAD_ICONS: Record<PatrullaModalidad, typeof Car> = {
  coche: Car,
  moto: Bike,
  a_pie: Footprints,
  punto_fijo: ShieldCheck,
  oficina: Building2,
};

const MAX_PUNTOS = 5;
const MIN_PUNTOS = 2;

function trazadoToPuntos(trazado: RutaPlantillaRow['trazado']): RoutePoint[] {
  return trazado.map(([lng, lat]) => ({ lat, lng }));
}

function numberedPointIcon(index: number) {
  return L.divIcon({
    className: '',
    html: `<div style="width:24px;height:24px;border-radius:9999px;background:#1A1A1A;border:2px solid #C59B6D;box-shadow:0 1px 3px rgba(0,0,0,.4);color:#C59B6D;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;font-family:'IBM Plex Sans',sans-serif">${index + 1}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function guardPointIcon(color: string, label: string, fotoUrl?: string) {
  const photoUrl = safePhotoUrl(fotoUrl);
  const fill = photoUrl ? `background-image:url('${photoUrl}');background-size:cover;background-position:center;` : `background:${color};`;
  return L.divIcon({
    className: '',
    html: `<div style="width:22px;height:22px;border-radius:9999px;${fill}border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4);color:#fff;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;font-family:'IBM Plex Sans',sans-serif">${photoUrl ? '' : label}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

interface ConfirmationMapPreviewProps {
  path: RoutePoint[];
  guardPoints: { id: string; label: string; fotoUrl?: string; color: string; point: RoutePoint; currentPosition: RoutePoint | null }[];
  /** Camino real por calles desde la posición actual de cada guardia hasta su punto — ver joinPaths más abajo. */
  joinPaths: Record<string, RoutePoint[]>;
}

// Memoizado y aislado como componente propio: si el mini-mapa de
// confirmación viviera inline en el JSX de AssignRouteWizard, cada
// tecleada en "Nombre de la ruta"/"Descripción" (estado del componente
// padre) volvía a evaluar <MapCanvas>/<Marker> — Leaflet reacciona
// reposicionando su capa de marcadores y eso le roba el foco al input
// (bug reportado: "solo deja escribir una letra"). Con React.memo, este
// árbol solo se re-renderiza si `path`/`guardPoints` cambian de verdad —
// nunca al tipear nombre/descripción.
const ConfirmationMapPreview = memo(function ConfirmationMapPreview({ path, guardPoints, joinPaths }: ConfirmationMapPreviewProps) {
  return (
    <div className="relative mb-4 h-[180px] overflow-hidden rounded-lg border border-neutral-border">
      <MapCanvas>
        {path.length >= 2 && (
          <Polyline positions={path.map((p) => [p.lat, p.lng])} pathOptions={{ color: '#A97F52', weight: 4, opacity: 0.9 }} />
        )}
        {guardPoints.map((g) => {
          // Mientras se calcula el camino real por calles, se muestra la
          // línea recta como aproximación provisoria — se reemplaza sola en
          // cuanto joinPaths[g.id] llega (routing.ts, nunca bloquea la UI).
          const join = joinPaths[g.id] ?? (g.currentPosition ? [g.currentPosition, g.point] : null);
          return (
            <span key={g.id}>
              {join && (
                <Polyline
                  positions={join.map((p) => [p.lat, p.lng])}
                  pathOptions={{ color: g.color, weight: 2, opacity: 0.6, dashArray: '4 6' }}
                />
              )}
              <Marker position={[g.point.lat, g.point.lng]} icon={guardPointIcon(g.color, g.label, g.fotoUrl)} />
            </span>
          );
        })}
      </MapCanvas>
    </div>
  );
});

function RouteClickCapture({ onClick }: { onClick: (latlng: LatLng) => void }) {
  useMapEvents({ click: (e) => onClick(e.latlng) });
  return null;
}

export interface AssignRouteWizardProps {
  isOpen: boolean;
  onClose: () => void;
  guards: Guard[];
  markers: GuardMarker[];
  rutas: RutaPlantillaRow[];
  preselectedGuardId?: string;
  onAssigned: () => void;
}

export function AssignRouteWizard({ isOpen, onClose, guards, markers, rutas, preselectedGuardId, onAssigned }: AssignRouteWizardProps) {
  const [entryMode, setEntryMode] = useState<EntryMode>('nueva');
  const [step, setStep] = useState<Step>('inicio');
  const [modalidad, setModalidad] = useState<PatrullaModalidad | null>(null);
  const [rutaPlantillaId, setRutaPlantillaId] = useState<string | null>(null);
  const [selectedGuardIds, setSelectedGuardIds] = useState<string[]>([]);
  const [lastCheckedIndex, setLastCheckedIndex] = useState<number | null>(null);
  const [puntos, setPuntos] = useState<RoutePoint[]>([]);
  const [rutaCalculada, setRutaCalculada] = useState<{ path: RoutePoint[]; siguioCalles: boolean } | null>(null);
  const [calculandoRuta, setCalculandoRuta] = useState(false);
  const [joinPaths, setJoinPaths] = useState<Record<string, RoutePoint[]>>({});
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [guardarPlantilla, setGuardarPlantilla] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Un guardia en SOS, fuera de servicio o dado de baja (accountStatus
  // 'inactivo') no puede recibir una ruta nueva (bug reportado tras la
  // defensa) — desaparece de la lista de selección hasta que vuelva a
  // 'en_servicio' (o, en el caso de baja, nunca hasta reactivar la cuenta).
  // assignRoute.ts repite esta misma validación en el servidor por si el
  // estado cambia mientras el wizard sigue abierto.
  const assignableGuards = guards.filter((g) => g.operationalStatus === 'en_servicio' && g.accountStatus !== 'inactivo');
  const markerById = useMemo(() => new Map(markers.map((m) => [m.id, m])), [markers]);

  useEffect(() => {
    if (!isOpen) return;
    const preselectedEsAsignable = Boolean(
      preselectedGuardId && assignableGuards.some((g) => g.id === preselectedGuardId),
    );
    setEntryMode('nueva');
    setStep('inicio');
    setModalidad(null);
    setRutaPlantillaId(null);
    setSelectedGuardIds(preselectedEsAsignable ? [preselectedGuardId!] : []);
    setLastCheckedIndex(null);
    setPuntos([]);
    setRutaCalculada(null);
    setCalculandoRuta(false);
    setJoinPaths({});
    setNombre('');
    setDescripcion('');
    setGuardarPlantilla(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe reiniciar el wizard al abrir/cambiar el preseleccionado, no en cada cambio de `guards` (polling en vivo).
  }, [isOpen, preselectedGuardId]);

  const plantillaSeleccionada = rutas.find((r) => r.id === rutaPlantillaId) ?? null;
  const capacidad = modalidad ? PATRULLA_MODALIDAD_CAPACIDAD[modalidad] : 4;
  const selectedGuards = selectedGuardIds.map((id) => guards.find((g) => g.id === id)).filter((g): g is Guard => Boolean(g));
  const epiId: EpiZone | undefined = plantillaSeleccionada ? (plantillaSeleccionada.epiId as EpiZone) : selectedGuards[0]?.epi;

  // Ruteo real por calles (pedido explícito 2026-09-14: "debe ir por las
  // calles, avenidas, carreteras... siempre debe cerrar el circuito si hay
  // 3 o más puntos"). Se recalcula cada vez que cambian los puntos
  // clickeados — `vigente` descarta la respuesta si `puntos` ya cambió de
  // nuevo antes de que OSRM conteste (evita pisar un cálculo más nuevo con
  // uno viejo que tardó más). Nunca corre en modo plantilla: ese trazado ya
  // viene ruteado de cuando se creó.
  useEffect(() => {
    if (plantillaSeleccionada || puntos.length < MIN_PUNTOS) {
      setRutaCalculada(null);
      return;
    }
    let vigente = true;
    setCalculandoRuta(true);
    calcularRutaPorCalles(puntos, puntos.length >= 3).then((resultado) => {
      if (!vigente) return;
      setRutaCalculada({ path: resultado.path, siguioCalles: resultado.siguioCalles });
      setCalculandoRuta(false);
    });
    return () => {
      vigente = false;
    };
  }, [plantillaSeleccionada, puntos]);

  // El trazado activo: el ya-ruteado de la plantilla elegida, el recién
  // calculado por calles, o (mientras se calcula/si OSRM no respondió
  // todavía) una aproximación en línea recta entre los puntos — nunca deja
  // el mapa vacío. De acá para abajo el resto del wizard no le importa de
  // dónde salió. Memoizado: `trazadoToPuntos` fabrica un array nuevo en
  // cada render, y sin memo esa referencia nueva llegaría a
  // <ConfirmationMapPreview> en cada tecleo de nombre/descripción,
  // rompiendo el React.memo de abajo igual que si no existiera.
  const activePath = useMemo(
    () => (plantillaSeleccionada ? trazadoToPuntos(plantillaSeleccionada.trazado) : (rutaCalculada?.path ?? puntos)),
    [plantillaSeleccionada, rutaCalculada, puntos],
  );
  const pathReady = puntos.length >= MIN_PUNTOS || Boolean(plantillaSeleccionada);

  const distribution: Placements = useMemo(() => {
    if (!pathReady || selectedGuardIds.length === 0) return {};
    return distributeGuardsAlongRoute(
      activePath,
      selectedGuardIds.map((id) => {
        const m = markerById.get(id);
        return { id, position: m ? { lat: m.lat, lng: m.lng } : null };
      }),
    );
  }, [activePath, selectedGuardIds, markerById, pathReady]);

  // "Cómo llegar" por calles (pedido explícito: "cualquier recorrido debe
  // ir por las calles" — antes era una línea recta). Se recalcula cada vez
  // que cambia el reparto (nuevo trazado, guardia agregado/quitado) — un
  // pedido en paralelo por guardia (Promise.all), no bloquea entre sí.
  // `vigente` descarta resultados si `distribution` ya cambió de nuevo.
  useEffect(() => {
    const guardIds = Object.keys(distribution);
    if (guardIds.length === 0) {
      setJoinPaths({});
      return;
    }
    let vigente = true;
    Promise.all(
      guardIds.map(async (id) => {
        const m = markerById.get(id);
        const punto = distribution[id];
        if (!m || !punto) return null;
        const resultado = await calcularRutaPorCalles([{ lat: m.lat, lng: m.lng }, punto], false);
        return [id, resultado.path] as const;
      }),
    ).then((pares) => {
      if (!vigente) return;
      const next: Record<string, RoutePoint[]> = {};
      for (const par of pares) {
        if (par) next[par[0]] = par[1];
      }
      setJoinPaths(next);
    });
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- markerById cambia de referencia en cada refresh en vivo del mapa; solo importa recalcular cuando el reparto (distribution) realmente cambia.
  }, [distribution]);

  function handleClose() {
    onClose();
  }

  function pickModalidad(m: PatrullaModalidad) {
    setModalidad(m);
    setStep('guardias');
  }

  function pickPlantilla(r: RutaPlantillaRow) {
    if (r.trazado.length < MIN_PUNTOS) return;
    setRutaPlantillaId(r.id);
    setModalidad(null);
    setNombre(r.nombre);
    setDescripcion(r.descripcion ?? '');
    setStep('guardias');
  }

  function toggleGuard(id: string, index: number, shiftKey: boolean) {
    setSelectedGuardIds((prev) => {
      const isSelected = prev.includes(id);
      let next = prev;

      if (shiftKey && lastCheckedIndex !== null) {
        const [from, to] = [lastCheckedIndex, index].sort((a, b) => a - b);
        const rangeIds = assignableGuards.slice(from, to + 1).map((g) => g.id);
        const merged = new Set(prev);
        rangeIds.forEach((rid) => merged.add(rid));
        next = Array.from(merged);
      } else {
        next = isSelected ? prev.filter((gid) => gid !== id) : [...prev, id];
      }

      return next.slice(0, capacidad);
    });
    setLastCheckedIndex(index);
  }

  function handleMapClick(latlng: LatLng) {
    if (plantillaSeleccionada || puntos.length >= MAX_PUNTOS) return;
    setPuntos((prev) => [...prev, { lat: latlng.lat, lng: latlng.lng }]);
  }

  function undoLastPoint() {
    setPuntos((prev) => prev.slice(0, -1));
  }

  async function handleSubmit() {
    if (!modalidad && !plantillaSeleccionada) return;
    if (!epiId || !pathReady) return;
    setIsSubmitting(true);
    setError(null);

    const placementList: GuardPlacement[] = selectedGuardIds
      .filter((id) => distribution[id])
      .map((id) => ({ guardiaId: id, lat: distribution[id].lat, lng: distribution[id].lng }));

    // Se manda `activePath` (el trazado YA ruteado por calles, potencialmente
    // decenas/cientos de puntos), no `puntos` (los 2-5 clics del Operador) —
    // eso es lo que queda guardado y lo que ve el guardia en el celular.
    const result = await assignRouteAction({
      modalidad: modalidad ?? 'coche',
      epiId,
      rutaPlantillaId: rutaPlantillaId ?? undefined,
      puntos: rutaPlantillaId ? undefined : activePath,
      nombre,
      descripcion: descripcion || undefined,
      placements: placementList,
      guardarComoPlantilla: entryMode === 'nueva' && guardarPlantilla,
    });

    setIsSubmitting(false);
    if (!result.success) {
      setError(result.error ?? 'No se pudo asignar la ruta.');
      return;
    }
    setStep('exito');
    onAssigned();
  }

  // Memoizado: si esto se recalculara en cada render (ej. al tipear en
  // "Nombre de la ruta"/"Descripción"), el array/objetos nuevos que salen
  // de acá le llegarían con una referencia distinta a <ConfirmationMapPreview>
  // en cada tecleo — y como ese componente está memoizado por props,
  // React.memo lo re-renderizaría de todas formas por más que su contenido
  // real no haya cambiado, reintroduciendo el mismo bug de foco que el memo
  // existe para evitar. Solo debe recalcularse cuando el reparto real
  // cambia.
  const previewGuardPoints = useMemo(
    () =>
      selectedGuardIds
        .map((id, i) => {
          const g = guards.find((guard) => guard.id === id);
          const point = distribution[id];
          if (!g || !point) return null;
          const m = markerById.get(id);
          return {
            id,
            label: guardInitials(g),
            fotoUrl: g.fotoUrl,
            color: ROUTE_COLOR_PALETTE[i % ROUTE_COLOR_PALETTE.length],
            point,
            currentPosition: m ? { lat: m.lat, lng: m.lng } : null,
          };
        })
        .filter((g): g is NonNullable<typeof g> => g !== null),
    [selectedGuardIds, guards, distribution, markerById],
  );

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Asignar Ruta de Patrullaje" widthClassName="max-w-[720px]" accent="gold">
      {step === 'exito' ? (
        <div className="animate-fade-in p-6 text-center">
          <div className="mb-3.5 flex justify-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-risk-low/10">
              <CheckCircle2 className="h-6 w-6 text-risk-low" aria-hidden="true" />
            </span>
          </div>
          <p className="mb-1 text-base font-semibold text-brand-ink-900">Ruta asignada correctamente</p>
          <p className="mb-4 text-[12.5px] text-neutral-text-muted">
            {selectedGuardIds.length} guardia(s) quedaron con la ruta registrada — cada uno verá en su celular el trazado y la forma más rápida de incorporarse; el pin en el Mapa de Patrullaje en Vivo solo se moverá cuando su GPS real reporte.
          </p>
          <Button variant="ink" onClick={handleClose} className="w-full">
            Cerrar
          </Button>
        </div>
      ) : (
        <div className="flex flex-col">
          {/* Encabezado de pasos */}
          <div className="flex items-center gap-1.5 border-b border-neutral-border px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-neutral-text-muted">
            {(['inicio', 'guardias', 'ruta', 'confirmacion'] as const).map((s, i) => (
              <span key={s} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-neutral-border">—</span>}
                <span className={step === s ? 'text-brand-gold-600' : ''}>
                  {i + 1}. {{ inicio: 'Modalidad', guardias: 'Guardias', ruta: 'Ruta', confirmacion: 'Confirmar' }[s]}
                </span>
              </span>
            ))}
          </div>

          {error && (
            <div role="alert" className="mx-5 mt-3.5 animate-fade-in rounded-md border border-risk-critical/20 bg-risk-critical/10 px-3 py-2.5 text-xs text-risk-critical">
              {error}
            </div>
          )}

          {/* Paso 1 — modalidad o plantilla */}
          {step === 'inicio' && (
            <div className="p-5">
              <div className="mb-4 flex gap-1 border-b border-neutral-border">
                {(['nueva', 'plantilla'] as EntryMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setEntryMode(mode)}
                    className={[
                      'border-b-2 px-3 py-2 text-sm font-medium transition-colors duration-200',
                      entryMode === mode ? 'border-brand-gold-600 text-brand-gold-600' : 'border-transparent text-neutral-text-muted hover:text-neutral-text',
                    ].join(' ')}
                  >
                    {mode === 'nueva' ? 'Nueva Asignación' : 'Usar Plantilla Guardada'}
                  </button>
                ))}
              </div>

              {entryMode === 'nueva' ? (
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {PATRULLA_MODALIDADES.map((m) => {
                    const Icon = MODALIDAD_ICONS[m];
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => pickModalidad(m)}
                        className="flex flex-col items-start gap-2 rounded-xl border border-neutral-border bg-white p-3.5 text-left transition-colors duration-200 hover:border-brand-gold-600 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-600 focus-visible:ring-offset-2"
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-gold-600/10 text-brand-gold-600">
                          <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                        </span>
                        <p className="text-[13px] font-semibold text-brand-ink-900">{PATRULLA_MODALIDAD_LABELS[m]}</p>
                        <p className="text-[11px] text-neutral-text-muted">Hasta {PATRULLA_MODALIDAD_CAPACIDAD[m]} guardia(s)</p>
                      </button>
                    );
                  })}
                </div>
              ) : rutas.length === 0 ? (
                <p className="py-8 text-center text-sm text-neutral-text-muted">
                  Todavía no hay plantillas guardadas — creá una desde &quot;Nueva Asignación&quot;.
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-neutral-bg">
                  {rutas.map((r) => {
                    const invalida = r.trazado.length < MIN_PUNTOS;
                    return (
                      <li key={r.id}>
                        <button
                          type="button"
                          disabled={invalida}
                          onClick={() => pickPlantilla(r)}
                          className={[
                            'flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-3 text-left transition-colors duration-200',
                            'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-600 focus-visible:ring-offset-2',
                            invalida ? 'cursor-not-allowed opacity-40' : 'hover:bg-neutral-bg',
                          ].join(' ')}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-neutral-text">{r.nombre}</p>
                            <p className="truncate text-[11.5px] text-neutral-text-muted">
                              EPI {EPI_ZONE_LABELS[r.epiId as EpiZone] ?? r.epiId}
                              {r.descripcion ? ` — ${r.descripcion}` : ''}
                              {invalida ? ' — trazado inválido' : ''}
                            </p>
                          </div>
                          <MapPin className="h-4 w-4 shrink-0 text-neutral-text-muted" aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {/* Paso 2 — guardias */}
          {step === 'guardias' && (
            <div className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[12.5px] text-neutral-text-muted">
                  Elegí uno o varios guardias — clic con Shift para seleccionar un rango.
                </p>
                <span className="shrink-0 rounded-full bg-neutral-bg px-2.5 py-1 text-[11px] font-semibold text-neutral-text">
                  {selectedGuardIds.length}/{capacidad}
                </span>
              </div>

              {assignableGuards.length === 0 ? (
                <p className="py-8 text-center text-sm text-neutral-text-muted">
                  No hay guardias en servicio disponibles para asignar en este momento.
                </p>
              ) : (
                <ul className="scrollbar-hidden flex max-h-[360px] flex-col divide-y divide-neutral-bg overflow-y-auto rounded-lg border border-neutral-border">
                  {assignableGuards.map((guard, index) => {
                    const isChecked = selectedGuardIds.includes(guard.id);
                    const isDisabled = !isChecked && selectedGuardIds.length >= capacidad;
                    return (
                      <li key={guard.id}>
                        <button
                          type="button"
                          disabled={isDisabled}
                          onClick={(event) => toggleGuard(guard.id, index, event.shiftKey)}
                          className={[
                            'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-200',
                            'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-600 focus-visible:ring-offset-2',
                            isDisabled ? 'cursor-not-allowed opacity-40' : 'hover:bg-neutral-bg',
                            isChecked ? 'bg-brand-gold-600/5' : '',
                          ].join(' ')}
                        >
                          <input type="checkbox" checked={isChecked} disabled={isDisabled} readOnly className="pointer-events-none h-4 w-4" />
                          {guard.fotoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- foto remota del backend
                            <img src={guard.fotoUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                          ) : (
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-ink-900 text-[11px] font-bold text-brand-gold-500">
                              {guardInitials(guard)}
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12.5px] font-medium text-neutral-text">{guardFullName(guard)}</p>
                            <p className="truncate text-[11px] text-neutral-text-muted">EPI {EPI_ZONE_LABELS[guard.epi]}</p>
                          </div>
                          <span className={['shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold', OPERATIONAL_STATUS_BADGE_CLASS[guard.operationalStatus]].join(' ')}>
                            {OPERATIONAL_STATUS_LABELS[guard.operationalStatus]}
                          </span>
                          {isChecked && <Check className="h-3.5 w-3.5 shrink-0 text-brand-gold-600" aria-hidden="true" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="mt-4 flex gap-2.5">
                <Button type="button" variant="secondary" onClick={() => setStep('inicio')} className="flex-1">
                  Atrás
                </Button>
                <Button type="button" variant="ink" onClick={() => setStep('ruta')} disabled={selectedGuardIds.length === 0} className="flex-1">
                  Siguiente
                </Button>
              </div>
            </div>
          )}

          {/* Paso 3 — trazado de la ruta */}
          {step === 'ruta' && (
            <div className="p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[12.5px] text-neutral-text-muted">
                  {plantillaSeleccionada
                    ? 'Trazado de la plantilla seleccionada — no se puede editar acá.'
                    : `Hacé clic en el mapa para marcar los puntos de la ruta, en orden (mínimo ${MIN_PUNTOS}, máximo ${MAX_PUNTOS}). El camino real por calles se calcula solo${puntos.length >= 3 ? ' y se cierra el circuito (vuelve al primer punto)' : ''}.`}
                </p>
                {!plantillaSeleccionada && (
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-neutral-bg px-2.5 py-1 text-[11px] font-semibold text-neutral-text">
                      {puntos.length}/{MAX_PUNTOS}
                    </span>
                    <Button type="button" variant="secondary" onClick={undoLastPoint} disabled={puntos.length === 0} className="!px-2.5 !py-1.5">
                      <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Deshacer
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => setPuntos([])} disabled={puntos.length === 0} className="!px-2.5 !py-1.5">
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Reiniciar
                    </Button>
                  </div>
                )}
              </div>

              {calculandoRuta && (
                <p className="mb-2 text-[11.5px] text-brand-gold-700">Calculando el camino real por calles…</p>
              )}
              {!calculandoRuta && rutaCalculada && !rutaCalculada.siguioCalles && (
                <p role="alert" className="mb-2 text-[11.5px] text-risk-medium">
                  No se pudo calcular el camino por calles (servicio de ruteo no disponible) — se muestra una aproximación en línea recta.
                </p>
              )}

              <div className="relative h-[380px] overflow-hidden rounded-lg border border-neutral-border">
                <MapCanvas>
                  <MapSearch />
                  {!plantillaSeleccionada && <RouteClickCapture onClick={handleMapClick} />}
                  {activePath.length >= 2 && (
                    <Polyline positions={activePath.map((p) => [p.lat, p.lng])} pathOptions={{ color: '#A97F52', weight: 4, opacity: 0.9 }} />
                  )}
                  {!plantillaSeleccionada &&
                    puntos.map((p, i) => <Marker key={i} position={[p.lat, p.lng]} icon={numberedPointIcon(i)} />)}
                </MapCanvas>
              </div>

              <div className="mt-4 flex gap-2.5">
                <Button type="button" variant="secondary" onClick={() => setStep('guardias')} className="flex-1" disabled={isSubmitting}>
                  Atrás
                </Button>
                <Button type="button" variant="ink" onClick={() => setStep('confirmacion')} disabled={!pathReady} className="flex-1">
                  {pathReady ? 'Siguiente' : `Marque al menos ${MIN_PUNTOS} puntos`}
                </Button>
              </div>
            </div>
          )}

          {/* Paso 4 — confirmación */}
          {step === 'confirmacion' && (
            <div className="p-5">
              <p className="mb-2 text-xs font-bold text-brand-ink-900">VAS A ASIGNAR</p>
              <div className="mb-4 flex flex-wrap gap-2">
                {previewGuardPoints.map((g) => (
                  <span key={g.id} className="flex items-center gap-1.5 rounded-full border border-neutral-border bg-neutral-bg py-1 pl-1 pr-2.5 text-[11.5px] font-medium text-neutral-text">
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white"
                      style={{ backgroundColor: g.color }}
                    >
                      {g.label}
                    </span>
                    {guardFullName(selectedGuards.find((sg) => sg.id === g.id)!)}
                    {!g.currentPosition && <span className="text-neutral-text-muted">(sin GPS aún)</span>}
                  </span>
                ))}
              </div>
              <p className="mb-4 text-[12.5px] text-neutral-text">
                Modalidad: <span className="font-semibold">{modalidad ? PATRULLA_MODALIDAD_LABELS[modalidad] : 'Desde plantilla'}</span>
                {plantillaSeleccionada && <span> — Plantilla &quot;{plantillaSeleccionada.nombre}&quot;</span>}
              </p>
              <p className="mb-3 text-[11.5px] text-neutral-text-muted">
                La línea sólida es la ruta por calles; las líneas punteadas de colores muestran, para cada guardia, el camino por calles desde su última posición GPS conocida hasta su punto asignado.
              </p>

              <ConfirmationMapPreview path={activePath} guardPoints={previewGuardPoints} joinPaths={joinPaths} />

              <div className="mb-4 grid grid-cols-1 gap-3">
                <Input
                  label="Nombre de la ruta"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej. Patrullaje Terminal — Turno Tarde"
                  required
                  disabled={isSubmitting}
                  accent="gold"
                />
                <Input
                  label="Descripción (opcional)"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  disabled={isSubmitting}
                  accent="gold"
                />
              </div>

              {entryMode === 'nueva' && (
                <label className="mb-4 flex items-start gap-2 text-xs text-neutral-text">
                  <input
                    type="checkbox"
                    checked={guardarPlantilla}
                    onChange={(e) => setGuardarPlantilla(e.target.checked)}
                    className="mt-0.5 accent-brand-gold-600"
                    disabled={isSubmitting}
                  />
                  Guardar como plantilla reutilizable (si no la marcás, esta ruta no aparecerá luego en &quot;Usar Plantilla Guardada&quot;, pero los guardias seleccionados igual la comparten)
                </label>
              )}

              <div className="flex gap-2.5">
                <Button type="button" variant="secondary" onClick={() => setStep('ruta')} className="flex-1" disabled={isSubmitting}>
                  Atrás
                </Button>
                <Button type="button" variant="ink" onClick={handleSubmit} isLoading={isSubmitting} disabled={!nombre.trim()} className="flex-1">
                  Asignar Ruta
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
