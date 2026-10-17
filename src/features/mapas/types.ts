import type { EpiZone } from '@/types/epi';
import type { OperationalStatus } from '@/features/guardias/types';
import type { EstadoRuta } from '@/types/patrulla';

// RF/RNF: Módulo de Mapas — RF-G1-01/02, RF-G3-09/10 (MASTER.md sección 7.3).

export type MapTab = 'patrullaje' | 'calor' | 'futuro';

export interface GuardMarker {
  id: string;
  label: string;
  lat: number;
  lng: number;
  /** F3: EPI en la que está AHORA (por GPS); si no se sabe, la de su cuenta. */
  zone: EpiZone | null;
  /**
   * F3: ruta que lo ocupa. `propia` = de la EPI de quien mira (se ve el
   * nombre); si es de otra EPI solo se sabe que está ocupado y dónde.
   */
  ocupacion?: { propia: boolean; epiCodigo: EpiZone | null; rutaNombre: string | null } | null;
  hasSos?: boolean;
  /** F2: ids de las alertas SOS abiertas (para atender exactamente esas). */
  sosAlertaIds?: string[];
  /** F2: estado respecto a su ruta (servidor). */
  estadoRuta?: EstadoRuta | null;
  distanciaRutaM?: number | null;
  /** F7: cuándo llegó a su ruta por primera vez y su plazo para hacerlo. */
  incorporadaEn?: string | null;
  incorporacionLimite?: string | null;
  ejecucionId?: string;
  // Datos del drawer de telemetría (MASTER.md sección 7.3 y 13.3) — un
  // guardia real vive en features/guardias/, aquí se replica solo lo que
  // el mapa necesita mostrar sin acoplar ambos features.
  nombre: string;
  fotoUrl?: string;
  operationalStatus: OperationalStatus;
  ubicacionActual: string;
  turnoInicio: string;
  turnoFin: string;
  bateria: number | null;
  ultimoSync: string;
  /** ISO crudo de `capturadoEn` — para recalcular "hace Xs" en vivo en el cliente sin re-fetch. */
  capturadoEnIso: string;
  /** Tiempo en segundos desde el último GPS reportado. null si no hay telemetría. */
  gpsSinActualizacionSeg: number | null;
  ruta: { lugar: string; hora: string }[];
  // Unidad de patrullaje actual (types/patrulla.ts PatrullaRow.unidadId) —
  // presente cuando el guardia comparte coche/moto con otro(s). La línea
  // punteada que los unía (UnitPerimeterLines) se reemplazó el 16/10 por el
  // camino de incorporación de cada uno (TrayectosLayer).
  unidadId?: string;
  // Info de ruta asignada (RF-G3-09): nombre, color y puntos del trazado
  rutaAsignada?: {
    nombre: string;
    color: string;
    puntos: { lat: number; lng: number }[];
  };
  direccionActual?: string;
}

// Nota: las zonas críticas (círculos del mapa de calor + panel de Puntos
// Rojos) usan directamente `ZonaCriticaActivaRow` (types/hecho.ts) — no un
// tipo reducido tipo RiskPoint — porque el panel necesita la dirección
// aproximada y el conteo de hechos, no solo lat/lng/nivel.
