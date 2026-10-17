'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Marker, Polyline, useMap, useMapEvents } from 'react-leaflet';
import { Trash2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useEpiCatalogo } from '@/lib/epis/EpiCatalogProvider';
import type { Jurisdiccion } from '../../lib/jurisdiccion';
import type { LatLng } from '../../lib/routeGeometry';
import { numberedPointIcon } from '../../lib/rutaIconos';
import { MAX_PUNTOS, MIN_PUNTOS, type TrazadoRuta } from '../../hooks/useTrazadoRuta';
import { EpiJurisdictionLayer } from '../EpiJurisdictionLayer';
import { MapCanvas } from '../MapCanvas';
import { MapSearch } from '../MapSearch';

// Mapa para dibujar un trazado con clics (2 a 5 puntos). Lo usan "Asignar
// Ruta" (paso Ruta) y "Crear Ruta".

function CapturaClic({ onClick, deshabilitado }: { onClick: (p: LatLng) => void; deshabilitado: boolean }) {
  useMapEvents({ click: (e) => { if (!deshabilitado) onClick({ lat: e.latlng.lat, lng: e.latlng.lng }) } });
  return null;
}

// Se centra UNA vez en los puntos dados (p. ej. la posición GPS de los
// guardias elegidos) para no pelear con el zoom manual mientras se dibuja.
function CentrarUnaVez({ puntos }: { puntos: LatLng[] }) {
  const map = useMap();
  const [hecho, setHecho] = useState(false);
  useEffect(() => {
    if (hecho || puntos.length === 0) return;
    if (puntos.length === 1) map.flyTo([puntos[0]!.lat, puntos[0]!.lng], 16, { duration: 1 });
    else map.flyToBounds(puntos.map((p) => [p.lat, p.lng]) as [number, number][], { padding: [48, 48], maxZoom: 16, duration: 1 });
    setHecho(true);
  }, [hecho, puntos, map]);
  return null;
}

export interface TrazadoEditorProps {
  trazado: TrazadoRuta;
  jurisdiccion: Jurisdiccion | null;
  /** Mensaje de error para el contenedor (null lo limpia). */
  onError: (mensaje: string | null) => void;
  /** Posiciones a encuadrar al abrir; sin ellas se encuadra la EPI propia. */
  centrarEn?: LatLng[];
  children?: ReactNode;
  altoClassName?: string;
}

export function TrazadoEditor({ trazado, jurisdiccion, onError, centrarEn = [], children, altoClassName = 'h-[380px]' }: TrazadoEditorProps) {
  const { nombre: nombreEpi } = useEpiCatalogo();
  const [buscando, setBuscando] = useState(false);
  const miEpi = jurisdiccion?.miEpi ? nombreEpi(jurisdiccion.miEpi) : 'tu EPI';

  function alHacerClic(p: LatLng) {
    const error = trazado.agregar(p);
    if (error === 'fuera_de_epi') onError(`Ese punto está fuera de tu jurisdicción (${miEpi}). Marca puntos dentro del área resaltada.`);
    else onError(error);
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] text-neutral-text-muted">
          Haz clic en el mapa para marcar los puntos en orden ({MIN_PUNTOS} a {MAX_PUNTOS}).
          {trazado.puntos.length >= 3 ? ' El circuito se cierra solo.' : ''}
        </p>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-neutral-bg px-2.5 py-1 text-[11px] font-semibold text-neutral-text">
            {trazado.puntos.length}/{MAX_PUNTOS}
          </span>
          <Button type="button" variant="secondary" onClick={trazado.deshacer} disabled={trazado.puntos.length === 0} className="!px-2.5 !py-1.5">
            <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
            Deshacer
          </Button>
          <Button type="button" variant="secondary" onClick={trazado.reiniciar} disabled={trazado.puntos.length === 0} className="!px-2.5 !py-1.5">
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Reiniciar
          </Button>
        </div>
      </div>

      <div className="mb-2 min-h-[18px] text-[11.5px]">
        {trazado.calculando ? (
          <p className="text-primary-800">Calculando el camino por calles…</p>
        ) : trazado.fueraDeEpi ? (
          <p role="alert" className="text-risk-critical">El camino por calles sale de tu jurisdicción ({miEpi}). Mueve o quita los puntos cercanos al borde.</p>
        ) : !trazado.siguioCalles ? (
          <p role="alert" className="text-[#B45309]">El servicio de calles no respondió: se usa una línea recta entre los puntos.</p>
        ) : null}
      </div>

      <div className={`relative overflow-hidden rounded-lg border border-neutral-border ${altoClassName}`}>
        <MapCanvas>
          <MapSearch disabled={buscando} onOpenChange={setBuscando} />
          <EpiJurisdictionLayer jurisdiccion={jurisdiccion} soloPropia ajustarVista={centrarEn.length === 0} />
          <CapturaClic onClick={alHacerClic} deshabilitado={buscando} />
          <CentrarUnaVez puntos={centrarEn} />
          {trazado.path.length >= 2 && (
            <Polyline positions={trazado.path.map((p) => [p.lat, p.lng])} pathOptions={{ color: '#A97F52', weight: 4, opacity: 0.9 }} />
          )}
          {trazado.puntos.map((p, i) => (
            <Marker key={`${i}-${p.lat}-${p.lng}`} position={[p.lat, p.lng]} icon={numberedPointIcon(i)} />
          ))}
          {children}
        </MapCanvas>
      </div>
    </div>
  );
}
