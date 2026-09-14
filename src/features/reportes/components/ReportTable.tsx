import { FileWarning } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/feedback/EmptyState';
import { RISK_LEVEL_BADGE_CLASS, RISK_LEVEL_LABELS } from '@/types/risk';
import { EPI_ZONE_LABELS } from '@/types/epi';
import { HECHO_ESTADO_BADGE_CLASS, HECHO_ESTADO_LABELS } from '@/features/hechos/types';
import type { ReportRow } from '../types';

// RF-XX Exportación de Reportes (MASTER.md sección 7.3): vista previa de
// solo lectura de lo que se exportará — el detalle/edición de cada hecho
// vive en /hechos (IncidentDetailDrawer), no aquí.

export interface ReportTableProps {
  rows: ReportRow[];
}

const COLUMNS = ['TIPO', 'SEVERIDAD', 'UBICACIÓN / EPI', 'FECHA', 'ESTADO'];

export function ReportTable({ rows }: ReportTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-neutral-border bg-white p-2">
        <EmptyState icon={FileWarning} title="Sin resultados para estos filtros de exportación." className="border-none" />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-border bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b border-neutral-border bg-neutral-bg">
              {COLUMNS.map((col) => (
                <th key={col} scope="col" className="px-3.5 py-2.5 text-left text-[11px] font-semibold text-neutral-text-muted">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-neutral-bg last:border-0">
                <td className="px-3.5 py-3 text-[12.5px] font-semibold text-brand-blue-600">{row.tipo}</td>
                <td className="px-3.5 py-3">
                  <Badge className={RISK_LEVEL_BADGE_CLASS[row.severidad]}>{RISK_LEVEL_LABELS[row.severidad]}</Badge>
                </td>
                <td className="px-3.5 py-3 text-xs text-neutral-text">
                  {row.ubicacion}
                  <span className="block text-neutral-text-muted">EPI {EPI_ZONE_LABELS[row.epi]}</span>
                </td>
                <td className="px-3.5 py-3 text-xs text-neutral-text">{row.timestamp}</td>
                <td className="px-3.5 py-3">
                  <Badge className={HECHO_ESTADO_BADGE_CLASS[row.estado]}>{HECHO_ESTADO_LABELS[row.estado]}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
