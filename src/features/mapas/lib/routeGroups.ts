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
}

export interface RouteGroup {
  id: string;
  nombre: string;
  color: string;
  path: LatLng[];
  guards: RouteGroupMember[];
}

export function groupPatrullasByRuta(patrullas: PatrullaRow[]): RouteGroup[] {
  const estadosActivos = new Set(['asignada', 'en_curso']);
  const byRuta = new Map<string, { nombre: string; trazado: PatrullaRow['trazado']; guards: RouteGroupMember[] }>();

  for (const p of patrullas) {
    if (!p.rutaPlantillaId || !estadosActivos.has(p.estado)) continue;
    const entry = byRuta.get(p.rutaPlantillaId) ?? { nombre: p.rutaNombre ?? p.nombre, trazado: p.trazado, guards: [] };
    entry.guards.push({ guardiaId: p.guardiaId, patrullaId: p.id });
    byRuta.set(p.rutaPlantillaId, entry);
  }

  const groups: RouteGroup[] = [];
  for (const [rutaId, { nombre, trazado, guards }] of byRuta) {
    if (!trazado || trazado.length < 2) continue;
    groups.push({
      id: rutaId,
      nombre,
      color: colorForRuta(rutaId),
      path: trazado.map(([lng, lat]) => ({ lat, lng })),
      guards,
    });
  }
  return groups;
}
