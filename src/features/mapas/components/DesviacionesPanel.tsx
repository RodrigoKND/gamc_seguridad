'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import type { GuardMarker } from '../types';
import { etaCorta } from './EtaIncorporacion';
import type { TrayectoIncorporacion } from '../hooks/useTrayectosIncorporacion';

// Estado de cada guardia respecto a su ruta, calculado por el SERVIDOR en
// cada ping (F2, umbrales por modalidad). El verde ("en ruta") no se lista:
// se da por hecho (decisión del usuario).
export type EstadoDesvio = 'incorporandose' | 'advertencia' | 'alerta';
export interface Desvio {
  lat: number;
  lng: number;
  distanciaM: number;
  estado: EstadoDesvio;
}

export const DESVIO_ESTILO: Record<EstadoDesvio, { etiqueta: string; punto: string; texto: string }> = {
  incorporandose: { etiqueta: 'Incorporándose', punto: 'bg-[#3B82F6]', texto: 'text-[#1D4ED8]' },
  advertencia: { etiqueta: 'Advertencia', punto: 'bg-[#F59E0B]', texto: 'text-[#B45309]' },
  alerta: { etiqueta: 'Fuera de ruta', punto: 'bg-risk-critical', texto: 'text-risk-critical' },
};
const ORDEN: Record<EstadoDesvio, number> = { alerta: 0, advertencia: 1, incorporandose: 2 };

/** Sin medición del servidor todavía (recién asignado): la distancia del trayecto por calles. */
export function distanciaVisible(d: Desvio, t?: TrayectoIncorporacion): string {
  const m = d.distanciaM > 0 || !t ? d.distanciaM : Math.round(t.distanciaM);
  return m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${m} m`;
}

// Aviso "N guardia(s) fuera de ruta" (RF-G3-09) como panel LATERAL
// retraíble sobre el mapa. Antes era un bloque dentro de la misma fila
// flexible que el mapa: con muchas desviaciones crecía y dejaba el mapa sin
// espacio (pedido del usuario: "me tapa todo el mapa… que se pueda
// retraer"). Retraído queda solo una pestaña con el conteo. El estado se
// recuerda por navegador (comodidad, no dato crítico).

const CLAVE_RETRAIDO = 'gamc_desviaciones_retraido';

export interface DesviacionesPanelProps {
  desviaciones: Map<string, Desvio>;
  /** Tiempo estimado de llegada de quien se está incorporando. */
  trayectos?: Map<string, TrayectoIncorporacion>;
  markers: GuardMarker[];
  onSelect: (marker: GuardMarker) => void;
}

export function DesviacionesPanel({ desviaciones, trayectos, markers, onSelect }: DesviacionesPanelProps) {
  const [retraido, setRetraido] = useState(false);

  useEffect(() => {
    try {
      setRetraido(window.localStorage.getItem(CLAVE_RETRAIDO) === 'true');
    } catch {
      // Sin almacenamiento disponible: se queda desplegado.
    }
  }, []);

  function cambiar(valor: boolean) {
    setRetraido(valor);
    try {
      window.localStorage.setItem(CLAVE_RETRAIDO, String(valor));
    } catch {
      // Ignorado: solo es una preferencia visual.
    }
  }

  if (desviaciones.size === 0) return null;
  const conteo: Record<EstadoDesvio, number> = { alerta: 0, advertencia: 0, incorporandose: 0 };
  for (const d of desviaciones.values()) conteo[d.estado]++;

  if (retraido) {
    return (
      <button
        type="button"
        onClick={() => cambiar(false)}
        aria-expanded={false}
        aria-label={`Mostrar ${desviaciones.size} guardia(s) con alertas de ruta`}
        className="absolute right-0 top-16 z-[550] flex items-center gap-1.5 rounded-l-lg border border-r-0 border-risk-critical/30 bg-white px-2 py-2 text-[11px] font-bold text-risk-critical shadow transition-colors hover:bg-risk-critical/5"
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
        {conteo.alerta > 0 && <span className="text-risk-critical">{conteo.alerta}</span>}
        {conteo.advertencia > 0 && <span className="text-[#B45309]">{conteo.advertencia}</span>}
        {conteo.incorporandose > 0 && <span className="text-[#1D4ED8]">{conteo.incorporandose}</span>}
      </button>
    );
  }

  return (
    <div
      role="region"
      aria-label="Guardias con alertas de ruta"
      className="absolute bottom-3 right-3 top-16 z-[550] flex w-[280px] flex-col overflow-hidden rounded-lg border border-risk-critical/30 bg-white/95 shadow-lg backdrop-blur-sm"
    >
      <div className="flex items-center gap-2 border-b border-risk-critical/20 bg-risk-critical/5 px-3 py-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-risk-critical" aria-hidden="true" />
        <p className="flex-1 text-xs font-bold text-risk-critical">
          {conteo.alerta} fuera de ruta · {conteo.advertencia} advertencia · {conteo.incorporandose} incorporándose
        </p>
        <button
          type="button"
          onClick={() => cambiar(true)}
          aria-expanded
          aria-label="Retraer panel de guardias fuera de ruta"
          className="rounded p-1 text-risk-critical hover:bg-risk-critical/10"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <ul className="flex-1 space-y-1 overflow-y-auto p-2">
        {Array.from(desviaciones.entries())
          .sort((a, b) => ORDEN[a[1].estado] - ORDEN[b[1].estado] || b[1].distanciaM - a[1].distanciaM)
          .map(([guardiaId, info]) => {
            const marker = markers.find((m) => m.id === guardiaId);
            return (
              <li key={guardiaId}>
                <button
                  type="button"
                  onClick={() => marker && onSelect(marker)}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[11.5px] text-neutral-text transition-colors hover:bg-risk-critical/10"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${DESVIO_ESTILO[info.estado].punto}`} aria-hidden="true" />
                    <span className="truncate font-medium">{marker?.nombre ?? guardiaId}</span>
                  </span>
                  <span className={`shrink-0 font-semibold ${DESVIO_ESTILO[info.estado].texto}`}>
                    {DESVIO_ESTILO[info.estado].etiqueta} · {distanciaVisible(info, trayectos?.get(guardiaId))}
                    {info.estado === 'incorporandose' && trayectos?.get(guardiaId) ? ` · ${etaCorta(trayectos.get(guardiaId)!)}` : ''}
                  </span>
                </button>
              </li>
            );
          })}
      </ul>
    </div>
  );
}
