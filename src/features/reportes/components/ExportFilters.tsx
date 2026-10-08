'use client';

import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { EpiOpciones } from '@/lib/epis/EpiNombre';
import type { ReportFilters } from '../types';

// RF-XX Exportación de Reportes (MASTER.md sección 7.3 y 12).

export interface ExportFiltersProps {
  value: ReportFilters;
  onChange: (value: ReportFilters) => void;
  tipos: string[];
}

export function ExportFiltersBar({ value, onChange, tipos }: ExportFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-neutral-border bg-white p-4">
      <Input
        label="Desde"
        type="date"
        value={value.from}
        onChange={(event) => onChange({ ...value, from: event.target.value })}
        className="w-auto"
      />
      <Input
        label="Hasta"
        type="date"
        value={value.to}
        onChange={(event) => onChange({ ...value, to: event.target.value })}
        className="w-auto"
      />
      <Select
        label="EPI"
        value={value.epi}
        onChange={(event) => onChange({ ...value, epi: event.target.value })}
        className="w-auto"
      >
        <option value="todos">Todas las EPI</option>
        <EpiOpciones />
      </Select>
      <Select
        label="Tipo de hecho"
        value={value.tipo}
        onChange={(event) => onChange({ ...value, tipo: event.target.value })}
        className="w-auto"
      >
        <option value="todos">Todos los tipos</option>
        {tipos.map((tipo) => (
          <option key={tipo} value={tipo}>
            {tipo}
          </option>
        ))}
      </Select>
    </div>
  );
}
