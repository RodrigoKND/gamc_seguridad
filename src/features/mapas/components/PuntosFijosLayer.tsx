'use client';

import { Fragment, memo } from 'react';
import { Marker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { EPI_COLOR_SIN_DATO } from '@/types/epi';
import { libresDe, type PuntoFijoRow } from '@/types/puntoFijo';
import type { Jurisdiccion } from '../lib/jurisdiccion';
import { PANES, ZOOM, iconoCacheado } from '../lib/capas';
import { AUTO_PAN_SIMBOLOS, useZoomMapa, useZoomMaximo } from './MapPanes';

// Pines PERMANENTES de los puntos fijos (F4): siempre visibles en el
// mapa en vivo, con el color de su EPI y la ocupación que cuenta el backend
// ("1/2"). Los subpuntos van como pines chicos junto a su punto. Accesibles:
// cada pin es enfocable con teclado (Leaflet), tiene título y su popup dice
// lo mismo en texto.
//
// Jerarquía y zoom (16/10, lib/capas.ts): van POR DEBAJO de los guardias (un
// guardia parado en su punto tapa la bandera, no al revés; el contador queda
// a la vista). Ocultos en la vista de ciudad (se encimaban con los grupos de
// guardias); pin chico desde el 13, pin completo con contador n/cap desde el
// 15 y subpuntos como pines propios desde el 16 — antes se resumen en su
// punto (Plataforma y Gradas del Cristo quedaban encimadas). Doble clic en
// cualquier pin: zoom máximo sobre él. Segmentados por EPI:
// el backend ya solo envía los de la EPI de quien mira.

function colorValido(c: string | null | undefined): string {
  return c && /^#[0-9A-Fa-f]{6}$/.test(c) ? c : EPI_COLOR_SIN_DATO;
}

/** Libre = verde, con lugar = ámbar, completo = rojo. */
function colorOcupacion(p: Pick<PuntoFijoRow, 'capacidad' | 'ocupados'>): string {
  if (p.ocupados >= p.capacidad) return '#B91C1C';
  if (p.ocupados > 0) return '#B45309';
  return '#15803D';
}

function iconoPunto(p: PuntoFijoRow, color: string, chico: boolean, conContador = true): L.DivIcon {
  const clave = `punto|${color}|${chico ? 1 : 0}|${conContador ? 1 : 0}|${p.ocupados}/${p.capacidad}|${p.coordenadasAproximadas ? 1 : 0}`;
  return iconoCacheado(clave, () => crearIconoPunto(p, color, chico, conContador));
}

function crearIconoPunto(p: PuntoFijoRow, color: string, chico: boolean, conContador: boolean): L.DivIcon {
  const tam = chico ? 18 : 28;
  const badge = `<span style="position:absolute;left:${tam - 8}px;top:-7px;min-width:22px;height:16px;padding:0 4px;border-radius:8px;background:${colorOcupacion(p)};color:#fff;border:1.5px solid #fff;font:700 9.5px 'IBM Plex Sans',sans-serif;display:flex;align-items:center;justify-content:center;white-space:nowrap">${p.ocupados}/${p.capacidad}</span>`;
  // Bandera (punto de servicio fijo): forma propia, distinta de guardias, sedes y módulos.
  const bandera = `<svg width="${chico ? 10 : 14}" height="${chico ? 10 : 14}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 22V4"/><path d="M4 4h12l-2 4 2 4H4"/></svg>`;
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:${tam}px;height:${tam}px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;${p.coordenadasAproximadas ? 'outline:2px dashed rgba(17,24,39,.55);outline-offset:1px;' : ''}">${bandera}${chico || !conContador ? '' : badge}</div>`,
    iconSize: [tam, tam],
    iconAnchor: [tam / 2, tam / 2],
  });
}

function textoOcupacion(p: PuntoFijoRow): string {
  const libres = libresDe(p);
  return `${p.ocupados} de ${p.capacidad} guardia(s)${libres === 0 ? ' · completo' : ` · ${libres} libre(s)`}`;
}

export interface PuntosFijosLayerProps {
  puntos: PuntoFijoRow[];
  jurisdiccion: Jurisdiccion | null;
  /** Si viene, el popup ofrece "Asignar guardias" en los puntos que el usuario puede editar. */
  onAsignar?: (punto: PuntoFijoRow) => void;
  puedeAsignarEn?: (epiCodigo: string) => boolean;
}

