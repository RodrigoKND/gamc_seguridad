import type { Hecho } from '@/features/hechos/types';

// RF-XX Exportación de Reportes (MASTER.md sección 7.3 y 12).
// Reutiliza el modelo de Hecho — Reportes es una vista de exportación
// filtrada sobre la misma bitácora, no una entidad separada.

export interface ReportFilters {
  from: string;
  to: string;
  epi: string;
  tipo: string;
}

export type ReportRow = Hecho;
