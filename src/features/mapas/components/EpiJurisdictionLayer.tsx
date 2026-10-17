'use client';

import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, GeoJSON, Marker, Polygon, Popup, Tooltip, useMap } from 'react-leaflet';
import type { GeoJsonObject } from 'geojson';
import L from 'leaflet';
import { getModulosPoliciales, type ModuloPolicial } from '@/lib/data-source';
import { useEpiCatalogo } from '@/lib/epis/EpiCatalogProvider';
import { EPI_COLOR_SIN_DATO } from '@/types/epi';
import type { Jurisdiccion } from '../lib/jurisdiccion';
import { PANES, ZOOM, iconoCacheado } from '../lib/capas';
import { AUTO_PAN_SIMBOLOS, useZoomMapa, useZoomMaximo } from './MapPanes';

// Capa "cristal" de jurisdicciones EPI (2026-10-05; catálogo v2):
// cada EPI se pinta con SU color del catálogo (GET /api/epis) en
// relleno translúcido + borde. La EPI propia se resalta (más opaca, borde
// sólido); las ajenas quedan atenuadas con borde punteado. Encima:
//  · pin de la SEDE de cada EPI (inventario oficial),
//  · capa opcional de módulos policiales,
//  · zona de referencia "Centro — Plaza 14 de Septiembre" (no es EPI).
// Nada de esto es interactivo con el mapa del wizard (no roba sus clics).
//
// Cada cosa va en su pane de la jerarquía común (lib/capas.ts): territorios
// al fondo, sedes y módulos por encima de las rutas y por debajo de los
// puntos fijos y los guardias.

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
  /**
   * Qué encuadra `ajustarVista`: 'todo' (Admin y Super Admin: el mapa completo)
   * o 'propia' (Operador: su EPI). Por defecto, lo visible.
   */
  encuadre?: 'todo' | 'propia';
  /** Interruptores de capa (mapa principal). */
  mostrarTerritorios?: boolean;
  mostrarSedes?: boolean;
  /** Pines de sedes + zona de referencia del Centro (mapa principal). */
  mostrarReferencias?: boolean;
  mostrarModulos?: boolean;
}

function JurisdictionViewport({ jurisdiccion, soloPropia, encuadre }: Pick<EpiJurisdictionLayerProps, 'jurisdiccion' | 'soloPropia' | 'encuadre'>) {
  const map = useMap();
  const puntos = useMemo(() => {
    if (!jurisdiccion) return [] as [number, number][];
    const soloLaPropia = encuadre === 'propia' || (encuadre !== 'todo' && soloPropia && jurisdiccion.restringido);
    const conPoligono = jurisdiccion.epis.filter((epi) => epi.poligono);
    const propia = conPoligono.filter((epi) => epi.zone === jurisdiccion.miEpi);
    // Sin EPI propia con polígono, se encuadra todo (nunca un mapa vacío).
    const visibles = soloLaPropia && propia.length > 0 ? propia : conPoligono;
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
  }, [jurisdiccion, soloPropia, encuadre]);

  useEffect(() => {
    if (puntos.length < 2) return;
    map.fitBounds(puntos, { padding: [28, 28], maxZoom: 14, animate: false });
  }, [map, puntos]);

  return null;
}

function colorValido(c: string | null | undefined): string {
  return c && /^#[0-9A-Fa-f]{6}$/.test(c) ? c : EPI_COLOR_SIN_DATO;
}

function iconoSede(color: string, numero: number | null, chica: boolean): L.DivIcon {
  const tam = chica ? 18 : 26;
  return iconoCacheado(`sede|${color}|${numero ?? ''}|${tam}`, () => L.divIcon({
    className: '',
    html: `<div style="width:${tam}px;height:${tam}px;border-radius:${chica ? 5 : 7}px;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:#fff;font:700 ${chica ? 9 : 11}px 'IBM Plex Sans',sans-serif">${numero ?? '·'}</div>`,
    iconSize: [tam, tam],
    iconAnchor: [tam / 2, tam / 2],
  }));
}

