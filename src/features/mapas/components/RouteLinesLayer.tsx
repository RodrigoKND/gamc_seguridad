'use client';

import { Polyline, Popup, Marker } from 'react-leaflet';
import React from 'react';
import type { RouteGroup } from '../lib/routeGroups';
import L from 'leaflet';

// RF-G3-09 (rediseño 2026-09-14): dibuja cada ruta activa como una línea
// de color llamativo sobre el mapa (estilo apps de despacho/delivery) —
// "deben cambiar de color las rutas que aparecen en el mapa para
// diferenciarlas" — el mismo color que usa el chip de la ruta en
// PatrolRosterPanel, para poder relacionarlos de un vistazo.
// También muestra los puntos de posición de cada guardia sobre la ruta
// cuando se monitorea en tiempo real.

function createGuardPositionIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="width:10px;height:10px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)"></div>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  });
}

export interface RouteLinesLayerProps {
  routeGroups: RouteGroup[];
}

export const RouteLinesLayer = React.memo(function RouteLinesLayer({ routeGroups }: RouteLinesLayerProps) {
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
              <p className="text-xs text-neutral-text-muted">{route.guards.length} guardia(s) asignado(s) · {route.guardiasEnRuta} en ruta</p>
            </Popup>
          </Polyline>
        ) : null,
      )}
      {/* Marcadores de posición de cada guardia sobre la ruta (tiempo real) */}
      {routeGroups.map((route) =>
        route.guards.map((g) => {
          if (g.lat == null || g.lng == null) return null;
          // Encontrar el punto más cercano de la ruta al guardia
          const closestPoint = route.path.length > 0 ? route.path[0] : null;
          return closestPoint ? (
            <Marker key={`guard-${g.guardiaId}`} position={[g.lat, g.lng]} icon={createGuardPositionIcon(route.color)} />
          ) : null;
        }),
      )}
    </>
  );
});
