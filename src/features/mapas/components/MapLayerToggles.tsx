'use client';

import type { LucideIcon } from 'lucide-react';
import { Building2, Flag, Footprints, Map as MapIcon, Route, Shield } from 'lucide-react';

// Interruptores de capas FUERA del mapa, en una barra encima (16/10). Antes
// eran casillas dentro de la leyenda: chicas, mezcladas con los colores y
// tapando el mapa. Arriba porque es donde se buscan los filtros (convención
// de Google Maps y de los tableros de flotas), queda a la vista sin tapar
// nada y deja libre la esquina inferior para la leyenda y la atribución.
// Cada chip es un interruptor accesible (role="switch") con animación corta.

export type CapaId = 'territorios' | 'sedes' | 'rutas' | 'trayectos' | 'puntos' | 'modulos';
export type CapasVisibles = Record<CapaId, boolean>;

export const CAPAS_POR_DEFECTO: CapasVisibles = {
  territorios: true,
  sedes: true,
  rutas: true,
  trayectos: true,
  puntos: true,
  modulos: false,
};

const CAPAS: { id: CapaId; etiqueta: string; detalle: string; icono: LucideIcon }[] = [
  { id: 'territorios', etiqueta: 'Territorios', detalle: 'Límites de cada EPI', icono: MapIcon },
  { id: 'sedes', etiqueta: 'Sedes', detalle: 'Sede de cada EPI', icono: Building2 },
  { id: 'rutas', etiqueta: 'Rutas', detalle: 'Rutas activas (trazados asignados)', icono: Route },
  { id: 'trayectos', etiqueta: 'Incorporación', detalle: 'Camino más rápido y tiempo de llegada', icono: Footprints },
  { id: 'puntos', etiqueta: 'Puntos fijos', detalle: 'Ocupados / capacidad', icono: Flag },
  { id: 'modulos', etiqueta: 'Módulos', detalle: 'Módulos policiales (se ven desde el zoom de barrio)', icono: Shield },
];

export interface MapLayerTogglesProps {
  valores: CapasVisibles;
  onCambiar: (id: CapaId, valor: boolean) => void;
  /** Capas que aplican a la vista actual (p. ej. el mapa de calor no tiene rutas). */
  disponibles: CapaId[];
  /** Conteos opcionales que se muestran en el chip. */
  conteos?: Partial<Record<CapaId, number>>;
}

export function MapLayerToggles({ valores, onCambiar, disponibles, conteos = {} }: MapLayerTogglesProps) {
  const visibles = CAPAS.filter((c) => disponibles.includes(c.id));
  if (visibles.length === 0) return null;
  return (
    // Una sola fila: si no entra (pantallas angostas) se desliza de lado en vez de quitarle alto al mapa.
    <div role="group" aria-label="Capas del mapa" className="flex items-center gap-1.5 overflow-x-auto px-0.5 py-1 [scrollbar-width:thin]">
      {visibles.map(({ id, etiqueta, detalle, icono: Icono }) => {
        const on = valores[id];
        const conteo = conteos[id];
        return (
          <button
            key={id}
            type="button"
            role="switch"
            aria-checked={on}
            title={detalle}
            onClick={() => onCambiar(id, !on)}
            className={[
              'group inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border py-1 pl-2.5 pr-1.5 text-[12px] font-medium',
              'transition-all duration-200 ease-out active:scale-95 motion-reduce:transition-none',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 focus-visible:ring-offset-1',
              on
                ? 'border-primary-300 bg-primary-50 text-primary-800 shadow-sm'
                : 'border-neutral-border bg-white text-neutral-text-muted hover:border-primary-200 hover:text-neutral-text',
            ].join(' ')}
          >
            <Icono className={['h-3.5 w-3.5 transition-transform duration-200', on ? 'scale-110' : 'scale-100 opacity-70'].join(' ')} aria-hidden="true" />
            {etiqueta}
            {conteo != null && (
              <span
                className={[
                  'min-w-[18px] rounded-full px-1 text-center text-[10.5px] font-bold transition-colors duration-200',
                  on ? 'bg-primary-700 text-white' : 'bg-neutral-bg text-neutral-text-muted',
                ].join(' ')}
              >
                {conteo}
              </span>
            )}
            {/* Mini interruptor: riel de 28×16 con 2 px de margen interno y
                perilla de 12 px que se desliza 12 px (24 px útiles): la perilla
                queda siempre DENTRO del riel. Flex, no posición absoluta. */}
            <span
              aria-hidden="true"
              className={[
                'flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 motion-reduce:transition-none',
                on ? 'bg-primary-700' : 'bg-neutral-border',
              ].join(' ')}
            >
              <span
                className={[
                  'h-3 w-3 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform duration-200 ease-out motion-reduce:transition-none',
                  on ? 'translate-x-3' : 'translate-x-0',
                ].join(' ')}
              />
            </span>
          </button>
        );
      })}
    </div>
  );
}