// Sedes (16/10): ocultas en la vista de ciudad (se encimaban con los grupos
// de guardias), chicas desde el 13 y completas desde el 15 (capas.ts).
function SedesEpi({ jurisdiccion }: { jurisdiccion: Jurisdiccion }) {
  const { epis } = useEpiCatalogo();
  const zoom = useZoomMapa();
  const zoomMaximo = useZoomMaximo();
  if (zoom < ZOOM.sedes) return null;
  const chica = zoom < ZOOM.sedesCompletas;
  return (
    <>
      {jurisdiccion.epis.map((epi) => {
        if (!epi.sede) return null;
        const info = epis.find((e) => e.codigo === epi.zone);
        return (
          <Marker
            key={`sede-${epi.zone}`}
            pane={PANES.sedes.name}
            position={[epi.sede.lat, epi.sede.lng]}
            icon={iconoSede(colorValido(epi.color), epi.numero, chica)}
            eventHandlers={{ dblclick: (e) => zoomMaximo(epi.sede!.lat, epi.sede!.lng, e.target) }}
          >
            <Tooltip direction="top" offset={[0, -12]}>{`Sede ${epi.nombre}`}</Tooltip>
            <Popup autoPan={AUTO_PAN_SIMBOLOS}>
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
  const zoomMaximo = useZoomMaximo();
  if (error) return null;
  const colorDe = (codigo: string) => colorValido(jurisdiccion.epis.find((e) => e.zone === codigo)?.color);
  return (
    <>
      {modulos.map((m) => (
        <CircleMarker
          key={m.id}
          pane={PANES.modulos.name}
          center={[m.lat, m.lng]}
          radius={4.5}
          // Sin burbujeo: el doble clic no debe llegar al mapa (que acercaría un nivel más).
          bubblingMouseEvents={false}
          eventHandlers={{ dblclick: () => zoomMaximo(m.lat, m.lng) }}
          pathOptions={{ color: '#fff', weight: 1.5, fillColor: colorDe(m.epiCodigo), fillOpacity: 1 }}
        >
          <Tooltip direction="top">
            {`${m.codigo} · ${m.nombre}${m.coordenadasAproximadas ? ' (ubicación aproximada)' : ''}`}
          </Tooltip>
        </CircleMarker>
      ))}
    </>
  );
}

/** Etiqueta "Centro" solo desde el zoom de barrio (de lejos tapa los guardias del casco viejo). */
function EtiquetaCentro() {
  const zoom = useZoomMapa();
  if (zoom < ZOOM.etiquetaCentro) return null;
  return (
    <Tooltip permanent direction="center" className="epi-centro-etiqueta">
      Centro
    </Tooltip>
  );
}

function ModulosSegunZoom({ jurisdiccion }: { jurisdiccion: Jurisdiccion }) {
  const zoom = useZoomMapa();
  return zoom >= ZOOM.modulos ? <ModulosPoliciales jurisdiccion={jurisdiccion} /> : null;
}

export function EpiJurisdictionLayer({
  jurisdiccion,
  soloPropia = false,
  ajustarVista = false,
  encuadre,
  mostrarReferencias = false,
  mostrarModulos = false,
  mostrarTerritorios = true,
  mostrarSedes = true,
}: EpiJurisdictionLayerProps) {
  if (!jurisdiccion) return null;
  const { epis, miEpi, restringido } = jurisdiccion;
  return (
    <>
      {ajustarVista && <JurisdictionViewport jurisdiccion={jurisdiccion} soloPropia={soloPropia} encuadre={encuadre} />}
      {mostrarTerritorios &&
        epis.map((epi) => {
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
              pane={PANES.territorios.name}
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
      {mostrarReferencias && mostrarTerritorios && (
        <Polygon
          positions={CENTRO_REFERENCIA}
          pane={PANES.centro.name}
          interactive={false}
          pathOptions={{ color: CENTRO_BORDE, weight: 2, fillColor: CENTRO_RELLENO, fillOpacity: CENTRO_OPACIDAD }}
        >
          <EtiquetaCentro />
        </Polygon>
      )}
      {mostrarReferencias && mostrarSedes && <SedesEpi jurisdiccion={jurisdiccion} />}
      {mostrarModulos && <ModulosSegunZoom jurisdiccion={jurisdiccion} />}
    </>
  );
}

/** Para la leyenda del mapa (MapLegend.tsx), que reemplaza a la que vivía acá. */
export { colorValido as colorEpiValido, CENTRO_RELLENO };
