import type { EpiZone } from '@/types/epi';

// RF/RNF: Dashboard Estadístico — Grupo 4 (MASTER.md sección 7.3).

export type AsyncStatus = 'loading' | 'error' | 'empty' | 'ready';

// KpiCardData ya no lleva icon/accent — la cinta de KPIs se rediseñó como
// "hoja de registro" (KpiCard/KpiGrid): sin íconos ni chips de color, solo
// número + etiqueta + periodo + delta (portado desde refactor/dashboard-design).
export interface KpiCardData {
  id: string;
  label: string;
  value: number;
  periodLabel: string;
  deltaLabel?: string;
  deltaDirection?: 'up' | 'down';
}

export interface HechoPorDiaPoint {
  day: string;
  total: number;
  rawDia: string; // YYYY-MM-DD original para filtrado preciso
}

export interface HechoPorTipoItem {
  tipo: string;
  total: number;
  percentage: number;
}

export interface HechoPorZonaItem {
  zone: EpiZone;
  total: number;
  percentage: number;
}
