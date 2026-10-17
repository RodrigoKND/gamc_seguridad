'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { getGuardias, getGuardMarkers, getJurisdiccion, getPatrullas, getPuntosFijos, getRutasPlantilla, getZonasCriticas, revalidarHorariosEnVivo } from '@/lib/data-source';
import { canArchiveEstablecida, canWrite } from '@/lib/permissions';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
import { useRealtimeSocket } from '@/lib/realtime/RealtimeProvider';
import type { Guard } from '@/features/guardias/types';
import type { PatrullaRow, RutaPlantillaRow } from '@/types/patrulla';
import type { ZonaCriticaActivaRow } from '@/types/hecho';
import type { PuntoFijoRow } from '@/types/puntoFijo';
import type { HorarioParaAsignar } from '@/types/programacion';
import { MapCanvas } from './MapCanvas';
import { MapSearch } from './MapSearch';
import { MapFocus, type MapFocusTarget } from './MapFocus';
import { PatrolLayer } from './PatrolLayer';
import { HeatmapLayer } from './HeatmapLayer';
import { FutureLayerPlaceholder } from './FutureLayerPlaceholder';
import { PatrolRosterPanel } from './PatrolRosterPanel';
import { RiskZonePanel } from './RiskZonePanel';
import { RouteLinesLayer } from './RouteLinesLayer';
import { TelemetryDrawer } from './TelemetryDrawer';
import { AssignRouteWizard } from './AssignRouteWizard';
import { RutasMenu, type OpcionRutas } from './rutas/RutasMenu';
import { RutasPredeterminadasModal } from './rutas/RutasPredeterminadasModal';
import { RutasGuardadasModal } from './rutas/RutasGuardadasModal';
import { PuntosFijosModal } from './rutas/PuntosFijosModal';
import { RutasProgramadasModal } from './rutas/RutasProgramadasModal';
import { PuntosFijosLayer } from './PuntosFijosLayer';
import { TrayectosLayer } from './TrayectosLayer';
import { DesviacionesPanel, type Desvio } from './DesviacionesPanel';
import { EpiJurisdictionLayer } from './EpiJurisdictionLayer';
import { MapLegend } from './MapLegend';
import { CAPAS_POR_DEFECTO, MapLayerToggles, type CapaId, type CapasVisibles } from './MapLayerToggles';
import { useTrayectosIncorporacion } from '../hooks/useTrayectosIncorporacion';
import { puedeEditarEn, type Jurisdiccion } from '../lib/jurisdiccion';
import { ZOOM_MAXIMO } from '../lib/capas';
import { useRealtimeMap } from '../hooks/useRealtimeMap';
import { useRealtimeEvent } from '@/lib/realtime/RealtimeProvider';
import { useDialog } from '@/components/ui/AlertDialog';
import { PROFILE_COOKIE_NAME, parseSessionCookie } from '@/lib/auth-session-shared';
import { resumeAutomaticaAction } from '../actions/programacion';
import { REALTIME_EVENTS } from '@/lib/api/realtime';
import { clearSosAction } from '../actions/clearSos';
import { cancelGuardFromRouteAction, cancelRouteAction } from '../actions/cancelRoute';
import { groupPatrullasByRuta, type RouteGroup } from '../lib/routeGroups';
import type { GuardMarker, MapTab } from '../types';

// RF/RNF: Módulo de Mapas — sub-header de tabs, 48px, sticky bajo topbar,
// colapsa a dropdown <sm (MASTER.md sección 7.1). Transición de capas fade
// duration-200, sin parpadeo del basemap (MASTER.md sección 7.2).
//
// Rediseño: mapa+lista es el patrón estándar de dashboards de flotas en
// vivo (mapa = ubicación, panel = qué necesita atención, drawer = detalle
// y acción) y de paneles de criminalidad (heatmap = referencia espacial,
// lista de hotspots = lo que realmente informa la decisión). Antes solo
// existía el mapa desnudo + un drawer al hacer clic en un pin — pobre para
// tener una vista de conjunto. El mapa además ahora vive en una tarjeta
// con borde/sombra (MASTER.md sección 11) en vez de ir a borde de pantalla.
//
// Datos desde el adaptador (lib/data-source.ts) — MASTER.md sección 13,
// instrucción 10.

const TABS: { id: MapTab; label: string }[] = [
  { id: 'patrullaje', label: 'Mapa de Patrullaje en Vivo' },
  { id: 'calor', label: 'Mapa de Calor / Zonas de Riesgo' },
  { id: 'futuro', label: 'Futuras vistas GIS' },
];

