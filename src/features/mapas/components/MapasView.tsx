'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Route } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { getGuardias, getGuardMarkers, getPatrullas, getRutasPlantilla, getZonasCriticas } from '@/lib/data-source';
import { canWrite } from '@/lib/permissions';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
import type { Guard } from '@/features/guardias/types';
import type { PatrullaRow, RutaPlantillaRow } from '@/types/patrulla';
import type { ZonaCriticaActivaRow } from '@/types/hecho';
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
import { UnitPerimeterLines } from './UnitPerimeterLines';
import { useRealtimeMap } from '../hooks/useRealtimeMap';
import { useRealtimeEvent } from '@/lib/realtime/RealtimeProvider';
import { REALTIME_EVENTS } from '@/lib/api/realtime';
import { clearSosAction } from '../actions/clearSos';
import { cancelGuardFromRouteAction, cancelRouteAction } from '../actions/cancelRoute';
import { groupPatrullasByRuta } from '../lib/routeGroups';
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
  guards: Guard[];
  markers: GuardMarker[];
  zonas: ZonaCriticaActivaRow[];
  rutas: RutaPlantillaRow[];
  patrullas: PatrullaRow[];
  loadedAt: number;
};
let mapDataCache: MapDataCache | null = null;
const MAP_DATA_CACHE_TTL_MS = 5 * 60_000;

