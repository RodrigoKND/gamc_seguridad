// Tipo "fila" alineado exactamente con `turno` de BD/02_tables.sql
// (MASTER.md sección 14.3): clock-in/out del guardia, selfie + GPS
// obligatorios al iniciar. Evento repetible con historial, no un valor
// único por guardia.

export const TURNO_ESTADOS = ['en_curso', 'finalizado'] as const;
export type TurnoEstado = (typeof TURNO_ESTADOS)[number];

export interface TurnoRow {
  id: string;
  guardiaId: string;
  horaInicio: string;
  selfieInicioUrl: string;
  latInicio: number;
  lngInicio: number;
  horaFin?: string;
  selfieFinUrl?: string;
  latFin?: number;
  lngFin?: number;
  estado: TurnoEstado;
  createdAt: string;
}
