'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from 'lucide-react';
import { Button } from './Button';

// Ventana flotante centrada para avisos, advertencias y confirmaciones
// (pedido del usuario: "una ventana flotante típica que saldrá en el medio
// para mandarnos alertas, advertencias, etc. para poder reutilizar este
// elemento"). Se usa en lugar de cargar los formularios con recuadros de
// aviso: el formulario queda limpio y lo importante salta al frente.
//
// Uso:
//   const dialogo = useDialog();
//   if (await dialogo.confirmar({ tono: 'advertencia', titulo: '¿Seguro?' })) …
//   await dialogo.avisar({ tono: 'exito', titulo: 'Listo' });
//   const r = await dialogo.elegir({ titulo: '…', textoAlternativo: 'Manual', textoConfirmar: 'Continuar' });
//   // r: 'confirmar' | 'alternativo' | 'cancelar'
//
// Se apila por encima de <Modal> (z-[6000] > z-[5000]) y atrapa Escape para
// que no cierre también el modal de abajo.

export type DialogTono = 'info' | 'exito' | 'advertencia' | 'peligro';

export interface DialogDetalle {
  titulo: string;
  texto?: string;
  tono?: DialogTono;
}

export interface DialogOpciones {
  tono?: DialogTono;
  titulo: string;
  mensaje?: ReactNode;
  /** Lista breve bajo el mensaje (ej. cada guardia y su motivo). */
  detalles?: DialogDetalle[];
  /** Encabezado opcional de la lista de detalles. */
  detallesTitulo?: string;
  /** Texto del botón principal. Por defecto "Aceptar" (confirmar) o "Entendido" (aviso). */
  textoConfirmar?: string;
  /** Texto del botón secundario. Por defecto "Cancelar". Solo en confirmar(). */
  textoCancelar?: string;
  /** Pinta el botón principal en rojo (acciones que quitan o cancelan algo). */
  destructivo?: boolean;
  /** Tercer botón (entre Cancelar y el principal). Solo en elegir(). */
  textoAlternativo?: string;
}

export type Eleccion = 'confirmar' | 'alternativo' | 'cancelar';

interface Pendiente extends DialogOpciones {
  id: number;
  conCancelar: boolean;
  resolver: (r: Eleccion) => void;
}

const TONO: Record<DialogTono, { icono: typeof Info; fondo: string; color: string; punto: string }> = {
  info: { icono: Info, fondo: 'bg-accent-100', color: 'text-accent-700', punto: 'bg-accent-600' },
  exito: { icono: CheckCircle2, fondo: 'bg-risk-low/10', color: 'text-risk-low', punto: 'bg-risk-low' },
  advertencia: { icono: AlertTriangle, fondo: 'bg-risk-medium/15', color: 'text-[#B45309]', punto: 'bg-risk-medium' },
  peligro: { icono: OctagonAlert, fondo: 'bg-risk-critical/10', color: 'text-risk-critical', punto: 'bg-risk-critical' },
};

export interface AlertDialogProps extends DialogOpciones {
  abierto: boolean;
  /** Si es false, solo hay un botón (aviso). */
  conCancelar?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
  onAlternativo?: () => void;
}

