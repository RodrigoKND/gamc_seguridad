'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

// Visor de imagen a pantalla completa — click en una foto (avatar de
// guardia, evidencia de un hecho) la expande sin el chrome de un Modal
// normal (sin título, fondo casi opaco). components/ui/ porque ya lo usan
// 2+ módulos (Guardias, Hechos/Reportes — MASTER.md sección 6).

export interface ImageLightboxProps {
  src: string | null;
  alt: string;
  onClose: () => void;
}

export function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  useEffect(() => {
    if (!src) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [src, onClose]);

  if (!src) return null;

  return (
    <div
      className="fixed inset-0 z-[2100] flex animate-fade-in items-center justify-center bg-black/70 p-6 backdrop-blur-md"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute right-5 top-5 rounded-full bg-white/10 p-2 text-white transition-colors duration-200 hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element -- foto remota del backend, no un asset local optimizable */}
      <img
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
      />
    </div>
  );
}
