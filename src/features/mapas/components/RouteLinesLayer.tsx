'use client';

import { Polyline, Popup, Marker, Tooltip } from 'react-leaflet';
import React, { useEffect, useState } from 'react';
import { callesGuardadas, claveCalles, muestrasDe, resolverCalles } from '../lib/callesRuta';
import type { LatLng } from '../lib/routeGeometry';
import type { RouteGroup } from '../lib/routeGroups';
import { PANES, ZOOM, grosorRuta, iconoCacheado } from '../lib/capas';
import { useZoomMapa, useZoomMaximo } from './MapPanes';
import L from 'leaflet';

// RF-G3-09 (rediseño 2026-09-14): dibuja cada ruta activa como una línea
// de color llamativo sobre el mapa (estilo apps de despacho/delivery) —
// "deben cambiar de color las rutas que aparecen en el mapa para
// diferenciarlas" — el mismo color que usa el chip de la ruta en
// PatrolRosterPanel, para poder relacionarlos de un vistazo.
//
// Jerarquía y zoom (16/10, lib/capas.ts): la línea siempre se ve (más fina de
// lejos); los rombos, solo desde el zoom de barrio. Los círculos numerados
// 1–5 se quitaron (pedido del usuario 16/10): se confundían con los puntos
// que marca el operador.
//
// Rombos (16/10): uno por cada calle de "Zona y calles por donde pasará"
// (lib/callesRuta.ts, los mismos 4 puntos), con el nombre de la calle al
// pasar el mouse. El inicio, un poco más grande. Antes había un rombo por
// guardia en su punto asignado; con el camino de incorporación yendo al
// inicio de la ruta ya no aportaba (y en coche/moto se encimaban en uno).
// Tampoco se dibuja un punto extra en la posición GPS de cada guardia:
// repetía el pin del guardia (PatrolLayer) justo debajo de él.

// Rombo (vs. el círculo del guardia) para que se distingan de un vistazo.
function createCheckpointIcon(color: string, inicio = false) {
  const tam = inicio ? 16 : 13;
  return iconoCacheado(`rombo|${color}|${tam}`, () => L.divIcon({
    className: '',
    html: `<div style="width:${tam}px;height:${tam}px;background:${color};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.5);transform:rotate(45deg)"></div>`,
    iconSize: [tam, tam],
    iconAnchor: [tam / 2, tam / 2],
  }));
}

/** Contenido del tooltip de un rombo: se monta al abrirlo, así la calle se busca solo si alguien mira (y queda en caché). */
function CalleDeMuestra({ puntos, indice, etiqueta, ruta }: { puntos: LatLng[]; indice: number; etiqueta: string; ruta: string }) {
  const clave = claveCalles(puntos);
  const [calles, setCalles] = useState<string[] | null>(() => callesGuardadas(clave));
  useEffect(() => {
    if (calles) return;
    let vigente = true;
    void resolverCalles(puntos).then((r) => vigente && setCalles(r.calles));
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `clave` resume `puntos`
  }, [clave]);
  return (
    <span className="block">
      <span className="block text-[12px] font-semibold">{calles?.[indice] ?? 'Buscando calle…'}</span>
      <span className="block text-[11px] text-neutral-text-muted">{`${etiqueta} · ${ruta}`}</span>
    </span>
  );
}

export interface RouteLinesLayerProps {
  routeGroups: RouteGroup[];
}

export const RouteLinesLayer = React.memo(function RouteLinesLayer({ routeGroups }: RouteLinesLayerProps) {
  const zoom = useZoomMapa();
  const zoomMaximo = useZoomMaximo();
  const conDetalle = zoom >= ZOOM.checkpoints;
  const grosor = grosorRuta(zoom);
  return (
    <>
      {routeGroups.map((route) =>
        route.path.length >= 2 ? (
          <Polyline
            key={route.id}
            pane={PANES.rutas.name}
            positions={route.path.map((p) => [p.lat, p.lng])}
            pathOptions={{ color: route.color, weight: grosor, opacity: 0.85 }}
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
      {conDetalle &&
        routeGroups.map((route) =>
          route.path.length >= 2
            ? muestrasDe(route.path).map((m, idx, todas) => (
                <Marker
                  key={`calle-${route.id}-${idx}`}
                  pane={PANES.checkpoints.name}
                  position={[m.punto.lat, m.punto.lng]}
                  icon={createCheckpointIcon(route.color, idx === 0)}
                  title={m.etiqueta}
                  eventHandlers={{ dblclick: (e) => zoomMaximo(m.punto.lat, m.punto.lng, e.target) }}
                >
                  <Tooltip direction="top" offset={[0, -8]}>
                    <CalleDeMuestra puntos={todas.map((t) => t.punto)} indice={idx} etiqueta={m.etiqueta} ruta={route.nombre} />
                  </Tooltip>
                </Marker>
              ))
            : null,
        )}
    </>
  );
});
