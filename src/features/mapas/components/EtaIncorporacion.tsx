'use client';

import { Clock } from 'lucide-react';
import type { TrayectoIncorporacion } from '../hooks/useTrayectosIncorporacion';
import { FRANJA_ETIQUETA, MODO_ETIQUETA, formatoDuracion, formatoHora } from '../lib/eta';

// Texto del tiempo estimado de llegada (lib/eta.ts), igual en el detalle del
// guardia, el panel de alertas y la lista de rutas.

/** "~6 min" / "detenido" / "retrasado · ~2 min". */
export function etaCorta(t: TrayectoIncorporacion): string {
  if (t.detenido) return `detenido · ~${formatoDuracion(t.eta.probableS)}`;
  return `${t.retrasado ? 'retrasado · ' : ''}~${formatoDuracion(t.restanteS)}`;
}

function distancia(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(m)} m`;
}

/** Más de esto sin GPS: la estimación parte de una posición vieja. */
const GPS_VIEJO_S = 300;

export function EtaDetalle({ trayecto: t, gpsSinActualizacionSeg }: { trayecto: TrayectoIncorporacion; gpsSinActualizacionSeg?: number | null }) {
  const gpsViejo = gpsSinActualizacionSeg != null && gpsSinActualizacionSeg > GPS_VIEJO_S;
  const alerta = t.detenido || t.retrasado || gpsViejo;
  return (
    <div className={['mt-2 rounded-md border px-2.5 py-2', alerta ? 'border-[#F59E0B]/40 bg-[#FEF3C7]/60' : 'border-[#3B82F6]/25 bg-[#EFF6FF]'].join(' ')}>
      <p className="flex items-center gap-1.5 text-[12px] font-bold text-neutral-text">
        <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Llega en ~{formatoDuracion(t.restanteS)} · {formatoHora(t.llegadaProbable)}
      </p>
      <p className="mt-0.5 text-[11px] text-neutral-text-muted">
        Hasta {formatoDuracion(t.restantePesimistaS)} si el tráfico se atranca ({formatoHora(t.llegadaPesimista)}).
      </p>
      <p className="mt-0.5 text-[11px] text-neutral-text-muted">
        {distancia(t.distanciaM)} {t.siguioCalles ? 'por calles' : 'en línea recta (sin ruteo)'} · {MODO_ETIQUETA[t.modo]} · {FRANJA_ETIQUETA[t.eta.franja]}
      </p>
      {gpsViejo && (
        <p className="mt-1 text-[11px] font-semibold text-[#B45309]">Sin GPS reciente: la estimación parte de su última posición conocida.</p>
      )}
      {!gpsViejo && t.detenido && <p className="mt-1 text-[11px] font-semibold text-[#B45309]">No avanza hace más de 3 min: el tiempo no se descuenta hasta que se mueva.</p>}
      {!gpsViejo && !t.detenido && t.retrasado && <p className="mt-1 text-[11px] font-semibold text-[#B45309]">Ya pasó la hora estimada más larga; conviene contactarlo.</p>}
    </div>
  );
}
