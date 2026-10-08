'use client';

import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, GeoJSON, Marker, Pane, Polygon, Popup, Tooltip, useMap } from 'react-leaflet';
import type { GeoJsonObject } from 'geojson';
import L from 'leaflet';
import { getModulosPoliciales, type ModuloPolicial } from '@/lib/data-source';
import { useEpiCatalogo } from '@/lib/epis/EpiCatalogProvider';
import { EPI_COLOR_SIN_DATO } from '@/types/epi';
import type { Jurisdiccion } from '../lib/jurisdiccion';

// Capa "cristal" de jurisdicciones EPI (2026-10-05; catálogo v2 cambios/04
// F1): cada EPI se pinta con SU color del catálogo (GET /api/epis) en
// relleno translúcido + borde. La EPI propia se resalta (más opaca, borde
// sólido); las ajenas quedan atenuadas con borde punteado. Encima:
//  · pin de la SEDE de cada EPI (inventario oficial),
//  · capa opcional de módulos policiales,
//  · zona de referencia "Centro — Plaza 14 de Septiembre" (no es EPI).
// Nada de esto es interactivo con el mapa del wizard (no roba sus clics).
//
// Panes propios POR DEBAJO de overlayPane (400, donde van las líneas de
// ruta): así las rutas siempre se ven encima de los territorios sin el
// truco de `bringToBack()` que dependía del orden de carga.
const PANE_TERRITORIOS = 'epi-territorios';
const PANE_CENTRO = 'epi-centro';
const PANE_MODULOS = 'epi-modulos';

// Zona de referencia "Centro": la Plaza 14 de Septiembre completa
// (contorno de OpenStreetMap, way 28575218, leisure=park; © OSM, ODbL). No
// es jurisdicción — Centro Cercado dejó de ser EPI (catálogo v2) — solo la
// referencia visual en negro de los mockups. Translúcida como los
// territorios EPI (pedido del usuario: el negro sólido era demasiado intenso).
const CENTRO_REFERENCIA: [number, number][] = [
  [-17.393368, -66.157504], [-17.393353, -66.157414], [-17.393327, -66.157263], [-17.393305, -66.15713],
  [-17.393277, -66.156963], [-17.39326, -66.156857], [-17.393237, -66.156723], [-17.393213, -66.156575],
  [-17.393204, -66.156527], [-17.393248, -66.156544], [-17.393282, -66.156546], [-17.394203, -66.156368],
  [-17.394233, -66.156354], [-17.394254, -66.156339], [-17.39425, -66.156361], [-17.394254, -66.156388],
  [-17.394265, -66.156449], [-17.394371, -66.157062], [-17.394397, -66.157206], [-17.394414, -66.157304],
  [-17.394418, -66.157326], [-17.394401, -66.157314], [-17.394381, -66.157307], [-17.394364, -66.15731],
  [-17.393443, -66.15748], [-17.393404, -66.157497], [-17.393371, -66.157524],
];
const CENTRO_RELLENO = '#111827';
const CENTRO_OPACIDAD = 0.35;
const CENTRO_BORDE = '#111827';

