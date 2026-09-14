// Mecánica de exportación a CSV/Excel compartida — Reportes/Historial y
// Guardias generan columnas distintas, pero la construcción del archivo
// (escapado, BOM UTF-8, blob + anchor de descarga) es la misma; se centraliza
// acá para no duplicarla por feature (MASTER.md sección 6).
//
// `title`: líneas de portada opcionales (nombre del reporte, fecha de
// emisión, cantidad de registros) antes de la fila de encabezados — mismo
// criterio de "documento real, no solo datos" que PrintReport.tsx aplica
// al PDF. Excel/Sheets las muestra como filas normales (celdas de una sola
// columna, el resto vacío); no rompen la tabla de datos porque van seguidas
// de una fila en blanco.
export function downloadCsv(
  headers: string[],
  rows: Array<Array<string | number>>,
  filename: string,
  title?: string[],
) {
  // Previene CSV/Formula Injection (OWASP): si una celda con datos ingresados
  // por guardias/operadores (nombre, ubicación, reportante...) empieza con
  // =, +, -, @ o un tab, Excel/Sheets la interpreta como fórmula al abrir el
  // archivo. Se neutraliza con un apóstrofe líder, igual que hace Excel al
  // pegar como texto — el valor se sigue viendo igual, solo deja de evaluarse.
  const FORMULA_TRIGGER = /^[=+\-@\t]/;
  const escape = (value: string | number) => {
    let text = String(value);
    if (FORMULA_TRIGGER.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const titleLines = title && title.length > 0 ? [...title.map((line) => [line]), []] : [];
  const lines = [...titleLines, headers, ...rows].map((row) => row.map(escape).join(','));
  const csv = lines.join('\n');

  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
