'use client';

import { useEpiCatalogo } from './EpiCatalogProvider';
import type { EpiZone } from '@/types/epi';

// Etiquetas de EPI desde el catálogo dinámico. Componentes (no funciones)
// para poder usarlas también dentro de tablas/vistas que no son cliente.

/** "EPI Norte" (o "Norte" con `corto`). Código desconocido → el código; null → "Sin EPI". */
export function EpiNombre({ codigo, corto = false }: { codigo: EpiZone | null | undefined; corto?: boolean }) {
  const { nombre, nombreCorto } = useEpiCatalogo();
  return <>{corto ? nombreCorto(codigo) : nombre(codigo)}</>;
}

/** Punto de color de la EPI (el nombre siempre va al lado: el color nunca es la única pista). */
export function EpiPunto({ codigo, className = 'h-2 w-2' }: { codigo: EpiZone | null | undefined; className?: string }) {
  const { color } = useEpiCatalogo();
  return <span aria-hidden className={`${className} shrink-0 rounded-full`} style={{ backgroundColor: color(codigo) }} />;
}

/**
 * <option>s del catálogo para un <select>. `soloOperativas` para altas
 * (usuarios, guardias, rutas); sin él, también las históricas (filtros).
 * `incluir` mantiene visible el valor actual aunque ya no sea operativo.
 */
export function EpiOpciones({ soloOperativas = false, incluir }: { soloOperativas?: boolean; incluir?: EpiZone | null }) {
  const { epis } = useEpiCatalogo();
  const lista = epis.filter((e) => !soloOperativas || e.operativa || e.codigo === incluir);
  return (
    <>
      {lista.map((e) => (
        <option key={e.codigo} value={e.codigo}>
          {e.nombre}
          {e.operativa ? '' : ' (histórica)'}
        </option>
      ))}
    </>
  );
}