export function AlertDialog({
  abierto,
  tono = 'info',
  titulo,
  mensaje,
  detalles,
  detallesTitulo,
  textoConfirmar,
  textoCancelar = 'Cancelar',
  destructivo = false,
  conCancelar = true,
  textoAlternativo,
  onConfirmar,
  onCancelar,
  onAlternativo,
}: AlertDialogProps) {
  const principalRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (abierto) principalRef.current?.focus();
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    // Fase de captura en window: llega antes que el listener de <Modal> en
    // document, y al detenerlo, Escape solo cierra esta ventana.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      if (conCancelar) onCancelar();
      else onConfirmar();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [abierto, conCancelar, onCancelar, onConfirmar]);

  if (!abierto) return null;
  const estilo = TONO[tono];
  const Icono = estilo.icono;

  return (
    <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4">
      <div aria-hidden="true" onClick={conCancelar ? onCancelar : undefined} className="absolute inset-0 animate-fade-in bg-primary-950/45 backdrop-blur-[1px]" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialogo-titulo"
        className="relative w-full max-w-[420px] animate-scale-in rounded-2xl bg-white p-5 shadow-xl"
      >
        <div className="flex items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${estilo.fondo}`}>
            <Icono className={`h-5 w-5 ${estilo.color}`} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <p id="dialogo-titulo" className="text-[15px] font-semibold text-primary-900">
              {titulo}
            </p>
            {mensaje && <div className="mt-1 text-[12.5px] leading-relaxed text-neutral-text">{mensaje}</div>}
          </div>
        </div>

        {detalles && detalles.length > 0 && (
          <div className="mt-3.5">
            {detallesTitulo && <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-text-muted">{detallesTitulo}</p>}
            <ul className="scrollbar-hidden max-h-[220px] space-y-1.5 overflow-y-auto rounded-lg border border-neutral-border bg-neutral-bg/60 p-2.5">
              {detalles.map((d, i) => (
                <li key={`${d.titulo}-${i}`} className="flex items-start gap-2 text-[12px]">
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${TONO[d.tono ?? tono].punto}`} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="font-semibold text-neutral-text">{d.titulo}</span>
                    {d.texto && <span className="text-neutral-text-muted"> — {d.texto}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5 flex gap-2.5">
          {conCancelar && (
            <Button type="button" variant="secondary" onClick={onCancelar} className="flex-1">
              {textoCancelar}
            </Button>
          )}
          {textoAlternativo && onAlternativo && (
            <Button type="button" variant="secondary" onClick={onAlternativo} className="flex-1">
              {textoAlternativo}
            </Button>
          )}
          <Button ref={principalRef} type="button" variant={destructivo ? 'destructive' : 'brand'} onClick={onConfirmar} className="flex-1">
            {textoConfirmar ?? (conCancelar ? 'Aceptar' : 'Entendido')}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface DialogApi {
  /** Pregunta y resuelve true si el usuario acepta. */
  confirmar: (opciones: DialogOpciones) => Promise<boolean>;
  /** Informa y resuelve cuando el usuario lo cierra. */
  avisar: (opciones: DialogOpciones) => Promise<void>;
  /** Tres salidas: el botón principal, el alternativo (`textoAlternativo`) o cancelar. */
  elegir: (opciones: DialogOpciones & { textoAlternativo: string }) => Promise<Eleccion>;
}

const DialogContext = createContext<DialogApi | null>(null);

/** Monta una sola ventana flotante para toda la sesión; las peticiones se encolan. */
export function DialogProvider({ children }: { children: ReactNode }) {
  const [cola, setCola] = useState<Pendiente[]>([]);
  const actual = cola[0] ?? null;
  const siguienteId = useRef(0);

  const encolar = useCallback((opciones: DialogOpciones, conCancelar: boolean) => {
    return new Promise<Eleccion>((resolver) => {
      siguienteId.current += 1;
      const id = siguienteId.current;
      setCola((prev) => [...prev, { ...opciones, id, conCancelar, resolver }]);
    });
  }, []);

  const api = useRef<DialogApi>({
    confirmar: (o) => encolar({ ...o, textoAlternativo: undefined }, true).then((r) => r === 'confirmar'),
    avisar: (o) => encolar({ ...o, textoAlternativo: undefined }, false).then(() => undefined),
    elegir: (o) => encolar(o, true),
  });

  const cerrar = useCallback(
    (r: Eleccion) => {
      if (!actual) return;
      actual.resolver(r);
      setCola((prev) => prev.slice(1));
    },
    [actual],
  );
  const onConfirmar = useCallback(() => cerrar('confirmar'), [cerrar]);
  const onCancelar = useCallback(() => cerrar('cancelar'), [cerrar]);
  const onAlternativo = useCallback(() => cerrar('alternativo'), [cerrar]);

  return (
    <DialogContext.Provider value={api.current}>
      {children}
      {actual && (
        <AlertDialog
          key={actual.id}
          abierto
          tono={actual.tono}
          titulo={actual.titulo}
          mensaje={actual.mensaje}
          detalles={actual.detalles}
          detallesTitulo={actual.detallesTitulo}
          textoConfirmar={actual.textoConfirmar}
          textoCancelar={actual.textoCancelar}
          destructivo={actual.destructivo}
          conCancelar={actual.conCancelar}
          textoAlternativo={actual.textoAlternativo}
          onConfirmar={onConfirmar}
          onCancelar={onCancelar}
          onAlternativo={onAlternativo}
        />
      )}
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog debe usarse dentro de <DialogProvider>.');
  return ctx;
}
