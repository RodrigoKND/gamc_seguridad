import L from 'leaflet';
import type { PatrullaModalidad, RutaPlantillaRow } from '@/types/patrulla';
import { Bike, Building2, Car, Footprints, ShieldCheck } from 'lucide-react';
import { safePhotoUrl } from './safeIconUrl';
import type { LatLng } from './routeGeometry';

// Piezas compartidas por los modales del menú "Rutas" (asignar, crear
// predeterminada, rutas guardadas).

export const MODALIDAD_ICONS: Record<PatrullaModalidad, typeof Car> = {
  coche: Car,
  moto: Bike,
  a_pie: Footprints,
  punto_fijo: ShieldCheck,
  oficina: Building2,
};

export function trazadoAPuntos(trazado: RutaPlantillaRow['trazado']): LatLng[] {
  return trazado.map(([lng, lat]) => ({ lat, lng }));
}

export function numberedPointIcon(index: number) {
  return L.divIcon({
    className: '',
    html: `<div style="width:24px;height:24px;border-radius:9999px;background:#1A1A1A;border:2px solid #C59B6D;box-shadow:0 1px 3px rgba(0,0,0,.4);color:#C59B6D;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;font-family:'IBM Plex Sans',sans-serif">${index + 1}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

export function guardPointIcon(color: string, label: string, fotoUrl?: string) {
  const photoUrl = safePhotoUrl(fotoUrl);
  const fill = photoUrl ? `background-image:url('${photoUrl}');background-size:cover;background-position:center;` : `background:${color};`;
  return L.divIcon({
    className: '',
    html: `<div style="width:22px;height:22px;border-radius:9999px;${fill}border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4);color:#fff;font-size:9px;font-weight:700;display:flex;align-items:center;justify-content:center;font-family:'IBM Plex Sans',sans-serif">${photoUrl ? '' : label}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

/** UUID para la clave idempotente (crypto.randomUUID con respaldo). */
export function nuevaClave(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16));
}
