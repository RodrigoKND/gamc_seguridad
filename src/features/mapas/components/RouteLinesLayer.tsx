'use client';

import { Polyline, Popup, Marker } from 'react-leaflet';
import React from 'react';
import type { RouteGroup } from '../lib/routeGroups';
import { sampleCheckpoints } from '../lib/routeGeometry';
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

// Checkpoint = el punto ESTRATÉGICO que le tocó a este guardia dentro del
// trazado compartido (patrulla.poligono_geojson) — distinto del punto GPS
// en vivo de arriba. Forma de rombo (vs. el círculo del GPS) para que se
// distingan de un vistazo aunque coincidan en el mismo lugar.
function createCheckpointIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;background:${color};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.5);transform:rotate(45deg)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

// Checkpoints NUMERADOS repartidos sobre TODO el trazado (no uno por
// guardia): con 1 solo guardia el punto asignado queda pegado a su pin de
// GPS y es indistinguible — "solo me aparece la línea" reportado
// 2026-09-19 después de agregar el rombo por guardia. Esto usa el MISMO
// `route.path` que ya dibuja la Polyline (que sí se ve), así que no
// depende de que `poligonoGeojson` venga bien poblado por guardia.
function createNumberedCheckpointIcon(color: string, index: number) {
  return L.divIcon({
    className: '',
    html: `<div style="width:20px;height:20px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.5);color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;font-family:'IBM Plex Sans',sans-serif">${index + 1}</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
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
              <p className="text-xs text-neutral-text-muted">{route.guardiasEnRuta} de {route.guards.length} en ruta</p>
              {/* Antes solo decía "N guardia(s) asignado(s)" sin decir
                  QUIÉN — pedido explícito 2026-09-19: "debería aparecer
                  qué guardia fue asignado a esa ruta". */}
              <ul className="mt-1 space-y-0.5">
                {route.guards.map((g) => (
                  <li key={g.guardiaId} className="text-xs text-neutral-text">
                    • {g.nombre ?? g.guardiaId}
                  </li>
                ))}
              </ul>
            </Popup>
          </Polyline>
        ) : null,
      )}
      {/* Marcadores de posición de cada guardia sobre la ruta (tiempo real) */}
      {routeGroups.map((route) =>
        route.guards.map((g) => {
          if (g.lat == null || g.lng == null) return null;
          return (
            <Marker key={`guard-${g.guardiaId}`} position={[g.lat, g.lng]} icon={createGuardPositionIcon(route.color)}>
              <Popup>
                <p className="text-[13px] font-bold">{g.nombre ?? g.guardiaId}</p>
                <p className="text-xs text-neutral-text-muted">Posición GPS en vivo · {route.nombre}</p>
              </Popup>
            </Marker>
          );
        }),
      )}
      {/* Checkpoints numerados repartidos sobre TODO el trazado — visibles
          sin importar cuántos guardias tenga la ruta. */}
      {routeGroups.map((route) =>
        route.path.length >= 2
          ? sampleCheckpoints(route.path, 5).map((p, i) => (
              <Marker key={`ckpt-${route.id}-${i}`} position={[p.lat, p.lng]} icon={createNumberedCheckpointIcon(route.color, i)}>
                <Popup>
                  <p className="text-[13px] font-bold">Checkpoint {i + 1} — {route.nombre}</p>
                </Popup>
              </Marker>
            ))
          : null,
      )}
      {/* Checkpoint por guardia: el punto estratégico que le tocó dentro
          del trazado compartido — con 1 solo guardia puede coincidir con
          su pin de GPS en vivo (rombo vs. círculo para distinguirlos). */}
      {routeGroups.map((route) =>
        route.guards.map((g) =>
          g.puntoAsignado ? (
            <Marker
              key={`checkpoint-${g.guardiaId}`}
              position={[g.puntoAsignado.lat, g.puntoAsignado.lng]}
              icon={createCheckpointIcon(route.color)}
            >
              <Popup>
                <p className="text-[13px] font-bold">Punto asignado — {g.nombre ?? g.guardiaId}</p>
                <p className="text-xs text-neutral-text-muted">{route.nombre}</p>
              </Popup>
            </Marker>
          ) : null,
        ),
      )}
    </>
  );
});
