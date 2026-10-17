'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import { Marker, Polyline, useMap } from 'react-leaflet';
import { Check, CheckCircle2, ChevronRight, Flag, Route as RouteIcon, Search } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useDialog, type DialogDetalle } from '@/components/ui/AlertDialog';
import { EpiNombre } from '@/lib/epis/EpiNombre';
import { OPERATIONAL_STATUS_BADGE_CLASS, OPERATIONAL_STATUS_LABELS, guardFullName, guardInitials, type Guard } from '@/features/guardias/types';
import {
  PATRULLA_MODALIDAD_CAPACIDAD,
  PATRULLA_MODALIDAD_LABELS,
  PATRULLA_MODALIDADES,
  TIPO_RUTA_LABELS,
  type PatrullaModalidad,
  type RutaPlantillaRow,
} from '@/types/patrulla';
import type { NoAsignado } from '@/lib/data-source';
import { libresDe, type PuntoFijoRow } from '@/types/puntoFijo';
import type { HorarioParaAsignar } from '@/types/programacion';
import { puedeEditarEn, type Jurisdiccion } from '../lib/jurisdiccion';
import { distributeGuardsAlongRoute, type LatLng as RoutePoint } from '../lib/routeGeometry';
import { calcularTrayecto } from '../lib/routing';
import { distanciaRectaM, modoDeViaje, perfilDe } from '../lib/eta';
import { ESTILO_INCORPORACION } from '../lib/capas';
import { horaLocal } from '../lib/programacionTexto';
import { ROUTE_COLOR_PALETTE } from '../lib/routeColors';
import { MODALIDAD_ICONS, guardPointIcon, nuevaClave, trazadoAPuntos } from '../lib/rutaIconos';
import { MIN_PUNTOS, useTrazadoRuta } from '../hooks/useTrazadoRuta';
import { assignRouteAction, previewAssignAction, type AssignRouteInput } from '../actions/assignRoute';
import type { GuardMarker } from '../types';
import { MapCanvas } from './MapCanvas';
import { TrazadoEditor } from './rutas/TrazadoEditor';

// RF-G3-09 — "Asignar Ruta" (menú "Rutas" del mapa).
//
// Dos entradas: "Modalidad" (se elige la modalidad, los guardias y se dibuja
// un trazado nuevo) y "Usar Ruta Guardada" (una predeterminada o recurrente
// de la biblioteca; su trazado ya existe, así que se salta el paso de dibujo).
//
// Rediseño F2 (pedido del usuario, menos saturación): el formulario ya no
// lleva recuadros de aviso ni parámetros de la ruta. Los avisos saltan en la
// ventana flotante (useDialog): al pasar de "Guardias" se avisa quién ya
// tiene ruta (y se pide confirmar retirarlo), quién no podrá asignarse y
// quién tiene el GPS viejo; al terminar, quién no quedó asignado y por qué
// (la asignación es parcial). El tipo se gestiona en "Rutas Guardadas" /
// "Crear Ruta"; los horarios, en "Programar Rutas". Asignada aquí, una ruta
// dura hasta cancelarla o hasta que sus guardias cierran turno, y admite el
// máximo de guardias de su modalidad.
//
// F4: la modalidad "Punto de Servicio Fijo" ya no dibuja nada en el
// mapa: se elige un punto del CATÁLOGO de la EPI con su ocupación real
// ("Plaza Colón — 1/2") y, si tiene subpuntos, el de cada guardia. El
// backend asigna por la identidad del punto y vuelve a contar el cupo.
//
// F5: desde "Programar Rutas" se abre vinculado a UN horario programado
// (`horario`): salta directo a los guardias y asigna a esa ejecución (no
// crea otra). La ruta o el punto ya los fija la programación.

type Modo = 'modalidad' | 'guardada' | 'programada';
type Step = 'inicio' | 'punto' | 'guardias' | 'ruta' | 'confirmacion' | 'exito';
type Placements = Record<string, RoutePoint>;
type Confirmacion = { guardiaId: string; patrullaId: string };

const PASOS: Record<Modo | 'punto', { id: Exclude<Step, 'exito'>; etiqueta: string }[]> = {
  modalidad: [
    { id: 'inicio', etiqueta: 'Modalidad' },
    { id: 'guardias', etiqueta: 'Guardias' },
    { id: 'ruta', etiqueta: 'Ruta' },
    { id: 'confirmacion', etiqueta: 'Confirmar' },
  ],
  guardada: [
    { id: 'inicio', etiqueta: 'Ruta guardada' },
    { id: 'guardias', etiqueta: 'Guardias' },
    { id: 'confirmacion', etiqueta: 'Confirmar' },
  ],
  punto: [
    { id: 'inicio', etiqueta: 'Modalidad' },
    { id: 'punto', etiqueta: 'Punto fijo' },
    { id: 'guardias', etiqueta: 'Guardias' },
    { id: 'confirmacion', etiqueta: 'Confirmar' },
  ],
  programada: [
    { id: 'guardias', etiqueta: 'Guardias' },
    { id: 'confirmacion', etiqueta: 'Confirmar' },
  ],
};

// Coche y moto viajan juntos: un único punto de incorporación sobre la ruta,
// el más cercano al centro de los guardias seleccionados (F2).
const MODALIDADES_EN_UNIDAD: PatrullaModalidad[] = ['coche', 'moto'];

function puntoComun(path: RoutePoint[], posiciones: RoutePoint[]): RoutePoint | null {
  if (path.length === 0) return null;
  if (posiciones.length === 0) return path[0]!;
  const c = {
    lat: posiciones.reduce((a, p) => a + p.lat, 0) / posiciones.length,
    lng: posiciones.reduce((a, p) => a + p.lng, 0) / posiciones.length,
  };
  return path.reduce((mejor, p) =>
    (p.lat - c.lat) ** 2 + (p.lng - c.lng) ** 2 < (mejor.lat - c.lat) ** 2 + (mejor.lng - c.lng) ** 2 ? p : mejor,
  );
}

function detallesNoAsignados(lista: NoAsignado[]): DialogDetalle[] {
  return lista.map((n) => ({ titulo: n.guardiaNombre, texto: n.mensaje, tono: 'peligro' }));
}

interface ConfirmationMapPreviewProps {
  path: RoutePoint[];
  guardPoints: { id: string; label: string; fotoUrl?: string; color: string; point: RoutePoint; currentPosition: RoutePoint | null }[];
  /** Camino real por calles desde la posición actual de cada guardia hasta su punto. */
  joinPaths: Record<string, RoutePoint[]>;
  /** Sin trazado (punto fijo): puntos a encuadrar. */
  encuadre?: RoutePoint[];
}

