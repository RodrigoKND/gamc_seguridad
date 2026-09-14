'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { clearPrintPayload, subscribePrintPayload, type PrintPayload } from '@/lib/print-store';

// Documento imprimible de exportación (MASTER.md sección 12).
//
// Montado una sola vez en el shell del dashboard. Cuando exportPDF() publica
// un payload en el store, renderiza (vía portal, fuera del shell que queda
// oculto con print:hidden) un documento HTML semántico con dos partes:
//   1. Portada: hoja completa en negro #0A0A0B, logo al medio y la leyenda
//      "Reporte — fecha — GAMC SEGURIDAD CIUDADANA".
//   2. Contenido: membrete institucional y la tabla de datos real (nada de
//      capturas de pantalla), con encabezados que se repiten por página.
// La impresión usa estilos CSS dedicados (ver @media print en globals.css).

function todayEsBo(): string {
  return new Date().toLocaleDateString('es-BO');
}

function PrintCover() {
  return (
    <section className="pr-cover" aria-label="Portada del reporte">
      <img src="/logo-gamc.png" alt="GAMC Seguridad Ciudadana" className="pr-cover-logo" />
      <p className="pr-cover-line">Reporte — {todayEsBo()}</p>
      <p className="pr-cover-institucion">GAMC SEGURIDAD CIUDADANA</p>
    </section>
  );
}

function PrintContent({ payload }: { payload: PrintPayload }) {
  return (
    <section className="pr-contenido" aria-label="Contenido del reporte">
      <header className="pr-membrete">
        <div>
          <p className="pr-membrete-institucion">GAMC SEGURIDAD CIUDADANA</p>
          <h1>{payload.title}</h1>
          <p>
            Fecha de emisión: {todayEsBo()} · {payload.rows.length} registro(s)
          </p>
        </div>
        <img src="/logo-gamc.png" alt="GAMC" className="pr-membrete-logo" />
      </header>

      <table className="pr-tabla">
        <thead>
          <tr>
            {payload.headings.map((heading) => (
              <th key={heading} scope="col">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {payload.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <footer className="pr-pie">
        <p>
          Documento generado por el sistema GAMC — Dirección de Seguridad Ciudadana del Gobierno
          Autónomo Municipal de Cochabamba.
        </p>
      </footer>
    </section>
  );
}

export function PrintReport() {
  const [payload, setPayload] = useState<PrintPayload | null>(null);

  useEffect(() => subscribePrintPayload(setPayload), []);

  useEffect(() => {
    if (!payload) return;
    // Da un frame para que el portal exista en el DOM antes de pedir el diálogo.
    const frame = requestAnimationFrame(() => window.print());
    return () => cancelAnimationFrame(frame);
  }, [payload]);

  useEffect(() => {
    if (!payload) return;
    function onAfterPrint() {
      clearPrintPayload();
    }
    window.addEventListener('afterprint', onAfterPrint);
    return () => window.removeEventListener('afterprint', onAfterPrint);
  }, [payload]);

  if (!payload) return null;

  return createPortal(
    <>
      <PrintCover />
      <PrintContent payload={payload} />
    </>,
    document.body,
  );
}
