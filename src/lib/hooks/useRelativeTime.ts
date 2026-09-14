'use client';

// Recalcula un texto tipo "hace 5s" en el CLIENTE a partir de un timestamp
// ISO crudo, refrescando cada segundo — antes el string ("hace 5s") se
// calculaba una sola vez en el servidor y quedaba congelado en el HTML
// hasta el próximo fetch/evento de socket, dando la sensación de un banner
// "solo visual" que nunca avanzaba.

import { useEffect, useState } from 'react';

function formatRelative(iso: string): string {
  const diffSeconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSeconds < 60) return `hace ${diffSeconds}s`;
  const minutes = Math.round(diffSeconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `hace ${hours} h`;
}

/** @param iso Timestamp ISO 8601. @param fallback Texto a mostrar antes del primer tick en cliente (evita mismatch de hidratación). */
export function useRelativeTime(iso: string, fallback: string): string {
  const [text, setText] = useState(fallback);

  useEffect(() => {
    setText(formatRelative(iso));
    const id = setInterval(() => setText(formatRelative(iso)), 1000);
    return () => clearInterval(id);
  }, [iso]);

  return text;
}
