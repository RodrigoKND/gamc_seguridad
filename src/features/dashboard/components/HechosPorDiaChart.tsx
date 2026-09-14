'use client';

import { useState } from 'react';
import type { HechoPorDiaPoint } from '../types';

// RF/RNF: Dashboard Estadístico — Grupo 4 (MASTER.md sección 7.3).
// Serie única -> un solo hue neutro (brand-ink-800), sin leyenda (dataviz: "A
// single series needs no legend box"). Migrado de brand-blue-600 a la paleta
// 2026 (MASTER.md sección 4): el trazo pasa a tinta neutra y el punto más
// reciente (hoy) se resalta en brand-gold-600 — el dorado queda reservado
// para "esto es lo que importa mirar ahora", igual que en el resto de la UI,
// en vez de repetirse en toda la serie. Marcas: línea 2px, extremos >=8px con
// anillo de superficie, crosshair por punto con tooltip (dataviz/interaction).
// Entrada animada (portado desde refactor/dashboard-design): la línea se
// "dibuja" a sí misma (pathLength=1 + animate-draw-line), el área hace fade
// y los puntos aparecen en cascada — respeta prefers-reduced-motion vía
// globals.css (colapsa animation-duration a ~0).

export interface HechosPorDiaChartProps {
  data: HechoPorDiaPoint[];
  onSelect?: (point: HechoPorDiaPoint, index: number) => void;
}

const WIDTH = 560;
const HEIGHT = 220;
const PADDING = { top: 16, right: 16, bottom: 28, left: 36 };

function niceMax(value: number) {
  if (value <= 0) return 10;
  const step = Math.pow(10, Math.floor(Math.log10(value)));
  return Math.ceil(value / (step * 2)) * step * 2;
}

export function HechosPorDiaChart({ data, onSelect }: HechosPorDiaChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const plotW = WIDTH - PADDING.left - PADDING.right;
  const plotH = HEIGHT - PADDING.top - PADDING.bottom;
  const max = niceMax(Math.max(...data.map((d) => d.total), 1));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));

  const x = (i: number) => PADDING.left + (i / Math.max(data.length - 1, 1)) * plotW;
  const y = (v: number) => PADDING.top + plotH - (v / max) * plotH;

  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d.total)}`).join(' ');
  const areaPath = `${linePath} L ${x(data.length - 1)} ${PADDING.top + plotH} L ${x(0)} ${PADDING.top + plotH} Z`;

  const active = activeIndex !== null ? data[activeIndex] : null;
  const tooltipX = activeIndex !== null ? x(activeIndex) : 0;
  const tooltipAnchorsRight = tooltipX > WIDTH - 90;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full"
      role="img"
      aria-label="Hechos reportados por día en los últimos 7 días"
      onMouseLeave={() => setActiveIndex(null)}
    >
      {/* Gridlines — hairline recesivo (dataviz: marks-and-anatomy) */}
      {ticks.map((t, i) => (
        <g key={i}>
          <line
            x1={PADDING.left}
            x2={WIDTH - PADDING.right}
            y1={y(t)}
            y2={y(t)}
            stroke="#E5E7EB"
            strokeWidth={1}
          />
          <text x={PADDING.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-neutral-text-muted text-[9px]">
            {t}
          </text>
        </g>
      ))}

      {/* Eje X */}
      {data.map((d, i) => (
        <text
          key={d.day}
          x={x(i)}
          y={HEIGHT - 6}
          textAnchor="middle"
          className="fill-neutral-text-muted text-[9px]"
        >
          {d.day}
        </text>
      ))}

      <path
        d={areaPath}
        fill="#262624"
        fillOpacity={0.08}
        stroke="none"
        className="animate-fade-in"
        style={{ animationDelay: '150ms' }}
      />
      <path
        d={linePath}
        fill="none"
        stroke="#262624"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={1}
        className="animate-draw-line"
        style={{ animationDelay: '200ms' }}
      />

      {data.map((d, i) => {
        const isLatest = i === data.length - 1;
        return (
          <g key={d.day}>
            {/* Hit target ampliado (>=24px) para hover/foco — dataviz/interaction */}
            <circle
              cx={x(i)}
              cy={y(d.total)}
              r={12}
              fill="transparent"
              tabIndex={0}
              role="button"
              aria-label={`${d.day}: ${d.total} hechos${isLatest ? ' (hoy)' : ''}`}
              onMouseEnter={() => setActiveIndex(i)}
              onFocus={() => setActiveIndex(i)}
              onBlur={() => setActiveIndex(null)}
              onClick={() => onSelect?.(d, i)}
              className="cursor-pointer outline-none"
            />
            <circle
              cx={x(i)}
              cy={y(d.total)}
              r={isLatest ? 5 : 4}
              fill={isLatest ? '#A97F52' : '#262624'}
              stroke="white"
              strokeWidth={2}
              pointerEvents="none"
              className="animate-fade-in"
              style={{ animationDelay: `${450 + i * 60}ms` }}
            />
          </g>
        );
      })}

      {active && (
        <g transform={`translate(${tooltipAnchorsRight ? tooltipX - 84 : tooltipX + 8}, ${Math.max(y(active.total) - 40, 4)})`}>
          <rect width={76} height={34} rx={6} fill="#1A1A1A" />
          <text x={8} y={14} className="fill-white text-[9px] font-medium">{active.day}</text>
          <text x={8} y={27} className="fill-white text-[11px] font-semibold">{active.total} hechos</text>
        </g>
      )}
    </svg>
  );
}
