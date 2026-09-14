import { downloadCsv } from '@/lib/csv';
import { EPI_ZONE_LABELS } from '@/types/epi';
import { ACCOUNT_STATUS_LABELS, OPERATIONAL_STATUS_LABELS, guardFullName, type Guard } from '../types';

// RF-01, RF-12 (MASTER.md sección 7.3). Mismo mecanismo de exportación que
// Reportes/Historial (lib/csv.ts) — no se duplica la lógica de generar el
// CSV, solo cambian las columnas. El PDF reutiliza tal cual
// features/reportes/actions/exportPDF.ts (ya es genérico: imprime lo que
// esté en pantalla).
function todayEsBo(): string {
  return new Date().toLocaleDateString('es-BO');
}

export function exportGuardiasExcel(guards: Guard[], filename = 'guardias-gamc.csv') {
  const headers = ['ID', 'Nombre Completo', 'CI', 'EPI', 'Estado de Cuenta', 'Estado Operativo', 'Ubicación Actual', 'Reportes'];
  const rows = guards.map((g) => [
    g.id,
    guardFullName(g),
    g.ci,
    EPI_ZONE_LABELS[g.epi],
    ACCOUNT_STATUS_LABELS[g.accountStatus],
    OPERATIONAL_STATUS_LABELS[g.operationalStatus],
    g.ubicacionActual ?? '—',
    g.reportesCount,
  ]);
  const title = [
    'GAMC Seguridad Ciudadana — Reporte de Dotación',
    `Fecha de emisión: ${todayEsBo()} · ${guards.length} registro(s)`,
  ];
  downloadCsv(headers, rows, filename, title);
}
