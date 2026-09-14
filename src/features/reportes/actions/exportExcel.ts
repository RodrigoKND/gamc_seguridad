import { downloadCsv } from '@/lib/csv';
import type { ReportRow } from '../types';

// RF-XX Exportación (MASTER.md sección 7.3). CSV real (abre en Excel/Sheets
// sin dependencias adicionales) con la misma portada de "documento real"
// que el PDF (título, fecha de emisión, cantidad de registros) — ver
// exportPDF.ts/PrintReport.tsx.
function todayEsBo(): string {
  return new Date().toLocaleDateString('es-BO');
}

export function exportExcel(rows: ReportRow[], filename = 'reportes-gamc.csv') {
  const headers = ['ID', 'Tipo', 'Severidad', 'Ubicación', 'EPI', 'Fecha/Hora', 'Reportante', 'Estado'];
  const data = rows.map((r) => [r.id, r.tipo, r.severidad, r.ubicacion, r.epi, r.timestamp, r.reportante, r.estado]);
  const title = [
    'GAMC Seguridad Ciudadana — Reporte de Hechos',
    `Fecha de emisión: ${todayEsBo()} · ${rows.length} registro(s)`,
  ];
  downloadCsv(headers, data, filename, title);
}
