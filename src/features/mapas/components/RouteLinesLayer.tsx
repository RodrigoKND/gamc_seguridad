'use client';

import { Polyline, Popup } from 'react-leaflet';
import type { RouteGroup } from '../lib/routeGroups';

// RF-G3-09 (rediseño 2026-09-14): dibuja cada ruta activa como una línea
// de color llamativo sobre el mapa (estilo apps de despacho/delivery) —
// "deben cambiar de color las rutas que aparecen en el mapa para
// diferenciarlas" — el mismo color que usa el chip de la ruta en
// PatrolRosterPanel, para poder relacionarlos de un vistazo.

export interface RouteLinesLayerProps {
  routeGroups: RouteGroup[];
}

export function RouteLinesLayer({ routeGroups }: RouteLinesLayerProps) {
  return (
    <>
      {routeGroups.map((route) =>
        route.path.length >= 2 ? (
          <Polyline
            key={route.id}
            positions={route.path.map((p) => [p.lat, p.lng])}
            pathOptions={{ color: route.color, weight: 4, opacity: 0.85 }}
          >
            <Popup>
              <p className="text-[13px] font-bold">{route.nombre}</p>
              <p className="text-xs text-neutral-text-muted">{route.guards.length} guardia(s) asignado(s)</p>
            </Popup>
          </Polyline>
        ) : null,
      )}
    </>
  );
}
