'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import { useMap } from 'react-leaflet';
import { PANES, ZOOM_MAXIMO } from '../lib/capas';

// Crea UNA vez los panes de la jerarquía de capas (lib/capas.ts) en cada
// mapa. Antes cada capa creaba su <Pane> y el orden dependía de quién se
// montaba primero. useLayoutEffect: corre antes de que las capas (que se
// agregan en useEffect) pidan su pane.
export function MapPanes() {
  const map = useMap();
  useLayoutEffect(() => {
    for (const { name, zIndex } of Object.values(PANES)) {
      const pane = map.getPane(name) ?? map.createPane(name);
      pane.style.zIndex = String(zIndex);
    }
  }, [map]);
  // Leaflet solo escucha el tamaño de la VENTANA: si cambia el de su
  // contenedor (barra de capas, aviso de SOS, panel que se pliega) hay que
  // avisarle, o quedan franjas sin teselas y los clics caen corridos.
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);
  return null;
}

/**
 * Acerca el mapa al MÁXIMO zoom sobre un punto (16/10): doble clic en
 * cualquier pin o símbolo, y clic en un guardia, para ver dónde está
 * exactamente. `capa`: el símbolo clicado; se cierra su ventanita (el primer
 * clic del doble clic la abrió).
 *
 * Para que el doble clic llegue, la ventanita de esos símbolos se abre SIN
 * mover el mapa (`autoPan={false}`, ver AUTO_PAN_SIMBOLOS): si el mapa se
 * desplaza tras el primer clic, el segundo cae en otro lado.
 */
export const AUTO_PAN_SIMBOLOS = false;

export function useZoomMaximo(): (lat: number, lng: number, capa?: { closePopup?: () => unknown }) => void {
  const map = useMap();
  return (lat, lng, capa) => {
    capa?.closePopup?.();
    const max = Number.isFinite(map.getMaxZoom()) ? map.getMaxZoom() : ZOOM_MAXIMO;
    map.flyTo([lat, lng], max, { duration: 0.7 });
  };
}

/**
 * Zoom actual del mapa (se actualiza al terminar cada zoom). Se vuelve a
 * leer al suscribirse: el encuadre inicial (fitBounds sin animación) puede
 * ocurrir antes de que esta capa escuche y ese evento se perdería.
 */
export function useZoomMapa(): number {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useEffect(() => {
    const leer = () => setZoom(map.getZoom());
    leer();
    map.on('zoomend viewreset', leer);
    return () => {
      map.off('zoomend viewreset', leer);
    };
  }, [map]);
  return zoom;
}
