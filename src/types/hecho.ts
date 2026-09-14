import type { RiskLevel } from '@/types/risk';
import type { HechoEstado } from '@/features/hechos/types';

// Tipos "fila" alineados exactamente con `hecho` y `zona_critica_activa` de
// BD/02_tables.sql (RF-G3-02 a 08, MASTER.md sección 14.6). Tipo
// compartido: lo usan hechos, reportes, dashboard y mapas (2+ módulos) —
// MASTER.md sección 6.
//
// `tipo` reproduce el CHECK real char por char, incluida la tilde de
// 'robo_vehículo' — no normalizar.

export const HECHO_TIPOS = [
  'atraco',
  'robo_vehículo',
  'robo_domicilio',
  'hurto',
  'violencia',
  'emergencia',
  'otro',
] as const;
export type HechoTipo = (typeof HECHO_TIPOS)[number];

export const HECHO_TIPO_LABELS: Record<HechoTipo, string> = {
  atraco: 'Atraco',
  robo_vehículo: 'Robo de Vehículo',
  robo_domicilio: 'Robo a Domicilio',
  hurto: 'Hurto',
  violencia: 'Violencia',
  emergencia: 'Emergencia',
  otro: 'Otro',
};

export interface HechoRow {
  id: string;
  tipo: HechoTipo;
  descripcion: string;
  ubicacionLat: number;
  ubicacionLng: number;
  ubicacionDireccion?: string;
  epiId: string;
  guardiaId: string;
  nivelRiesgo: RiskLevel;
  estado: HechoEstado;
  fotoUrl?: string;
  timestampInmutable: string;
  createdAt: string;
}

// Agregado de hechos por radio — direccion_aproximada es obligatoria para
// el panel de Puntos Rojos (MASTER.md sección 14.6, FIX hueco #1).
export interface ZonaCriticaActivaRow {
  id: string;
  centroLat: number;
  centroLng: number;
  direccionAproximada: string;
  radioMetros: number;
  conteoHechos: number;
  nivelRiesgoPredominante: RiskLevel;
  epiId: string;
  lastUpdated: string;
}
