'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

// Modal centrado compartido — registro/catálogo de guardias, y cualquier
// otro flujo modal futuro (MASTER.md sección 6: 2+ módulos -> components/ui/,
// nunca duplicar). Entrada scale+fade desde el centro (motion-modal: los
// modales/sheets deben animarse desde su origen), duration-200,
// respeta prefers-reduced-motion vía globals.css. `accent="gold"` es opt-in
// para pantallas ya migradas a la paleta 2026 (Generar Credenciales,
// MASTER.md sección 4) — no cambia el comportamiento de los demás
// consumidores (Módulo de Mapas, Guardias).

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  widthClassName?: string;
  accent?: 'blue' | 'gold';
  /** Cuando false, el modal NO se cierra con click afuera ni con Escape
   *  (y se oculta la X). Útil para contenido que no debe perderse por
   *  accidente, p.ej. credenciales recién generadas. Solo cierra onClose(). */
  dismissible?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  widthClassName = 'max-w-[480px]',
  accent = 'blue',
  dismissible = true,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Bug real encontrado en pruebas locales 2026-09-14 (síntoma: "solo deja
  // escribir una letra" en cualquier input dentro de un modal — reportado
  // antes para AssignRouteWizard y "arreglado" ahí con React.memo, pero esa
  // no era la causa real). El foco inicial y el listener de Escape estaban
  // en el MISMO efecto, con `onClose` en las dependencias — como `onClose`
  // casi siempre es una función inline nueva en cada render del padre
  // (ej. `onClose={() => setOpen(false)}`, o un wrapper como
  // `handleClose` redefinido en cada render), el efecto entero se
  // re-ejecutaba en CADA tecleo de cualquier input adentro, y
  // `panelRef.current?.focus()` le robaba el foco al input activo después
  // de la primera letra. Separado en dos efectos: el foco inicial corre
  // SOLO al abrir (depende únicamente de `isOpen`); el listener de Escape
  // puede seguir re-suscribiéndose sin efecto secundario (no mueve el foco).
  useEffect(() => {
    if (!isOpen) return;
    panelRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissible) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose, dismissible]);

  function handleDismiss() {
    if (dismissible) onClose();
  }

  if (!isOpen) return null;

  const isGold = accent === 'gold';

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4">
      <div
        onClick={handleDismiss}
        aria-hidden="true"
        className={[
          'absolute inset-0 animate-fade-in backdrop-blur-[2px]',
          isGold ? 'bg-brand-ink-900/55' : 'bg-brand-navy-950/50',
        ].join(' ')}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={[
          'relative max-h-[88vh] w-full overflow-y-auto bg-white shadow-lg',
          isGold ? 'rounded-2xl' : 'rounded-xl',
          'animate-scale-in outline-none',
          widthClassName,
        ].join(' ')}
      >
        <div className="flex items-center border-b border-neutral-border px-5 py-4">
          <p className={['flex-1 text-base font-semibold', isGold ? 'text-brand-ink-900' : 'text-brand-navy-950'].join(' ')}>{title}</p>
          {dismissible && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className={[
                'rounded-md p-1 text-neutral-text-muted transition-colors duration-200 hover:bg-neutral-bg hover:text-neutral-text',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                isGold ? 'focus-visible:ring-brand-gold-600' : 'focus-visible:ring-brand-blue-600',
              ].join(' ')}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