export function MapasView() {
  const { user } = useAuthSession();
  const searchParams = useSearchParams();
  const canAssignRoute = user ? canWrite(user.role, 'patrullaje') : false;

  const [activeTab, setActiveTab] = useState<MapTab>('patrullaje');
  const [selectedGuard, setSelectedGuard] = useState<GuardMarker | null>(null);
  const [selectedZonaId, setSelectedZonaId] = useState<string | null>(null);
  const [focusTarget, setFocusTarget] = useState<MapFocusTarget | null>(null);
  const [markers, setMarkers] = useState<GuardMarker[]>([]);
  const [zonas, setZonas] = useState<ZonaCriticaActivaRow[]>([]);
  const [guards, setGuards] = useState<Guard[]>([]);
  const [rutas, setRutas] = useState<RutaPlantillaRow[]>([]);
  const [patrullas, setPatrullas] = useState<PatrullaRow[]>([]);
  const [assignModal, setAssignModal] = useState<{ open: boolean; guardId?: string }>({ open: false });

  function loadMapData(force = false) {
    if (!force && mapDataCache && Date.now() - mapDataCache.loadedAt < MAP_DATA_CACHE_TTL_MS) {
      setGuards(mapDataCache.guards);
      setMarkers(mapDataCache.markers);
      setZonas(mapDataCache.zonas);
      setRutas(mapDataCache.rutas);
      setPatrullas(mapDataCache.patrullas);
      return;
    }

    // getGuardMarkers reusa esta misma lista en vez de volver a pedir
    // /api/guardias internamente (evita duplicar el fetch en cada carga).
    const guardiasPromise = getGuardias();
    guardiasPromise.then(setGuards);
    const markersPromise = guardiasPromise.then((gs) => getGuardMarkers(gs));
    markersPromise.then(setMarkers);
    const zonasPromise = getZonasCriticas();
    zonasPromise.then(setZonas);
    const rutasPromise = getRutasPlantilla();
    rutasPromise.then(setRutas);
    const patrullasPromise = getPatrullas();
    patrullasPromise.then(setPatrullas);

    Promise.all([guardiasPromise, markersPromise, zonasPromise, rutasPromise, patrullasPromise]).then(
      ([guards, markers, zonas, rutas, patrullas]) => {
        mapDataCache = { guards, markers, zonas, rutas, patrullas, loadedAt: Date.now() };
      },
    );
  }

  useEffect(() => loadMapData(false), []);

  // Deep-link desde banner SOS / notificaciones: /mapas?guardiaId=xxx centra el mapa y abre el drawer
  useEffect(() => {
    const guardiaId = searchParams.get('guardiaId');
    if (!guardiaId || markers.length === 0) return;
    const target = markers.find((m) => m.id === guardiaId);
    if (target) {
      setSelectedGuard(target);
      setFocusTarget({ lat: target.lat, lng: target.lng, zoom: 17 });
      setActiveTab('patrullaje');
    }
  }, [searchParams, markers]);

  // Recarga en vivo: cuando el móvil manda telemetría/SOS o el Operador
  // asigna una patrulla, el API empuja el evento por socket.io y se vuelve a
  // pedir el estado completo — siempre forzado, nunca desde caché, porque el
  // evento en sí es la señal de que algo cambió.
  useRealtimeMap(() => loadMapData(true));

  // Actualización optimista en vivo: cuando llega telemetría por socket, mueve
  // el pin en el mapa de inmediato sin esperar al fetch de /ubicaciones (que
  // también se dispara arriba). Evita el "no aparece hasta recargar" y hace
  // que el seguimiento se sienta fluido.
  useRealtimeEvent<{ guardiaId: string; lat: number; lng: number; esSos?: boolean; estadoOperativo?: string; capturadoEn?: string }>(
    REALTIME_EVENTS.guardiaUbicacion,
    (payload) => {
      if (!payload?.guardiaId || typeof payload.lat !== 'number' || typeof payload.lng !== 'number') return;
      setMarkers((prev) => {
        const idx = prev.findIndex((m) => m.id === payload.guardiaId);
        if (idx === -1) {
          // Guardia que aún no estaba en el mapa (primer ping tras iniciar ruta) — recarga completa para traer foto/nombre/zona.
          loadMapData(true);
          return prev;
        }
        const next = [...prev];
        const cur = next[idx]!;
        next[idx] = {
          ...cur,
          lat: payload.lat,
          lng: payload.lng,
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

  // Respaldo: antes 8s, ahora 30s — el mapa ya se actualiza optimistamente
  // por socket (guardiaUbicacion mueve el pin sin fetch) y los eventos de
  // patrulla/SOS fuerzan reload. 30s es la red de seguridad si el socket cae.
  useEffect(() => {
    const iv = setInterval(() => loadMapData(true), 30000);
    return () => clearInterval(iv);
  }, []);

  // Agrupa las patrullas por rutaPlantillaId compartido (assignRoute.ts) —
  // así el mapa dibuja una línea por ruta y el panel derecho colorea a cada
  // guardia según en cuál está, en vez de mostrarlos sueltos.
  const routeGroups = useMemo(() => groupPatrullasByRuta(patrullas), [patrullas]);

  function selectGuardFromPanel(guard: GuardMarker) {
    setSelectedGuard(guard);
    setFocusTarget({ lat: guard.lat, lng: guard.lng });
  }

  function selectZonaFromPanel(zona: ZonaCriticaActivaRow) {
    setSelectedZonaId(zona.id);
    setFocusTarget({ lat: zona.centroLat, lng: zona.centroLng, zoom: 16 });
  }

  // El operador resuelve el SOS a mano desde el desplegable del guardia
  // (bug reportado tras la defensa) — cambia el estado operativo real, no
  // solo la vista. Al confirmar, se cierra el desplegable junto con el
  // botón (en vez de dejarlo abierto con el botón desapareciendo de golpe)
  // y se recarga el mapa para que el pin/color vuelvan a la normalidad.
  async function handleClearSos(guardId: string): Promise<boolean> {
    const result = await clearSosAction(guardId);
    if (result.success) {
      setSelectedGuard(null);
      loadMapData(true);
      return true;
    }
    return false;
  }

  // Cancelar la ruta (RF-G3-09, 2026-09-14): saca a todos los guardias
  // vigentes de esa ruta compartida — la línea desaparece del mapa
  // (RouteLinesLayer) y de "Rutas Activas" en cuanto loadMapData recarga
  // patrullas/rutas, porque routeGroups.ts solo agrupa filas en estado
  // asignada/en_curso. El pin del guardia en sí NO desaparece: sigue
  // viniendo de telemetría, no de la ruta.
  async function handleCancelRoute(rutaPlantillaId: string): Promise<boolean> {
    const result = await cancelRouteAction(rutaPlantillaId);
    if (result.success) {
      loadMapData(true);
      return true;
    }
    return false;
  }

  // Complemento (2026-09-14): saca a UN guardia de su ruta sin tocar a los
  // demás — mismo criterio de recarga que handleCancelRoute.
  async function handleCancelGuardFromRoute(patrullaId: string): Promise<boolean> {
    const result = await cancelGuardFromRouteAction(patrullaId);
    if (result.success) {
      loadMapData(true);
      return true;
    }
    return false;
  }

  return (
    <div className="flex h-[calc(100vh-64px-48px)] flex-col">
      <div className="border-b border-neutral-border bg-white px-4">
        {/* Dropdown en móvil (<sm) — MASTER.md sección 7.1 */}
        <select
          value={activeTab}
          onChange={(event) => setActiveTab(event.target.value as MapTab)}
          aria-label="Vista del Módulo de Mapas"
          className="block h-12 w-full border-none bg-transparent text-sm font-medium text-neutral-text focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-600 sm:hidden"
        >
          {TABS.map((tab) => (
            <option key={tab.id} value={tab.id}>
              {tab.label}
            </option>
          ))}
        </select>

        {/* Tabs en desktop — activo: border-b-2 border-brand-gold-600 (paleta 2026, MASTER.md sección 4/10) */}
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
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-600 focus-visible:ring-offset-2',
                  activeTab === tab.id
                    ? 'border-brand-gold-600 text-brand-gold-600'
                    : 'border-transparent text-neutral-text-muted hover:text-neutral-text',
                ].join(' ')}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'patrullaje' && canAssignRoute && (
            <Button variant="secondary" onClick={() => setAssignModal({ open: true })} className="ml-auto">
              <Route className="h-3.5 w-3.5" aria-hidden="true" />
              Asignar Ruta
            </Button>
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
      <div className="flex flex-1 gap-4 overflow-hidden p-4">
        <div className="relative flex-1 overflow-hidden rounded-xl border border-neutral-border bg-white shadow-sm">
          <MapCanvas>
            <MapSearch />
            <MapFocus target={focusTarget} />
            {activeTab === 'patrullaje' && (
              <>
                <RouteLinesLayer routeGroups={routeGroups} />
                <UnitPerimeterLines guards={markers} />
                <PatrolLayer guards={markers} selectedId={selectedGuard?.id ?? null} onSelectGuard={setSelectedGuard} />
              </>
            )}
            {activeTab === 'calor' && (
              <HeatmapLayer zonas={zonas} onSelectZona={(zona) => setSelectedZonaId(zona.id)} />
            )}
          </MapCanvas>
          {activeTab === 'futuro' && <FutureLayerPlaceholder />}
        </div>

        {activeTab !== 'futuro' && (
          <div className="hidden w-[340px] shrink-0 overflow-hidden rounded-xl border border-neutral-border bg-white shadow-sm lg:block">
            {activeTab === 'patrullaje' && (
              <PatrolRosterPanel
                guards={markers}
                selectedId={selectedGuard?.id ?? null}
                onSelect={selectGuardFromPanel}
                routeGroups={routeGroups}
                onCancelRoute={canAssignRoute ? handleCancelRoute : undefined}
                onCancelGuardFromRoute={canAssignRoute ? handleCancelGuardFromRoute : undefined}
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
        onAssignRoute={
          canAssignRoute
            ? (guardId) => {
                setSelectedGuard(null);
                setAssignModal({ open: true, guardId });
              }
            : undefined
        }
        onClearSos={canAssignRoute ? handleClearSos : undefined}
        patrullas={patrullas}
        routeGroups={routeGroups}
      />

      {canAssignRoute && (
        <AssignRouteWizard
          isOpen={assignModal.open}
          onClose={() => setAssignModal({ open: false })}
          guards={guards}
          markers={markers}
          rutas={rutas}
          preselectedGuardId={assignModal.guardId}
          onAssigned={() => loadMapData(true)}
        />
      )}
    </div>
  );
}
