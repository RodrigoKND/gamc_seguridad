'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Play, X } from 'lucide-react';
import type { HechoEvidencia } from '../types';

// RF-10 (evidencia de un hecho): antes de esto no había ningún visor —
// `tieneEvidencia` estaba hardcodeado en `false` en el adaptador y nunca
// llegaba nada que mostrar. Soporta foto y video (evidencia_tipo ya lo
// contempla en BD/back, ver Backend/gamc-backend/prisma/schema.prisma) con
// una sola pista deslizable por transform+transition (sin librería nueva).
//
// Rediseño 2026-09-14 (pedido explícito): varias evidencias de distinto
// tipo se unifican en UN solo carrusel — primero todas las fotos, después
// todos los videos (`ordenadas` abajo, sort estable). Bug reportado: al
// ampliar una foto el fondo no se veía difuminado y, ya ampliada, no había
// forma de pasar a la siguiente evidencia — había que cerrar y volver a
// abrir. Reemplazado el <ImageLightbox> genérico (solo imagen suelta, lo
// sigue usando GuardTable para el avatar) por un visor propio que:
//   · difumina el fondo (backdrop-blur),
//   · navega con flechas/teclado sin cerrarse — funciona para foto Y video,
//   · anima la entrada y el cambio de evidencia.

export interface EvidenceCarouselProps {
  evidencias: HechoEvidencia[];
}

function EvidenceLightbox({
  items,
  index,
  onClose,
  onNavigate,
}: {
  items: HechoEvidencia[];
  index: number | null;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  const isOpen = index !== null;
  const actual = isOpen ? items[index] : null;
  const hasPrev = isOpen && index > 0;
  const hasNext = isOpen && index < items.length - 1;

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft' && hasPrev) onNavigate(index - 1);
      if (event.key === 'ArrowRight' && hasNext) onNavigate(index + 1);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- se re-suscribe solo cuando cambia qué evidencia está abierta, no en cada render del padre.
  }, [isOpen, index, hasPrev, hasNext]);

  if (!isOpen || !actual) return null;

  return (
    <div
      className="fixed inset-0 z-[2100] flex animate-fade-in items-center justify-center bg-black/70 p-6 backdrop-blur-md"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Evidencia ${index + 1} de ${items.length}`}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute right-5 top-5 rounded-full bg-white/10 p-2 text-white transition-colors duration-200 hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>

      {hasPrev && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(index - 1);
          }}
          aria-label="Evidencia anterior"
          className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white transition-colors duration-200 hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <ChevronLeft className="h-6 w-6" aria-hidden="true" />
        </button>
      )}
      {hasNext && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(index + 1);
          }}
          aria-label="Evidencia siguiente"
          className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white transition-colors duration-200 hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <ChevronRight className="h-6 w-6" aria-hidden="true" />
        </button>
      )}

      <div key={actual.id} className="flex max-h-full max-w-full animate-scale-in flex-col items-center gap-3">
        {actual.tipo === 'video' ? (
          <video
            src={actual.url}
            controls
            autoPlay
            className="max-h-[80vh] max-w-full rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- foto remota del backend, no un asset local optimizable
          <img
            src={actual.url}
            alt="Evidencia ampliada"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[80vh] max-w-full rounded-lg object-contain shadow-2xl"
          />
        )}
        <p className="text-xs font-medium text-white/80">
          {index + 1} de {items.length} · {actual.tipo === 'video' ? 'Video' : 'Foto'}
        </p>
      </div>
    </div>
  );
}

export function EvidenceCarousel({ evidencias }: EvidenceCarouselProps) {
  // Primero las fotos, después los videos (pedido explícito) — sort estable,
  // conserva el orden relativo dentro de cada grupo (ej. el orden en que se
  // subieron desde el celular).
  const ordenadas = useMemo(
    () => [...evidencias].sort((a, b) => Number(a.tipo === 'video') - Number(b.tipo === 'video')),
    [evidencias],
  );
  const [indice, setIndice] = useState(0);
  const [expandidoIndice, setExpandidoIndice] = useState<number | null>(null);

  if (ordenadas.length === 0) return null;

  const irA = (i: number) => setIndice(Math.max(0, Math.min(ordenadas.length - 1, i)));

  function expandir(i: number) {
    setExpandidoIndice(i);
    setIndice(i);
  }

  function navegarExpandido(i: number) {
    setExpandidoIndice(i);
    setIndice(i);
  }

  return (
    <div>
      <EvidenceLightbox items={ordenadas} index={expandidoIndice} onClose={() => setExpandidoIndice(null)} onNavigate={navegarExpandido} />

      <div className="relative overflow-hidden rounded-lg border border-neutral-border bg-neutral-bg">
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${indice * 100}%)` }}
        >
          {ordenadas.map((item, i) => (
            <div key={item.id} className="relative w-full shrink-0">
              {item.tipo === 'video' ? (
                <>
                  <video
                    src={item.url}
                    controls
                    className="aspect-video w-full bg-black object-contain"
                    preload="metadata"
                  />
                  <button
                    type="button"
                    onClick={() => expandir(i)}
                    aria-label="Ampliar video de evidencia"
                    className="absolute right-2 top-2 rounded-md bg-black/60 p-1.5 text-white transition-colors duration-200 hover:bg-black/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => expandir(i)}
                  className="block aspect-video w-full cursor-zoom-in"
                  aria-label="Ampliar foto de evidencia"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- foto remota del backend */}
                  <img src={item.url} alt="Evidencia del hecho" className="h-full w-full object-cover" />
                </button>
              )}
            </div>
          ))}
        </div>

        {ordenadas.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => irA(indice - 1)}
              disabled={indice === 0}
              aria-label="Evidencia anterior"
              className="absolute left-1.5 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 text-neutral-text shadow-sm transition-opacity duration-200 hover:bg-white disabled:pointer-events-none disabled:opacity-0"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => irA(indice + 1)}
              disabled={indice === ordenadas.length - 1}
              aria-label="Evidencia siguiente"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 text-neutral-text shadow-sm transition-opacity duration-200 hover:bg-white disabled:pointer-events-none disabled:opacity-0"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>

            <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
              {ordenadas.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => irA(i)}
                  aria-label={`Ir a evidencia ${i + 1}`}
                  aria-current={i === indice}
                  className={[
                    'h-1.5 rounded-full transition-all duration-300',
                    i === indice ? 'w-4 bg-white' : 'w-1.5 bg-white/60',
                  ].join(' ')}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <p className="mt-1.5 flex items-center gap-1 text-xs text-neutral-text-muted">
        {ordenadas[indice]?.tipo === 'video' && <Play className="h-3 w-3" aria-hidden="true" />}
        {indice + 1} de {ordenadas.length} · {ordenadas[indice]?.tipo === 'video' ? 'Video' : 'Foto'}
      </p>
    </div>
  );
}
