'use client';

import { useMemo } from 'react';
import { AlertTriangle, MapPinned } from 'lucide-react';
import { EmptyState } from '@/components/feedback/EmptyState';
import { EPI_ZONE_LABELS, type EpiZone } from '@/types/epi';
import { RISK_LEVEL_LABELS, RISK_LEVELS, type RiskLevel } from '@/types/risk';
import type { ZonaCriticaActivaRow } from '@/types/hecho';

// Panel de "Puntos Rojos" — MASTER.md sección 7.3 lo especifica ("Listado
// con dirección aproximada real por zona... ej. 'Av. Heroínas esq.
// Ayacucho — Muy Alto — 15 hechos'") pero nunca se había construido; el
// mapa de calor solo dibujaba círculos sin ningún dato de apoyo. Mismo
// patrón que los dashboards de criminalidad reales (ej. paneles de
// hotspots ordenados por severidad): la lista es lo que realmente informa
// la decisión de a dónde mandar una patrulla — el círculo en el mapa es
// solo la referencia espacial.

const RISK_ORDER: Record<RiskLevel, number> = Object.fromEntries(RISK_LEVELS.map((level, i) => [level, i])) as Record<RiskLevel, number>;

const RISK_DOT_CLASS: Record<RiskLevel, string> = {
  muy_alto: 'bg-risk-critical',
  alto: 'bg-risk-high',
  medio: 'bg-risk-medium',
  bajo: 'bg-risk-low',
};

export interface RiskZonePanelProps {
  zonas: ZonaCriticaActivaRow[];
  selectedId: string | null;
  onSelect: (zona: ZonaCriticaActivaRow) => void;
}

export function RiskZonePanel({ zonas, selectedId, onSelect }: RiskZonePanelProps) {
  const sorted = useMemo(
    () =>
      [...zonas].sort((a, b) => {
        const byRisk = RISK_ORDER[a.nivelRiesgoPredominante] - RISK_ORDER[b.nivelRiesgoPredominante];
        return byRisk !== 0 ? byRisk : b.conteoHechos - a.conteoHechos;
      }),
    [zonas],
  );
  const criticoCount = zonas.filter((z) => z.nivelRiesgoPredominante === 'muy_alto').length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-neutral-border px-4 py-3">
        <div>
          <p className="text-sm font-bold text-brand-ink-900">Puntos Rojos</p>
          <p className="text-xs text-neutral-text-muted">{zonas.length} zona(s) activa(s)</p>
        </div>
        {criticoCount > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-risk-critical/10 px-2 py-0.5 text-[11px] font-bold text-risk-critical">
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            {criticoCount} muy alto
          </span>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="p-3">
          <EmptyState icon={MapPinned} title="Sin zonas críticas activas en este momento." className="border-none" />
        </div>
      ) : (
        <ul className="scrollbar-hidden flex-1 divide-y divide-neutral-bg overflow-y-auto">
          {sorted.map((zona, index) => {
            const isSelected = zona.id === selectedId;
            return (
              <li key={zona.id}>
                <button
                  type="button"
                  onClick={() => onSelect(zona)}
                  aria-current={isSelected || undefined}
                  className={[
                    'flex w-full items-start gap-2.5 px-4 py-3 text-left transition-colors duration-200',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-600 focus-visible:ring-offset-2',
                    isSelected ? 'bg-brand-gold-600/5' : 'hover:bg-neutral-bg',
                  ].join(' ')}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-bg text-xs font-bold text-neutral-text-muted">
                    #{index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-semibold text-neutral-text">{zona.direccionAproximada}</p>
                    <p className="truncate text-[11px] text-neutral-text-muted">
                      EPI {EPI_ZONE_LABELS[zona.epiId as EpiZone] ?? zona.epiId}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-neutral-text">
                        <span className={['h-2 w-2 shrink-0 rounded-full', RISK_DOT_CLASS[zona.nivelRiesgoPredominante]].join(' ')} />
                        {RISK_LEVEL_LABELS[zona.nivelRiesgoPredominante]}
                      </span>
                      <span className="text-[10.5px] text-neutral-text-muted">{zona.conteoHechos} hecho(s)</span>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
