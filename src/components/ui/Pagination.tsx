'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

// Paginación client-side compartida (Guardias, Reportes/Hechos, Historial)
// — pedido explícito 2026-09-19: las tablas mostraban TODOS los registros
// de una sola vez, sin páginas, lo que hacía sentir el sistema lento con
// listas grandes. Pagina sobre el array ya filtrado en memoria; no cambia
// cuántos datos trae el fetch (eso es un problema de backend aparte).

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-border px-1 py-3 text-[12.5px] text-neutral-text-muted">
      <span>
        {from}–{to} de {total}
      </span>
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="secondary"
          className="!px-2.5 !py-1.5"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <span className="px-1 font-medium text-neutral-text">
          {page} / {totalPages}
        </span>
        <Button
          type="button"
          variant="secondary"
          className="!px-2.5 !py-1.5"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Página siguiente"
        >
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
