'use client';

import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

// Fecha de nacimiento "moderna": tres selects (Día / Mes / Año) en lugar de
// un input de texto o del date picker nativo del navegador (ux: native-pickers
// en formularios administrativos se evita). Emite el valor combinado en el
// formato que consume el dominio (dd/mm/aaaa) a través de un hidden input
// con `name`, de modo que `FormData.get(name)` sigue funcionando igual que
// con un input visible.

const MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const;

function daysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate();
}

export interface DateFieldProps {
  label: string;
  name: string;
  required?: boolean;
  disabled?: boolean;
  /** Rango de años permitidos. Por defecto: 1940 → (año actual - 16). */
  minYear?: number;
  maxYear?: number;
}

export function DateField({
  label,
  name,
  required,
  disabled,
  minYear = 1940,
  maxYear,
}: DateFieldProps) {
  const fieldId = useId();
  const maxYearEffective = maxYear ?? new Date().getFullYear() - 16;
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');

  const years = Array.from(
    { length: maxYearEffective - minYear + 1 },
    (_, index) => minYear + index,
  );

  const selectedMonth = month ? Number(month) : 0;
  const selectedYear = year ? Number(year) : undefined;
  const dayCount = selectedMonth && selectedYear ? daysInMonth(selectedMonth, selectedYear) : 31;
  const days = Array.from({ length: dayCount }, (_, index) => index + 1);

  function handleMonthChange(nextMonth: string) {
    setMonth(nextMonth);
    if (day) {
      const nextCount = nextMonth && selectedYear ? daysInMonth(Number(nextMonth), selectedYear) : 31;
      if (Number(day) > nextCount) setDay('');
    }
  }

  function handleYearChange(nextYear: string) {
    setYear(nextYear);
    if (day && nextYear) {
      const nextCount = selectedMonth && nextYear ? daysInMonth(selectedMonth, Number(nextYear)) : 31;
      if (Number(day) > nextCount) setDay('');
    }
  }

  const complete = Boolean(day && month && year);
  const combined = complete ? `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}` : '';

  return (
    <div className="flex flex-col gap-1.5">
      <span id={fieldId} className="text-xs font-semibold text-neutral-text">
        {label}
        {required && <span className="ml-0.5 text-risk-critical">*</span>}
      </span>

      <input type="hidden" name={name} value={combined} />

      <div className="grid grid-cols-3 gap-2" role="group" aria-labelledby={fieldId}>
        <div className="relative">
          <select
            aria-label="Día"
            value={day}
            disabled={disabled}
            required={required}
            onChange={(event) => setDay(event.target.value)}
            className={[
              'w-full appearance-none rounded-md border bg-white px-2 py-2 pr-6 text-sm',
              day ? 'text-neutral-text' : 'text-neutral-text-muted',
              'transition-colors duration-200',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-500 focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'border-neutral-border',
            ].join(' ')}
          >
            <option value="" disabled>
              Día
            </option>
            {days.map((d) => (
              <option key={d} value={d}>
                {String(d).padStart(2, '0')}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-1.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-text-muted"
            aria-hidden="true"
          />
        </div>

        <div className="relative">
          <select
            aria-label="Mes"
            value={month}
            disabled={disabled}
            required={required}
            onChange={(event) => handleMonthChange(event.target.value)}
            className={[
              'w-full appearance-none rounded-md border bg-white px-2 py-2 pr-6 text-sm',
              month ? 'text-neutral-text' : 'text-neutral-text-muted',
              'transition-colors duration-200',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-500 focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'border-neutral-border',
            ].join(' ')}
          >
            <option value="" disabled>
              Mes
            </option>
            {MONTHS.map((monthName, index) => (
              <option key={monthName} value={index + 1}>
                {monthName}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-1.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-text-muted"
            aria-hidden="true"
          />
        </div>

        <div className="relative">
          <select
            aria-label="Año"
            value={year}
            disabled={disabled}
            required={required}
            onChange={(event) => handleYearChange(event.target.value)}
            className={[
              'w-full appearance-none rounded-md border bg-white px-2 py-2 pr-6 text-sm',
              year ? 'text-neutral-text' : 'text-neutral-text-muted',
              'transition-colors duration-200',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-500 focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'border-neutral-border',
            ].join(' ')}
          >
            <option value="" disabled>
              Año
            </option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-1.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-text-muted"
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  );
}
