'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Drawer } from '@/components/ui/Drawer';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { EpiNombre, EpiOpciones } from '@/lib/epis/EpiNombre';
import { RISK_LEVEL_BADGE_CLASS, RISK_LEVEL_LABELS } from '@/types/risk';
import { HECHO_ESTADO_BADGE_CLASS, HECHO_ESTADOS, HECHO_ESTADO_LABELS, type Hecho, type HechoEstado } from '../types';
import { EvidenceCarousel } from './EvidenceCarousel';

// ssr:false — Leaflet lee `window` al cargar, y /hechos SÍ se prerenderiza
// estático (a diferencia de /mapas) — importarlo directo revienta el build
// ("window is not defined"). Ver IncidentLocationMap.tsx.
const IncidentLocationMap = dynamic(
  () => import('./IncidentLocationMap').then((m) => m.IncidentLocationMap),
  { ssr: false, loading: () => <div className="mb-2 h-[180px] animate-pulse rounded-lg bg-neutral-bg" /> },
);

// RF-G3-02 a 08, RF-10 (MASTER.md sección 7.3 y 13.5). El cambio de estado
// usa el mismo Select que el resto de controles editables del sistema —
// no debe leerse como un dato de solo lectura (MASTER.md sección 10).
//
// Ahora Super Admin/Admin también pueden VER hechos (sección 15 actualizada)
// pero no cambiar su estado — acción operativa exclusiva del Operador. Sin
// onEstadoChange, el campo se muestra como Badge fijo en vez de Select
// editable (mismo patrón que onEdit? en GuardTable/GuardCatalogModal).

export interface IncidentDetailDrawerProps {
  hecho: Hecho | null;
  onClose: () => void;
  onEstadoChange?: (id: string, estado: HechoEstado) => void;
  /** F3: solo supervisión global. Decide/corrige la EPI del hecho. */
  onClasificar?: (id: string, epiCodigo: string) => Promise<boolean>;
}

// F3: la EPI de un hecho sale de SU ubicación. Si cae fuera de las EPIs o en
// un borde, queda "por clasificar" y el Super Admin la decide aquí.
function ClasificacionEpi({ hecho, onClasificar }: { hecho: Hecho; onClasificar: (id: string, epiCodigo: string) => Promise<boolean> }) {
  const [epi, setEpi] = useState<string>(hecho.epi ?? '');
  const [guardando, setGuardando] = useState(false);
  useEffect(() => setEpi(hecho.epi ?? ''), [hecho.id, hecho.epi]);
  const pendiente = hecho.epiEstado === 'ambigua' || hecho.epiEstado === 'fuera_cobertura';
  return (
    <div className={`mb-5 rounded-lg border p-3 ${pendiente ? 'border-risk-medium/40 bg-risk-medium/10' : 'border-neutral-border bg-neutral-bg/60'}`}>
      <p className="mb-1 text-xs font-bold text-primary-900">EPI DEL HECHO</p>
      <p className="mb-2 text-[11.5px] text-neutral-text-muted">
        {hecho.epiEstado === 'fuera_cobertura'
          ? 'La ubicación cae fuera de todas las EPIs. Decide a cuál corresponde.'
          : hecho.epiEstado === 'ambigua'
            ? 'La ubicación cae en el borde entre dos EPIs. Confirma a cuál corresponde.'
            : hecho.epiMetodo === 'manual'
              ? 'Clasificado a mano por la supervisión.'
              : 'Calculada por la ubicación del hecho. Puedes corregirla.'}
      </p>
      <div className="flex gap-2">
        <Select aria-label="EPI del hecho" value={epi} onChange={(e) => setEpi(e.target.value)} disabled={guardando} className="flex-1">
          <option value="" disabled>Elige una EPI</option>
          <EpiOpciones soloOperativas />
        </Select>
        <Button
          type="button"
          variant="brand"
          isLoading={guardando}
          disabled={!epi || (epi === hecho.epi && !pendiente)}
          onClick={async () => {
            setGuardando(true);
            await onClasificar(hecho.id, epi);
            setGuardando(false);
          }}
        >
          Guardar
        </Button>
      </div>
    </div>
  );
}

export function IncidentDetailDrawer({ hecho, onClose, onEstadoChange, onClasificar }: IncidentDetailDrawerProps) {
  return (
    <Drawer
      isOpen={Boolean(hecho)}
      onClose={onClose}
      widthClassName="w-[460px]"
      headerClassName="border-b border-neutral-border"
      header={
        hecho && (
          <div className="flex items-center gap-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-primary-900">{hecho.tipo}</p>
              <p className="truncate text-xs text-neutral-text-muted">{hecho.timestamp}</p>
            </div>
            <Badge className={RISK_LEVEL_BADGE_CLASS[hecho.severidad]}>{RISK_LEVEL_LABELS[hecho.severidad]}</Badge>
          </div>
        )
      }
    >
      {hecho && (
        <div className="animate-fade-in">
          <p className="mb-1.5 text-xs font-bold text-primary-900">ESTADO DEL HECHO</p>
          {onEstadoChange ? (
            <Select
              aria-label="Cambiar estado del hecho"
              value={hecho.estado}
              onChange={(event) => onEstadoChange(hecho.id, event.target.value as HechoEstado)}
              className="mb-5"
            >
              {HECHO_ESTADOS.map((estado) => (
                <option key={estado} value={estado}>
                  {HECHO_ESTADO_LABELS[estado]}
                </option>
              ))}
            </Select>
          ) : (
            <Badge className={[HECHO_ESTADO_BADGE_CLASS[hecho.estado], 'mb-5'].join(' ')}>
              {HECHO_ESTADO_LABELS[hecho.estado]}
            </Badge>
          )}

          <p className="mb-1.5 text-xs font-bold text-primary-900">NARRATIVA</p>
          <p className="mb-5 text-[13px] leading-relaxed text-neutral-text">{hecho.narrativa}</p>

          <p className="mb-2 text-xs font-bold text-primary-900">UBICACIÓN</p>
          <IncidentLocationMap lat={hecho.lat} lng={hecho.lng} />
          {/* Nunca lat/lng crudos en pantalla (pedido explícito 2026-09-14) —
              el mini-mapa de arriba ya ubica el punto exacto visualmente. */}
          <p className="mb-5 text-xs text-neutral-text-muted">
            {hecho.ubicacion} · {hecho.epi ? <EpiNombre codigo={hecho.epi} /> : 'Sin EPI'}
          </p>

          {onClasificar && <ClasificacionEpi hecho={hecho} onClasificar={onClasificar} />}

          <p className="mb-1.5 text-xs font-bold text-primary-900">UNIDAD DE RESPUESTA ASIGNADA</p>
          <p className="mb-5 text-[13px] text-neutral-text">{hecho.unidadAsignada}</p>

          {hecho.evidencias.length > 0 && (
            <>
              <p className="mb-2 text-xs font-bold text-primary-900">EVIDENCIA</p>
              <EvidenceCarousel evidencias={hecho.evidencias} />
            </>
          )}
        </div>
      )}
    </Drawer>
  );
}
