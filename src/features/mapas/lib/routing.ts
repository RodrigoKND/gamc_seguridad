import type { LatLng } from './routeGeometry';

// Ruteo real por calles (RF-G3-09, pedido explícito 2026-09-14: "debe ir
// por las calles, avenidas, carreteras... y debe calcular la ruta más
// óptima"). Antes el trazado era una línea recta entre los puntos que
// clickeaba el Operador — cruzaba manzanas, patios, casas. Usa el servidor
// de demostración público de OSRM (gratis, sin API key — mismo criterio que
// las teselas de OpenStreetMap ya usadas en MapCanvas.tsx) para calcular el
// camino real siguiendo la red vial entre los puntos, en el ORDEN en que el
// Operador los marcó (no reordena — el Operador elige la secuencia a
// propósito, ej. "primero el punto de control, después la plaza").
//
// Advertencia real: router.project-osrm.org es un servidor de DEMOSTRACIÓN
// público — no tiene SLA, puede tener límite de uso y solo sirve el perfil
// "driving" (no "foot"), así que una ruta "a pie" también se calcula sobre
// la red vial para autos, no sobre sendas peatonales. Para producción real
// convendría un proveedor propio (OSRM auto-hospedado, Mapbox Directions,
// OpenRouteService) — queda documentado, no se decidió acá sin consultar.
// Si el servicio falla o no responde a tiempo, se cae a línea recta entre
// los puntos: nunca bloquea el flujo de asignar una ruta.

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';
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
 */
export async function calcularRutaPorCalles(puntos: LatLng[], cerrarCircuito: boolean): Promise<RutaCalculada> {
  if (puntos.length < 2) return { path: puntos, distanciaM: 0, siguioCalles: false };

  const secuencia = cerrarCircuito && puntos.length >= 3 ? [...puntos, puntos[0]] : puntos;
  const coords = secuencia.map((p) => `${p.lng},${p.lat}`).join(';');
  const url = `${OSRM_BASE}/${coords}?overview=full&geometries=geojson`;

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
