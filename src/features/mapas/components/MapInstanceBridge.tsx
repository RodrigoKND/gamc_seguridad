'use client';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import type { Map as LeafletMap } from 'leaflet';

// Igual que MapFocus.tsx: `useMap()` solo funciona dentro del árbol de
// <MapContainer>, así que este puente le pasa la instancia de Leaflet a
// quien la necesite AFUERA (ej. el asistente de asignación de ruta, para
// convertir la posición de un elemento soltado con @dnd-kit en lat/lng vía
// `map.containerPointToLatLng`).

export interface MapInstanceBridgeProps {
  onReady: (map: LeafletMap) => void;
}

export function MapInstanceBridge({ onReady }: MapInstanceBridgeProps) {
  const map = useMap();

  useEffect(() => {
    onReady(map);
    // Solo al montar — la instancia de Leaflet no cambia durante la vida
    // del MapContainer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  return null;
}