// Memoizado y aislado: así teclear el nombre/descripción no re-renderiza el
// mapa (Leaflet reposiciona capas y robaba el foco del input).
const ConfirmationMapPreview = memo(function ConfirmationMapPreview({ path, guardPoints, joinPaths, encuadre }: ConfirmationMapPreviewProps) {
  return (
    <div className="relative mb-4 h-[200px] overflow-hidden rounded-lg border border-neutral-border">
      <MapCanvas>
        {path.length >= 2 && (
          <Polyline positions={path.map((p) => [p.lat, p.lng])} pathOptions={{ color: '#A97F52', weight: 4, opacity: 0.9 }} />
        )}
        {guardPoints.map((g) => {
          // Camino más rápido por calles, con el mismo estilo que en el mapa en
          // vivo (roja y discontinua, ESTILO_INCORPORACION). Mientras se
          // calcula no se dibuja nada: la recta provisoria cruzaba manzanas.
          const join = joinPaths[g.id] ?? null;
          return (
            <span key={g.id}>
              {join && join.length >= 2 && (
                <Polyline positions={join.map((p) => [p.lat, p.lng])} interactive={false} pathOptions={ESTILO_INCORPORACION} />
              )}
              <Marker position={[g.point.lat, g.point.lng]} icon={guardPointIcon(g.color, g.label, g.fotoUrl)} />
            </span>
          );
        })}
        <EncuadrarRuta path={path.length >= 2 ? path : (encuadre ?? [])} />
      </MapCanvas>
    </div>
  );
});

// El mini-mapa abre encuadrado en el trazado (antes abría en el centro por
// defecto de la ciudad y una ruta guardada podía quedar fuera de la vista).
function EncuadrarRuta({ path }: { path: RoutePoint[] }) {
  return path.length >= 2 ? <EncuadrarRutaInner path={path} /> : null;
}
function EncuadrarRutaInner({ path }: { path: RoutePoint[] }) {
  const map = useMap();
  useEffect(() => {
    const encuadrar = () => map.fitBounds(path.map((p) => [p.lat, p.lng]) as [number, number][], { padding: [24, 24], maxZoom: 16, animate: false });
    encuadrar();
    // El modal entra con animación: Leaflet midió el contenedor a medio
    // crecer (mapa a medias y fuera de cuadro). Se vuelve a medir al terminar.
    const t = setTimeout(() => {
      map.invalidateSize();
      encuadrar();
    }, 320);
    return () => clearTimeout(t);
  }, [map, path]);
  return null;
}

export interface AssignRouteWizardProps {
  isOpen: boolean;
  onClose: () => void;
  guards: Guard[];
  markers: GuardMarker[];
  rutas: RutaPlantillaRow[];
  /** Jurisdicción por EPI. `null` bloquea edición hasta que el API responda. */
  jurisdiccion?: Jurisdiccion | null;
  preselectedGuardId?: string;
  /** Abre directo con esta ruta guardada elegida (desde "Rutas Guardadas" → Asignar). */
  rutaInicialId?: string;
  /** F4: catálogo de puntos fijos con su ocupación (GET /puntos-fijos). */
  puntosFijos?: PuntoFijoRow[];
  /** Abre directo con este punto fijo elegido (desde el pin del mapa). */
  puntoInicialId?: string;
  /** F5: asignar guardias a este horario programado (desde la agenda). */
  horario?: HorarioParaAsignar;
  /** Texto del botón para salir en el modo horario (por defecto «Volver a la agenda»). */
  textoSalirHorario?: string;
  onAssigned: () => void;
}

