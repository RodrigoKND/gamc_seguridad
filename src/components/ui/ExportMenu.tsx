'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, FileSpreadsheet, FileText } from 'lucide-react';
import { Button } from './Button';

// Botón "Exportar" único con menú desplegable (Excel / PDF) — mismo patrón
// que la campana de alertas del Topbar (panel absoluto bajo el botón,
// cierra al hacer clic afuera). Compartido entre Reportes y Historial
// (MASTER.md sección 6: 2+ módulos -> components/ui/, nunca duplicar).

export interface ExportMenuProps {
  onExportExcel: () => void;
  onExportPDF: () => void;
  disabled?: boolean;
}

export function ExportMenu({ onExportExcel, onExportPDF, disabled }: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className="relative">
      <Button
        type="button"
        variant="secondary"
        onClick={() => setIsOpen((open) => !open)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        Exportar
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </Button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Formato de exportación"
          className="absolute right-0 top-full z-20 mt-2 w-44 animate-fade-in rounded-xl border border-neutral-border bg-white p-1.5 shadow-md"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              onExportExcel();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-neutral-text transition-colors duration-200 hover:bg-neutral-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-600 focus-visible:ring-offset-2"
          >
            <FileSpreadsheet className="h-4 w-4 text-risk-low" aria-hidden="true" />
            Excel
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              onExportPDF();
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-neutral-text transition-colors duration-200 hover:bg-neutral-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-600 focus-visible:ring-offset-2"
          >
            <FileText className="h-4 w-4 text-risk-critical" aria-hidden="true" />
            PDF
          </button>
        </div>
      )}
    </div>
  );
}
