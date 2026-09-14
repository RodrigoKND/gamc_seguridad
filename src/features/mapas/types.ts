import type { EpiZone } from '@/types/epi';
import type { OperationalStatus } from '@/features/guardias/types';

// RF/RNF: Módulo de Mapas — RF-G1-01/02, RF-G3-09/10 (MASTER.md sección 7.3).

export type MapTab = 'patrullaje' | 'calor' | 'futuro';

export interface GuardMarker {
  id: string;
  label: string;
  lat: number;
  lng: number;
  zone: EpiZone;
  hasSos?: boolean;
  // Datos del drawer de telemetría (MASTER.md sección 7.3 y 13.3) — un
  // guardia real vive en features/guardias/, aquí se replica solo lo que
  // el mapa necesita mostrar sin acoplar ambos features.
  nombre: string;
  fotoUrl?: string;
  operationalStatus: OperationalStatus;
  ubicacionActual: string;
  turnoInicio: string;
  turnoFin: string;
  bateria: number;
  ultimoSync: string;
  /** ISO crudo de `capturadoEn` — para recalcular "hace Xs" en vivo en el cliente sin re-fetch. */
  capturadoEnIso: string;
  ruta: { lugar: string; hora: string }[];
  // Unidad de patrullaje actual (types/patrulla.ts PatrullaRow.unidadId) —
  // presente cuando el guardia comparte coche/moto/punto de servicio con
  // otro(s); PatrolLayer y UnitPerimeterLines lo usan para dibujarlos
  // relacionados (Caso B/C).
  unidadId?: string;
}

// Nota: las zonas críticas (círculos del mapa de calor + panel de Puntos
// Rojos) usan directamente `ZonaCriticaActivaRow` (types/hecho.ts) — no un
// tipo reducido tipo RiskPoint — porque el panel necesita la dirección
// aproximada y el conteo de hechos, no solo lat/lng/nivel.
