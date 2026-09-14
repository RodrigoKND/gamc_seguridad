import type { AccountStatus, OperationalStatus } from '@/features/guardias/types';

// Tipos "fila" alineados exactamente con `guardia` y `guardia_telemetria`
// de BD/02_tables.sql (RF-01, RF-03, RF-12, RF-G3-09/10). Tipo compartido:
// lo usan guardias, mapas y patrullas (2+ módulos) — MASTER.md sección 6.
//
// `estado`/`estado_operativo` reutilizan los enums ya definidos en
// features/guardias/types.ts (AccountStatus/OperationalStatus) — sus
// valores ya coinciden con los CHECK reales de la tabla, no se duplican
// aquí.

export interface GuardiaRow {
  id: string;
  primerNombre: string;
  segundoNombre?: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  numeroCedula: string;
  fechaNacimiento: string; // dd/mm/aaaa — la contraseña temporal real la genera el backend (createGuardia)
  telefono?: string;
  fotoUrl?: string | null;
  epiId: string;
  usuario: string;
  primerLoginRequerido: boolean;
  estado: AccountStatus;
  estadoOperativo: OperationalStatus;
  createdBy: string | null;
  createdAt: string;
}

// SOLO INSERT en la BD real — el mock simula el último ping por guardia.
// sos_activo=true es lo que un trigger real traduce a estado_operativo =
// 'emergencia' (BD/03_functions.sql, actualizar_estado_operativo_por_telemetria).
export interface GuardiaTelemetriaRow {
  id: string;
  guardiaId: string;
  lat: number;
  lng: number;
  precisionMetros?: number;
  bateria: number;
  sosActivo: boolean;
  syncTimestamp: string;
  createdAt: string;
}
