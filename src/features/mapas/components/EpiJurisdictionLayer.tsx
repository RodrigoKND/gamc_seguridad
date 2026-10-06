'use client';

import { useEffect, useMemo } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';
import type { GeoJsonObject } from 'geojson';
import type L from 'leaflet';
import { EPI_ZONE_HEX } from '@/types/epi';
import type { Jurisdiccion } from '../lib/jurisdiccion';

// Capa "cristal" de jurisdicciones EPI (2026-10-05): cada EPI se pinta con
// su color territorial (EPI_ZONE_HEX) en relleno translúcido + borde, para
// que el Operador vea dónde termina su jurisdicción. La EPI propia se
// resalta (más opaca, borde sólido); las ajenas quedan atenuadas con borde
// punteado. `interactive: false` para no robar los clics del mapa (el
// wizard de rutas marca puntos con click).

export interface EpiJurisdictionLayerProps {
  jurisdiccion: Jurisdiccion | null;
  /** Solo la EPI propia (p. ej. dentro del wizard de rutas). */
  soloPropia?: boolean;
  /** Ajusta una sola vez la vista para que entren todos los límites visibles. */
  ajustarVista?: boolean;
}

function JurisdictionViewport({ jurisdiccion, soloPropia }: Pick<EpiJurisdictionLayerProps, 'jurisdiccion' | 'soloPropia'>) {
  const map = useMap();
  const puntos = useMemo(() => {
    if (!jurisdiccion) return [] as [number, number][];
    const visibles = jurisdiccion.epis.filter((epi) => {
      if (!epi.poligono) return false;
      return !soloPropia || !jurisdiccion.restringido || epi.zone === jurisdiccion.miEpi;
    });
    const resultado: [number, number][] = [];
    const recoger = (valor: unknown) => {
      if (!Array.isArray(valor)) return;
      if (valor.length >= 2 && typeof valor[0] === 'number' && typeof valor[1] === 'number') {
        resultado.push([valor[1], valor[0]]);
        return;
      }
      valor.forEach(recoger);
    };
    visibles.forEach((epi) => recoger(epi.poligono?.coordinates));
    return resultado;
  }, [jurisdiccion, soloPropia]);

  useEffect(() => {
    if (puntos.length < 2) return;
    map.fitBounds(puntos, { padding: [28, 28], maxZoom: 14, animate: false });
  }, [map, puntos]);

  return null;
}

export function EpiJurisdictionLayer({ jurisdiccion, soloPropia = false, ajustarVista = false }: EpiJurisdictionLayerProps) {
  if (!jurisdiccion) return null;
  const { epis, miEpi, restringido } = jurisdiccion;
  return (
    <>
      {ajustarVista && <JurisdictionViewport jurisdiccion={jurisdiccion} soloPropia={soloPropia} />}
      {epis.map((epi) => {
        if (!epi.poligono) return null;
        const propia = restringido && epi.zone === miEpi;
        if (soloPropia && restringido && !propia) return null;
        const color = EPI_ZONE_HEX[epi.zone];
        const atenuada = restringido && !propia;
        return (
          <GeoJSON
            // key con miEpi: react-leaflet no re-aplica `style` al cambiar props.
            key={`${epi.zone}-${miEpi ?? 'all'}-${soloPropia ? 1 : 0}`}
            data={epi.poligono as unknown as GeoJsonObject}
            interactive={false}
            // Siempre DEBAJO de las líneas de ruta: los polígonos llegan
            // después (fetch aparte) y Leaflet los agregaría encima en el SVG.
            eventHandlers={{ add: (e) => (e.target as L.GeoJSON).bringToBack() }}
            style={{
              color,
              weight: propia ? 4 : 3,
              opacity: atenuada ? 0.7 : 1,
              dashArray: atenuada ? '6 6' : undefined,
              fillColor: color,
              fillOpacity: propia ? 0.28 : atenuada ? 0.1 : 0.2,
            }}
          />
        );
      })}
    </>
  );
}

export function EpiJurisdictionLegend({ jurisdiccion }: { jurisdiccion: Jurisdiccion | null }) {
  if (!jurisdiccion || jurisdiccion.epis.every((e) => !e.poligono)) return null;
  const { epis, miEpi, restringido } = jurisdiccion;
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-lg border border-neutral-border bg-white/85 px-3 py-2 text-[11px] shadow-sm backdrop-blur-sm">
      <p className="mb-1 font-semibold text-neutral-text">Jurisdicciones EPI</p>
      <ul className="flex flex-col gap-0.5">
        {epis.filter((e) => e.poligono).map((e) => (
          <li key={e.zone} className="flex items-center gap-1.5 text-neutral-text-muted">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: EPI_ZONE_HEX[e.zone] }} />
            {e.zone === 'sud' ? 'Sud (Sur, Jaihuayco y Alalay Sud)' : e.nombre}
            {restringido && e.zone === miEpi && <span className="font-semibold text-neutral-text">(tu EPI)</span>}
          </li>
        ))}
      </ul>
      <p className="mt-1 max-w-[210px] text-neutral-text-muted">Límites aproximados; pendientes de validación territorial.</p>
      {restringido && !miEpi && (
        <p className="mt-1 max-w-[180px] text-risk-critical">Sin EPI asignada: no puedes modificar rutas.</p>
      )}
    </div>
  );
}
