'use client';

// RF-XX Exportación (MASTER.md sección 7.3 y 12). Publica un payload de
// impresión en lib/print-store.ts; PrintReport.tsx (montado en el shell)
// renderiza el documento (portada + tabla real, sin capturas de pantalla)
// y llama a window.print().
//
// hechosToPrint/guardiasToPrint serializan los datos de cada módulo a
// columnas/filas de texto plano — la tabla impresa es contenido, no una
// imagen de la vista.

import { setPrintPayload, type PrintPayload } from '@/lib/print-store';
import type { Hecho } from '@/features/hechos/types';
import type { Guard } from '@/features/guardias/types';
import { ACCOUNT_STATUS_LABELS, OPERATIONAL_STATUS_LABELS, guardFullName } from '@/features/guardias/types';
import { HECHO_ESTADO_LABELS } from '@/features/hechos/types';
import { RISK_LEVEL_LABELS } from '@/types/risk';
import { EPI_ZONE_LABELS } from '@/types/epi';

export type { PrintPayload };

export function exportPDF(payload: PrintPayload) {
  setPrintPayload(payload);
}

export function hechosToPrint(hechos: Hecho[]): PrintPayload {
  return {
    title: 'Reporte de Hechos',
    headings: ['Código', 'Tipo', 'Severidad', 'Ubicación / EPI', 'Fecha / Hora', 'Reportado por', 'Estado'],
    rows: hechos.map((hecho) => [
      hecho.id,
      hecho.tipo,
      RISK_LEVEL_LABELS[hecho.severidad],
      `${hecho.ubicacion} · EPI ${EPI_ZONE_LABELS[hecho.epi]}`,
      hecho.timestamp,
      hecho.reportante,
      HECHO_ESTADO_LABELS[hecho.estado],
    ]),
  };
}

export function guardiasToPrint(guardias: Guard[]): PrintPayload {
  return {
    title: 'Reporte de Dotación',
    headings: ['Guardia', 'CI', 'EPI', 'Ubicación actual', 'Estado de cuenta', 'Estado operativo', 'Reportes'],
    rows: guardias.map((guard) => [
      guardFullName(guard),
      guard.ci,
      `EPI ${EPI_ZONE_LABELS[guard.epi]}`,
      guard.ubicacionActual ?? '—',
      ACCOUNT_STATUS_LABELS[guard.accountStatus],
      OPERATIONAL_STATUS_LABELS[guard.operationalStatus],
      String(guard.reportesCount),
    ]),
  };
}