export const PuntosFijosLayer = memo(function PuntosFijosLayer({ puntos, jurisdiccion, onAsignar, puedeAsignarEn }: PuntosFijosLayerProps) {
  const zoom = useZoomMapa();
  const zoomMaximo = useZoomMaximo();
  const colorDe = (codigo: string) => colorValido(jurisdiccion?.epis.find((e) => e.zone === codigo)?.color);
  if (zoom < ZOOM.puntos) return null;
  const conContador = zoom >= ZOOM.puntosContador;
  const conSubpuntos = zoom >= ZOOM.subpuntos;
  return (
    <>
      {puntos.map((p) => {
        const color = colorDe(p.epiCodigo);
        const asignable = Boolean(onAsignar && puedeAsignarEn?.(p.epiCodigo) && libresDe(p) > 0);
        const titulo = `Punto fijo ${p.nombre}: ${textoOcupacion(p)}`;
        return (
          <Fragment key={p.id}>
            <Marker
              position={[p.lat, p.lng]}
              icon={iconoPunto(p, color, !conContador, conContador)}
              title={titulo}
              alt={titulo}
              keyboard
              pane={PANES.puntos.name}
              eventHandlers={{ dblclick: (e) => zoomMaximo(p.lat, p.lng, e.target) }}
            >
              <Tooltip direction="top" offset={[0, -14]}>{`${p.nombre} · ${p.ocupados}/${p.capacidad}`}</Tooltip>
              <Popup autoPan={AUTO_PAN_SIMBOLOS}>
                <p className="text-[13px] font-bold">{p.nombre}</p>
                <p className="text-xs text-neutral-text-muted">
                  Punto fijo · {p.epiNombre}
                  {p.epiMetodo === 'manual' ? ' (EPI asignada a mano)' : ''}
                </p>
                {p.descripcion && <p className="mt-0.5 text-xs">{p.descripcion}</p>}
                <p className="mt-1 text-xs font-semibold">{textoOcupacion(p)}</p>
                {p.subpuntos.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-xs">
                    {p.subpuntos.map((s) => (
                      <li key={s.id}>
                        • {s.nombre}: {s.ocupados}/{s.capacidad}
                      </li>
                    ))}
                  </ul>
                )}
                {p.ocupantes && p.ocupantes.length > 0 && (
                  <p className="mt-1 text-xs text-neutral-text-muted">{p.ocupantes.map((o) => o.guardiaNombre).join(', ')}</p>
                )}
                {p.coordenadasAproximadas && <p className="mt-1 text-[11px] text-[#B45309]">Ubicación aproximada (pendiente de validar en campo).</p>}
                {asignable && (
                  <button
                    type="button"
                    onClick={() => onAsignar!(p)}
                    className="mt-2 w-full rounded-md bg-primary-800 px-2 py-1 text-xs font-semibold text-white hover:bg-primary-900"
                  >
                    Asignar guardias a este punto
                  </button>
                )}
              </Popup>
            </Marker>
            {conSubpuntos && p.subpuntos.map((s) => {
              const t = `Subpunto ${s.nombre} (${p.nombre}): ${textoOcupacion(s)}`;
              return (
                <Marker
                  key={s.id}
                  position={[s.lat, s.lng]}
                  icon={iconoPunto(s, color, true)}
                  title={t}
                  alt={t}
                  keyboard
                  pane={PANES.puntos.name}
                  eventHandlers={{ dblclick: (e) => zoomMaximo(s.lat, s.lng, e.target) }}
                >
                  <Tooltip direction="top" offset={[0, -10]}>{`${p.nombre} · ${s.nombre} · ${s.ocupados}/${s.capacidad}`}</Tooltip>
                  <Popup autoPan={AUTO_PAN_SIMBOLOS}>
                    <p className="text-[13px] font-bold">{`${p.nombre} · ${s.nombre}`}</p>
                    <p className="text-xs font-semibold">{textoOcupacion(s)}</p>
                    {s.ocupantes && s.ocupantes.length > 0 && <p className="mt-1 text-xs text-neutral-text-muted">{s.ocupantes.map((o) => o.guardiaNombre).join(', ')}</p>}
                    {s.coordenadasAproximadas && <p className="mt-1 text-[11px] text-[#B45309]">Ubicación aproximada.</p>}
                  </Popup>
                </Marker>
              );
            })}
          </Fragment>
        );
      })}
    </>
  );
});
