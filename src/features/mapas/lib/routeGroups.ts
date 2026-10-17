import type { EjecucionInfo, EstadoRuta, PatrullaRow } from '@/types/patrulla';
import { colorForRuta } from './routeColors';
import type { LatLng } from './routeGeometry';

// Agrupa las filas `patrulla` (1 por guardia) de una misma EJECUCIÓN — la
// asignación concreta de una ruta en un momento dado (F2). Antes se agrupaba
// por plantilla (`rutaPlantillaId`): dos asignaciones de la misma ruta
// guardada (mañana y tarde) se veían como una sola, y cancelar una cancelaba
// la otra. Las filas viejas sin ejecución se agrupan por plantilla, como antes.
//
// Nombre y trazado salen de cada fila (`GET /mapas/patrullas` ya los trae,
// desde la copia guardada en la ejecución), no de GET /mapas/rutas: así una
// ruta dinámica (no reutilizable) también se dibuja.
//
// F4: una asignación a un PUNTO FIJO no tiene trazado (se asigna por la
// identidad del punto); el grupo existe igual, con `path` vacío y su destino.

export interface RouteGroupMember {
  guardiaId: string;
  /** PatrullaRow.id — la fila individual de ESTE guardia, para poder sacarlo de la ruta sin tocar a los demás (cancelGuardFromRouteAction). */
  patrullaId: string;
  /** Última posición GPS conocida de este guardia en la ruta. */
  lat?: number;
  lng?: number;
  nombre?: string;
  /**
   * Punto ASIGNADO a este guardia dentro del trazado compartido
   * (patrulla.poligono_geojson) — distinto de `lat`/`lng` (GPS en vivo).
   */
  puntoAsignado?: { lat: number; lng: number };
  /** Estado respecto a la ruta, calculado por el servidor (F2). */
  estadoRuta?: EstadoRuta | null;
  distanciaRutaM?: number | null;
  /** F4: subpunto (o punto) fijo donde está este guardia. */
  puntoFijoNombre?: string;
}

export interface RouteGroup {
  /** Id de la ejecución (o de la plantilla en filas viejas): es lo que se cancela. */
  id: string;
  /** true si `id` es una ejecución (se cancela con PATCH /ejecuciones/:id/cancelar). */
  esEjecucion: boolean;
  nombre: string;
  color: string;
  path: LatLng[];
  guards: RouteGroupMember[];
  ejecucion: EjecucionInfo | null;
  /** Guardias con posición GPS conocida. */
  guardiasLocalizados: number;
  /** Guardias realmente sobre su ruta (estado del servidor 'en_ruta'). */
  guardiasEnRuta: number;
  /** F4: asignación a un punto fijo (sin trazado). */
  puntoFijo: { id: string; nombre: string; lat: number; lng: number } | null;
}

export function groupPatrullasByRuta(patrullas: PatrullaRow[], markersMap?: Map<string, { lat: number; lng: number; nombre?: string }>): RouteGroup[] {
  const estadosActivos = new Set(['asignada', 'en_curso']);
  const porGrupo = new Map<string, { esEjecucion: boolean; nombre: string; trazado: PatrullaRow['trazado']; ejecucion: EjecucionInfo | null; guards: RouteGroupMember[] }>();

  for (const p of patrullas) {
    if (!estadosActivos.has(p.estado)) continue;
    const clave = p.ejecucionId ?? p.rutaPlantillaId;
    if (!clave) continue;
    const entry = porGrupo.get(clave) ?? {
      esEjecucion: Boolean(p.ejecucionId),
      nombre: p.ejecucion?.nombre ?? p.rutaNombre ?? p.nombre ?? 'Ruta sin nombre',
      trazado: p.trazado,
      ejecucion: p.ejecucion ?? null,
      guards: [],
    };
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
      estadoRuta: p.estadoRuta ?? null,
      distanciaRutaM: p.distanciaRutaM ?? null,
      puntoFijoNombre: p.puntoFijo?.esSubpunto ? p.puntoFijo.nombre : undefined,
    });
    porGrupo.set(clave, entry);
  }

  const groups: RouteGroup[] = [];
  for (const [id, { esEjecucion, nombre, trazado, ejecucion, guards }] of porGrupo) {
    const destino = ejecucion?.puntoFijoId && ejecucion.destino ? ejecucion.destino : null;
    if (!destino && (!trazado || trazado.length < 2)) continue;
    groups.push({
      id,
      esEjecucion,
      nombre,
      color: colorForRuta(id),
      path: destino ? [] : trazado!.map(([lng, lat]) => ({ lat, lng })),
      guards,
      ejecucion,
      guardiasLocalizados: guards.filter((g) => g.lat != null && g.lng != null).length,
      guardiasEnRuta: guards.filter((g) => g.estadoRuta === 'en_ruta').length,
      puntoFijo: destino ? { id: destino.puntoFijoId, nombre: destino.nombre, lat: destino.lat, lng: destino.lng } : null,
    });
  }
  return groups;
}
