'use client';

// Cola mínima de "reporte a imprimir" para la exportación PDF (MASTER.md
// sección 12). exportPDF() escribe aquí el contenido serializado (cabeceras
// + filas de texto plano, sin badges ni componentes), y PrintReport.tsx
// (montado en el shell del dashboard) escucha, renderiza el documento
// sirviéndose de un portal y llama a window.print(). Es un mini store de
// módulo a propósito: el flujo de exportación se dispara desde cualquier
// vista/modal sin pasar props por toda la aplicación.

export interface PrintPayload {
  title: string;
  headings: string[];
  rows: string[][];
}

type Listener = (payload: PrintPayload | null) => void;

let current: PrintPayload | null = null;
const listeners = new Set<Listener>();

export function setPrintPayload(payload: PrintPayload) {
  current = payload;
  for (const listener of listeners) listener(payload);
}

export function clearPrintPayload() {
  current = null;
  for (const listener of listeners) listener(null);
}

export function subscribePrintPayload(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}