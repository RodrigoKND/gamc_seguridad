// Enum de jurisdicciones EPI (Estación Policial Integral) — MASTER.md sección 4.
// Tipo compartido: usado por dashboard, mapas y guardias (2+ módulos).

export const EPI_ZONES = ['norte', 'central', 'sud', 'cona', 'centro'] as const;

export type EpiZone = (typeof EPI_ZONES)[number];

export const EPI_ZONE_LABELS: Record<EpiZone, string> = {
  norte: 'Norte',
  central: 'Central',
  sud: 'Sud',
  cona: 'Cona',
  centro: 'Centro',
};

// Clases Tailwind de fondo por zona — reserva semántica territorial
// (MASTER.md sección 4: "no reutilizar fuera de su contexto").
export const EPI_ZONE_BG_CLASS: Record<EpiZone, string> = {
  norte: 'bg-epi-norte',
  central: 'bg-epi-central',
  sud: 'bg-epi-sud',
  cona: 'bg-epi-cona',
  centro: 'bg-epi-centro',
};

// Mismos valores que tailwind.config.js sección "colors" — Leaflet dibuja
// marcadores/polígonos en un canvas/SVG propio y necesita el color en hex,
// no una clase Tailwind. Mantener sincronizado con MASTER.md sección 4.
export const EPI_ZONE_HEX: Record<EpiZone, string> = {
  norte: '#5DADE2',
  central: '#26A69A',
  sud: '#F5A623',
  cona: '#8E6FCE',
  centro: '#0B1B3D',
};