export function AssignRouteWizard({
  isOpen,
  onClose,
  guards,
  markers,
  rutas: todasLasRutas,
  puntosFijos = [],
  jurisdiccion = null,
  preselectedGuardId,
  rutaInicialId,
  puntoInicialId,
  horario,
  textoSalirHorario = 'Volver a la agenda',
  onAssigned,
}: AssignRouteWizardProps) {
  const dialogo = useDialog();
  // Jurisdicción: un Operador solo ve rutas y guardias de su EPI (el backend lo revalida).
  const rutas = useMemo(
    () =>
      todasLasRutas
        .filter((r) => puedeEditarEn(jurisdiccion, r.epiId) && r.trazado.length >= MIN_PUNTOS)
        // Predeterminadas primero, luego recurrentes (orden de visibilidad pedido).
        .sort((a, b) => Number(b.tipo === 'establecida') - Number(a.tipo === 'establecida') || a.nombre.localeCompare(b.nombre)),
    [todasLasRutas, jurisdiccion],
  );
  const [modo, setModo] = useState<Modo>('modalidad');
  const [step, setStep] = useState<Step>('inicio');
  const [modalidad, setModalidad] = useState<PatrullaModalidad | null>(null);
  const [rutaPlantillaId, setRutaPlantillaId] = useState<string | null>(null);
  // F4: punto (o subpunto) fijo elegido y, si tiene subpuntos, el de cada guardia ('' = automático).
  const [puntoId, setPuntoId] = useState<string | null>(null);
  const [subpuntoPor, setSubpuntoPor] = useState<Record<string, string>>({});
  const [busqueda, setBusqueda] = useState('');
  const [selectedGuardIds, setSelectedGuardIds] = useState<string[]>([]);
  const [lastCheckedIndex, setLastCheckedIndex] = useState<number | null>(null);
  const [joinPaths, setJoinPaths] = useState<Record<string, RoutePoint[]>>({});
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [guardarRecurrente, setGuardarRecurrente] = useState(false);
  // Clave idempotente: un doble clic o un reintento no duplican la asignación.
  const [claveIdempotencia, setClaveIdempotencia] = useState(nuevaClave);
  // Retiros que el operador ya aceptó en la ventana flotante.
  const [confirmaciones, setConfirmaciones] = useState<Confirmacion[]>([]);
  // Quitados de la selección en la verificación previa: se suman al informe final.
  const [excluidosPrevios, setExcluidosPrevios] = useState<NoAsignado[]>([]);
  const [asignados, setAsignados] = useState(0);
  const [verificando, setVerificando] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plantillaSeleccionada = rutas.find((r) => r.id === rutaPlantillaId) ?? null;
  // Puntos fijos de MI EPI (el backend repite la jurisdicción); los demás no se ofrecen.
  const puntosMios = useMemo(() => puntosFijos.filter((p) => p.activo && puedeEditarEn(jurisdiccion, p.epiCodigo)), [puntosFijos, jurisdiccion]);
  const puntoRaiz = puntoId ? (puntosMios.find((p) => p.id === puntoId || p.subpuntos.some((s) => s.id === puntoId)) ?? null) : null;
  const puntoSel = puntoRaiz ? (puntoRaiz.id === puntoId ? puntoRaiz : (puntoRaiz.subpuntos.find((s) => s.id === puntoId) ?? null)) : null;
  // F5: horario programado elegido en la agenda (su ejecución ya existe).
  const programada = modo === 'programada' && horario ? horario : null;
  const esPunto = modalidad === 'punto_fijo' && (modo === 'modalidad' || Boolean(programada?.puntoFijoId));
  const subpuntosActivos = puntoRaiz && puntoSel?.id === puntoRaiz.id ? puntoRaiz.subpuntos.filter((s) => s.activo) : [];
  const trazado = useTrazadoRuta(modalidad, jurisdiccion, isOpen && modo === 'modalidad');
  const markerById = useMemo(() => new Map(markers.map((m) => [m.id, m])), [markers]);

  // Elegibles a la vista: en servicio, cuenta activa y SIN SOS abierto. Desde
  // F3 los guardias son LIBRES: de cualquier EPI; se listan primero
  // los que hoy están en la EPI del usuario. El backend repite la validación.
  const miEpi = jurisdiccion?.restringido ? jurisdiccion.miEpi : null;
  const assignableGuards = useMemo(
    () =>
      guards
        .filter((g) => g.operationalStatus === 'en_servicio' && g.accountStatus !== 'inactivo' && !markerById.get(g.id)?.hasSos)
        .sort((a, b) => {
          const enMia = (g: Guard) => (miEpi && (markerById.get(g.id)?.zone ?? g.epiActual?.codigo) === miEpi ? 0 : 1);
          return enMia(a) - enMia(b);
        }),
    [guards, markerById, miEpi],
  );
  /** Ocupado por una ruta de OTRA EPI: no se puede retirar, se muestra deshabilitado. */
  const ocupadoAjeno = (id: string) => {
    const o = markerById.get(id)?.ocupacion;
    return o && !o.propia ? o : null;
  };

  useEffect(() => {
    if (!isOpen) return;
    const preseleccion =
      preselectedGuardId && assignableGuards.some((g) => g.id === preselectedGuardId) && !ocupadoAjeno(preselectedGuardId) ? [preselectedGuardId] : [];
    const inicial = !horario && rutaInicialId ? rutas.find((r) => r.id === rutaInicialId) : undefined;
    const puntoInicial = !horario && !inicial && puntoInicialId ? puntosFijos.find((p) => p.id === puntoInicialId) : undefined;
    setModo(horario ? 'programada' : inicial ? 'guardada' : 'modalidad');
    setStep(horario || inicial || puntoInicial ? 'guardias' : 'inicio');
    setModalidad(horario ? (horario.modalidad as PatrullaModalidad) : inicial ? (inicial.modalidad ?? 'coche') : puntoInicial ? 'punto_fijo' : null);
    setRutaPlantillaId(horario?.rutaPlantillaId ?? inicial?.id ?? null);
    setPuntoId(horario?.puntoFijoId ?? puntoInicial?.id ?? null);
    setSubpuntoPor({});
    setBusqueda('');
    setSelectedGuardIds(preseleccion);
    setLastCheckedIndex(null);
    setJoinPaths({});
    setNombre(horario?.nombre ?? inicial?.nombre ?? puntoInicial?.nombre ?? '');
    setDescripcion(inicial?.descripcion ?? '');
    setGuardarRecurrente(false);
    setClaveIdempotencia(nuevaClave());
    setConfirmaciones([]);
    setExcluidosPrevios([]);
    setAsignados(0);
    setError(null);
    trazado.reiniciar();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo reinicia al abrir; `guards`/`rutas` cambian con el refresco en vivo.
  }, [isOpen, preselectedGuardId, rutaInicialId, puntoInicialId, horario?.ejecucionId]);

  // Cambiar de paso limpia el error del paso anterior.
  useEffect(() => setError(null), [step]);

  // Punto fijo: el cupo LIBRE del punto (o subpunto) según el backend.
  // Horario programado: lo que falta para su cupo (el backend lo vuelve a contar).
  const capacidad = programada
    ? Math.max(0, programada.cupo - programada.asignados)
    : esPunto
    ? puntoSel
      ? libresDe(puntoSel)
      : 0
    : PATRULLA_MODALIDAD_CAPACIDAD[modalidad ?? 'coche'];
  const selectedGuards = selectedGuardIds.map((id) => guards.find((g) => g.id === id)).filter((g): g is Guard => Boolean(g));

  const activePath = useMemo(
    () => (plantillaSeleccionada ? trazadoAPuntos(plantillaSeleccionada.trazado) : trazado.path),
    [plantillaSeleccionada, trazado.path],
  );
  // Un horario programado ya tiene su destino (copia de la ruta o el punto en la ejecución).
  const pathReady = programada ? true : esPunto ? Boolean(puntoSel) : plantillaSeleccionada ? true : trazado.listo;

  const distribution: Placements = useMemo(() => {
    if (!pathReady || selectedGuardIds.length === 0) return {};
    if (esPunto && puntoSel) {
      // Destino de cada guardia: su subpunto elegido o, en automático, el punto.
      return Object.fromEntries(
        selectedGuardIds.map((id) => {
          const sub = subpuntosActivos.find((x) => x.id === subpuntoPor[id]);
          return [id, sub ? { lat: sub.lat, lng: sub.lng } : { lat: puntoSel.lat, lng: puntoSel.lng }];
        }),
      );
    }
    if (modalidad && MODALIDADES_EN_UNIDAD.includes(modalidad)) {
      const posiciones = selectedGuardIds
        .map((id) => markerById.get(id))
        .filter((m): m is GuardMarker => Boolean(m))
        .map((m) => ({ lat: m.lat, lng: m.lng }));
      const p = puntoComun(activePath, posiciones);
      return p ? Object.fromEntries(selectedGuardIds.map((id) => [id, p])) : {};
    }
    return distributeGuardsAlongRoute(
      activePath,
      selectedGuardIds.map((id) => {
        const m = markerById.get(id);
        return { id, position: m ? { lat: m.lat, lng: m.lng } : null };
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- subpuntosActivos deriva de puntoSel
  }, [activePath, selectedGuardIds, markerById, pathReady, modalidad, esPunto, puntoSel, subpuntoPor]);

  // "Cómo llegar" por calles para cada guardia (solo para el mini-mapa).
  useEffect(() => {
    if (step !== 'confirmacion') return;
    const guardIds = Object.keys(distribution);
    if (guardIds.length === 0) {
      setJoinPaths({});
      return;
    }
    let vigente = true;
    Promise.all(
      guardIds.map(async (id) => {
        const m = markerById.get(id);
        // Igual que en el mapa en vivo (useTrayectosIncorporacion): hacia el
        // INICIO de la ruta; en un punto fijo, hacia su (sub)punto.
        const punto = esPunto ? distribution[id] : (activePath[0] ?? distribution[id]);
        if (!m || !punto) return null;
        const origen = { lat: m.lat, lng: m.lng };
        const modo = modoDeViaje(modalidad, distanciaRectaM(origen, punto));
        const resultado = await calcularTrayecto(origen, punto, perfilDe(modo));
        return [id, resultado.path] as const;
      }),
    ).then((pares) => {
      if (!vigente) return;
      const next: Record<string, RoutePoint[]> = {};
      for (const par of pares) if (par) next[par[0]] = par[1];
      setJoinPaths(next);
    });
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- markerById cambia con cada refresco en vivo; basta con el reparto y el paso.
  }, [distribution, modalidad, step]);

  /** Quita de la selección a quien ya no entra por capacidad y lo informa. (F3: la EPI del guardia ya no importa.) */
  async function ajustarSeleccion(nuevaCapacidad: number) {
    const sobran = selectedGuardIds.slice(nuevaCapacidad);
    if (sobran.length === 0) return;
    setSelectedGuardIds(selectedGuardIds.slice(0, nuevaCapacidad));
    const detalles: DialogDetalle[] = sobran.map((id) => ({
      titulo: guardFullName(guards.find((g) => g.id === id) ?? ({ primerNombre: 'Guardia' } as Guard)),
      texto: `La ruta admite hasta ${nuevaCapacidad} guardia(s).`,
    }));
    await dialogo.avisar({ tono: 'advertencia', titulo: 'Se ajustó la selección de guardias', detalles });
  }

  function pickModalidad(m: PatrullaModalidad) {
    // Una ruta guardada elegida antes deja de aplicar (antes quedaba pegada
    // y se asignaba ESA ruta aunque se hubiera elegido "Modalidad").
    setRutaPlantillaId(null);
    setModalidad(m);
    // Sin nombre sugerido: el operador lo escribe (es obligatorio).
    setNombre('');
    setDescripcion('');
    setConfirmaciones([]);
    setPuntoId(null);
    setSubpuntoPor({});
    if (m === 'punto_fijo') {
      // Se elige del catálogo, no se dibuja.
      setStep('punto');
      return;
    }
    void ajustarSeleccion(PATRULLA_MODALIDAD_CAPACIDAD[m]);
    setStep('guardias');
  }

  function pickPunto(p: PuntoFijoRow, raiz: PuntoFijoRow) {
    setPuntoId(p.id);
    setSubpuntoPor({});
    setNombre(p.id === raiz.id ? raiz.nombre : `${raiz.nombre} · ${p.nombre}`);
    setDescripcion('');
    setConfirmaciones([]);
    void ajustarSeleccion(libresDe(p));
    setStep('guardias');
  }

  function pickPlantilla(r: RutaPlantillaRow) {
    const m = r.modalidad ?? 'coche';
    trazado.reiniciar();
    setRutaPlantillaId(r.id);
    setModalidad(m);
    setNombre(r.nombre);
    setDescripcion(r.descripcion ?? '');
    setGuardarRecurrente(false);
    setConfirmaciones([]);
    void ajustarSeleccion(PATRULLA_MODALIDAD_CAPACIDAD[m]);
    setStep('guardias');
  }

  function toggleGuard(id: string, index: number, shiftKey: boolean) {
    const guardia = assignableGuards.find((g) => g.id === id);
    if (!guardia || ocupadoAjeno(id)) return;
    setSelectedGuardIds((prev) => {
      let next: string[];
      if (shiftKey && lastCheckedIndex !== null) {
        const [from, to] = [lastCheckedIndex, index].sort((a, b) => a - b);
        const rango = assignableGuards.slice(from, to + 1).filter((g) => !ocupadoAjeno(g.id)).map((g) => g.id);
        next = Array.from(new Set([...prev, ...rango]));
      } else {
        next = prev.includes(id) ? prev.filter((gid) => gid !== id) : [...prev, id];
      }
      return next.slice(0, capacidad);
    });
    setLastCheckedIndex(index);
  }

  // Paso Guardias → siguiente: se verifica en el servidor y, si hay algo que
  // decir, salta la ventana flotante (en vez de recuadros en el formulario).
  async function continuarDesdeGuardias() {
    setVerificando(true);
    const r = await previewAssignAction(selectedGuardIds, esPunto && !programada ? (puntoId ?? undefined) : undefined, programada?.ejecucionId);
    setVerificando(false);
    if (!r.success) {
      setError(r.error ?? 'No se pudo verificar a los guardias.');
      return;
    }
    const noAsignables = r.noAsignados ?? [];
    const conflictos = r.conflictos ?? [];
    const avisos = r.avisos ?? [];
    const quedan = selectedGuardIds.filter((id) => !noAsignables.some((n) => n.guardiaId === id));

    if (quedan.length === 0) {
      await dialogo.avisar({
        tono: 'peligro',
        titulo: 'Ningún guardia seleccionado puede recibir la ruta',
        detalles: detallesNoAsignados(noAsignables),
      });
      return;
    }

    if (noAsignables.length > 0 || conflictos.length > 0 || avisos.length > 0) {
      const nombreDe = (id: string) => guardFullName(guards.find((g) => g.id === id) ?? ({ primerNombre: 'Guardia' } as Guard));
      const detalles: DialogDetalle[] = [
        ...conflictos.map((c) => ({ titulo: c.guardiaNombre, texto: `Ya está en «${c.rutaNombre ?? 'otra ruta'}»: se le retirará de esa ruta.`, tono: 'advertencia' as const })),
        ...detallesNoAsignados(noAsignables).map((d) => ({ ...d, texto: `No se asignará: ${d.texto}` })),
        ...avisos.map((a) => ({ titulo: nombreDe(a.guardiaId), texto: `${a.mensaje} Su punto se calcula con la última posición conocida.`, tono: 'info' as const })),
      ];
      const ok = await dialogo.confirmar({
        tono: conflictos.length > 0 || noAsignables.length > 0 ? 'advertencia' : 'info',
        titulo:
          conflictos.length > 0
            ? conflictos.length === 1
              ? '¿Retirar a este guardia de su ruta actual?'
              : `¿Retirar a ${conflictos.length} guardias de su ruta actual?`
            : noAsignables.length > 0
              ? 'Algunos guardias no podrán asignarse'
              : 'Algunos guardias no reportan GPS reciente',
        mensaje: conflictos.length > 0 ? 'Si continúas, al asignar esta ruta saldrán de la que tienen ahora.' : '¿Quieres continuar con los demás?',
        detalles,
        textoConfirmar: conflictos.length > 0 ? 'Sí, continuar' : 'Continuar',
      });
      if (!ok) return;
    }

    setSelectedGuardIds(quedan);
    setExcluidosPrevios(noAsignables);
    setConfirmaciones(conflictos.map((c) => ({ guardiaId: c.guardiaId, patrullaId: c.patrullaId })));
    setStep(plantillaSeleccionada || esPunto || programada ? 'confirmacion' : 'ruta');
  }

  function armarIntencion(confs: Confirmacion[], clave: string): AssignRouteInput {
    if (programada) {
      // Se asigna a ESA ejecución: el destino lo fija el servidor (punto o trazado copiado).
      return {
        claveIdempotencia: clave,
        modalidad: modalidad ?? 'coche',
        ejecucionId: programada.ejecucionId,
        nombre: programada.nombre,
        placements: selectedGuardIds.map((id) => ({
          guardiaId: id,
          lat: esPunto ? 0 : (distribution[id]?.lat ?? 0),
          lng: esPunto ? 0 : (distribution[id]?.lng ?? 0),
          ...(subpuntoPor[id] ? { puntoFijoId: subpuntoPor[id] } : {}),
        })),
        confirmaciones: confs,
      };
    }
    if (esPunto && puntoId) {
      // El destino lo fija el catálogo; solo viaja el subpunto elegido (si hay).
      return {
        claveIdempotencia: clave,
        modalidad: 'punto_fijo',
        puntoFijoId: puntoId,
        nombre: nombre.trim(),
        placements: selectedGuardIds.map((id) => ({ guardiaId: id, lat: 0, lng: 0, ...(subpuntoPor[id] ? { puntoFijoId: subpuntoPor[id] } : {}) })),
        confirmaciones: confs,
      };
    }
    return {
      claveIdempotencia: clave,
      modalidad: modalidad ?? 'coche',
      rutaPlantillaId: rutaPlantillaId ?? undefined,
      // Se manda el trazado YA ruteado por calles, no los 2-5 clics.
      puntos: rutaPlantillaId ? undefined : activePath,
      guardarComoRecurrente: !rutaPlantillaId && guardarRecurrente,
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || undefined,
      placements: selectedGuardIds
        .filter((id) => distribution[id])
        .map((id) => ({ guardiaId: id, lat: distribution[id]!.lat, lng: distribution[id]!.lng })),
      confirmaciones: confs,
    };
  }

  async function handleSubmit(confs = confirmaciones, clave = claveIdempotencia) {
    if (!modalidad || !pathReady || !nombre.trim()) return;
    setIsSubmitting(true);
    setError(null);
    const result = await assignRouteAction(armarIntencion(confs, clave));
    setIsSubmitting(false);

    if (result.success) {
      setAsignados(result.asignados ?? 0);
      setStep('exito');
      onAssigned();
      const fuera = [...excluidosPrevios, ...(result.noAsignados ?? [])];
      if (fuera.length > 0) {
        void dialogo.avisar({
          tono: 'advertencia',
          titulo: `Se asignó la ruta a ${result.asignados ?? 0} de ${(result.asignados ?? 0) + fuera.length} guardias`,
          mensaje: 'Estos guardias no quedaron asignados:',
          detalles: detallesNoAsignados(fuera),
        });
      }
      return;
    }

    if (result.conflictos && result.conflictos.length > 0) {
      // Algo cambió desde la verificación: se pide confirmar lo NUEVO (el
      // consentimiento anterior no se reutiliza) y se reintenta con otra clave.
      const ok = await dialogo.confirmar({
        tono: 'advertencia',
        titulo: 'Mientras tanto, algunos guardias recibieron otra ruta',
        mensaje: '¿Retirarlos de esa ruta y asignarles esta?',
        detalles: result.conflictos.map((c) => ({ titulo: c.guardiaNombre, texto: `Ahora está en «${c.rutaNombre ?? 'otra ruta'}».` })),
        textoConfirmar: 'Retirar y asignar',
      });
      const nuevas = result.conflictos.map((c) => ({ guardiaId: c.guardiaId, patrullaId: c.patrullaId }));
      const clave2 = nuevaClave();
      setConfirmaciones(nuevas);
      setClaveIdempotencia(clave2);
      if (ok) await handleSubmit(nuevas, clave2);
      return;
    }

    if (result.noAsignados && result.noAsignados.length > 0) {
      await dialogo.avisar({
        tono: 'peligro',
        titulo: 'Ningún guardia pudo ser asignado',
        detalles: detallesNoAsignados([...excluidosPrevios, ...result.noAsignados]),
      });
      setClaveIdempotencia(nuevaClave());
      setStep('guardias');
      return;
    }

    await dialogo.avisar({ tono: 'peligro', titulo: 'No se pudo asignar la ruta', mensaje: result.error ?? 'Intenta nuevamente.' });
  }

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

  // Posición GPS actual de los guardias elegidos, para el mapa del paso Ruta.
  const posicionesGuardias = useMemo(
    () =>
      selectedGuardIds
        .map((id, i) => {
          const g = guards.find((guard) => guard.id === id);
          const m = markerById.get(id);
          if (!g || !m) return null;
          return { id, label: guardInitials(g), fotoUrl: g.fotoUrl, color: ROUTE_COLOR_PALETTE[i % ROUTE_COLOR_PALETTE.length], pos: { lat: m.lat, lng: m.lng } };
        })
        .filter((g): g is NonNullable<typeof g> => g !== null),
    [selectedGuardIds, guards, markerById],
  );
  const centrarEn = useMemo(() => posicionesGuardias.map((g) => g.pos), [posicionesGuardias]);

  const rutasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return q ? rutas.filter((r) => r.nombre.toLowerCase().includes(q) || (r.descripcion ?? '').toLowerCase().includes(q)) : rutas;
  }, [rutas, busqueda]);
  const pasos = PASOS[programada ? 'programada' : esPunto ? 'punto' : modo];
  const indicePaso = pasos.findIndex((p) => p.id === step);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={programada ? 'Asignar guardias al horario' : 'Asignar Ruta'} widthClassName="max-w-[720px]" accent="gold">
      {step === 'exito' ? (
        <div className="animate-fade-in p-6 text-center">
          <div className="mb-3.5 flex justify-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-risk-low/10">
              <CheckCircle2 className="h-6 w-6 text-risk-low" aria-hidden="true" />
            </span>
          </div>
          <p className="mb-1 text-base font-semibold text-primary-900">{programada ? 'Guardias asignados al horario' : esPunto ? 'Guardias asignados al punto' : 'Ruta asignada'}</p>
          <p className="mb-4 text-[12.5px] text-neutral-text-muted">
            {asignados} guardia(s) recibieron «{nombre.trim()}».{' '}
            {programada && new Date(programada.inicio).getTime() > Date.now() ? `Empiezan su servicio a las ${horaLocal(programada.inicio)}. ` : ''}
            {esPunto ? 'Cada uno verá en su celular el punto y cómo llegar.' : 'Cada uno verá en su celular el trazado y cómo incorporarse.'}
            {guardarRecurrente && !rutaPlantillaId ? ' La ruta quedó guardada en «Rutas Guardadas».' : ''}
          </p>
          <Button variant="brand" onClick={onClose} className="w-full">
            Cerrar
          </Button>
        </div>
      ) : (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 border-b border-neutral-border px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-neutral-text-muted">
            {pasos.map((p, i) => (
              <span key={p.id} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-neutral-border">—</span>}
                <span className={i === indicePaso ? 'text-accent-700' : i < indicePaso ? 'text-primary-800' : ''}>
                  {i + 1}. {p.etiqueta}
                </span>
              </span>
            ))}
          </div>

          {error && (
            <div role="alert" className="mx-5 mt-3.5 animate-fade-in rounded-md border border-risk-critical/20 bg-risk-critical/10 px-3 py-2.5 text-xs text-risk-critical">
              {error}
            </div>
          )}

          {/* Paso 1 — modalidad o ruta guardada */}
          {step === 'inicio' && (
            <div className="p-5">
              <div className="mb-4 flex gap-1 border-b border-neutral-border">
                {(['modalidad', 'guardada'] as Modo[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setModo(m)}
                    className={[
                      'border-b-2 px-3 py-2 text-sm font-medium transition-colors duration-200',
                      modo === m ? 'border-accent-600 text-accent-700' : 'border-transparent text-neutral-text-muted hover:text-neutral-text',
                    ].join(' ')}
                  >
                    {m === 'modalidad' ? 'Modalidad' : 'Usar Ruta Guardada'}
                  </button>
                ))}
              </div>

              {modo === 'modalidad' ? (
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {PATRULLA_MODALIDADES.map((m) => {
                    const Icon = MODALIDAD_ICONS[m];
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => pickModalidad(m)}
                        className="group flex cursor-pointer flex-col items-start gap-2 rounded-xl border border-neutral-border bg-white p-3.5 text-left transition-colors duration-200 hover:border-primary-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2"
                      >
                        <span className="icon-badge h-10 w-10 transition-colors duration-200 group-hover:bg-primary-900 group-hover:text-accent-500 group-hover:ring-primary-900">
                          <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                        </span>
                        <p className="text-[13px] font-semibold text-primary-900">{PATRULLA_MODALIDAD_LABELS[m]}</p>
                        <p className="text-[11px] text-neutral-text-muted">
                          {m === 'punto_fijo' ? 'Elige un punto del catálogo' : `Hasta ${PATRULLA_MODALIDAD_CAPACIDAD[m]} guardia(s)`}
                        </p>
                      </button>
                    );
                  })}
                </div>
              ) : rutas.length === 0 ? (
                <p className="py-8 text-center text-sm text-neutral-text-muted">
                  Todavía no hay rutas guardadas. Crea una en «Crear Ruta» o marca «Guardar como ruta recurrente» al asignar.
                </p>
              ) : (
                <>
                  <div className="relative mb-2">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-text-muted" aria-hidden="true" />
                    <input
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      placeholder="Buscar ruta…"
                      aria-label="Buscar ruta guardada"
                      className="h-9 w-full rounded-md border border-neutral-border pl-8 pr-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
                    />
                  </div>
                  <ul className="scrollbar-hidden flex max-h-[360px] flex-col divide-y divide-neutral-bg overflow-y-auto">
                    {rutasFiltradas.map((r) => {
                      const Icon = MODALIDAD_ICONS[r.modalidad ?? 'coche'];
                      return (
                        <li key={r.id}>
                          <button
                            type="button"
                            onClick={() => pickPlantilla(r)}
                            className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors duration-200 hover:bg-neutral-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
                          >
                            <Icon className="h-4 w-4 shrink-0 text-primary-700" aria-hidden="true" />
                            <div className="min-w-0 flex-1">
                              <p className="flex items-center gap-1.5 truncate text-[13px] font-semibold text-neutral-text">
                                {r.nombre}
                                {r.tipo === 'establecida' && (
                                  <span className="shrink-0 rounded bg-primary-100 px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-primary-800">{TIPO_RUTA_LABELS.establecida}</span>
                                )}
                              </p>
                              <p className="truncate text-[11.5px] text-neutral-text-muted">
                                <EpiNombre codigo={r.epiId} />
                                {` · ${PATRULLA_MODALIDAD_LABELS[r.modalidad ?? 'coche']} · hasta ${PATRULLA_MODALIDAD_CAPACIDAD[r.modalidad ?? 'coche']}`}
                                {r.descripcion ? ` — ${r.descripcion}` : ''}
                              </p>
                            </div>
                            <ChevronRight className="h-4 w-4 shrink-0 text-neutral-text-muted" aria-hidden="true" />
                          </button>
                        </li>
                      );
                    })}
                    {rutasFiltradas.length === 0 && <li className="py-6 text-center text-[12.5px] text-neutral-text-muted">Ninguna ruta coincide con la búsqueda.</li>}
                  </ul>
                </>
              )}
            </div>
          )}

          {/* Paso Punto fijo (F4): catálogo de la EPI con ocupación real */}
          {step === 'punto' && (
            <div className="p-5">
              {puntosMios.length === 0 ? (
                <p className="py-8 text-center text-sm text-neutral-text-muted">
                  Tu EPI todavía no tiene puntos fijos. Agrégalos en «Rutas» → «Puntos Fijos».
                </p>
              ) : (
                <ul className="scrollbar-hidden flex max-h-[380px] flex-col divide-y divide-neutral-bg overflow-y-auto rounded-lg border border-neutral-border">
                  {puntosMios.map((p) => {
                    const subs = p.subpuntos.filter((x) => x.activo);
                    const fila = (x: PuntoFijoRow, sub: boolean) => {
                      const libres = libresDe(x);
                      return (
                        <button
                          key={x.id}
                          type="button"
                          disabled={libres === 0}
                          onClick={() => pickPunto(x, p)}
                          className={[
                            'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-200',
                            'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600',
                            sub ? 'pl-10' : '',
                            libres === 0 ? 'cursor-not-allowed opacity-45' : 'hover:bg-neutral-bg',
                          ].join(' ')}
                        >
                          <Flag className={['h-4 w-4 shrink-0', sub ? 'text-neutral-text-muted' : 'text-primary-700'].join(' ')} aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-semibold text-neutral-text">
                              {x.nombre}
                              {!sub && subs.length > 0 ? <span className="font-normal text-neutral-text-muted"> · {subs.length} subpuntos</span> : null}
                            </p>
                            <p className="truncate text-[11.5px] text-neutral-text-muted">
                              {x.ocupantes && x.ocupantes.length > 0 ? x.ocupantes.map((o) => o.guardiaNombre).join(', ') : 'Sin guardias asignados'}
                              {x.coordenadasAproximadas ? ' · ubicación aproximada' : ''}
                            </p>
                          </div>
                          <span
                            className={[
                              'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold',
                              libres === 0 ? 'bg-risk-critical/10 text-risk-critical' : x.ocupados > 0 ? 'bg-risk-medium/15 text-[#B45309]' : 'bg-risk-low/10 text-risk-low',
                            ].join(' ')}
                            title={`${x.ocupados} asignado(s) de ${x.capacidad}`}
                          >
                            {x.ocupados}/{x.capacidad}
                            {libres === 0 ? ' · completo' : ''}
                          </span>
                          {libres > 0 && <ChevronRight className="h-4 w-4 shrink-0 text-neutral-text-muted" aria-hidden="true" />}
                        </button>
                      );
                    };
                    return (
                      <li key={p.id}>
                        {fila(p, false)}
                        {subs.map((x) => fila(x, true))}
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="mt-2 text-[11.5px] text-neutral-text-muted">
                Elige el punto completo (los guardias se reparten entre sus subpuntos) o un subpunto concreto.
              </p>
              <div className="mt-4 flex gap-2.5">
                <Button type="button" variant="secondary" onClick={() => setStep('inicio')} className="flex-1">
                  Atrás
                </Button>
              </div>
            </div>
          )}

          {/* Paso 2 — guardias */}
          {step === 'guardias' && (
            <div className="p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-[12.5px] text-neutral-text-muted">
                  {programada ? (
                    <>
                      Horario: <span className="font-semibold text-neutral-text">{programada.nombre}</span> {horaLocal(programada.inicio)}–{horaLocal(programada.fin)} · faltan {capacidad} ·{' '}
                    </>
                  ) : (
                    <>
                      {plantillaSeleccionada ? <>Ruta: <span className="font-semibold text-neutral-text">{plantillaSeleccionada.nombre}</span> · </> : null}
                      {esPunto && puntoSel ? <>Punto: <span className="font-semibold text-neutral-text">{nombre}</span> · </> : null}
                    </>
                  )}
                  {modalidad ? PATRULLA_MODALIDAD_LABELS[modalidad] : ''} · Shift + clic para elegir un rango.
                </p>
                <span className="shrink-0 rounded-full bg-neutral-bg px-2.5 py-1 text-[11px] font-semibold text-neutral-text">
                  {selectedGuardIds.length}/{capacidad}
                </span>
              </div>

              {assignableGuards.length === 0 ? (
                <p className="py-8 text-center text-sm text-neutral-text-muted">No hay guardias en servicio disponibles para asignar en este momento.</p>
              ) : (
                <ul className="scrollbar-hidden flex max-h-[360px] flex-col divide-y divide-neutral-bg overflow-y-auto rounded-lg border border-neutral-border">
                  {assignableGuards.map((guard, index) => {
                    const isChecked = selectedGuardIds.includes(guard.id);
                    const ajeno = ocupadoAjeno(guard.id);
                    const isDisabled = !isChecked && (selectedGuardIds.length >= capacidad || Boolean(ajeno));
                    const enRuta = markerById.get(guard.id)?.rutaAsignada;
                    const epiAhora = markerById.get(guard.id)?.zone ?? guard.epiActual?.codigo ?? null;
                    return (
                      <li key={guard.id}>
                        <button
                          type="button"
                          disabled={isDisabled}
                          onClick={(event) => toggleGuard(guard.id, index, event.shiftKey)}
                          className={[
                            'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-200',
                            'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2',
                            isDisabled ? 'cursor-not-allowed opacity-40' : 'hover:bg-neutral-bg',
                            isChecked ? 'bg-accent-100/60' : '',
                          ].join(' ')}
                        >
                          <input type="checkbox" checked={isChecked} disabled={isDisabled} readOnly className="pointer-events-none h-4 w-4" />
                          {guard.fotoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- foto remota del backend
                            <img src={guard.fotoUrl} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                          ) : (
                            <span className="avatar-initials h-8 w-8 text-[11px]">{guardInitials(guard)}</span>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[12.5px] font-medium text-neutral-text">{guardFullName(guard)}</p>
                            <p className="truncate text-[11px] text-neutral-text-muted">
                              {epiAhora ? <>Ahora en <EpiNombre codigo={epiAhora} /></> : 'Sin GPS'}
                            </p>
                            {ajeno && (
                              <p className="truncate text-[10.5px] font-medium text-neutral-text-muted">
                                En una ruta de <EpiNombre codigo={ajeno.epiCodigo} /> (no se puede retirar)
                              </p>
                            )}
                            {enRuta && (
                              <p className="flex items-center gap-1 truncate text-[10.5px] font-medium text-[#B45309]">
                                <RouteIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
                                Ya en ruta: {enRuta.nombre}
                              </p>
                            )}
                          </div>
                          <span className={['shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold', OPERATIONAL_STATUS_BADGE_CLASS[guard.operationalStatus]].join(' ')}>
                            {OPERATIONAL_STATUS_LABELS[guard.operationalStatus]}
                          </span>
                          {isChecked && <Check className="h-3.5 w-3.5 shrink-0 text-primary-700" aria-hidden="true" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="mt-4 flex gap-2.5">
                <Button type="button" variant="secondary" onClick={() => (programada ? onClose() : setStep(esPunto ? 'punto' : 'inicio'))} className="flex-1">
                  {programada ? textoSalirHorario : 'Atrás'}
                </Button>
                <Button type="button" variant="brand" onClick={continuarDesdeGuardias} isLoading={verificando} disabled={selectedGuardIds.length === 0} className="flex-1">
                  Siguiente
                </Button>
              </div>
            </div>
          )}

          {/* Paso 3 — trazado nuevo (solo en "Modalidad") */}
          {step === 'ruta' && (
            <div className="p-5">
              <TrazadoEditor trazado={trazado} jurisdiccion={jurisdiccion} onError={setError} centrarEn={centrarEn}>
                {posicionesGuardias.map((g) => (
                  <Marker key={`actual-${g.id}`} position={[g.pos.lat, g.pos.lng]} icon={guardPointIcon(g.color, g.label, g.fotoUrl)} />
                ))}
              </TrazadoEditor>
              <div className="mt-4 flex gap-2.5">
                <Button type="button" variant="secondary" onClick={() => setStep('guardias')} className="flex-1">
                  Atrás
                </Button>
                <Button type="button" variant="brand" onClick={() => setStep('confirmacion')} disabled={!trazado.listo} className="flex-1">
                  {trazado.listo ? 'Siguiente' : trazado.calculando ? 'Calculando…' : trazado.fueraDeEpi ? 'Fuera de tu EPI' : `Marca al menos ${MIN_PUNTOS} puntos`}
                </Button>
              </div>
            </div>
          )}

          {/* Paso final — confirmación */}
          {step === 'confirmacion' && (
            <div className="p-5">
              <div className="mb-3 flex flex-wrap gap-2">
                {previewGuardPoints.map((g) => (
                  <span key={g.id} className="flex items-center gap-1.5 rounded-full border border-neutral-border bg-neutral-bg py-1 pl-1 pr-2.5 text-[11.5px] font-medium text-neutral-text">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ backgroundColor: g.color }}>
                      {g.label}
                    </span>
                    {guardFullName(selectedGuards.find((sg) => sg.id === g.id)!)}
                    {confirmaciones.some((c) => c.guardiaId === g.id) && <span className="text-[#B45309]">(cambia de ruta)</span>}
                  </span>
                ))}
              </div>

              <ConfirmationMapPreview
                path={esPunto ? [] : activePath}
                guardPoints={previewGuardPoints}
                joinPaths={joinPaths}
                encuadre={esPunto && puntoSel ? [{ lat: puntoSel.lat, lng: puntoSel.lng }, ...previewGuardPoints.flatMap((g) => (g.currentPosition ? [g.currentPosition] : []))] : undefined}
              />

              {esPunto ? (
                subpuntosActivos.length > 0 && (
                  <div className="mb-3 rounded-lg border border-neutral-border p-3">
                    <p className="mb-2 text-[12px] font-semibold text-neutral-text">Subpunto de cada guardia</p>
                    <div className="flex flex-col gap-2">
                      {selectedGuardIds.map((id) => {
                        const g = guards.find((x) => x.id === id);
                        if (!g) return null;
                        return (
                          <label key={id} className="flex items-center gap-2 text-[12px]">
                            <span className="min-w-0 flex-1 truncate">{guardFullName(g)}</span>
                            <select
                              value={subpuntoPor[id] ?? ''}
                              onChange={(e) => setSubpuntoPor({ ...subpuntoPor, [id]: e.target.value })}
                              disabled={isSubmitting}
                              aria-label={`Subpunto de ${guardFullName(g)}`}
                              className="h-8 rounded-md border border-neutral-border px-2 text-[12px] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
                            >
                              <option value="">Automático (el de más cupo)</option>
                              {subpuntosActivos.map((x) => (
                                <option key={x.id} value={x.id} disabled={!programada && libresDe(x) === 0}>
                                  {x.nombre} ({x.ocupados}/{x.capacidad})
                                </option>
                              ))}
                            </select>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )
              ) : programada ? null : (
                <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input
                    label="Nombre de la ruta"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej. Patrullaje Plaza 14 de Septiembre"
                    required
                    disabled={isSubmitting}
                    accent="gold"
                  />
                  <Input label="Descripción (opcional)" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} disabled={isSubmitting} accent="gold" />
                </div>
              )}

              <p className="mb-3 text-[11.5px] text-neutral-text-muted">
                {modalidad ? PATRULLA_MODALIDAD_LABELS[modalidad] : ''}
                {programada
                  ? ` · Horario programado ${horaLocal(programada.inicio)}–${horaLocal(programada.fin)}: ${
                      new Date(programada.inicio).getTime() > Date.now()
                        ? `quedan asignados y empiezan su servicio a las ${horaLocal(programada.inicio)}`
                        : 'empiezan ahora'
                    }; salen al terminar el horario`
                  : esPunto
                  ? ` · ${nombre} · sin límite de tiempo: el guardia sale del punto al cerrar su turno o cuando lo retires`
                  : plantillaSeleccionada
                  ? ` · ${plantillaSeleccionada.tipo === 'establecida' ? 'Predeterminada' : 'Recurrente'} · sin límite de tiempo: termina cuando la canceles o sus guardias cierren turno`
                  : ` · ${guardarRecurrente ? 'Recurrente' : 'Dinámica'} · sin límite de tiempo: termina cuando la canceles o sus guardias cierren turno`}
              </p>

              {!plantillaSeleccionada && !esPunto && !programada && (
                <label className="mb-4 flex items-start gap-2 text-[12px] text-neutral-text">
                  <input type="checkbox" checked={guardarRecurrente} onChange={(e) => setGuardarRecurrente(e.target.checked)} disabled={isSubmitting} className="mt-0.5 accent-primary-700" />
                  Guardar como ruta recurrente (aparecerá en «Rutas Guardadas» para reutilizarla)
                </label>
              )}

              <div className="flex gap-2.5">
                <Button type="button" variant="secondary" onClick={() => setStep(plantillaSeleccionada || esPunto || programada ? 'guardias' : 'ruta')} className="flex-1" disabled={isSubmitting}>
                  Atrás
                </Button>
                <Button type="button" variant="brand" onClick={() => void handleSubmit()} isLoading={isSubmitting} disabled={!nombre.trim() || !pathReady} className="flex-1">
                  {programada ? 'Asignar al horario' : esPunto ? 'Asignar al punto' : 'Asignar Ruta'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
