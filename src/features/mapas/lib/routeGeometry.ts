// Geometría del trazado de rutas (RF-G3-09, rediseño 2026-09-14). Todo en
// proyección plana local (equirectangular alrededor de la latitud promedio
// del trazado) — suficiente para distancias a escala de ciudad
// (Cochabamba, unos pocos km de extensión) sin traer una librería GIS
// nueva. No es una ruta real por calles (eso requeriría un motor de
// ruteo/direcciones — Mapbox Directions, OSRM, etc. — que este proyecto no
// tiene integrado; queda documentado como pendiente en el informe para
// Backend/Móvil, no se inventa acá).

export interface LatLng {
  lat: number;
  lng: number;
}

const METERS_PER_DEG_LAT = 111_320;

function metersPerDegLng(refLatDeg: number): number {
  return METERS_PER_DEG_LAT * Math.cos((refLatDeg * Math.PI) / 180);
}

interface XY {
  x: number;
  y: number;
}

function toXY(p: LatLng, refLatDeg: number): XY {
  return { x: p.lng * metersPerDegLng(refLatDeg), y: p.lat * METERS_PER_DEG_LAT };
}

function toLatLng(p: XY, refLatDeg: number): LatLng {
  return { lat: p.y / METERS_PER_DEG_LAT, lng: p.x / metersPerDegLng(refLatDeg) };
}

function averageLat(path: LatLng[]): number {
  return path.reduce((sum, p) => sum + p.lat, 0) / path.length;
}

function segmentLength(a: XY, b: XY): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Largo total del trazado en metros. */
export function pathLengthMeters(path: LatLng[]): number {
  if (path.length < 2) return 0;
  const refLat = averageLat(path);
  const xy = path.map((p) => toXY(p, refLat));
  let total = 0;
  for (let i = 1; i < xy.length; i += 1) total += segmentLength(xy[i - 1], xy[i]);
  return total;
}

/**
 * Punto sobre el trazado a `targetMeters` desde el inicio. Si excede el
 * largo total, devuelve el último punto (clamp) — nunca extrapola fuera
 * del trazado real.
 */
export function pointAtDistance(path: LatLng[], targetMeters: number): LatLng {
  if (path.length === 0) throw new Error('pointAtDistance: trazado vacío');
  if (path.length === 1) return path[0];
  const refLat = averageLat(path);
  const xy = path.map((p) => toXY(p, refLat));
  let remaining = Math.max(0, targetMeters);
  for (let i = 1; i < xy.length; i += 1) {
    const segLen = segmentLength(xy[i - 1], xy[i]);
    if (remaining <= segLen || i === xy.length - 1) {
      const t = segLen === 0 ? 0 : Math.min(1, remaining / segLen);
      const x = xy[i - 1].x + (xy[i].x - xy[i - 1].x) * t;
      const y = xy[i - 1].y + (xy[i].y - xy[i - 1].y) * t;
      return toLatLng({ x, y }, refLat);
    }
    remaining -= segLen;
  }
  return path[path.length - 1];
}

/**
 * Proyecta `point` sobre el segmento más cercano del trazado. Devuelve el
 * punto proyectado y la distancia acumulada desde el inicio del trazado
 * hasta ese punto (para poder ordenar/comparar guardias a lo largo de la
 * ruta).
 */
export function projectOntoPath(point: LatLng, path: LatLng[]): { point: LatLng; distanceFromStart: number } {
  if (path.length === 0) throw new Error('projectOntoPath: trazado vacío');
  if (path.length === 1) return { point: path[0], distanceFromStart: 0 };

  const refLat = averageLat(path);
  const xy = path.map((p) => toXY(p, refLat));
  const query = toXY(point, refLat);

  let best = { distSq: Infinity, projected: xy[0], cumulative: 0 };
  let cumulativeBeforeSegment = 0;

  for (let i = 1; i < xy.length; i += 1) {
    const a = xy[i - 1];
    const b = xy[i];
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const abLenSq = abx * abx + aby * aby;
    const t = abLenSq === 0 ? 0 : Math.max(0, Math.min(1, ((query.x - a.x) * abx + (query.y - a.y) * aby) / abLenSq));
    const projected = { x: a.x + abx * t, y: a.y + aby * t };
    const distSq = (query.x - projected.x) ** 2 + (query.y - projected.y) ** 2;
    if (distSq < best.distSq) {
      const segLen = Math.sqrt(abLenSq);
      best = { distSq, projected, cumulative: cumulativeBeforeSegment + segLen * t };
    }
    cumulativeBeforeSegment += segmentLength(a, b);
  }

  return { point: toLatLng(best.projected, refLat), distanceFromStart: best.cumulative };
}

export interface GuardForDistribution {
  id: string;
  /** Última posición real conocida (telemetría) — null si nunca reportó. */
  position: LatLng | null;
}

/**
 * Reparte guardias a lo largo de un trazado (RF-G3-09: "distribuirlos en
 * puntos estratégicos... para que no estén muy cerca y puedan cubrir más
 * barrido"). Con 1 guardia, el resultado es simplemente el punto del
 * trazado más cercano a su ubicación actual ("la manera más rápida de
 * incorporarse"). Con 2+, se reparten en objetivos parejos a lo largo del
 * trazado, respetando el orden real de cada guardia sobre la ruta (el más
 * cercano al inicio va al primer tramo, y así sucesivamente) — evita que
 * dos guardias que ya están juntos terminen asignados al mismo punto.
 * Guardias sin posición conocida (nunca reportaron GPS) se reparten en los
 * huecos restantes, al final del orden.
 */
export function distributeGuardsAlongRoute(path: LatLng[], guards: GuardForDistribution[]): Record<string, LatLng> {
  const result: Record<string, LatLng> = {};
  if (guards.length === 0 || path.length < 2) return result;

  if (guards.length === 1) {
    const g = guards[0];
    result[g.id] = g.position ? projectOntoPath(g.position, path).point : pointAtDistance(path, pathLengthMeters(path) / 2);
    return result;
  }

  const total = pathLengthMeters(path);
  const targets = Array.from({ length: guards.length }, (_, i) => ((i + 0.5) / guards.length) * total);

  const withDistance = guards.map((g) => ({
    id: g.id,
    distanceFromStart: g.position ? projectOntoPath(g.position, path).distanceFromStart : null,
  }));
  const known = withDistance.filter((g) => g.distanceFromStart !== null).sort((a, b) => a.distanceFromStart! - b.distanceFromStart!);
  const unknown = withDistance.filter((g) => g.distanceFromStart === null);

  [...known, ...unknown].forEach((g, i) => {
    result[g.id] = pointAtDistance(path, targets[i]);
  });

  return result;
}
