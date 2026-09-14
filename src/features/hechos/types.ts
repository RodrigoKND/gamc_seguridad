import type { EpiZone } from '@/types/epi';
import type { RiskLevel } from '@/types/risk';

// RF-G3-02 a 08, RF-10 (MASTER.md sección 7.3 y 13.5).

// El Operador puede cambiar el estado manualmente desde el drawer de
// detalle (MASTER.md sección 10 y 13.5) — 3 opciones, la automatización
// completa del flujo queda para después del 10/09.
export const HECHO_ESTADOS = ['abierto', 'en_proceso', 'resuelto'] as const;
export type HechoEstado = (typeof HECHO_ESTADOS)[number];

export const HECHO_ESTADO_LABELS: Record<HechoEstado, string> = {
  abierto: 'Abierto',
  en_proceso: 'En Proceso',
  resuelto: 'Resuelto',
};

export const HECHO_ESTADO_BADGE_CLASS: Record<HechoEstado, string> = {
  abierto: 'bg-risk-high/10 text-risk-high',
  en_proceso: 'bg-brand-blue-600/10 text-brand-blue-600',
  resuelto: 'bg-risk-low/10 text-risk-low',
};

// Sin historial de auditoría en este MVP (MASTER.md sección 7.3: "solo
// Operador... sin historial de auditoría en este MVP") — la tabla real
// `audit_log` sigue existiendo, solo no se construye esta vista todavía
// (MASTER.md sección 15.2).
export interface HechoEvidencia {
  id: string;
  url: string;
  tipo: 'foto' | 'video';
}

export interface Hecho {
  id: string;
  tipo: string;
  severidad: RiskLevel;
  ubicacion: string;
  lat: number;
  lng: number;
  epi: EpiZone;
  timestamp: string;
  reportante: string;
  estado: HechoEstado;
  tieneEvidencia: boolean;
  evidencias: HechoEvidencia[];
  narrativa: string;
  unidadAsignada: string;
}
