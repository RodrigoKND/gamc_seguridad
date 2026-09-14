'use client';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

// Puente imperativo entre la bandeja de información (lista de guardias o de
// zonas críticas) y el mapa: al hacer clic en una fila, `useMap()` es la
// única forma de mover el mapa desde fuera de <MapContainer> sin
// desmontarlo — por eso este componente vive siempre montado dentro de
// MapCanvas (igual que PatrolLayer/HeatmapLayer) y no dibuja nada él
// mismo, solo reacciona a `target`.

export interface MapFocusTarget {
  lat: number;
  lng: number;
  zoom?: number;
}

export interface MapFocusProps {
  target: MapFocusTarget | null;
}

export function MapFocus({ target }: MapFocusProps) {
  const map = useMap();

  useEffect(() => {
    if (!target) return;
    map.flyTo([target.lat, target.lng], target.zoom ?? Math.max(map.getZoom(), 15), { duration: 0.6 });
  }, [target, map]);

  return null;
}