// Caché a nivel de módulo (no de componente): sobrevive a que el Operador
// entre y salga del tab Mapas dentro de la misma pestaña del navegador, así
// un ida-y-vuelta rápido entre módulos del dashboard no vuelve a gastar las
// 4 requests de carga (guardias/marcadores/zonas/rutas) si nada cambió. Los
// eventos en vivo (useRealtimeMap) y las acciones que mutan datos (asignar
// ruta, resolver SOS) siempre piden `force: true` — el caché solo evita
// pedir de nuevo algo que sabemos que sigue igual, nunca oculta un cambio
// real.
//
// TTL largo (2026-09-14): antes RealtimeProvider nunca se montaba en el
// layout, así que este TTL de 20s era la única red de seguridad real contra
// datos viejos — de ahí que volver al mapa después de un rato se sintiera
// lento (esperaba a que el caché expirara para volver a pedir todo). Ahora
// que el socket compartido sí está montado (layout.tsx) y todo evento en
// vivo fuerza `loadMapData(true)` sin pasar por el caché, el TTL deja de ser
// el mecanismo de frescura y pasa a ser solo el respaldo para cuando el
// socket está caído/reconectando — puede ser mucho más largo sin arriesgar
// datos obsoletos.
type MapDataCache = {
  /** Usuario dueño de estos datos: nunca se reutilizan con otra cuenta (cada una ve su EPI). */
  usuarioId: string | null;
  guards: Guard[];
  markers: GuardMarker[];
  zonas: ZonaCriticaActivaRow[];
  rutas: RutaPlantillaRow[];
  patrullas: PatrullaRow[];
  puntos: PuntoFijoRow[];
  loadedAt: number;
};
let mapDataCache: MapDataCache | null = null;

/** Id del usuario de la sesión (cookie de perfil no sensible); null si no hay. */
function usuarioActualId(): string | null {
  if (typeof document === 'undefined') return null;
  const fila = document.cookie.split('; ').find((r) => r.startsWith(`${PROFILE_COOKIE_NAME}=`));
  return parseSessionCookie(fila ? decodeURIComponent(fila.split('=').slice(1).join('=')) : null)?.id ?? null;
}
const MAP_DATA_CACHE_TTL_MS = 5 * 60_000;

// Capas visibles: preferencia de cada navegador (comodidad, no dato crítico).
const CLAVE_CAPAS = 'gamc_mapa_capas';
const CAPAS_PATRULLAJE: CapaId[] = ['territorios', 'sedes', 'rutas', 'trayectos', 'puntos', 'modulos'];
const CAPAS_CALOR: CapaId[] = ['territorios', 'sedes', 'modulos'];

