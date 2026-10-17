'use client';

import { Clock, MapPinOff } from 'lucide-react';
import { EpiNombre, EpiPunto } from '@/lib/epis/EpiNombre';
import type { EpiActualInfo } from '../types';

// F3: EPI en la que está el guardia AHORA, según su último GPS — no su
// adscripción. Estados explícitos: sin GPS (desconocida), fuera de
// cobertura, y dato antiguo (más de 10 min) con la hora del último GPS.

function haceTexto(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (min < 1) return 'hace instantes';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`;
}

/** Texto plano para exportaciones (Excel/PDF). */
export function epiActualTexto(e: EpiActualInfo | null | undefined, nombreEpi: (c: string | null | undefined) => string): string {
  if (!e) return 'Sin GPS';
  if (e.estado === 'fuera_cobertura') return `Fuera de cobertura (${haceTexto(e.capturadoEnIso)})`;
  const base = nombreEpi(e.codigo);
  return e.frescura === 'reciente' ? base : `${base} (último GPS ${haceTexto(e.capturadoEnIso)})`;
}

export function EpiActualCell({ epiActual }: { epiActual: EpiActualInfo | null | undefined }) {
  if (!epiActual) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-neutral-text-muted" title="El guardia todavía no reportó GPS">
        <MapPinOff className="h-3.5 w-3.5" aria-hidden="true" />
        Sin GPS
      </span>
    );
  }
  const antigua = epiActual.frescura === 'antigua';
  return (
    <span className="flex flex-col gap-0.5" title={`Último GPS ${haceTexto(epiActual.capturadoEnIso)} · en esta EPI desde ${new Date(epiActual.desdeIso).toLocaleString('es-BO', { timeZone: 'America/La_Paz' })}`}>
      {epiActual.estado === 'fuera_cobertura' ? (
        <span className="text-xs font-medium text-[#B45309]">Fuera de cobertura</span>
      ) : (
        <span className={`flex items-center gap-1.5 text-xs ${antigua ? 'text-neutral-text-muted' : 'text-neutral-text'}`}>
          <EpiPunto codigo={epiActual.codigo} />
          <EpiNombre codigo={epiActual.codigo} corto />
        </span>
      )}
      {antigua && (
        <span className="inline-flex items-center gap-1 text-[10.5px] text-neutral-text-muted">
          <Clock className="h-3 w-3" aria-hidden="true" />
          {haceTexto(epiActual.capturadoEnIso)}
        </span>
      )}
    </span>
  );
}
