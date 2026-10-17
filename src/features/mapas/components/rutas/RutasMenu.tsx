'use client';

import { useEffect, useRef, useState } from 'react';
import { BookMarked, CalendarClock, ChevronDown, Flag, MapPinned, Route, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';

// Botón "Rutas" del Módulo de Mapas (antes "Asignar Ruta"): agrupa las
// tareas de rutas en un menú, en vez de meter todas las configuraciones
// dentro del asistente de asignación. F5 suma "Programar Rutas" (y la
// antigua "Rutas Predeterminadas" pasa a llamarse "Crear Ruta").

export type OpcionRutas = 'predeterminadas' | 'asignar' | 'guardadas' | 'puntos' | 'programadas';

const OPCIONES: { id: OpcionRutas; titulo: string; detalle: string; icono: typeof Route }[] = [
  { id: 'predeterminadas', titulo: 'Crear Ruta', detalle: 'Rutas oficiales reutilizables', icono: MapPinned },
  { id: 'asignar', titulo: 'Asignar Ruta', detalle: 'Por modalidad o con una ruta guardada', icono: Users },
  { id: 'guardadas', titulo: 'Rutas Guardadas', detalle: 'Ver, editar, asignar y archivar', icono: BookMarked },
  { id: 'puntos', titulo: 'Puntos Fijos', detalle: 'Catálogo, subpuntos y capacidad', icono: Flag },
  { id: 'programadas', titulo: 'Programar Rutas', detalle: 'Horarios, agenda y tareas por asignar', icono: CalendarClock },
];

export interface RutasMenuProps {
  /** Opciones visibles según los permisos del rol. */
  disponibles: OpcionRutas[];
  disabled?: boolean;
  cargando?: boolean;
  title?: string;
  onElegir: (opcion: OpcionRutas) => void;
}

export function RutasMenu({ disponibles, disabled = false, cargando = false, title, onElegir }: RutasMenuProps) {
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  return (
    <div ref={raiz} className="relative ml-auto">
      <Button variant="secondary" onClick={() => setAbierto((v) => !v)} disabled={disabled} title={title} aria-haspopup="menu" aria-expanded={abierto}>
        <Route className="h-3.5 w-3.5" aria-hidden="true" />
        {cargando ? 'Cargando EPI…' : 'Rutas'}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${abierto ? 'rotate-180' : ''}`} aria-hidden="true" />
      </Button>
      {abierto && (
        <div role="menu" className="absolute right-0 top-full z-[1200] mt-1.5 w-[280px] origin-top-right animate-dropdown-in overflow-hidden rounded-xl border border-neutral-border bg-white p-1 shadow-lg">
          {OPCIONES.filter((o) => disponibles.includes(o.id)).map((o) => {
            const Icono = o.icono;
            return (
              <button
                key={o.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  setAbierto(false);
                  onElegir(o.id);
                }}
                className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-neutral-bg focus:outline-none focus-visible:bg-neutral-bg"
              >
                <span className="icon-badge mt-0.5 h-8 w-8 shrink-0">
                  <Icono className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-primary-900">{o.titulo}</span>
                  <span className="block text-[11.5px] text-neutral-text-muted">{o.detalle}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
