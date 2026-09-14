'use client';

import { Polyline } from 'react-leaflet';
import type { GuardMarker } from '../types';

// Caso C de la bandeja de Patrullaje: guardias de la MISMA unidad
// (comparten unidadId — ej. dos sub-puntos de un mismo punto de servicio
// con nombre, como "Plataforma" e "Inicio de Gradas" de Cristo Seguro en
// el rol de servicio real) pero separados por una distancia real, no
// apilados como el Caso B (coche/moto, unos metros de jitter). Se dibuja
// una línea punteada fina entre ellos — un "cerco" visual — para que el
// Operador lea de un vistazo que esos puntos cubren juntos una misma zona,
// sin fusionarlos en un cluster (eso solo pasa si de verdad están a pocos
// metros, y ya lo resuelve MarkerClusterGroup en PatrolLayer).
//
// Umbral en metros, no en píxeles: el clustering de Leaflet es por radio
// de pantalla (depende del zoom), pero "misma unidad, mismo servicio" es
// una relación geográfica real que no debería aparecer/desaparecer al
// hacer zoom.
const DISTANCIA_MINIMA_METROS = 30;

function distanciaMetros(a: GuardMarker, b: GuardMarker): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface UnitPerimeterLinesProps {
  guards: GuardMarker[];
}

export function UnitPerimeterLines({ guards }: UnitPerimeterLinesProps) {
  const grupos = new Map<string, GuardMarker[]>();
  for (const guard of guards) {
    if (!guard.unidadId) continue;
    const grupo = grupos.get(guard.unidadId) ?? [];
    grupo.push(guard);
    grupos.set(guard.unidadId, grupo);
  }

  const segmentos: [GuardMarker, GuardMarker][] = [];
  for (const grupo of grupos.values()) {
    for (let i = 0; i < grupo.length; i += 1) {
      for (let j = i + 1; j < grupo.length; j += 1) {
        if (distanciaMetros(grupo[i], grupo[j]) >= DISTANCIA_MINIMA_METROS) {
          segmentos.push([grupo[i], grupo[j]]);
        }
      }
    }
  }

  return (
    <>
      {segmentos.map(([a, b], index) => (
        <Polyline
          key={`${a.id}-${b.id}-${index}`}
          positions={[[a.lat, a.lng], [b.lat, b.lng]]}
          pathOptions={{ color: '#1A1A1A', weight: 2, dashArray: '6 6', opacity: 0.6 }}
        />
      ))}
    </>
  );
}
