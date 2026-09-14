import { EPI_ZONE_BG_CLASS, EPI_ZONE_LABELS } from '@/types/epi';
import type { HechoPorZonaItem } from '../types';

// RF/RNF: Dashboard Estadístico — Grupo 4 (MASTER.md sección 7.3).
//
// El mockup de Etapa 2 agrupaba por zonas genéricas (Centro/Norte/Sur/Este/
// Oeste) que no coinciden con la taxonomía territorial oficial de MASTER.md
// sección 4 (EPI Norte/Central/Sud/Cona/Centro). Se corrige para usar las 5
// zonas EPI reales — son la misma jurisdicción que ya se usa en Guardias y
// en los filtros del Módulo de Mapas.
//
// Nota de accesibilidad: los tokens epi-* fallan el validador de paletas
// categóricas del skill de dataviz cuando se usan como relleno sin etiqueta
// (bajo contraste de epi-sud/epi-norte contra superficie clara, y separación
// insuficiente epi-central/epi-norte para daltonismo). No se pueden
// sustituir por otros colores — son una reserva semántica territorial de
// MASTER.md reutilizada en toda la app. La mitigación exigida por el propio
// skill ("secondary encoding: direct labels") ya es estructural en este
// componente: cada barra lleva su nombre de zona y su valor siempre visibles
// en texto, nunca solo color.
//
// Entrada animada (portado desde refactor/dashboard-design): cada fila entra
// en cascada (animate-rise-up) y su barra crece desde la izquierda
// (animate-grow-bar) — respeta prefers-reduced-motion vía globals.css.
export interface HechosPorZonaChartProps {
  data: HechoPorZonaItem[];
  onSelect?: (item: HechoPorZonaItem) => void;
}

export function HechosPorZonaChart({ data, onSelect }: HechosPorZonaChartProps) {
  const sorted = [...data].sort((a, b) => b.percentage - a.percentage);

  return (
    <ul className="space-y-3" aria-label="Hechos por zona EPI, ordenados por participación">
      {sorted.map((item, i) => (
        <li
          key={item.zone}
          onClick={() => onSelect?.(item)}
          role={onSelect ? 'button' : undefined}
          tabIndex={onSelect ? 0 : undefined}
          onKeyDown={onSelect ? (e) => { if (e.key === 'Enter') onSelect(item); } : undefined}
          className={`flex animate-rise-up items-center gap-3 ${onSelect ? 'cursor-pointer rounded-md px-1 py-1 hover:bg-neutral-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-600' : ''}`}
          style={{ animationDelay: `${100 + i * 70}ms` }}
        >
          <span className="w-16 shrink-0 truncate text-sm text-neutral-text-muted">{EPI_ZONE_LABELS[item.zone]}</span>
          <div className="h-5 flex-1 rounded-sm bg-neutral-bg">
            <div
              className={[
                'h-5 origin-left animate-grow-bar rounded-r-[4px] transition-[width] duration-300',
                EPI_ZONE_BG_CLASS[item.zone],
              ].join(' ')}
              style={{ width: `${item.percentage}%`, animationDelay: `${160 + i * 70}ms` }}
            />
          </div>
          <span className="w-10 shrink-0 text-right text-sm font-medium text-neutral-text">{item.percentage}%</span>
        </li>
      ))}
    </ul>
  );
}