export function MapasView() {
  const { user } = useAuthSession();
  const searchParams = useSearchParams();
  const canAssignRoute = user ? canWrite(user.role, 'patrullaje') : false;
  // Rutas predeterminadas (F2): los 3 roles; el Admin solo gestiona estas.
  const canPredeterminadas = user ? canWrite(user.role, 'rutas_establecidas') : false;
  // Puntos fijos (F4): Operador (en su EPI) y Super Admin; el Admin solo los ve.
  const canPuntosFijos = user ? canWrite(user.role, 'puntos_fijos') : false;
  // Programación (F5): Operador (en su EPI) y Super Admin programan; el Admin ve la agenda.
  const canProgramar = user ? canWrite(user.role, 'programacion_rutas') : false;

  const [activeTab, setActiveTab] = useState<MapTab>('patrullaje');
  const [selectedGuard, setSelectedGuard] = useState<GuardMarker | null>(null);
  const [selectedZonaId, setSelectedZonaId] = useState<string | null>(null);
  const [focusTarget, setFocusTarget] = useState<MapFocusTarget | null>(null);
  const [markers, setMarkers] = useState<GuardMarker[]>([]);
  const [zonas, setZonas] = useState<ZonaCriticaActivaRow[]>([]);
  const [guards, setGuards] = useState<Guard[]>([]);
  const [rutas, setRutas] = useState<RutaPlantillaRow[]>([]);
  const [patrullas, setPatrullas] = useState<PatrullaRow[]>([]);
  const [puntosFijos, setPuntosFijos] = useState<PuntoFijoRow[]>([]);
  const [capas, setCapas] = useState<CapasVisibles>(CAPAS_POR_DEFECTO);
  useEffect(() => {
    try {
      const guardadas = JSON.parse(localStorage.getItem(CLAVE_CAPAS) ?? 'null') as Partial<CapasVisibles> | null;
      if (guardadas && typeof guardadas === 'object') setCapas((c) => ({ ...c, ...guardadas }));
    } catch {
      /* sin almacenamiento: valores por defecto */
    }
  }, []);
  function cambiarCapa(id: CapaId, valor: boolean) {
    setCapas((c) => {
      const next = { ...c, [id]: valor };
      try {
        localStorage.setItem(CLAVE_CAPAS, JSON.stringify(next));
      } catch {
        /* ignorar */
      }
      return next;
    });
  }
  // `reanudar`: el asistente se abrió por "Manual" al retirar a un guardia de un
  // horario automático; al cerrarlo, la automática sigue con lo que falte.
  const [assignModal, setAssignModal] = useState<{ open: boolean; guardId?: string; rutaId?: string; puntoFijoId?: string; horario?: HorarioParaAsignar; reanudar?: boolean }>({ open: false });
  const [rutasModal, setRutasModal] = useState<'predeterminadas' | 'guardadas' | 'puntos' | 'programadas' | null>(null);
  // Horario programado a resaltar (desde la campana: /mapas?programada=<ejecución>).
  const [programadaEnfocada, setProgramadaEnfocada] = useState<string | null>(null);
  // Jurisdicción por EPI (2026-10-05): capa "cristal" + límites de edición.
  const [jurisdiccion, setJurisdiccion] = useState<Jurisdiccion | null>(null);
  const [jurisdiccionCargando, setJurisdiccionCargando] = useState(true);
  const [jurisdiccionError, setJurisdiccionError] = useState<string | null>(null);
  const [avisoAccion, setAvisoAccion] = useState<string | null>(null);
  // Con los resultados del buscador abiertos se oculta el panel de alertas de
  // ruta: el buscador vive dentro del mapa (contexto de apilamiento propio) y
  // el panel le tapaba la lista de resultados.
  const [buscando, setBuscando] = useState(false);
  const puedeEditarGuardia = useCallback((g: GuardMarker) => puedeEditarEn(jurisdiccion, g.zone), [jurisdiccion]);
  const epiPropiaConPoligono = Boolean(
    jurisdiccion?.miEpi && jurisdiccion.epis.find((epi) => epi.zone === jurisdiccion.miEpi)?.poligono,
  );
  // Sin jurisdicción cargada (o EPI sin polígono) todo lo de rutas queda bloqueado.
  const jurisdiccionLista = Boolean(jurisdiccion && (!jurisdiccion.restringido || epiPropiaConPoligono));
  const puedeGestionarRutas = canAssignRoute && jurisdiccionLista;
  const puedeCrearPredeterminadas = canPredeterminadas && jurisdiccionLista;
  const puedeGestionarPuntos = canPuntosFijos && jurisdiccionLista;
  const opcionesRutas: OpcionRutas[] = [
    ...(puedeCrearPredeterminadas ? (['predeterminadas'] as const) : []),
    ...(puedeGestionarRutas ? (['asignar'] as const) : []),
    ...(puedeGestionarRutas || puedeCrearPredeterminadas ? (['guardadas'] as const) : []),
    ...(puedeGestionarPuntos ? (['puntos'] as const) : []),
    // La agenda la ven los 3 roles (el Admin solo mira).
    ...(jurisdiccionLista ? (['programadas'] as const) : []),
  ];
  function elegirOpcionRutas(opcion: OpcionRutas) {
    if (opcion === 'asignar') setAssignModal({ open: true });
    else setRutasModal(opcion);
  }
  const markersMap = useMemo(() => new Map(markers.map((m) => [m.id, { lat: m.lat, lng: m.lng, nombre: m.nombre }])), [markers]);
  const routeGroups = useMemo(() => groupPatrullasByRuta(patrullas, markersMap), [patrullas, markersMap]);
  const dialogo = useDialog();
  // Camino más rápido y tiempo estimado de llegada de quien se incorpora (16/10).
  const trayectos = useTrayectosIncorporacion(routeGroups, activeTab === 'patrullaje');
  const nombresGuardias = useMemo(() => new Map(markers.map((m) => [m.id, m.nombre])), [markers]);
  // Encuadre inicial por rol (16/10): Admin y Super Admin, el mapa completo; Operador, su EPI.
  const encuadre = user?.role === 'operador_monitoreo' ? 'propia' : 'todo';
  // Estado de ruta (F2): lo calcula el SERVIDOR en cada ping con umbrales
  // por modalidad (antes la web medía 50 m fijos y solo con el mapa abierto).
  // El verde ("en ruta") no se lista: se da por hecho.
  const desviaciones = useMemo(() => {
    const m = new Map<string, Desvio>();
    for (const g of markers) {
      if (!g.estadoRuta || g.estadoRuta === 'en_ruta') continue;
      m.set(g.id, { lat: g.lat, lng: g.lng, distanciaM: g.distanciaRutaM ?? 0, estado: g.estadoRuta });
    }
    return m;
  }, [markers]);
  const puedeEditarRuta = useCallback(
    (route: RouteGroup) => puedeEditarEn(jurisdiccion, route.ejecucion?.epiCodigo ?? null),
    [jurisdiccion],
  );

  function loadMapData(force = false) {
    if (!force && mapDataCache && mapDataCache.usuarioId === usuarioActualId() && Date.now() - mapDataCache.loadedAt < MAP_DATA_CACHE_TTL_MS) {
      setGuards(mapDataCache.guards);
      setMarkers(mapDataCache.markers);
      setZonas(mapDataCache.zonas);
      setRutas(mapDataCache.rutas);
      setPatrullas(mapDataCache.patrullas);
      setPuntosFijos(mapDataCache.puntos);
      return;
    }

    // getGuardMarkers reusa esta misma lista en vez de volver a pedir
    // /api/guardias internamente (evita duplicar el fetch en cada carga).
    const guardiasPromise = getGuardias();
    const markersPromise = guardiasPromise.then((gs) => getGuardMarkers(gs));
    const zonasPromise = getZonasCriticas();
    const rutasPromise = getRutasPlantilla();
    const patrullasPromise = getPatrullas();
    // Los pines de puntos fijos no deben tumbar el resto del mapa si fallan.
    const puntosPromise = getPuntosFijos().catch(() => [] as PuntoFijoRow[]);

    Promise.all([guardiasPromise, markersPromise, zonasPromise, rutasPromise, patrullasPromise, puntosPromise]).then(
      ([guards, markers, zonas, rutas, patrullas, puntos]) => {
        setGuards(guards);
        setMarkers(markers);
        setZonas(zonas);
        setRutas(rutas);
        setPatrullas(patrullas);
        setPuntosFijos(puntos);
        mapDataCache = { usuarioId: usuarioActualId(), guards, markers, zonas, rutas, patrullas, puntos, loadedAt: Date.now() };
      },
      () => setAvisoAccion('No se pudieron cargar los datos del mapa. Recarga la página para reintentar.'),
    );
  }

  useEffect(() => loadMapData(false), []);
  useEffect(() => {
    let vigente = true;
    setJurisdiccionCargando(true);
    setJurisdiccionError(null);
    getJurisdiccion()
      .then((data) => {
        if (!vigente) return;
        setJurisdiccion(data);
        if (data.restringido && !data.miEpi) {
          setJurisdiccionError('Tu cuenta no tiene una EPI asignada. No puedes crear, asignar ni cancelar rutas.');
        } else if (data.restringido && !data.epis.find((epi) => epi.zone === data.miEpi)?.poligono) {
          setJurisdiccionError('Tu EPI no tiene un polígono de jurisdicción cargado. Las acciones de rutas quedan bloqueadas hasta configurar sus límites.');
        }
      })
      .catch(() => {
        if (!vigente) return;
        setJurisdiccion(null);
        setJurisdiccionError('No se pudo cargar la jurisdicción por EPI. Las acciones de rutas quedan bloqueadas por seguridad.');
      })
      .finally(() => {
        if (vigente) setJurisdiccionCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, []);

  // Recarga completa DEBOUNCED (pedido explícito: "muchos guardias
  // conectados... que se sienta fluido"): si varios guardias arrancan
  // turno casi al mismo tiempo (cambio de turno), cada uno dispara un
  // guardiaUbicacion cuyo primer ping cae en la rama "guardia nuevo" de
  // abajo, que antes llamaba a loadMapData(true) una vez por CADA guardia
  // — 5 fetches x N guardias en el mismo instante. Colapsa cualquier
  // ráfaga de "guardia nuevo" ocurrida dentro de una ventana corta en UNA
  // sola recarga.
  const reloadDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function scheduleFullReload() {
    if (reloadDebounceRef.current) clearTimeout(reloadDebounceRef.current);
    reloadDebounceRef.current = setTimeout(() => {
      reloadDebounceRef.current = null;
      loadMapData(true);
    }, 400);
  }
  useEffect(() => () => {
    if (reloadDebounceRef.current) clearTimeout(reloadDebounceRef.current);
  }, []);

  // Deep-link desde banner SOS / notificaciones: /mapas?guardiaId=xxx centra el mapa y abre el drawer.
  // Espera a la jurisdicción: su encuadre inicial (fitBounds sin animación)
  // llegaba después y deshacía el acercamiento. Se atiende una sola vez por
  // guardia — antes cada recarga de marcadores (ping GPS) volvía a acercar.
  const deepLinkAtendido = useRef<string | null>(null);
  useEffect(() => {
    const guardiaId = searchParams.get('guardiaId');
    if (!guardiaId) {
      deepLinkAtendido.current = null;
      return;
    }
    if (jurisdiccionCargando || markers.length === 0 || deepLinkAtendido.current === guardiaId) return;
    const target = markers.find((m) => m.id === guardiaId);
    if (target) {
      deepLinkAtendido.current = guardiaId;
      setSelectedGuard(target);
      setFocusTarget({ lat: target.lat, lng: target.lng, zoom: 17 });
      setActiveTab('patrullaje');
    }
  }, [searchParams, markers, jurisdiccionCargando]);

  // Deep-link desde la campana (F5): /mapas?programada=<ejecución> abre la agenda en ese horario.
  useEffect(() => {
    const ejecucionId = searchParams.get('programada');
    if (!ejecucionId) return;
    setProgramadaEnfocada(ejecucionId);
    setRutasModal('programadas');
  }, [searchParams]);

  // Recarga en vivo: cuando el móvil manda telemetría/SOS o el Operador
  // asigna una patrulla, el API empuja el evento por socket.io y se vuelve a
  // pedir el estado completo — siempre forzado, nunca desde caché, porque el
  // evento en sí es la señal de que algo cambió.
  useRealtimeMap(() => loadMapData(true));
  // F5: un horario programado empezó, se cerró o relevó a otro (lo hace el
  // planificador del servidor): se invalida la caché y se recarga el mapa.
  useRealtimeEvent<{ soloAgenda?: boolean }>(REALTIME_EVENTS.programacionActualizada, (payload) => {
    // Cambios que solo ven la agenda y la campana (intento sin asignar, radio, modo): el mapa no cambia.
    if (payload?.soloAgenda) return;
    mapDataCache = null;
    void revalidarHorariosEnVivo().finally(() => loadMapData(true));
  });

  // Actualización optimista en vivo: cuando llega telemetría por socket, mueve
  // el pin en el mapa de inmediato sin esperar al fetch de /ubicaciones (que
  // también se dispara arriba). Evita el "no aparece hasta recargar" y hace
  // que el seguimiento se sienta fluido.
  useRealtimeEvent<{ guardiaId: string; lat: number; lng: number; bateriaPct?: number | null; esSos?: boolean; estadoOperativo?: string; capturadoEn?: string; epiActualCodigo?: string | null }>(
    REALTIME_EVENTS.guardiaUbicacion,
    (payload) => {
      if (!payload?.guardiaId || typeof payload.lat !== 'number' || typeof payload.lng !== 'number') return;
      setMarkers((prev) => {
        const idx = prev.findIndex((m) => m.id === payload.guardiaId);
        if (idx === -1) {
          // Guardia que aún no estaba en el mapa (primer ping tras iniciar ruta) — recarga completa para traer foto/nombre/zona.
          scheduleFullReload();
          return prev;
        }
        const next = [...prev];
        const cur = next[idx]!;
        next[idx] = {
          ...cur,
          lat: payload.lat,
          lng: payload.lng,
          // F3: el pin cambia de color al entrar en otra EPI.
          zone: payload.epiActualCodigo !== undefined ? (payload.epiActualCodigo ?? cur.zone) : cur.zone,
          // Reportado 2026-09-19: "la batería ya funciona pero no me
          // actualiza automático, tengo que recargar" — faltaba mergear el
          // % de batería en esta actualización optimista (el resto de
          // campos ya lo hacía), así que solo se veía fresco tras el poll
          // completo de 60s o un F5.
          bateria: payload.bateriaPct !== undefined ? payload.bateriaPct : cur.bateria,
          hasSos: payload.esSos ?? cur.hasSos,
          operationalStatus: (payload.estadoOperativo as GuardMarker['operationalStatus']) ?? cur.operationalStatus,
          capturadoEnIso: payload.capturadoEn ? new Date(payload.capturadoEn).toISOString() : cur.capturadoEnIso,
          ultimoSync: 'hace instantes',
        };
        // Mantener el drawer sincronizado si es el guardia seleccionado
        setSelectedGuard((sel) => (sel?.id === payload.guardiaId ? next[idx]! : sel));
        return next;
      });
    },
  );

  // Alto disponible real (16/10): el `calc(100vh-64px-48px)` no contaba el
  // aviso rojo de SOS de arriba, la página se desplazaba y el pie del mapa
  // (leyenda, atribución) quedaba fuera de la pantalla. Se mide desde donde
  // empieza la vista hasta el borde inferior, y se recalcula si cambia algo
  // arriba (aparece/desaparece el aviso) o el tamaño de la ventana.
  const vistaRef = useRef<HTMLDivElement>(null);
  const [altoVista, setAltoVista] = useState<number | null>(null);
  useEffect(() => {
    const medir = () => {
      const el = vistaRef.current;
      if (!el) return;
      setAltoVista(Math.max(420, Math.floor(window.innerHeight - el.getBoundingClientRect().top - window.scrollY)));
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(document.body);
    window.addEventListener('resize', medir);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', medir);
    };
  }, []);

  const socket = useRealtimeSocket();
  const isSocketConnected = !!socket;

  // Polling adaptativo: cuando el socket está conectado, usar 60s
  // (el push en vivo ya actualiza el mapa); cuando está caído, 15s
  // para no perder datos demasiado tiempo. Antes era siempre 30s.
  useEffect(() => {
    const intervalMs = isSocketConnected ? 60000 : 15000;
    const iv = setInterval(() => loadMapData(true), intervalMs);
    return () => clearInterval(iv);
  }, [isSocketConnected]);

  // Seleccionar un guardia (desde el panel derecho O tocando su pin en el
  // mapa) abre su detalle y centra/acerca el mapa sobre él — antes el pin
  // solo abría el detalle sin zoom. useCallback: el memo de cada pin
  // compara esta referencia, así no se re-crean todos en cada render.
  const selectGuardFromPanel = useCallback((guard: GuardMarker) => {
    setSelectedGuard(guard);
    setFocusTarget({ lat: guard.lat, lng: guard.lng });
  }, []);
  // Clic en el PIN del guardia (16/10): además de abrir su detalle, zoom
  // máximo sobre él al primer clic, para ver exactamente dónde está.
  const selectGuardFromMap = useCallback((guard: GuardMarker) => {
    setSelectedGuard(guard);
    setFocusTarget({ lat: guard.lat, lng: guard.lng, zoom: ZOOM_MAXIMO });
  }, []);

  function selectZonaFromPanel(zona: ZonaCriticaActivaRow) {
    setSelectedZonaId(zona.id);
    setFocusTarget({ lat: zona.centroLat, lng: zona.centroLng, zoom: 16 });
  }

  // El operador resuelve el SOS a mano desde el desplegable del guardia
  // (bug reportado tras la defensa) — cambia el estado operativo real, no
  // solo la vista. Al confirmar, se cierra el desplegable junto con el
  // botón (en vez de dejarlo abierto con el botón desapareciendo de golpe)
  // y se recarga el mapa para que el pin/color vuelvan a la normalidad.
  // F2: se atienden EXACTAMENTE las alertas que el operador está viendo; si
  // llega un SOS nuevo después, sigue abierto. El estado lo deriva el backend.
  async function handleClearSos(guardId: string): Promise<boolean> {
    const alertaIds = markers.find((m) => m.id === guardId)?.sosAlertaIds ?? [];
    // Optimista inmediato: limpia el SOS del panel derecho y del pin sin esperar al fetch
    // (antes solo hacía setSelectedGuard(null)+loadMapData(true) y el `hasSos` quedaba en true
    //  hasta que el polling/revalidate respondiera, por eso "tarda mucho en desaparecer")
    setMarkers((prev) => prev.map((m) => (m.id === guardId ? { ...m, hasSos: false } : m)));
    setSelectedGuard(null);
    // Invalidar caché de módulo para que el reload no sirva datos viejos
    mapDataCache = null;
    const result = await clearSosAction(guardId, alertaIds);
    if (result.success) {
      loadMapData(true);
      return true;
    }
    // Rollback si falla (vuelve a pedir datos reales)
    loadMapData(true);
    return false;
  }

  // Cancelar la ruta (RF-G3-09, 2026-09-14): saca a todos los guardias
  // vigentes de esa ruta compartida — la línea desaparece del mapa
  // (RouteLinesLayer) y de "Rutas Activas" en cuanto loadMapData recarga
  // patrullas/rutas, porque routeGroups.ts solo agrupa filas en estado
  // asignada/en_curso. El pin del guardia en sí NO desaparece: sigue
  // viniendo de telemetría, no de la ruta.
  async function handleCancelRoute(ejecucionId: string): Promise<boolean> {
    // F6: una ruta PROGRAMADA se cancela solo tras confirmarlo en la ventana (no se reabre hoy).
    const grupo = routeGroups.find((g) => g.id === ejecucionId);
    if (grupo?.ejecucion?.programacionId) {
      const ok = await dialogo.confirmar({
        tono: 'peligro',
        titulo: `«${grupo.nombre}» es una ruta programada`,
        mensaje: `Si la cancelas, el horario de hoy queda cancelado y no se vuelve a abrir${grupo.guards.length > 0 ? '; sus guardias quedan libres' : ''}. Quedará registrado como cancelado, no como cubierto. ¿Estás seguro?`,
        detalles: grupo.guards.map((g) => ({ titulo: g.nombre ?? 'Guardia', tono: 'advertencia' as const })),
        textoConfirmar: 'Sí, cancelar la ruta',
        destructivo: true,
      });
      if (!ok) return false;
    }
    const result = await cancelRouteAction(ejecucionId);
    if (result.success) {
      loadMapData(true);
      return true;
    }
    setAvisoAccion(result.error ?? 'No se pudo cancelar la ruta.');
    return false;
  }

  // Complemento (2026-09-14): saca a UN guardia de su ruta sin tocar a los
  // demás — mismo criterio de recarga que handleCancelRoute.
  async function handleCancelGuardFromRoute(patrullaId: string): Promise<boolean> {
    // F6: en una ruta programada se avisa en la ventana; si es automática, el
    // operador elige: Continuar (se busca el reemplazo más cercano) o Manual
    // (abre el selector de guardias para mandar él al reemplazo; luego sigue
    // en automático).
    const grupo = routeGroups.find((g) => g.guards.some((m) => m.patrullaId === patrullaId));
    const nombre = grupo?.guards.find((m) => m.patrullaId === patrullaId)?.nombre ?? 'este guardia';
    let reposicion: 'automatica' | 'manual' | undefined;
    if (grupo?.ejecucion?.programacionId && grupo.ejecucion.asignacionModo === 'automatica') {
      const r = await dialogo.elegir({
        tono: 'advertencia',
        titulo: `¿Retirar a ${nombre} de «${grupo.nombre}»?`,
        mensaje: 'Es una ruta programada automática: el sistema buscará automáticamente el reemplazo más cercano. Elige «Manual» para elegir tú a quién mandar; después sigue en automático.',
        textoCancelar: 'Cancelar',
        textoAlternativo: 'Manual',
        textoConfirmar: 'Continuar',
      });
      if (r === 'cancelar') return false;
      reposicion = r === 'alternativo' ? 'manual' : 'automatica';
    } else if (grupo?.ejecucion?.programacionId) {
      const ok = await dialogo.confirmar({
        tono: 'advertencia',
        titulo: `¿Retirar a ${nombre} de «${grupo.nombre}»?`,
        mensaje: 'Es una ruta programada: su lugar queda libre y el horario avisa en la campana para que asignes a otro guardia.',
        textoConfirmar: 'Retirar',
        destructivo: true,
      });
      if (!ok) return false;
    }
    const result = await cancelGuardFromRouteAction(patrullaId, reposicion);
    if (result.success) {
      loadMapData(true);
      if (reposicion === 'manual' && grupo?.ejecucion) {
        // Selector de guardias vinculado a ESE horario (el sistema le espera mientras elige).
        const e = grupo.ejecucion;
        setAssignModal({
          open: true,
          reanudar: true,
          horario: {
            ejecucionId: e.id,
            nombre: e.nombre,
            modalidad: e.modalidad,
            puntoFijoId: e.puntoFijoId ?? null,
            rutaPlantillaId: patrullas.find((p) => p.id === patrullaId)?.rutaPlantillaId ?? null,
            inicio: e.inicio,
            fin: e.fin ?? e.inicio,
            cupo: e.capacidad,
            asignados: Math.max(0, grupo.guards.length - 1),
          },
        });
      }
      return true;
    }
    setAvisoAccion(result.error ?? 'No se pudo sacar al guardia de la ruta.');
    return false;
  }

  return (
    <div ref={vistaRef} className="flex h-[calc(100vh-64px-48px)] flex-col" style={altoVista ? { height: altoVista } : undefined}>
      {/* Mismo margen que el Topbar (m-3 / lg:m-4) para que pestañas, capas, mapa y panel queden a plomo con él. */}
      <div className="mx-3 rounded-xl border border-neutral-border bg-white px-4 shadow-sm lg:mx-4">
        {/* Dropdown en móvil (<sm) — MASTER.md sección 7.1 */}
        <select
          value={activeTab}
          onChange={(event) => setActiveTab(event.target.value as MapTab)}
          aria-label="Vista del Módulo de Mapas"
          className="block h-12 w-full border-none bg-transparent text-sm font-medium text-neutral-text focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 sm:hidden"
        >
          {TABS.map((tab) => (
            <option key={tab.id} value={tab.id}>
              {tab.label}
            </option>
          ))}
        </select>

        {/* Tabs en desktop — activo: border-b-2 border-accent-600 (paleta del logo, MASTER.md sección 4/10) */}
        <div className="hidden h-12 items-center gap-1 sm:flex">
          <div role="tablist" aria-label="Vistas del Módulo de Mapas" className="flex h-full items-center gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={[
                  'border-b-2 px-3 py-2 text-sm font-medium transition-colors duration-200',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-2',
                  activeTab === tab.id
                    ? 'border-accent-600 text-accent-700'
                    : 'border-transparent text-neutral-text-muted hover:text-neutral-text',
                ].join(' ')}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'patrullaje' && (canAssignRoute || canPredeterminadas) && (
            <RutasMenu
              disponibles={opcionesRutas}
              disabled={opcionesRutas.length === 0}
              cargando={jurisdiccionCargando}
              title={jurisdiccionCargando ? 'Cargando jurisdicción…' : jurisdiccionError ?? undefined}
              onElegir={elegirOpcionRutas}
            />
          )}
        </div>
      </div>

      {/*
        El canvas (MapCanvas: MapContainer + TileLayer) nunca se desmonta al
        cambiar de tab — solo la capa hija activa cambia. Los marcadores/
        círculos de Leaflet se adjuntan al mapa vía efectos imperativos, no
        como hijos normales del DOM, así que envolverlos en un <div> oculto
        con CSS NO los desactiva (seguirían agregados al mapa): la única
        forma correcta de "intercambiar" la capa es des/montar el componente
        de React, lo que agrega/quita sus capas de Leaflet sin tocar el
        MapContainer/TileLayer de abajo.
      */}
      <div className="flex flex-1 gap-4 overflow-hidden p-3 lg:p-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
        {activeTab !== 'futuro' && (
          <MapLayerToggles
            valores={capas}
            onCambiar={cambiarCapa}
            disponibles={activeTab === 'patrullaje' ? CAPAS_PATRULLAJE : CAPAS_CALOR}
            conteos={activeTab === 'patrullaje' ? { rutas: routeGroups.filter((r) => !r.puntoFijo).length, trayectos: trayectos.size, puntos: puntosFijos.length } : {}}
          />
        )}
        <div className="relative flex-1 overflow-hidden rounded-xl border border-neutral-border bg-white shadow-sm">
          <MapCanvas>
            <MapSearch onOpenChange={setBuscando} />
            <MapFocus target={focusTarget} />
            <EpiJurisdictionLayer
              jurisdiccion={jurisdiccion}
              ajustarVista
              encuadre={encuadre}
              mostrarReferencias
              mostrarTerritorios={capas.territorios}
              mostrarSedes={capas.sedes}
              mostrarModulos={capas.modulos}
            />
            {activeTab === 'patrullaje' && (
              <>
                {capas.puntos && (
                  <PuntosFijosLayer
                    puntos={puntosFijos}
                    jurisdiccion={jurisdiccion}
                    onAsignar={puedeGestionarRutas ? (p) => setAssignModal({ open: true, puntoFijoId: p.id }) : undefined}
                    puedeAsignarEn={(codigo) => puedeEditarEn(jurisdiccion, codigo)}
                  />
                )}
                {capas.trayectos && <TrayectosLayer trayectos={trayectos} nombres={nombresGuardias} />}
                {capas.rutas && <RouteLinesLayer routeGroups={routeGroups} />}
                <PatrolLayer guards={markers} selectedId={selectedGuard?.id ?? null} onSelectGuard={selectGuardFromMap} />
              </>
            )}
            {activeTab === 'calor' && (
              <HeatmapLayer zonas={zonas} onSelectZona={(zona) => setSelectedZonaId(zona.id)} />
            )}
           </MapCanvas>
           {activeTab !== 'futuro' && <MapLegend jurisdiccion={jurisdiccion} conSimbolosPatrullaje={activeTab === 'patrullaje'} />}
           {jurisdiccionError && activeTab !== 'futuro' && (
             <div role="alert" className="absolute right-3 top-3 z-[600] flex max-w-[360px] items-start gap-2 rounded-lg border border-risk-critical/30 bg-white px-3 py-2 text-xs text-risk-critical shadow">
               <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
               <span>{jurisdiccionError}</span>
             </div>
           )}
           {avisoAccion && (
             <div role="alert" className="absolute left-1/2 top-3 z-[600] flex max-w-[90%] -translate-x-1/2 items-center gap-2 rounded-lg border border-risk-critical/30 bg-white px-3 py-2 text-xs text-risk-critical shadow">
               <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
               <span>{avisoAccion}</span>
               <button type="button" onClick={() => setAvisoAccion(null)} className="ml-1 font-semibold hover:underline">Cerrar</button>
             </div>
           )}
           {activeTab === 'futuro' && <FutureLayerPlaceholder />}
           {/* Guardias fuera de ruta (RF-G3-09): panel lateral retraíble
               SOBRE el mapa — antes era un bloque en la misma fila flexible
               que el mapa y lo dejaba sin espacio. */}
           {activeTab === 'patrullaje' && !buscando && (
             <DesviacionesPanel
               desviaciones={desviaciones}
               trayectos={trayectos}
               markers={markers}
               onSelect={(marker) => {
                 setSelectedGuard(marker);
                 setFocusTarget({ lat: marker.lat, lng: marker.lng, zoom: 17 });
               }}
             />
           )}
         </div>
        </div>

         {activeTab !== 'futuro' && (
          <div className="hidden w-[340px] shrink-0 overflow-hidden rounded-xl border border-neutral-border bg-white shadow-sm lg:block">
            {activeTab === 'patrullaje' && (
              <PatrolRosterPanel
                guards={markers}
                selectedId={selectedGuard?.id ?? null}
                onSelect={selectGuardFromPanel}
                routeGroups={routeGroups}
                onCancelRoute={puedeGestionarRutas ? handleCancelRoute : undefined}
                onCancelGuardFromRoute={puedeGestionarRutas ? handleCancelGuardFromRoute : undefined}
                desviaciones={desviaciones}
                trayectos={trayectos}
                puedeEditar={puedeEditarGuardia}
                puedeEditarRuta={puedeEditarRuta}
              />
            )}
            {activeTab === 'calor' && (
              <RiskZonePanel zonas={zonas} selectedId={selectedZonaId} onSelect={selectZonaFromPanel} />
            )}
          </div>
        )}
      </div>

      <TelemetryDrawer
        guard={selectedGuard}
        onClose={() => setSelectedGuard(null)}
        // F3: guardias libres — se puede asignar a cualquier guardia, salvo
        // que esté en una ruta de otra EPI (no se puede retirar).
        onAssignRoute={
          puedeGestionarRutas && !(selectedGuard?.ocupacion && !selectedGuard.ocupacion.propia)
            ? (guardId) => {
                setSelectedGuard(null);
                setAssignModal({ open: true, guardId });
              }
            : undefined
        }
        onClearSos={canAssignRoute ? handleClearSos : undefined}
        patrullas={patrullas}
        routeGroups={routeGroups}
        trayecto={selectedGuard ? (trayectos.get(selectedGuard.id) ?? null) : null}
      />

      {puedeGestionarRutas && (
        <AssignRouteWizard
          isOpen={assignModal.open}
          onClose={() => {
            // Desde la agenda (F5): al cerrar el asistente se vuelve a ella.
            // Desde "Manual" (F6): el horario sigue en automático con lo que falte.
            const { horario, reanudar } = assignModal;
            setAssignModal({ open: false });
            if (horario && reanudar) void resumeAutomaticaAction(horario.ejecucionId).then(() => loadMapData(true));
            else if (horario) setRutasModal('programadas');
          }}
          guards={guards}
          markers={markers}
          rutas={rutas}
          puntosFijos={puntosFijos}
          jurisdiccion={jurisdiccion}
          preselectedGuardId={assignModal.guardId}
          rutaInicialId={assignModal.rutaId}
          puntoInicialId={assignModal.puntoFijoId}
          horario={assignModal.horario}
          textoSalirHorario={assignModal.reanudar ? 'Cancelar' : undefined}
          onAssigned={() => loadMapData(true)}
        />
      )}

      {jurisdiccionLista && (
        <RutasProgramadasModal
          isOpen={rutasModal === 'programadas'}
          onClose={() => {
            setRutasModal(null);
            setProgramadaEnfocada(null);
          }}
          jurisdiccion={jurisdiccion}
          rutas={rutas}
          puntos={puntosFijos}
          puedeProgramar={canProgramar}
          puedeAsignar={puedeGestionarRutas}
          esSuperAdmin={user?.role === 'super_admin'}
          enfocarEjecucionId={programadaEnfocada}
          onAsignar={(horario) => {
            // La agenda se cierra mientras se asigna; al cerrar el asistente vuelve.
            setRutasModal(null);
            setAssignModal({ open: true, horario });
          }}
          onCambio={() => loadMapData(true)}
        />
      )}

      {puedeGestionarPuntos && (
        <PuntosFijosModal
          isOpen={rutasModal === 'puntos'}
          onClose={() => setRutasModal(null)}
          jurisdiccion={jurisdiccion}
          esSuperAdmin={user?.role === 'super_admin'}
          onCambio={() => loadMapData(true)}
        />
      )}

      {puedeCrearPredeterminadas && (
        <RutasPredeterminadasModal
          isOpen={rutasModal === 'predeterminadas'}
          onClose={() => setRutasModal(null)}
          jurisdiccion={jurisdiccion}
          onCreada={() => loadMapData(true)}
          onAsignarAhora={puedeGestionarRutas ? (ruta) => setAssignModal({ open: true, rutaId: ruta.id }) : undefined}
        />
      )}

      {(puedeGestionarRutas || puedeCrearPredeterminadas) && (
        <RutasGuardadasModal
          isOpen={rutasModal === 'guardadas'}
          onClose={() => setRutasModal(null)}
          rutas={rutas}
          jurisdiccion={jurisdiccion}
          puedeAsignar={puedeGestionarRutas}
          puedeGestionarRecurrentes={puedeGestionarRutas}
          puedeGestionarPredeterminadas={puedeCrearPredeterminadas}
          puedeArchivarPredeterminadas={Boolean(user && canArchiveEstablecida(user.role))}
          onAsignar={(ruta) => {
            setRutasModal(null);
            setAssignModal({ open: true, rutaId: ruta.id });
          }}
          onCambio={() => loadMapData(true)}
        />
      )}
    </div>
  );
}
