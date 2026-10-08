import type { EpiZone } from '@/types/epi';

// Jurisdicción por EPI (2026-10-05) — polígonos desde GET /api/mapas/jurisdiccion
// (territorio vigente de cada EPI, GeoJSON [lng, lat]). La Web solo ayuda al Operador a no
// salirse de su EPI; la validación real está en el backend (mapas.service.ts).

type Ring = [number, number][];

export interface EpiJurisdiccion {
  zone: EpiZone;
  numero: number | null;
  nombre: string;
  color: string | null;
  sede: { lat: number; lng: number; direccion: string | null } | null;
  /** GeoJSON Polygon | MultiPolygon tal como viene de la BD. */
  poligono: { type: 'Polygon' | 'MultiPolygon'; coordinates: unknown } | null;
}

export interface Jurisdiccion {
  epis: EpiJurisdiccion[];
  /** EPI del usuario; null en super_admin o si no tiene EPI asignada. */
  miEpi: EpiZone | null;
  /** false = super_admin (edita en todas las EPIs). */
  restringido: boolean;
}

function poligonosDe(geo: EpiJurisdiccion['poligono']): Ring[][] {
  if (!geo || !Array.isArray(geo.coordinates)) return [];
  if (geo.type === 'Polygon') return [geo.coordinates as Ring[]];
  if (geo.type === 'MultiPolygon') return geo.coordinates as Ring[][];
  return [];
}

function enAnillo(lng: number, lat: number, ring: Ring): boolean {
  let dentro = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

export function puntoEnEpi(p: { lat: number; lng: number }, epi: EpiJurisdiccion | undefined): boolean {
  if (!epi) return false;
  return poligonosDe(epi.poligono).some(
    ([exterior, ...huecos]) => !!exterior && enAnillo(p.lng, p.lat, exterior) && !huecos.some((h) => enAnillo(p.lng, p.lat, h)),
  );
}

/** ¿Puede este usuario editar en `zone`? (super_admin siempre). */
export function puedeEditarEn(j: Jurisdiccion | null, zone: EpiZone | null | undefined): boolean {
  // `null` significa que la jurisdicción todavía no cargó o que el API
  // falló. Nunca debe equivaler a super_admin: el endpoint representa a
  // ese rol explícitamente con `restringido: false`.
  if (!j) return false;
  if (!j.restringido) return true;
  return !!j.miEpi && zone === j.miEpi;
}

/** ¿Puede marcar este punto? (dentro del polígono de su EPI). */
export function puntoPermitido(j: Jurisdiccion | null, p: { lat: number; lng: number }): boolean {
  if (!j) return false;
  if (!j.restringido) return true;
  if (!j.miEpi) return false;
  const mia = j.epis.find((e) => e.zone === j.miEpi);
  // Sin polígono no existe un límite verificable: falla cerrado. El API
  // también debe aplicar este criterio para impedir llamadas directas.
  if (!mia?.poligono) return false;
  return puntoEnEpi(p, mia);
}

// Misma tolerancia que el backend (mapas/jurisdiccion.ts): el camino
// ruteado por calles (OSRM) puede rozar el borde aunque los puntos
// marcados estén dentro.
const TOLERANCIA_M = 60;

function distanciaSegmentoM(p: { lat: number; lng: number }, a: [number, number], b: [number, number]): number {
  const k = Math.cos((p.lat * Math.PI) / 180) * 111_320;
  const ax = (a[0] - p.lng) * k, ay = (a[1] - p.lat) * 110_540;
  const bx = (b[0] - p.lng) * k, by = (b[1] - p.lat) * 110_540;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
  return Math.hypot(ax + t * dx, ay + t * dy);
}

function cercaDelBorde(p: { lat: number; lng: number }, epi: EpiJurisdiccion): boolean {
  return poligonosDe(epi.poligono).some((poly) =>
    poly.some((ring) => ring.some((v, i) => i > 0 && distanciaSegmentoM(p, ring[i - 1]!, v) <= TOLERANCIA_M)),
  );
}

/** ¿Todo el trazado (ya ruteado) queda dentro de su EPI? Mismo criterio que el backend. */
export function trazadoPermitido(j: Jurisdiccion | null, path: { lat: number; lng: number }[]): boolean {
  if (!j) return false;
  if (!j.restringido) return true;
  if (!j.miEpi) return false;
  const mia = j.epis.find((e) => e.zone === j.miEpi);
  if (!mia?.poligono) return false;
  return path.every((p) => puntoEnEpi(p, mia) || cercaDelBorde(p, mia));
}
