import type { PatrullaRow } from '@/types/patrulla';
import { colorForRuta } from './routeColors';
import type { LatLng } from './routeGeometry';

// Agrupa las filas `patrulla` (1 por guardia) que comparten la misma
// `rutaPlantillaId` — así es como el rediseño de rutas (2026-09-14) vincula
// a varios guardias a UNA ruta compartida (ver assignRoute.ts). Una
// patrulla sin rutaPlantillaId (asignaciones viejas, o modalidades que
// nunca pasaron por el wizard) queda fuera de la agrupación — no rompe
// nada, simplemente no se le dibuja línea de ruta ni aparece como grupo en
// el panel derecho (ver PatrolRosterPanel — segmentado estilo "grupos de
// amigos", pedido explícito 2026-09-14: Emergencia / General / una sección
// colapsable por ruta activa).
//
// Bug encontrado en pruebas locales 2026-09-14: la primera versión cruzaba
// `patrullas` contra `getRutasPlantilla()` (GET /mapas/rutas) para sacar el
// trazado/nombre — pero ese endpoint filtra `activo=true` (solo plantillas
// reutilizables). Una ruta creada SIN marcar "guardar como reutilizable"
// (activo=false, el caso normal de una asignación puntual) nunca aparecía
// ahí, así que la ruta desaparecía del panel/mapa aunque los guardias la
// tuvieran perfectamente asignada. Fix: usar `rutaNombre`/`trazado` que el
// backend YA embebe en cada fila de `GET /mapas/patrullas`
// (mapas.service.ts:patrullasVigentes hace el join) — no hace falta ni
// depende de si la ruta es reutilizable.

export interface RouteGroupMember {
  guardiaId: string;
  /** PatrullaRow.id — la fila individual de ESTE guardia, para poder sacarlo de la ruta sin tocar a los demás (cancelGuardFromRouteAction). */
  patrullaId: string;
  /** Última posición GPS conocida de este guardia en la ruta. */
  lat?: number;
  lng?: number;
  nombre?: string;
  /**
   * Punto estratégico ASIGNADO a este guardia dentro del trazado
   * compartido (patrulla.poligono_geojson, ver types/patrulla.ts) —
   * distinto de `lat`/`lng` (posición GPS en vivo). Antes esto nunca se
   * leía en el Mapa: solo se dibujaba la línea de la ruta y el punto GPS
   * en vivo, nunca el "checkpoint" que le tocó a cada guardia (pedido
   * explícito 2026-09-19: "me aparece la línea trazada pero debería
   * aparecerme igual los checkpoints marcados").
   */
  puntoAsignado?: { lat: number; lng: number };
}

export interface RouteGroup {
  id: string;
  nombre: string;
  color: string;
  path: LatLng[];
  guards: RouteGroupMember[];
  /** Número de guardias que están dentro de los puntos de la ruta (vs los que se salieron). */
  guardiasEnRuta: number;
}

export function groupPatrullasByRuta(patrullas: PatrullaRow[], markersMap?: Map<string, { lat: number; lng: number; nombre?: string }>): RouteGroup[] {
  const estadosActivos = new Set(['asignada', 'en_curso']);
  const byRuta = new Map<string, { nombre: string; trazado: PatrullaRow['trazado']; guards: RouteGroupMember[] }>();

  for (const p of patrullas) {
    if (!p.rutaPlantillaId || !estadosActivos.has(p.estado)) continue;
    const entry = byRuta.get(p.rutaPlantillaId) ?? { nombre: p.rutaNombre ?? p.nombre ?? 'Ruta sin nombre', trazado: p.trazado, guards: [] };
    const marcador = markersMap?.get(p.guardiaId);
    const puntoAsignado =
      p.poligonoGeojson?.type === 'Point' && Array.isArray(p.poligonoGeojson.coordinates)
        ? { lat: p.poligonoGeojson.coordinates[1], lng: p.poligonoGeojson.coordinates[0] }
        : undefined;
    entry.guards.push({
      guardiaId: p.guardiaId,
      patrullaId: p.id,
      lat: marcador?.lat,
      lng: marcador?.lng,
      nombre: marcador?.nombre,
      puntoAsignado,
    });
    byRuta.set(p.rutaPlantillaId, entry);
  }

  const groups: RouteGroup[] = [];
  for (const [rutaId, { nombre, trazado, guards }] of byRuta) {
    if (!trazado || trazado.length < 2) continue;
    const path: LatLng[] = trazado.map(([lng, lat]) => ({ lat, lng }));
    const guardiasEnRuta = guards.filter((g) => g.lat != null && g.lng != null).length;
    groups.push({
      id: rutaId,
      nombre,
      color: colorForRuta(rutaId),
      path,
      guards,
      guardiasEnRuta,
    });
  }
  return groups;
}
