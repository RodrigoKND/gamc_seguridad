// Enum de niveles de riesgo — MASTER.md sección 4. Tipo compartido: usado
// por mapas (heatmap), hechos y reportes (2+ módulos).
//
// Valores alineados exactamente con el CHECK real de hecho.nivel_riesgo y
// zona_critica_activa.nivel_riesgo_predominante (BD/02_tables.sql) —
// 'muy_alto', no 'critico'. El color visual (risk-critical) se mantiene.

export const RISK_LEVELS = ['muy_alto', 'alto', 'medio', 'bajo'] as const;

export type RiskLevel = (typeof RISK_LEVELS)[number];

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  muy_alto: 'Muy Alto',
  alto: 'Alto',
  medio: 'Medio',
  bajo: 'Bajo',
};

// Clases Tailwind para badges (MASTER.md sección 10: fondo al 10% de
// opacidad del color semántico + texto sólido del mismo color).
export const RISK_LEVEL_BADGE_CLASS: Record<RiskLevel, string> = {
  muy_alto: 'bg-risk-critical/10 text-risk-critical',
  alto: 'bg-risk-high/10 text-risk-high',
  medio: 'bg-risk-medium/10 text-risk-medium',
  bajo: 'bg-risk-low/10 text-risk-low',
};

// Mismos valores que tailwind.config.js sección "colors" — Leaflet dibuja
// círculos/polígonos en un canvas/SVG propio y necesita el color en hex, no
// una clase Tailwind. Mantener sincronizado con MASTER.md sección 4.
export const RISK_LEVEL_HEX: Record<RiskLevel, string> = {
  muy_alto: '#DC2626',
  alto: '#F97316',
  medio: '#EAB308',
  bajo: '#22C55E',
};
