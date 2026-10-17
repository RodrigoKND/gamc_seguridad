'use client';

import { useEffect, useState } from 'react';
import { ChevronUp, ListTree } from 'lucide-react';
import type { Jurisdiccion } from '../lib/jurisdiccion';
import { CENTRO_RELLENO, colorEpiValido } from './EpiJurisdictionLayer';

// Leyenda DESPLEGABLE (16/10), separada de los interruptores de capas (que
// ahora están en la barra de arriba, MapLayerToggles). Plegada es un botón
// chico en la esquina; desplegada explica colores y símbolos. Textos cortos,
// sin aclaraciones entre paréntesis (pedido del usuario 16/10). Se recuerda
// abierta/cerrada por navegador (comodidad, no dato crítico).

const CLAVE = 'gamc_mapa_leyenda_abierta';

export interface MapLegendProps {
  jurisdiccion: Jurisdiccion | null;
  /** Mapa en vivo: agrega los símbolos de guardias, rutas y puntos. */
  conSimbolosPatrullaje?: boolean;
}

function Simbolo({ children, texto }: { children: React.ReactNode; texto: string }) {
  return (
    <li className="flex items-center gap-2 text-neutral-text-muted">
      <span className="flex h-4 w-6 shrink-0 items-center justify-center" aria-hidden="true">
        {children}
      </span>
      {texto}
    </li>
  );
}

export function MapLegend({ jurisdiccion, conSimbolosPatrullaje = false }: MapLegendProps) {
  const [abierta, setAbierta] = useState(false);
  useEffect(() => {
    try {
      setAbierta(localStorage.getItem(CLAVE) === '1');
    } catch {
      /* sin almacenamiento: queda plegada */
    }
  }, []);
  function cambiar(v: boolean) {
    setAbierta(v);
    try {
      localStorage.setItem(CLAVE, v ? '1' : '0');
    } catch {
      /* ignorar */
    }
  }

  const epis = jurisdiccion ? [...jurisdiccion.epis].filter((e) => e.poligono).sort((a, b) => (a.numero ?? 99) - (b.numero ?? 99)) : [];

  return (
    <div className="absolute bottom-3 left-3 z-[500] flex max-w-[260px] flex-col items-start">
      <div
        id="leyenda-mapa"
        className={[
          'grid w-full transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none',
          abierta ? 'mb-1.5 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        ].join(' ')}
        aria-hidden={!abierta}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="max-h-[55vh] overflow-y-auto rounded-lg border border-neutral-border bg-white/95 px-3 py-2.5 text-[11px] shadow-lg backdrop-blur-sm">
            {epis.length > 0 && (
              <section>
                <p className="mb-1 font-semibold text-neutral-text">Jurisdicciones EPI</p>
                <ul className="flex flex-col gap-0.5">
                  {epis.map((e) => (
                    <li key={e.zone} className="flex items-center gap-1.5 text-neutral-text-muted">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: colorEpiValido(e.color) }} />
                      {e.numero ? `${e.numero}. ` : ''}
                      {e.nombre}
                    </li>
                  ))}
                  <li className="flex items-center gap-1.5 text-neutral-text-muted">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: CENTRO_RELLENO }} />
                    Centro – Plaza 14 de Septiembre
                  </li>
                </ul>
                <p className="mt-1 text-neutral-text-muted">Límites aproximados; pendientes de validación territorial.</p>
              </section>
            )}

            {conSimbolosPatrullaje && (
              <section className="mt-2 border-t border-neutral-border pt-2">
                <p className="mb-1 font-semibold text-neutral-text">Símbolos</p>
                <ul className="flex flex-col gap-1">
                  <Simbolo texto="Guardia">
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-white bg-primary-700 shadow" />
                  </Simbolo>
                  <Simbolo texto="Grupo de guardias">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-accent-500 bg-primary-700 text-[8px] font-bold text-white">3</span>
                  </Simbolo>
                  <Simbolo texto="Borde del grupo">
                    <span className="h-3.5 w-3.5 rounded-full border-[3px] border-risk-critical bg-primary-700" />
                  </Simbolo>
                  <Simbolo texto="SOS activo">
                    <span className="h-3.5 w-3.5 rounded-full bg-risk-critical ring-2 ring-white" />
                  </Simbolo>
                  <Simbolo texto="Ruta activa">
                    <span className="h-1 w-6 rounded-full bg-[#2563EB]" />
                  </Simbolo>
                  <Simbolo texto="Camino de incorporación">
                    <span className="h-[3px] w-6 bg-[repeating-linear-gradient(90deg,#DC2626_0_6px,transparent_6px_10px)]" />
                  </Simbolo>
                  <Simbolo texto="Calles por donde pasa la ruta">
                    <span className="h-2.5 w-2.5 rotate-45 bg-[#2563EB]" />
                  </Simbolo>
                  <Simbolo texto="Punto fijo: libre / con lugar / completo">
                    <span className="flex gap-0.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#15803D]" />
                      <span className="h-2.5 w-2.5 rounded-full bg-[#B45309]" />
                      <span className="h-2.5 w-2.5 rounded-full bg-[#B91C1C]" />
                    </span>
                  </Simbolo>
                  <Simbolo texto="Sede EPI · módulo policial">
                    <span className="flex items-center gap-1">
                      <span className="h-3 w-3 rounded-[3px] bg-primary-700" />
                      <span className="h-2 w-2 rounded-full bg-primary-700 ring-1 ring-white" />
                    </span>
                  </Simbolo>
                </ul>
              </section>
            )}

            {jurisdiccion?.restringido && !jurisdiccion.miEpi && <p className="mt-2 text-risk-critical">Sin EPI asignada: no puedes modificar rutas.</p>}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => cambiar(!abierta)}
        aria-expanded={abierta}
        aria-controls="leyenda-mapa"
        className="inline-flex items-center gap-1.5 rounded-full border border-neutral-border bg-white/95 px-3 py-1.5 text-[11.5px] font-semibold text-neutral-text shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-primary-300 hover:text-primary-800 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
      >
        <ListTree className="h-3.5 w-3.5" aria-hidden="true" />
        Leyenda
        <ChevronUp className={['h-3.5 w-3.5 transition-transform duration-300', abierta ? 'rotate-0' : 'rotate-180'].join(' ')} aria-hidden="true" />
      </button>
    </div>
  );
}
