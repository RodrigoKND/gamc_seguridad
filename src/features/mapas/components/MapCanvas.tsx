'use client';

import type { ReactNode } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.Default.css';
import { mapConfig } from '@/lib/env';

// RF/RNF: Módulo de Mapas — RF-G1-01/02 (MASTER.md sección 7.3).
//
// Instancia única del canvas, compartida entre las pestañas Patrullaje /
// Calor / Futuro (MASTER.md sección 7.2, "regla clave del Módulo de Mapas").
// El componente padre (MapasView) NO desmonta este árbol al cambiar de tab
// — solo intercambia los `children` (PatrolLayer <-> HeatmapLayer), así el
// mapa base nunca se recarga y el zoom/centro persisten.
//
// La URL/atribución de las teselas viene de src/lib/env.ts (OpenStreetMap
// por defecto, sin llave) para poder cambiar de proveedor sin tocar este
// componente.

export interface MapCanvasProps {
  children?: ReactNode;
}

export function MapCanvas({ children }: MapCanvasProps) {
  return (
    <MapContainer
      center={[mapConfig.defaultCenter.lat, mapConfig.defaultCenter.lng]}
      zoom={mapConfig.defaultZoom}
      scrollWheelZoom
      className="h-full w-full isolate [&_.leaflet-pane]:!z-[400] [&_.leaflet-top]:!z-[500] [&_.leaflet-bottom]:!z-[500]"
    >
      <TileLayer url={mapConfig.tileUrl} attribution={mapConfig.tileAttribution} maxZoom={18} />
      {children}
    </MapContainer>
  );
}
