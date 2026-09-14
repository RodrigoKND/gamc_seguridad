'use client';

import { Circle, Popup } from 'react-leaflet';
import { RISK_LEVEL_HEX, RISK_LEVEL_LABELS } from '@/types/risk';
import type { ZonaCriticaActivaRow } from '@/types/hecho';

// RF/RNF: Tab Calor / Zonas de Riesgo — Grupo 4 completo (MASTER.md sección
// 7.3). Círculos de riesgo coloreados por nivel (MASTER.md sección 4). El
// popup ahora muestra dirección aproximada y conteo de hechos — antes solo
// decía el nivel de riesgo, que por sí solo no le decía nada accionable al
// Operador. El panel de "Puntos Rojos" (RiskZonePanel) muestra la misma
// información en formato de lista para verla toda de un vistazo.

export interface HeatmapLayerProps {
  zonas: ZonaCriticaActivaRow[];
  onSelectZona?: (zona: ZonaCriticaActivaRow) => void;
}

export function HeatmapLayer({ zonas, onSelectZona }: HeatmapLayerProps) {
  return (
    <>
      {zonas.map((zona) => {
        const color = RISK_LEVEL_HEX[zona.nivelRiesgoPredominante];
        return (
          <Circle
            key={zona.id}
            center={[zona.centroLat, zona.centroLng]}
            radius={zona.radioMetros}
            pathOptions={{ color, fillColor: color, fillOpacity: 0.35, weight: 1 }}
            eventHandlers={onSelectZona ? { click: () => onSelectZona(zona) } : undefined}
          >
            <Popup>
              <p className="mb-0.5 text-xs font-bold" style={{ color }}>
                Riesgo {RISK_LEVEL_LABELS[zona.nivelRiesgoPredominante]}
              </p>
              <p className="text-[13px] font-medium">{zona.direccionAproximada}</p>
              <p className="text-xs text-neutral-text-muted">{zona.conteoHechos} hecho(s) registrados en el radio</p>
            </Popup>
          </Circle>
        );
      })}
    </>
  );
}
