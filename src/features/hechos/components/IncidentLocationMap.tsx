'use client';

import L from 'leaflet';
import { Marker } from 'react-leaflet';
import { MapCanvas } from '@/features/mapas/components/MapCanvas';
import { MapFocus } from '@/features/mapas/components/MapFocus';

// Leaflet lee `window` al cargar — separado en su propio archivo para poder
// importarlo con `next/dynamic({ ssr: false })` desde IncidentDetailDrawer y
// no romper el prerender estático de /hechos ("window is not defined" en
// build), mismo motivo por el que el Módulo de Mapas nunca se prerenderiza.

export interface IncidentLocationMapProps {
  lat: number;
  lng: number;
}

export function IncidentLocationMap({ lat, lng }: IncidentLocationMapProps) {
  return (
    <div className="relative mb-2 h-[180px] overflow-hidden rounded-lg border border-neutral-border">
      <MapCanvas>
        <MapFocus target={{ lat, lng, zoom: 15 }} />
        <Marker
          position={[lat, lng]}
          icon={L.divIcon({
            className: '',
            html: '<div style="width:26px;height:26px;border-radius:9999px;background:#DC2626;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>',
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          })}
        />
      </MapCanvas>
    </div>
  );
}
