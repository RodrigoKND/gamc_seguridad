import type { LatLng } from './routeGeometry';
import type { PatrullaModalidad } from '@/types/patrulla';

// Ruteo real por calles (RF-G3-09, pedido explícito 2026-09-14: "debe ir
// por las calles, avenidas, carreteras... y debe calcular la ruta más
// óptima"). Antes el trazado era una línea recta entre los puntos que
// clickeaba el Operador — cruzaba manzanas, patios, casas. Usa servidores
// de demostración públicos de OSRM (gratis, sin API key — mismo criterio que
// las teselas de OpenStreetMap ya usadas en MapCanvas.tsx) para calcular el
// camino real siguiendo la red vial entre los puntos, en el ORDEN en que el
// Operador los marcó (no reordena — el Operador elige la secuencia a
// propósito, ej. "primero el punto de control, después la plaza").
//
// Perfil según modalidad (pedido explícito: "no se debe marcar siempre
// como si fuera un auto, según si es a pie, en moto, etc"). router.
// project-osrm.org (el demo "oficial") SOLO sirve el perfil "driving" — para
// "a_pie"/"moto" se usa el demo de OpenStreetMap.de (routing.openstreetmap.de),
// que sí expone /routed-foot y /routed-bike sobre la misma red OSM, gratis y
// sin API key. Si el modo no tiene perfil de ruteo con sentido (punto_fijo,
// oficina) se usa "coche" como base razonable.
//
// Advertencia real: son servidores de DEMOSTRACIÓN públicos — no tienen SLA
// y pueden tener límite de uso. Para producción real convendría un proveedor
// propio (OSRM auto-hospedado, Mapbox Directions, OpenRouteService) — queda
// documentado, no se decidió acá sin consultar. Si el servicio falla o no
// responde a tiempo, se cae a línea recta entre los puntos: nunca bloquea el
// flujo de asignar una ruta.

const OSRM_PROFILES: Record<PatrullaModalidad, string> = {
  coche: 'https://router.project-osrm.org/route/v1/driving',
  moto: 'https://routing.openstreetmap.de/routed-bike/route/v1/bike',
  a_pie: 'https://routing.openstreetmap.de/routed-foot/route/v1/foot',
  punto_fijo: 'https://router.project-osrm.org/route/v1/driving',
  oficina: 'https://router.project-osrm.org/route/v1/driving',
};
const TIMEOUT_MS = 8000;

export interface RutaCalculada {
  path: LatLng[];
  distanciaM: number;
  /** false si el servicio de ruteo falló/no respondió y esto es una aproximación en línea recta. */
  siguioCalles: boolean;
}

/**
 * Calcula el trazado real por calles entre `puntos`, en el orden dado.
 * `cerrarCircuito`: si hay 3+ puntos, agrega el primero al final para que
 * la ruta vuelva al punto de partida (pedido explícito: "siempre debe
 * cerrar el circuito si hay 3 o más puntos, une el primero con el último").
 * Con 2 puntos nunca cierra (sería ir y volver por el mismo camino).
 * `modalidad`: elige el perfil de ruteo (a pie / moto / coche) — por
 * defecto 'coche' para no romper llamadas existentes que no lo pasan.
 */
export async function calcularRutaPorCalles(
  puntos: LatLng[],
  cerrarCircuito: boolean,
  modalidad: PatrullaModalidad = 'coche',
): Promise<RutaCalculada> {
  if (puntos.length < 2) return { path: puntos, distanciaM: 0, siguioCalles: false };

  const secuencia = cerrarCircuito && puntos.length >= 3 ? [...puntos, puntos[0]] : puntos;
  const coords = secuencia.map((p) => `${p.lng},${p.lat}`).join(';');
  const base = OSRM_PROFILES[modalidad] ?? OSRM_PROFILES.coche;
  const url = `${base}/${coords}?overview=full&geometries=geojson`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`OSRM respondió ${res.status}`);
    const data = (await res.json()) as {
      routes?: { geometry?: { coordinates?: [number, number][] }; distance?: number }[];
    };
    const route = data.routes?.[0];
    const coords2 = route?.geometry?.coordinates;
    if (!Array.isArray(coords2) || coords2.length < 2) throw new Error('OSRM sin geometría de ruta');
    return {
      path: coords2.map(([lng, lat]) => ({ lat, lng })),
      distanciaM: route?.distance ?? 0,
      siguioCalles: true,
    };
  } catch {
    return { path: secuencia, distanciaM: 0, siguioCalles: false };
  }
}