export interface EpiJurisdictionLayerProps {
  jurisdiccion: Jurisdiccion | null;
  /** Solo la EPI propia (p. ej. dentro del wizard de rutas). */
  soloPropia?: boolean;
  /** Ajusta una sola vez la vista para que entren todos los límites visibles. */
  ajustarVista?: boolean;
  /** Pines de sedes + zona de referencia del Centro (mapa principal). */
  mostrarReferencias?: boolean;
  mostrarModulos?: boolean;
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

function colorValido(c: string | null | undefined): string {
  return c && /^#[0-9A-Fa-f]{6}$/.test(c) ? c : EPI_COLOR_SIN_DATO;
}

function iconoSede(color: string, numero: number | null): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="width:26px;height:26px;border-radius:7px;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:#fff;font:700 11px 'IBM Plex Sans',sans-serif">${numero ?? '·'}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function SedesEpi({ jurisdiccion }: { jurisdiccion: Jurisdiccion }) {
  const { epis } = useEpiCatalogo();
  return (
    <>
      {jurisdiccion.epis.map((epi) => {
        if (!epi.sede) return null;
        const info = epis.find((e) => e.codigo === epi.zone);
        return (
          <Marker key={`sede-${epi.zone}`} position={[epi.sede.lat, epi.sede.lng]} icon={iconoSede(colorValido(epi.color), epi.numero)}>
            <Tooltip direction="top" offset={[0, -12]}>{`Sede ${epi.nombre}`}</Tooltip>
            <Popup>
              <p className="text-[13px] font-bold">{info?.nombreOficial ?? epi.nombre}</p>
              {epi.sede.direccion && <p className="text-xs text-neutral-text-muted">{epi.sede.direccion}</p>}
              {info && info.telefonos.length > 0 && (
                <p className="mt-1 text-xs">
                  {info.telefonos.map((t) => `${t.tipo === 'whatsapp' ? 'WhatsApp' : 'Tel.'} ${t.numero}`).join(' · ')}
                </p>
              )}
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

function ModulosPoliciales({ jurisdiccion }: { jurisdiccion: Jurisdiccion }) {
  const [modulos, setModulos] = useState<ModuloPolicial[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    let vivo = true;
    getModulosPoliciales()
      .then((m) => vivo && setModulos(m))
      .catch(() => vivo && setError(true));
    return () => {
      vivo = false;
    };
  }, []);
  if (error) return null;
  const colorDe = (codigo: string) => colorValido(jurisdiccion.epis.find((e) => e.zone === codigo)?.color);
  return (
    <Pane name={PANE_MODULOS} style={{ zIndex: 405 }}>
      {modulos.map((m) => (
        <CircleMarker
          key={m.id}
          center={[m.lat, m.lng]}
          radius={4.5}
          pathOptions={{ color: '#fff', weight: 1.5, fillColor: colorDe(m.epiCodigo), fillOpacity: 1 }}
        >
          <Tooltip direction="top">
            {`${m.codigo} · ${m.nombre}${m.coordenadasAproximadas ? ' (ubicación aproximada)' : ''}`}
          </Tooltip>
        </CircleMarker>
      ))}
    </Pane>
  );
}

export function EpiJurisdictionLayer({
  jurisdiccion,
  soloPropia = false,
  ajustarVista = false,
  mostrarReferencias = false,
  mostrarModulos = false,
}: EpiJurisdictionLayerProps) {
  if (!jurisdiccion) return null;
  const { epis, miEpi, restringido } = jurisdiccion;
  return (
    <>
      {ajustarVista && <JurisdictionViewport jurisdiccion={jurisdiccion} soloPropia={soloPropia} />}
      <Pane name={PANE_TERRITORIOS} style={{ zIndex: 395 }}>
        {epis.map((epi) => {
          if (!epi.poligono) return null;
          const propia = restringido && epi.zone === miEpi;
          if (soloPropia && restringido && !propia) return null;
          const color = colorValido(epi.color);
          const atenuada = restringido && !propia;
          return (
            <GeoJSON
              // key con miEpi/color: react-leaflet no re-aplica `style` al cambiar props.
              key={`${epi.zone}-${color}-${miEpi ?? 'all'}-${soloPropia ? 1 : 0}`}
              data={epi.poligono as unknown as GeoJsonObject}
              interactive={false}
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
      </Pane>
      {mostrarReferencias && (
        <>
          <Pane name={PANE_CENTRO} style={{ zIndex: 396 }}>
            <Polygon
              positions={CENTRO_REFERENCIA}
              interactive={false}
              pathOptions={{ color: CENTRO_BORDE, weight: 2, fillColor: CENTRO_RELLENO, fillOpacity: CENTRO_OPACIDAD }}
            >
              <Tooltip permanent direction="center" className="epi-centro-etiqueta">
                Centro
              </Tooltip>
            </Polygon>
          </Pane>
          <SedesEpi jurisdiccion={jurisdiccion} />
        </>
      )}
      {mostrarModulos && <ModulosPoliciales jurisdiccion={jurisdiccion} />}
    </>
  );
}

export function EpiJurisdictionLegend({
  jurisdiccion,
  mostrarModulos,
  onToggleModulos,
}: {
  jurisdiccion: Jurisdiccion | null;
  mostrarModulos?: boolean;
  onToggleModulos?: (v: boolean) => void;
}) {
  if (!jurisdiccion || jurisdiccion.epis.every((e) => !e.poligono)) return null;
  const { epis, miEpi, restringido } = jurisdiccion;
  const ordenadas = [...epis].filter((e) => e.poligono).sort((a, b) => (a.numero ?? 99) - (b.numero ?? 99));
  return (
    <div className="absolute bottom-3 left-3 z-[500] rounded-lg border border-neutral-border bg-white/85 px-3 py-2 text-[11px] shadow-sm backdrop-blur-sm">
      <p className="mb-1 font-semibold text-neutral-text">Jurisdicciones EPI</p>
      <ul className="flex flex-col gap-0.5">
        {ordenadas.map((e) => (
          <li key={e.zone} className="flex items-center gap-1.5 text-neutral-text-muted">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: colorValido(e.color) }} />
            {e.numero ? `${e.numero}. ` : ''}
            {e.nombre}
            {restringido && e.zone === miEpi && <span className="font-semibold text-neutral-text">(tu EPI)</span>}
          </li>
        ))}
        <li className="flex items-center gap-1.5 text-neutral-text-muted">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: CENTRO_RELLENO }} />
          Centro – Plaza 14 de Septiembre (referencia)
        </li>
      </ul>
      {onToggleModulos && (
        <label className="mt-1.5 flex cursor-pointer items-center gap-1.5 text-neutral-text">
          <input type="checkbox" checked={!!mostrarModulos} onChange={(ev) => onToggleModulos(ev.target.checked)} />
          Módulos policiales
        </label>
      )}
      <p className="mt-1 max-w-[210px] text-neutral-text-muted">Límites aproximados; pendientes de validación territorial.</p>
      {restringido && !miEpi && (
        <p className="mt-1 max-w-[180px] text-risk-critical">Sin EPI asignada: no puedes modificar rutas.</p>
      )}
    </div>
  );
}
