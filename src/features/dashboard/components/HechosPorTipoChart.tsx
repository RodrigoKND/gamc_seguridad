import type { HechoPorTipoItem } from '../types';

// RF/RNF: Dashboard Estadístico — Grupo 4 (MASTER.md sección 7.3).
//
// El mockup de Etapa 2 mostraba esta serie como dona. Se reemplaza por barra
// horizontal: es un reparto parte-del-todo ordenado por magnitud, y la guía
// de dataviz recomienda barra (no dona) para ese tipo de dato — "Part-to-whole
// -> stacked bar (horizontal para categorías largas)". Además, MASTER.md no
// define una paleta categórica para "tipo de hecho" (los tokens risk-*/epi-*
// están reservados a severidad y territorio — sección 4).
//
// Migrado de la rampa secuencial de brand-blue-600 a la paleta 2026 (MASTER.md
// sección 4): en vez de 5 tonos de un mismo azul (donde los 5 compiten por
// atención por igual), la categoría de mayor participación se resalta en
// brand-gold-600 — el dorado como "esto es lo que domina" — y el resto usa una
// rampa neutra descendente en brand-ink. Luminosidad monótona y separación de
// contraste verificadas a mano (ver MASTER.md sección 4, tabla de contraste);
// la etiqueta de texto siempre visible por barra hace que el color nunca sea
// el único portador del dato (dataviz: "secondary encoding: direct labels").
//
// Entrada animada (portado desde refactor/dashboard-design): cada fila entra
// en cascada (animate-rise-up) y su barra crece desde la izquierda
// (animate-grow-bar) — respeta prefers-reduced-motion vía globals.css.
const RAMP = ['#A97F52', '#262624', '#4A4740', '#6E6B63', '#948F86'];

export interface HechosPorTipoChartProps {
  data: HechoPorTipoItem[];
  onSelect?: (item: HechoPorTipoItem) => void;
}

export function HechosPorTipoChart({ data, onSelect }: HechosPorTipoChartProps) {
  const sorted = [...data].sort((a, b) => b.percentage - a.percentage);

  return (
    <ul className="space-y-3" role="img" aria-label="Hechos por tipo, ordenados por participación">
      {sorted.map((item, i) => (
        <li
          key={item.tipo}
          onClick={() => onSelect?.(item)}
          role={onSelect ? 'button' : undefined}
          tabIndex={onSelect ? 0 : undefined}
          onKeyDown={onSelect ? (e) => { if (e.key === 'Enter') onSelect(item); } : undefined}
          className={`flex animate-rise-up items-center gap-3 ${onSelect ? 'cursor-pointer rounded-md px-1 py-1 hover:bg-neutral-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-600' : ''}`}
          style={{ animationDelay: `${100 + i * 70}ms` }}
        >
          <span className="w-28 shrink-0 truncate text-sm text-neutral-text-muted">{item.tipo}</span>
          <div className="h-5 flex-1 rounded-sm bg-neutral-bg">
            <div
              className="h-5 origin-left animate-grow-bar rounded-r-[4px] transition-[width] duration-300"
              style={{
                width: `${item.percentage}%`,
                backgroundColor: RAMP[i] ?? RAMP[RAMP.length - 1],
                animationDelay: `${160 + i * 70}ms`,
              }}
            />
          </div>
          <span className="w-10 shrink-0 text-right text-sm font-medium text-neutral-text">{item.percentage}%</span>
        </li>
      ))}
    </ul>
  );
}
